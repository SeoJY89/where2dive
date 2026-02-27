// 앱 엔트리 포인트
import { spots } from './data.js';
import { initMap, updateMarkers, setMapSpotClickHandler, flyToSpot, invalidateMapSize, updatePersonalMarkers, setPersonalSpotClickHandler, getMapInstance } from './map.js';
import { renderCards, renderFavEmpty, openModal, initModal, setDetailClickHandler, updateFavCount, setPersonalSpotCardHandlers } from './ui.js';
import { initFilters, filterSpots, setFilterListener, refreshFilterLabels, getActivityCounts, filterMySpots } from './filters.js';
import { getFavorites } from './favorites.js';
import { getLang, setLang, setLangChangeListener, t } from './i18n.js';
import { isLoggedIn, login, logout } from './auth.js';
import { getLogEntries, getLogEntry, addLogEntry, updateLogEntry, deleteLogEntry, getLogStats } from './logbook.js';
import { getMySpots, getMySpot, addMySpot, updateMySpot, deleteMySpot } from './myspots.js';

// ── State ──
let currentView = 'map'; // 'map' | 'list' | 'favorites' | 'logbook'
let listVisible = false;
let booted = false;
let mapPickingState = null; // { target: 'log'|'spot' }

// ── Landing / App visibility ──
function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.querySelector('.header').classList.add('app-hidden');
  document.querySelector('.filter-bar').classList.add('app-hidden');
  document.querySelector('.main').classList.add('app-hidden');
  document.querySelector('.footer').classList.add('app-hidden');
}

function hideLanding() {
  document.getElementById('landing').classList.add('hidden');
  document.querySelector('.header').classList.remove('app-hidden');
  document.querySelector('.filter-bar').classList.remove('app-hidden');
  document.querySelector('.main').classList.remove('app-hidden');
  document.querySelector('.footer').classList.remove('app-hidden');
}

function updateLandingLabels() {
  const landing = document.getElementById('landing');
  if (!landing) return;
  const tagline = landing.querySelector('.landing__tagline');
  if (tagline) tagline.textContent = t('landing.tagline');
  const submit = landing.querySelector('.landing__submit');
  if (submit) submit.textContent = t('landing.login');
  const demo = landing.querySelector('.landing__demo');
  if (demo) demo.textContent = t('landing.demo');
  const error = landing.querySelector('.landing__error');
  if (error) error.textContent = t('landing.error');
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.textContent = t('nav.logout');
}

// ── Boot app (only once) ──
function bootApp() {
  if (booted) return;
  booted = true;

  initMap();
  initFilters();
  initModal();
  initLogModal();
  initSpotModal();

  // 초기 렌더 (첫 로딩 시 모든 마커 보이도록)
  updateFavCount();
  refresh(true);  // fitToMarkers = true

  // 필터 변경 시 갱신
  setFilterListener(() => refresh(false));

  // 상세보기 핸들러
  function handleDetail(id) {
    const spot = spots.find(s => s.id === id);
    if (spot) {
      openModal(spot);
      flyToSpot(spot.lat, spot.lng);
    }
  }
  setDetailClickHandler(handleDetail);
  setMapSpotClickHandler(handleDetail);

  // Personal spot handlers
  setPersonalSpotClickHandler(id => {
    openSpotFormModal(id);
  });
  setPersonalSpotCardHandlers(
    id => openSpotFormModal(id),
    id => {
      if (confirm(t('myspot.delete.confirm'))) {
        deleteMySpot(id);
        refresh(false);
      }
    }
  );

  // 초기 map 뷰: cards-panel 숨김
  document.getElementById('cards-panel').classList.add('map-hidden');

  // 네비게이션
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // 리스트 토글
  document.getElementById('list-toggle').addEventListener('click', toggleList);

  // FAB — add personal spot
  document.getElementById('add-spot-btn').addEventListener('click', () => {
    openSpotFormModal();
  });

  // Add log button
  document.getElementById('add-log-btn').addEventListener('click', () => {
    openLogFormModal();
  });

  // Map picking cancel
  document.getElementById('map-pick-cancel').addEventListener('click', () => {
    cancelMapPicking();
  });

  // My spots toggle
  document.getElementById('myspot-toggle').addEventListener('change', () => {
    refresh(false);
  });
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved language on load
  applyLangToggleState();
  updateStaticLabels();
  updateLandingLabels();

  // Auth gate
  if (isLoggedIn()) {
    hideLanding();
    bootApp();
  } else {
    showLanding();
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    if (login(email, pw)) {
      errorEl.classList.add('hidden');
      hideLanding();
      bootApp();
    } else {
      errorEl.classList.remove('hidden');
    }
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    showLanding();
  });

  // ── Language toggle (header) ──
  document.querySelectorAll('#lang-toggle .lang-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });

  // ── Language toggle (landing) ──
  document.querySelectorAll('#landing-lang-toggle .lang-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });

  setLangChangeListener(() => {
    applyLangToggleState();
    updateStaticLabels();
    updateLandingLabels();
    refreshFilterLabels();
    if (booted) refresh(false);
  });
});

