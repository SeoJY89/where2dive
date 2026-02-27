// DOM 조작, 카드 렌더링, 모달
import { isFavorite, toggleFavorite, getFavCount } from './favorites.js';
import { fetchWeather } from './weather.js';
import { t, td, translateMonth } from './i18n.js';

let onDetailClick = () => {};

// ── 카드 렌더링 ──

let onPersonalSpotEdit = () => {};
let onPersonalSpotDelete = () => {};

export function setPersonalSpotCardHandlers(editFn, deleteFn) {
  onPersonalSpotEdit = editFn;
  onPersonalSpotDelete = deleteFn;
}

export function renderCards(spots, mySpots = []) {
  const grid = document.getElementById('cards-grid');
  const countEl = document.getElementById('spot-count');
  const emptyState = document.getElementById('empty-state');
  const favEmpty = document.getElementById('fav-empty-state');

  grid.innerHTML = '';
  favEmpty.classList.add('hidden');

  const totalCount = spots.length + mySpots.length;

  if (totalCount === 0) {
    emptyState.classList.remove('hidden');
    countEl.textContent = '';
    return;
  }

  emptyState.classList.add('hidden');
  countEl.textContent = t('card.count').replace('{n}', totalCount);

  // Personal spots first
  mySpots.forEach(spot => {
    grid.appendChild(createPersonalCard(spot));
  });

  spots.forEach(spot => {
    grid.appendChild(createCard(spot));
  });
}

export function renderFavEmpty() {
  const grid = document.getElementById('cards-grid');
  const countEl = document.getElementById('spot-count');
  const emptyState = document.getElementById('empty-state');
  const favEmpty = document.getElementById('fav-empty-state');

  grid.innerHTML = '';
  countEl.textContent = '';
  emptyState.classList.add('hidden');
  favEmpty.classList.remove('hidden');
}

function createCard(spot) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.spotId = spot.id;

  const fav = isFavorite(spot.id);
  const seasonBadges = spot.bestSeason.slice(0, 3).map(s => `<span class="badge badge--season">${translateMonth(s)}</span>`).join('');
  const moreSeasons = spot.bestSeason.length > 3 ? `<span class="badge">+${spot.bestSeason.length - 3}</span>` : '';

  const diffLabel = t('difficulty.' + spot.difficulty);
  const activityBadges = (spot.activityTypes || []).map(a =>
    `<span class="badge badge--activity badge--activity-${a}">${t('activity.' + a)}</span>`
  ).join('');

  card.innerHTML = `
    <div class="card__header">
      <span class="card__tag">${td(spot, 'country')}</span>
      <button class="card__fav ${fav ? 'active' : ''}" data-id="${spot.id}" aria-label="${t('nav.favorites')}">
        ${fav ? '\u2764' : '\u2661'}
      </button>
    </div>
    <div class="card__name">${td(spot, 'name')}</div>
    <div class="card__location">${t('region.' + spot.region)} · ${td(spot, 'country')}</div>
    <div class="card__stats">
      <div class="card__stat">
        <span class="card__stat-label">${t('card.depth')}</span>
        <span class="card__stat-value">${spot.depth}</span>
      </div>
      <div class="card__stat">
        <span class="card__stat-label">${t('card.waterTemp')}</span>
        <span class="card__stat-value">${spot.waterTemp.min}~${spot.waterTemp.max}°C</span>
      </div>
      <div class="card__stat">
        <span class="card__stat-label">${t('card.visibility')}</span>
        <span class="card__stat-value">${spot.visibility}</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="card__difficulty card__difficulty--${spot.difficulty}">
        <span class="card__difficulty-dot"></span>
        ${diffLabel}
      </span>
      ${activityBadges}
      <div class="card__badges">${seasonBadges}${moreSeasons}</div>
    </div>
    <div class="card__actions">
      <button class="btn btn--primary card__detail-btn" data-id="${spot.id}">${t('card.detail')}</button>
    </div>
  `;

  // 즐겨찾기 토글
  card.querySelector('.card__fav').addEventListener('click', e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const nowFav = toggleFavorite(spot.id);
    btn.classList.toggle('active', nowFav);
    btn.innerHTML = nowFav ? '\u2764' : '\u2661';
    updateFavCount();
  });

  // 상세보기
  card.querySelector('.card__detail-btn').addEventListener('click', () => {
    onDetailClick(spot.id);
  });

  return card;
}

