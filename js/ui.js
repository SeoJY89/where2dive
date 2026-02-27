// DOM 조작, 카드 렌더링, 모달
import { isFavorite, toggleFavorite, getFavCount } from './favorites.js';
import { fetchWeather } from './weather.js';

let onDetailClick = () => {};

const DIFFICULTY_LABEL = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '상급',
};

// ── 카드 렌더링 ──

export function renderCards(spots) {
  const grid = document.getElementById('cards-grid');
  const countEl = document.getElementById('spot-count');
  const emptyState = document.getElementById('empty-state');
  const favEmpty = document.getElementById('fav-empty-state');

  grid.innerHTML = '';
  favEmpty.classList.add('hidden');

  if (spots.length === 0) {
    emptyState.classList.remove('hidden');
    countEl.textContent = '';
    return;
  }

  emptyState.classList.add('hidden');
  countEl.textContent = `${spots.length}개 다이빙 스팟`;

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
  const seasonBadges = spot.bestSeason.slice(0, 3).map(s => `<span class="badge badge--season">${s}</span>`).join('');
  const moreSeasons = spot.bestSeason.length > 3 ? `<span class="badge">+${spot.bestSeason.length - 3}</span>` : '';

  card.innerHTML = `
    <div class="card__header">
      <span class="card__tag">${spot.country}</span>
      <button class="card__fav ${fav ? 'active' : ''}" data-id="${spot.id}" aria-label="즐겨찾기">
        ${fav ? '\u2764' : '\u2661'}
      </button>
    </div>
    <div class="card__name">${spot.name}</div>
    <div class="card__location">${regionLabel(spot.region)} · ${spot.country}</div>
    <div class="card__stats">
      <div class="card__stat">
        <span class="card__stat-label">수심</span>
        <span class="card__stat-value">${spot.depth}</span>
      </div>
      <div class="card__stat">
        <span class="card__stat-label">수온</span>
        <span class="card__stat-value">${spot.waterTemp.min}~${spot.waterTemp.max}°C</span>
      </div>
      <div class="card__stat">
        <span class="card__stat-label">시야</span>
        <span class="card__stat-value">${spot.visibility}</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="card__difficulty card__difficulty--${spot.difficulty}">
        <span class="card__difficulty-dot"></span>
        ${DIFFICULTY_LABEL[spot.difficulty]}
      </span>
      <div class="card__badges">${seasonBadges}${moreSeasons}</div>
    </div>
    <div class="card__actions">
      <button class="btn btn--primary card__detail-btn" data-id="${spot.id}">상세보기</button>
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

// ── 모달 ──

export function openModal(spot) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  const fav = isFavorite(spot.id);

  body.innerHTML = `
    <div class="modal__header">
      <div>
        <h2 class="modal__title" id="modal-title">${spot.name}</h2>
        <div class="modal__subtitle">${regionLabel(spot.region)} · ${spot.country}</div>
      </div>
      <button class="modal__fav ${fav ? 'active' : ''}" data-id="${spot.id}" aria-label="즐겨찾기">
        ${fav ? '\u2764' : '\u2661'}
      </button>
    </div>

    <p class="modal__desc">${spot.description}</p>

    <div class="modal__section-title">다이빙 정보</div>
    <div class="modal__stats-grid">
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">수심</div>
        <div class="modal__stat-card__value">${spot.depth}</div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">수온</div>
        <div class="modal__stat-card__value">${spot.waterTemp.min}~${spot.waterTemp.max}°C</div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">시야</div>
        <div class="modal__stat-card__value">${spot.visibility}</div>
      </div>
      <div class="modal__stat-card">
        <div class="modal__stat-card__label">난이도</div>
        <div class="modal__stat-card__value">
          <span class="card__difficulty card__difficulty--${spot.difficulty}">
            <span class="card__difficulty-dot"></span>
            ${DIFFICULTY_LABEL[spot.difficulty]}
          </span>
        </div>
      </div>
    </div>

    <div class="modal__section-title">추천 시즌</div>
    <div class="modal__tags">
      ${spot.bestSeason.map(s => `<span class="modal__tag">${s}</span>`).join('')}
    </div>

    <div class="modal__section-title">해양 생물</div>
    <div class="modal__tags">
      ${spot.marineLife.map(m => `<span class="modal__tag">${m}</span>`).join('')}
    </div>

    <div class="modal__section-title">하이라이트</div>
    <ul class="modal__highlights">
      ${spot.highlights.map(h => `<li>${h}</li>`).join('')}
    </ul>

    <div class="modal__weather" id="weather-section">
      <div class="modal__weather-title">실시간 날씨 · 해양 정보</div>
      <div class="weather-loading" id="weather-loading">
        <div class="spinner"></div>
        <span style="font-size:0.8rem;color:var(--c-gray-300);">날씨 데이터 불러오는 중...</span>
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
    if (w.temperature != null) items.push({ label: '기온', value: `${w.temperature}°C` });
    if (w.weatherText) items.push({ label: '날씨', value: w.weatherText });
    if (w.windSpeed != null) items.push({ label: '풍속', value: `${w.windSpeed} km/h` });
    if (w.windDir) items.push({ label: '풍향', value: w.windDir });
    if (w.waterTemp != null) items.push({ label: '수온(실시간)', value: `${w.waterTemp}°C` });
    if (w.waveHeight != null) items.push({ label: '파고', value: `${w.waveHeight}m` });
    if (w.waveDir) items.push({ label: '파향', value: w.waveDir });
    if (w.wavePeriod != null) items.push({ label: '파주기', value: `${w.wavePeriod}s` });

    if (items.length === 0) {
      section.insertAdjacentHTML('beforeend',
        `<div class="weather-error">이 지역의 날씨 데이터를 사용할 수 없습니다.</div>`
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
        날씨 데이터를 불러오지 못했습니다.
        <button class="weather-error__retry" id="weather-retry">다시 시도</button>
      </div>
    `;
    document.getElementById('weather-retry')?.addEventListener('click', () => {
      loading.innerHTML = `
        <div class="weather-loading">
          <div class="spinner"></div>
          <span style="font-size:0.8rem;color:var(--c-gray-300);">날씨 데이터 불러오는 중...</span>
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

// ── Helpers ──

const REGION_LABELS = {
  korea: '한국',
  'southeast-asia': '동남아시아',
  oceania: '오세아니아',
  'indian-ocean': '인도양',
  'red-sea': '홍해',
  caribbean: '카리브해',
  europe: '유럽',
  'east-asia': '동아시아',
  pacific: '태평양',
};

function regionLabel(id) {
  return REGION_LABELS[id] || id;
}

export function updateFavCount() {
  document.getElementById('fav-count').textContent = getFavCount();
}