function applyLangToggleState() {
  const lang = getLang();
  // Update all lang toggle buttons (header + landing)
  document.querySelectorAll('.lang-toggle__btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function updateStaticLabels() {
  const lang = getLang();

  // html lang attribute
  document.documentElement.lang = lang === 'en' ? 'en' : 'ko';

  // page title
  document.title = t('title');

  // nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    if (view === 'map') btn.childNodes[0].textContent = t('nav.map');
    else if (view === 'list') btn.childNodes[0].textContent = t('nav.list');
    else if (view === 'favorites') {
      // Preserve fav-count span
      const span = btn.querySelector('#fav-count');
      const count = span ? span.textContent : '0';
      btn.innerHTML = `${t('nav.favorites')}(<span id="fav-count">${count}</span>)`;
    } else if (view === 'logbook') {
      btn.textContent = t('nav.logbook');
    }
  });

  // list toggle text
  const listToggleText = document.getElementById('list-toggle-text');
  if (listToggleText) listToggleText.textContent = t('nav.listToggle');

  // my spot toggle text
  const myspotToggleText = document.getElementById('myspot-toggle-text');
  if (myspotToggleText) myspotToggleText.textContent = t('myspot.toggle');

  // empty state texts
  const emptyP = document.querySelector('#empty-state p');
  if (emptyP) emptyP.textContent = t('empty.noSpots');
  const emptyResetBtn = document.getElementById('empty-reset');
  if (emptyResetBtn) emptyResetBtn.textContent = t('empty.reset');

  const favEmptyP = document.querySelector('#fav-empty-state p');
  if (favEmptyP) favEmptyP.textContent = t('empty.noFavorites');
  const favEmptySub = document.querySelector('#fav-empty-state .empty-state__sub');
  if (favEmptySub) favEmptySub.textContent = t('empty.noFavoritesSub');

  // logbook empty state
  const logEmptyText = document.getElementById('logbook-empty-text');
  if (logEmptyText) logEmptyText.textContent = t('logbook.empty');
  const logEmptySub = document.getElementById('logbook-empty-sub');
  if (logEmptySub) logEmptySub.textContent = t('logbook.emptySub');
}

function toggleList() {
  listVisible = !listVisible;
  const mainInner = document.querySelector('.main__inner');
  const cardsPanel = document.getElementById('cards-panel');
  const btn = document.getElementById('list-toggle');

  mainInner.classList.toggle('show-list', listVisible);
  cardsPanel.classList.toggle('map-hidden', !listVisible);
  btn.setAttribute('aria-pressed', listVisible);
  invalidateMapSize();
}