function createPersonalCard(spot) {
  const card = document.createElement('article');
  card.className = 'card card--personal';
  card.dataset.myspotId = spot.id;

  const diffLabel = t('difficulty.' + spot.difficulty);
  const activityBadges = (spot.activityTypes || []).map(a =>
    `<span class="badge badge--activity badge--activity-${a}">${t('activity.' + a)}</span>`
  ).join('');

  const tempStr = (spot.waterTemp?.min != null && spot.waterTemp?.max != null)
    ? `${spot.waterTemp.min}~${spot.waterTemp.max}°C` : '-';

  card.innerHTML = `
    <div class="card__header">
      <span class="card__tag card__tag--personal">${t('myspot.badge')}</span>
    </div>
    <div class="card__name">${spot.name}</div>
    <div class="card__stats">
      ${spot.depth ? `<div class="card__stat"><span class="card__stat-label">${t('card.depth')}</span><span class="card__stat-value">${spot.depth}</span></div>` : ''}
      <div class="card__stat">
        <span class="card__stat-label">${t('card.waterTemp')}</span>
        <span class="card__stat-value">${tempStr}</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="card__difficulty card__difficulty--${spot.difficulty}">
        <span class="card__difficulty-dot"></span>
        ${diffLabel}
      </span>
      ${activityBadges}
    </div>
    ${spot.memo ? `<div class="log-card__memo">${spot.memo}</div>` : ''}
    <div class="log-card__actions">
      <button class="myspot-edit-btn" data-id="${spot.id}">${t('myspot.card.edit')}</button>
      <button class="myspot-delete-btn log-delete-btn" data-id="${spot.id}">${t('myspot.card.delete')}</button>
    </div>
  `;

  card.querySelector('.myspot-edit-btn').addEventListener('click', () => {
    onPersonalSpotEdit(spot.id);
  });
  card.querySelector('.myspot-delete-btn').addEventListener('click', () => {
    onPersonalSpotDelete(spot.id);
  });

  return card;
}

// ── 모달 ──

