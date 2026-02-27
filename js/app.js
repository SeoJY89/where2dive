// 앱 엔트리 포인트
import { spots } from './data.js';
import { initMap, updateMarkers, setMapSpotClickHandler, flyToSpot, invalidateMapSize } from './map.js';
import { renderCards, renderFavEmpty, openModal, initModal, setDetailClickHandler, updateFavCount } from './ui.js';
import { initFilters, filterSpots, setFilterListener, refreshFilterLabels } from './filters.js';
import { getFavorites } from './favorites.js';
import { getLang, setLang, setLangChangeListener, t } from './i18n.js';

// ── State ──
let currentView = 'map'; // 'map' | 'list' | 'favorites'

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initFilters();
  initModal();

  // Apply saved language on load
  applyLangToggleState();
  updateStaticLabels();

  // 초기 렌더
  updateFavCount();
  refresh();

  // 필터 변경 시 갱신
  setFilterListener(refresh);

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

  // 네비게이션
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // ── Language toggle ──
  document.querySelectorAll('.lang-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });

  setLangChangeListener(() => {
    applyLangToggleState();
    updateStaticLabels();
    refreshFilterLabels();
    refresh();
  });
});

function applyLangToggleState() {
  const lang = getLang();
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
    }
  });

  // empty state texts
  const emptyP = document.querySelector('#empty-state p');
  if (emptyP) emptyP.textContent = t('empty.noSpots');
  const emptyResetBtn = document.getElementById('empty-reset');
  if (emptyResetBtn) emptyResetBtn.textContent = t('empty.reset');

  const favEmptyP = document.querySelector('#fav-empty-state p');
  if (favEmptyP) favEmptyP.textContent = t('empty.noFavorites');
  const favEmptySub = document.querySelector('#fav-empty-state .empty-state__sub');
  if (favEmptySub) favEmptySub.textContent = t('empty.noFavoritesSub');
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

  if (view === 'map') {
    mapPanel.classList.remove('hidden');
    cardsPanel.classList.remove('hidden');
    mainInner.style.gridTemplateColumns = '';
    invalidateMapSize();
  } else {
    mapPanel.classList.add('hidden');
    cardsPanel.classList.remove('hidden');
    mainInner.style.gridTemplateColumns = '1fr';
  }

  refresh();
}

function refresh() {
  const isFavView = currentView === 'favorites';
  const favSet = getFavorites();
  const filtered = filterSpots(isFavView, favSet);

  if (isFavView && filtered.length === 0) {
    renderFavEmpty();
  } else {
    renderCards(filtered);
  }

  // 지도 마커는 항상 현재 필터 기준
  updateMarkers(isFavView ? filtered : filterSpots(false));
  updateFavCount();
}