function switchView(view) {
  currentView = view;

  // 네비 활성화
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  const mapPanel = document.getElementById('map-panel');
  const cardsPanel = document.getElementById('cards-panel');
  const mainInner = document.querySelector('.main__inner');
  const listToggleBtn = document.getElementById('list-toggle');
  const filterBar = document.getElementById('filter-bar');
  const logbookView = document.getElementById('logbook-view');

  // Hide logbook view by default
  logbookView.classList.add('hidden');

  // Show/hide filter bar for logbook
  filterBar.classList.toggle('logbook-hidden', view === 'logbook');

  if (view === 'map') {
    mapPanel.classList.remove('hidden');
    mainInner.style.gridTemplateColumns = '';
    listToggleBtn.classList.remove('hidden');

    // 리스트 토글 상태에 따라 표시/숨김
    mainInner.classList.toggle('show-list', listVisible);
    cardsPanel.classList.toggle('map-hidden', !listVisible);
    listToggleBtn.setAttribute('aria-pressed', listVisible);
    invalidateMapSize();
  } else if (view === 'logbook') {
    mapPanel.classList.add('hidden');
    cardsPanel.classList.remove('hidden');
    cardsPanel.classList.remove('map-hidden');
    mainInner.classList.remove('show-list');
    mainInner.style.gridTemplateColumns = '1fr';
    listToggleBtn.classList.add('hidden');
    logbookView.classList.remove('hidden');
  } else {
    mapPanel.classList.add('hidden');
    cardsPanel.classList.remove('hidden');
    cardsPanel.classList.remove('map-hidden');
    mainInner.classList.remove('show-list');
    mainInner.style.gridTemplateColumns = '1fr';
    listToggleBtn.classList.add('hidden');
  }

  refresh(false);
}

function refresh(fitToMarkers = false) {
  if (currentView === 'logbook') {
    // Hide normal card elements
    document.getElementById('cards-grid').innerHTML = '';
    document.getElementById('spot-count').textContent = '';
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('fav-empty-state').classList.add('hidden');
    renderLogbook();
    return;
  }

  // Hide logbook view when not in logbook
  document.getElementById('logbook-view').classList.add('hidden');

  const isFavView = currentView === 'favorites';
  const favSet = getFavorites();
  const filtered = filterSpots(isFavView, favSet);

  // Personal spots
  const showMySpots = document.getElementById('myspot-toggle')?.checked;
  const mySpots = showMySpots ? filterMySpots(getMySpots()) : [];

  if (isFavView && filtered.length === 0) {
    renderFavEmpty();
  } else {
    renderCards(filtered, currentView === 'favorites' ? [] : mySpots);
  }

  // 지도 마커는 항상 현재 필터 기준
  updateMarkers(isFavView ? filtered : filterSpots(false), fitToMarkers);
  updateFavCount();

  // Personal markers on map
  if (showMySpots && currentView !== 'favorites') {
    updatePersonalMarkers(filterMySpots(getMySpots()));
  } else {
    updatePersonalMarkers([]);
  }

  // Activity tab counts
  const counts = getActivityCounts(isFavView, favSet);
  document.getElementById('count-all').textContent = counts.total;
  document.getElementById('count-skin').textContent = counts.skin;
  document.getElementById('count-scuba').textContent = counts.scuba;
}

// ═══ Logbook View ═══