export function openModal(spot) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  const fav = isFavorite(spot.id);

  const seasonTags = spot.bestSeason.map(s => `<span class="modal__tag">${translateMonth(s)}</span>`).join('');
  const marineLifeItems = (td(spot, 'marineLife') || spot.marineLife).map(m => `<span class="modal__tag">${m}</span>`).join('');
  const highlightItems = (td(spot, 'highlights') || spot.highlights).map(h => `<li>${h}</li>`).join('');
  const diffLabel = t('difficulty.' + spot.difficulty);
  const activityBadges = (spot.activityTypes || []).map(a =>
    `<span class="badge badge--activity badge--activity-${a}">${t('activity.' + a)}</span>`
  ).join('');

  body.innerHTML = `
    <div class="modal__header">
      <div>
        <h2 class="modal__title" id="modal-title">${td(spot, 'name')}</h2>
        <div class="modal__subtitle">${t('region.' + spot.region)} · ${td(spot, 'country')}</div>
      </div>
      <button class="modal__fav ${fav ? 'active' : ''}" data-id="${spot.id}" aria-label="${t('nav.favorites')}">
        ${fav ? '\u2764' : '\u2661'}
      </button>
    </div>

    <p class="modal__desc">${td(spot, 'description')}</p>

    <div class="modal__section-title">${t('modal.info')}</div>
    <div class="modal__stats-grid">
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">${t('modal.depth')}</div>
        <div class="modal__stat-card__value">${spot.depth}</div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">${t('modal.waterTemp')}</div>
        <div class="modal__stat-card__value">${spot.waterTemp.min}~${spot.waterTemp.max}°C</div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">${t('modal.visibility')}</div>
        <div class="modal__stat-card__value">${spot.visibility}</div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">${t('modal.difficulty')}</div>
        <div class="modal__stat-card__value">
          <span class="card__difficulty card__difficulty--${spot.difficulty}">
            <span class="card__difficulty-dot"></span>
            ${diffLabel}
          </span>
        </div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">${t('modal.activityType')}</div>
        <div class="modal__stat-card__value" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
          ${activityBadges}
        </div>
      </div>
    </div>

    <div class="modal__section-title">${t('modal.bestSeason')}</div>
    <div class="modal__tags">
      ${seasonTags}
    </div>

    <div class="modal__section-title">${t('modal.marineLife')}</div>
    <div class="modal__tags">
      ${marineLifeItems}
    </div>

    <div class="modal__section-title">${t('modal.highlights')}</div>
    <ul class="modal__highlights">
      ${highlightItems}
    </ul>

    <div class="modal__weather" id="weather-section">
      <div class="modal__weather-title">${t('modal.weather.title')}</div>
      <div class="weather-loading" id="weather-loading">
        <div class="spinner"></div>
        <span style="font-size:0.8rem;color:var(--c-gray-300);">${t('modal.weather.loading')}</span>
      </div>
    </div>
  `;

  // 즐겨찾기 토글
  body.querySelector('.modal__fav').addEventListener('click', e => {
    const btn = e.currentTarget;
    const nowFav = toggleFavorite(spot.id);
    btn.classList.toggle('active', nowFav);
    btn.innerHTML = nowFav ? '\u2764' : '\u2661';
    updateFavCount();
  });

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // 날씨 로딩
  loadWeather(spot);
}

async function loadWeather(spot) {
  const section = document.getElementById('weather-section');
  const loading = document.getElementById('weather-loading');
  if (!section || !loading) return;

  try {
    const w = await fetchWeather(spot.lat, spot.lng);
    loading.remove();

    const items = [];
    if (w.temperature != null) items.push({ label: t('weather.temperature'), value: `${w.temperature}°C` });
    if (w.weatherText) items.push({ label: t('weather.weather'), value: w.weatherText });
    if (w.windSpeed != null) items.push({ label: t('weather.windSpeed'), value: `${w.windSpeed} km/h` });
    if (w.windDir) items.push({ label: t('weather.windDir'), value: w.windDir });
    if (w.waterTemp != null) items.push({ label: t('weather.waterTemp'), value: `${w.waterTemp}°C` });
    if (w.waveHeight != null) items.push({ label: t('weather.waveHeight'), value: `${w.waveHeight}m` });
    if (w.waveDir) items.push({ label: t('weather.waveDir'), value: w.waveDir });
    if (w.wavePeriod != null) items.push({ label: t('weather.wavePeriod'), value: `${w.wavePeriod}s` });

    if (items.length === 0) {
      section.insertAdjacentHTML('beforeend',
        `<div class="weather-error">${t('weather.noData')}</div>`
      );
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'modal__weather-grid';
    grid.innerHTML = items.map(i => `
      <div class="weather-item">
        <div class="weather-item__label">${i.label}</div>
        <div class="weather-item__value">${i.value}</div>
      </div>
    `).join('');
    section.appendChild(grid);
  } catch {
    loading.innerHTML = `
      <div class="weather-error">
        ${t('weather.error')}
        <button class="weather-error__retry" id="weather-retry">${t('weather.retry')}</button>
      </div>
    `;
    document.getElementById('weather-retry')?.addEventListener('click', () => {
      loading.innerHTML = `
        <div class="weather-loading">
          <div class="spinner"></div>
          <span style="font-size:0.8rem;color:var(--c-gray-300);">${t('modal.weather.loading')}</span>
        </div>
      `;
      loadWeather(spot);
    });
  }
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function initModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

export function setDetailClickHandler(fn) {
  onDetailClick = fn;
}

export function updateFavCount() {
  document.getElementById('fav-count').textContent = getFavCount();
}