function renderLogbook() {
  const view = document.getElementById('logbook-view');
  const statsEl = document.getElementById('logbook-stats');
  const listEl = document.getElementById('logbook-list');
  const emptyEl = document.getElementById('logbook-empty-state');
  const addBtn = document.getElementById('add-log-btn');

  // Update button text
  addBtn.textContent = t('logbook.addNew');

  // Stats
  const stats = getLogStats();
  statsEl.innerHTML = `
    <div class="logbook-stats__card">
      <div class="logbook-stats__label">${t('logbook.stats.totalDives')}</div>
      <div class="logbook-stats__value">${stats.totalDives}</div>
    </div>
    <div class="logbook-stats__card">
      <div class="logbook-stats__label">${t('logbook.stats.maxDepth')}</div>
      <div class="logbook-stats__value">${stats.maxDepth > 0 ? stats.maxDepth + 'm' : '-'}</div>
    </div>
    <div class="logbook-stats__card">
      <div class="logbook-stats__label">${t('logbook.stats.totalTime')}</div>
      <div class="logbook-stats__value">${stats.totalTime > 0 ? stats.totalTime + 'min' : '-'}</div>
    </div>
  `;

  // Entries
  const entries = getLogEntries();
  listEl.innerHTML = '';

  if (entries.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'log-card';

    const actLabel = entry.activityType === 'scuba' ? t('activity.scuba') : t('activity.skin');

    card.innerHTML = `
      <div class="log-card__header">
        <span class="log-card__date">${entry.date}</span>
        <span class="badge badge--activity badge--activity-${entry.activityType}">${actLabel}</span>
      </div>
      <div class="log-card__spot">${entry.spotName || '-'}</div>
      <div class="log-card__stats">
        ${entry.maxDepth != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.depth')}</span><span class="card__stat-value">${entry.maxDepth}m</span></div>` : ''}
        ${entry.diveTime != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.time')}</span><span class="card__stat-value">${entry.diveTime}min</span></div>` : ''}
        ${entry.waterTemp != null ? `<div class="card__stat"><span class="card__stat-label">${t('logbook.temp')}</span><span class="card__stat-value">${entry.waterTemp}°C</span></div>` : ''}
      </div>
      ${entry.memo ? `<div class="log-card__memo">${entry.memo}</div>` : ''}
      <div class="log-card__actions">
        <button class="log-edit-btn" data-id="${entry.id}">${t('logbook.card.edit')}</button>
        <button class="log-delete-btn" data-id="${entry.id}">${t('logbook.card.delete')}</button>
      </div>
    `;

    card.querySelector('.log-edit-btn').addEventListener('click', () => {
      openLogFormModal(entry.id);
    });
    card.querySelector('.log-delete-btn').addEventListener('click', () => {
      if (confirm(t('logbook.delete.confirm'))) {
        deleteLogEntry(entry.id);
        renderLogbook();
      }
    });

    listEl.appendChild(card);
  });
}

// ═══ Log Form Modal ═══

function initLogModal() {
  const overlay = document.getElementById('log-modal-overlay');
  const closeBtn = document.getElementById('log-modal-close');
  const cancelBtn = document.getElementById('log-cancel');
  const form = document.getElementById('log-form');

  function close() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Log pick-on-map button
  document.getElementById('log-pick-map-btn').addEventListener('click', () => {
    startMapPicking('log');
  });

  // Activity type toggle — show/hide scuba fields
  document.querySelectorAll('input[name="log-activity"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const scubaFields = document.getElementById('log-scuba-fields');
      if (radio.value === 'scuba' && radio.checked) {
        scubaFields.classList.remove('hidden');
      } else if (radio.value === 'skin' && radio.checked) {
        scubaFields.classList.add('hidden');
      }
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const editId = document.getElementById('log-edit-id').value;

    const data = {
      date: document.getElementById('log-date').value,
      spotName: document.getElementById('log-spot-name').value,
      activityType: document.querySelector('input[name="log-activity"]:checked').value,
      maxDepth: parseFloat(document.getElementById('log-depth').value) || null,
      diveTime: parseInt(document.getElementById('log-time').value) || null,
      waterTemp: parseFloat(document.getElementById('log-temp').value) || null,
      visibility: parseFloat(document.getElementById('log-visibility').value) || null,
      equipment: document.getElementById('log-equipment').value,
      weight: parseFloat(document.getElementById('log-weight').value) || null,
      tankPressureStart: parseInt(document.getElementById('log-tank-start').value) || null,
      tankPressureEnd: parseInt(document.getElementById('log-tank-end').value) || null,
      buddy: document.getElementById('log-buddy').value,
      weather: document.getElementById('log-weather').value,
      lat: parseFloat(document.getElementById('log-lat').value) || null,
      lng: parseFloat(document.getElementById('log-lng').value) || null,
      memo: document.getElementById('log-memo').value,
    };

    if (editId) {
      updateLogEntry(+editId, data);
    } else {
      addLogEntry(data);
    }

    close();
    if (currentView === 'logbook') renderLogbook();
  });
}

function openLogFormModal(editId) {
  const overlay = document.getElementById('log-modal-overlay');
  const title = document.getElementById('log-modal-title');
  const form = document.getElementById('log-form');
  const scubaFields = document.getElementById('log-scuba-fields');

  form.reset();
  document.getElementById('log-edit-id').value = '';

  // Populate spot datalist
  const datalist = document.getElementById('log-spot-datalist');
  datalist.innerHTML = '';
  spots.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    datalist.appendChild(opt);
  });
  getMySpots().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    datalist.appendChild(opt);
  });

  // Update form labels
  document.getElementById('log-date-label').textContent = t('logbook.form.date');
  document.getElementById('log-spot-label').textContent = t('logbook.form.spotName');
  document.getElementById('log-activity-label').textContent = t('logbook.form.activityType');
  document.getElementById('log-depth-label').textContent = t('logbook.form.maxDepth');
  document.getElementById('log-time-label').textContent = t('logbook.form.diveTime');
  document.getElementById('log-temp-label').textContent = t('logbook.form.waterTemp');
  document.getElementById('log-vis-label').textContent = t('logbook.form.visibility');
  document.getElementById('log-equip-label').textContent = t('logbook.form.equipment');
  document.getElementById('log-weight-label').textContent = t('logbook.form.weight');
  document.getElementById('log-tank-start-label').textContent = t('logbook.form.tankStart');
  document.getElementById('log-tank-end-label').textContent = t('logbook.form.tankEnd');
  document.getElementById('log-buddy-label').textContent = t('logbook.form.buddy');
  document.getElementById('log-weather-label').textContent = t('logbook.form.weather');
  document.getElementById('log-location-label').textContent = t('logbook.form.location');
  document.getElementById('log-pick-map-btn').textContent = t('logbook.form.pickOnMap');
  document.getElementById('log-memo-label').textContent = t('logbook.form.memo');
  document.getElementById('log-save').textContent = t('logbook.form.save');
  document.getElementById('log-cancel').textContent = t('logbook.form.cancel');

  if (editId) {
    const entry = getLogEntry(editId);
    if (!entry) return;
    title.textContent = t('logbook.form.titleEdit');
    document.getElementById('log-edit-id').value = editId;
    document.getElementById('log-date').value = entry.date || '';
    document.getElementById('log-spot-name').value = entry.spotName || '';
    document.querySelector(`input[name="log-activity"][value="${entry.activityType}"]`).checked = true;
    document.getElementById('log-depth').value = entry.maxDepth ?? '';
    document.getElementById('log-time').value = entry.diveTime ?? '';
    document.getElementById('log-temp').value = entry.waterTemp ?? '';
    document.getElementById('log-visibility').value = entry.visibility ?? '';
    document.getElementById('log-equipment').value = entry.equipment || '';
    document.getElementById('log-weight').value = entry.weight ?? '';
    document.getElementById('log-tank-start').value = entry.tankPressureStart ?? '';
    document.getElementById('log-tank-end').value = entry.tankPressureEnd ?? '';
    document.getElementById('log-buddy').value = entry.buddy || '';
    document.getElementById('log-weather').value = entry.weather || '';
    document.getElementById('log-lat').value = entry.lat ?? '';
    document.getElementById('log-lng').value = entry.lng ?? '';
    document.getElementById('log-memo').value = entry.memo || '';
    scubaFields.classList.toggle('hidden', entry.activityType !== 'scuba');
  } else {
    title.textContent = t('logbook.form.title');
    document.getElementById('log-date').value = new Date().toISOString().slice(0, 10);
    scubaFields.classList.add('hidden');
  }

  // Show coords text if editing with existing coordinates
  const latVal = document.getElementById('log-lat').value;
  const lngVal = document.getElementById('log-lng').value;
  const coordsText = document.getElementById('log-coords-text');
  if (latVal && lngVal) {
    coordsText.textContent = `${parseFloat(latVal).toFixed(4)}, ${parseFloat(lngVal).toFixed(4)}`;
  } else {
    coordsText.textContent = '';
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

// ═══ Spot Form Modal ═══

function initSpotModal() {
  const overlay = document.getElementById('spot-modal-overlay');
  const closeBtn = document.getElementById('spot-modal-close');
  const cancelBtn = document.getElementById('spot-cancel');
  const form = document.getElementById('spot-form');

  function close() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Spot pick-on-map button
  document.getElementById('spot-pick-map-btn').addEventListener('click', () => {
    startMapPicking('spot');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const editId = document.getElementById('spot-edit-id').value;

    const activityTypes = [];
    document.querySelectorAll('input[name="spot-activity"]:checked').forEach(cb => {
      activityTypes.push(cb.value);
    });
    if (activityTypes.length === 0) activityTypes.push('skin');

    const data = {
      name: document.getElementById('spot-name').value,
      lat: parseFloat(document.getElementById('spot-lat').value) || 0,
      lng: parseFloat(document.getElementById('spot-lng').value) || 0,
      depth: document.getElementById('spot-depth').value,
      waterTemp: {
        min: parseFloat(document.getElementById('spot-temp-min').value) || null,
        max: parseFloat(document.getElementById('spot-temp-max').value) || null,
      },
      difficulty: document.getElementById('spot-difficulty').value,
      activityTypes,
      memo: document.getElementById('spot-memo').value,
    };

    if (editId) {
      updateMySpot(+editId, data);
    } else {
      addMySpot(data);
    }

    close();
    refresh(false);
  });
}

function openSpotFormModal(editId) {
  const overlay = document.getElementById('spot-modal-overlay');
  const title = document.getElementById('spot-modal-title');
  const form = document.getElementById('spot-form');

  form.reset();
  document.getElementById('spot-edit-id').value = '';

  // Update form labels
  document.getElementById('spot-name-label').textContent = t('myspot.form.name');
  document.getElementById('spot-location-label').textContent = t('myspot.form.location');
  document.getElementById('spot-pick-map-btn').textContent = t('myspot.form.pickOnMap');
  document.getElementById('spot-depth-label').textContent = t('myspot.form.depth');
  document.getElementById('spot-temp-min-label').textContent = t('myspot.form.tempMin');
  document.getElementById('spot-temp-max-label').textContent = t('myspot.form.tempMax');
  document.getElementById('spot-difficulty-label').textContent = t('myspot.form.difficulty');
  document.getElementById('spot-activity-label').textContent = t('myspot.form.activityTypes');
  document.getElementById('spot-memo-label').textContent = t('myspot.form.memo');
  document.getElementById('spot-save').textContent = t('myspot.form.save');
  document.getElementById('spot-cancel').textContent = t('myspot.form.cancel');

  // Update difficulty select labels
  const diffSelect = document.getElementById('spot-difficulty');
  diffSelect.options[0].textContent = t('difficulty.beginner');
  diffSelect.options[1].textContent = t('difficulty.intermediate');
  diffSelect.options[2].textContent = t('difficulty.advanced');

  if (editId) {
    const spot = getMySpot(editId);
    if (!spot) return;
    title.textContent = t('myspot.form.titleEdit');
    document.getElementById('spot-edit-id').value = editId;
    document.getElementById('spot-name').value = spot.name || '';
    document.getElementById('spot-lat').value = spot.lat || '';
    document.getElementById('spot-lng').value = spot.lng || '';
    document.getElementById('spot-depth').value = spot.depth || '';
    document.getElementById('spot-temp-min').value = spot.waterTemp?.min ?? '';
    document.getElementById('spot-temp-max').value = spot.waterTemp?.max ?? '';
    document.getElementById('spot-difficulty').value = spot.difficulty || 'beginner';
    document.querySelectorAll('input[name="spot-activity"]').forEach(cb => {
      cb.checked = spot.activityTypes?.includes(cb.value);
    });
    document.getElementById('spot-memo').value = spot.memo || '';
  } else {
    title.textContent = t('myspot.form.title');
  }

  // Show coords text if editing with existing coordinates
  const latVal = document.getElementById('spot-lat').value;
  const lngVal = document.getElementById('spot-lng').value;
  const coordsText = document.getElementById('spot-coords-text');
  if (latVal && lngVal) {
    coordsText.textContent = `${parseFloat(latVal).toFixed(4)}, ${parseFloat(lngVal).toFixed(4)}`;
  } else {
    coordsText.textContent = '';
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

// ═══ Full-screen Map Picking ═══

function startMapPicking(target) {
  mapPickingState = { target };

  // Hide the current modal
  const overlayId = target === 'log' ? 'log-modal-overlay' : 'spot-modal-overlay';
  document.getElementById(overlayId).classList.add('hidden');
  document.getElementById(overlayId).setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Ensure map panel is visible
  const mapPanel = document.getElementById('map-panel');
  const mainInner = document.querySelector('.main__inner');
  mapPanel.classList.remove('hidden');
  mainInner.style.gridTemplateColumns = '';
  invalidateMapSize();

  // Add crosshair cursor
  document.getElementById('map').classList.add('map--picking');

  // Show banner
  const banner = document.getElementById('map-pick-banner');
  document.getElementById('map-pick-banner-text').textContent = t('logbook.form.pickBanner');
  document.getElementById('map-pick-cancel').textContent = t('logbook.form.pickCancel');
  banner.classList.remove('hidden');

  // Register one-time click handler on main map
  const map = getMapInstance();
  map.once('click', finishMapPicking);
}

function finishMapPicking(e) {
  if (!mapPickingState) return;
  const { target } = mapPickingState;
  const { lat, lng } = e.latlng;

  // Set coordinates
  const prefix = target === 'log' ? 'log' : 'spot';
  document.getElementById(`${prefix}-lat`).value = lat.toFixed(6);
  document.getElementById(`${prefix}-lng`).value = lng.toFixed(6);
  document.getElementById(`${prefix}-coords-text`).textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  // Clean up picking UI
  document.getElementById('map').classList.remove('map--picking');
  document.getElementById('map-pick-banner').classList.add('hidden');

  // Re-open the modal
  const overlayId = target === 'log' ? 'log-modal-overlay' : 'spot-modal-overlay';
  document.getElementById(overlayId).classList.remove('hidden');
  document.getElementById(overlayId).setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Restore view if we were in logbook
  if (currentView === 'logbook') {
    switchView('logbook');
  }

  mapPickingState = null;
}

function cancelMapPicking() {
  if (!mapPickingState) return;
  const { target } = mapPickingState;

  // Remove click handler
  const map = getMapInstance();
  map.off('click', finishMapPicking);

  // Clean up picking UI
  document.getElementById('map').classList.remove('map--picking');
  document.getElementById('map-pick-banner').classList.add('hidden');

  // Re-open the modal
  const overlayId = target === 'log' ? 'log-modal-overlay' : 'spot-modal-overlay';
  document.getElementById(overlayId).classList.remove('hidden');
  document.getElementById(overlayId).setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Restore view if we were in logbook
  if (currentView === 'logbook') {
    switchView('logbook');
  }

  mapPickingState = null;
}
