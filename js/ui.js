// DOM 조작, 카드 렌더링, 모달
import { isFavorite, toggleFavorite, getFavCount } from './favorites.js';
import { fetchWeatherFull, getWeatherIcon, calculateDiveScore, getDiveMessage, renderDiveStars, windDir } from './weather.js';
import { t, td, translateMonth } from './i18n.js';
import { loadReviews, getCachedReviews, getAverageRating, sortReviews } from './reviews.js';
import { getCurrentUid } from './auth.js';

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
  card.querySelector('.card__fav').addEventListener('click', async e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    try {
      const nowFav = await toggleFavorite(spot.id);
      btn.classList.toggle('active', nowFav);
      btn.innerHTML = nowFav ? '\u2764' : '\u2661';
      updateFavCount();
      if (nowFav && typeof gtag === 'function') gtag('event', 'add_favorite', { spot_name: spot.name });
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
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

    <div class="modal__section-title">${t('modal.location')}</div>
    <div class="modal__location">
      <span class="modal__location-coords">${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}</span>
      <a class="modal__location-link" href="https://www.google.com/maps?q=${spot.lat},${spot.lng}" target="_blank" rel="noopener">${t('modal.openInMaps')} ↗</a>
    </div>

    <div class="review-section" id="review-section" data-spot-id="${spot.id}">
      <div class="review-section__header">
        <span class="review-section__title">${t('review.title')}</span>
        <button class="review-section__write-btn" id="review-write-btn">${t('review.write')}</button>
      </div>
      <div id="review-summary"></div>
      <div class="review-sort" id="review-sort-wrap" style="display:none;">
        <select class="review-sort__select" id="review-sort">
          <option value="latest">${t('review.sort.latest')}</option>
          <option value="ratingHigh">${t('review.sort.ratingHigh')}</option>
          <option value="ratingLow">${t('review.sort.ratingLow')}</option>
        </select>
      </div>
      <div class="review-list" id="review-list">
        <div class="review-empty">${t('modal.weather.loading')}</div>
      </div>
    </div>

    <div class="modal__actions" id="modal-actions">
      <button class="modal__action-btn" id="modal-add-log"><span>📝</span> ${t('modal.addToLogbook')}</button>
      <button class="modal__action-btn" id="modal-share"><span>📤</span> ${t('modal.share')}</button>
    </div>
  `;

  // Review write button
  body.querySelector('#review-write-btn').addEventListener('click', () => {
    const uid = getCurrentUid();
    if (!uid) {
      alert(t('review.loginRequired'));
      return;
    }
    document.dispatchEvent(new CustomEvent('open-review-modal', { detail: { spotId: spot.id, spotName: td(spot, 'name') } }));
  });

  // Review sort handler
  body.querySelector('#review-sort').addEventListener('change', (e) => {
    renderReviewList(spot.id, e.target.value);
  });

  // 즐겨찾기 토글
  body.querySelector('.modal__fav').addEventListener('click', async e => {
    const btn = e.currentTarget;
    try {
      const nowFav = await toggleFavorite(spot.id);
      btn.classList.toggle('active', nowFav);
      btn.innerHTML = nowFav ? '\u2764' : '\u2661';
      updateFavCount();
      if (nowFav && typeof gtag === 'function') gtag('event', 'add_favorite', { spot_name: spot.name });
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  });

  // Add to logbook button
  body.querySelector('#modal-add-log').addEventListener('click', () => {
    closeModal();
    document.dispatchEvent(new CustomEvent('open-log-from-spot', { detail: { spotId: spot.id, spotName: td(spot, 'name'), lat: spot.lat, lng: spot.lng } }));
  });

  // Share button
  body.querySelector('#modal-share').addEventListener('click', () => {
    const url = `${location.origin}/?spot=${spot.id}`;
    const text = `${td(spot, 'name')} - ${td(spot, 'country')} | Where2Dive`;
    if (navigator.share) {
      navigator.share({ title: td(spot, 'name'), text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const btn = body.querySelector('#modal-share');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      });
    }
  });

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // 날씨 로딩
  loadWeather(spot);

  // 리뷰 로딩
  loadAndRenderReviews(spot.id);
}

async function loadWeather(spot) {
  const section = document.getElementById('weather-section');
  const loading = document.getElementById('weather-loading');
  if (!section || !loading) return;

  try {
    const { current: w, daily } = await fetchWeatherFull(spot.lat, spot.lng);
    loading.remove();

    // ── Current conditions (no data?) ──
    const hasData = w.temperature != null || w.weatherCode != null;
    if (!hasData) {
      section.insertAdjacentHTML('beforeend',
        `<div class="weather-error">${t('weather.noData')}</div>`
      );
      return;
    }

    // ── Dive Score Card ──
    const scoreHtml = `
      <div class="dive-score-card dive-score-card--s${w.diveScore}">
        <div class="dive-score-card__icon">${getWeatherIcon(w.weatherCode)}</div>
        <div class="dive-score-card__info">
          <div class="dive-score-card__stars">${renderDiveStars(w.diveScore)}</div>
          <div class="dive-score-card__label">${t('weather.diveScore')}</div>
          <div class="dive-score-card__msg">${getDiveMessage(w.diveScore)}</div>
        </div>
      </div>`;
    section.insertAdjacentHTML('beforeend', scoreHtml);

    // ── Current weather grid ──
    const items = [];
    if (w.temperature != null) items.push({ label: t('weather.temperature'), value: `${w.temperature}°C` });
    if (w.weatherText) items.push({ label: t('weather.weather'), value: w.weatherText });
    if (w.windSpeed != null) items.push({ label: t('weather.windSpeed'), value: `${w.windSpeed} km/h` });
    if (w.windDir) items.push({ label: t('weather.windDir'), value: w.windDir });
    if (w.waterTemp != null) items.push({ label: t('weather.waterTemp'), value: `${w.waterTemp}°C` });
    if (w.waveHeight != null) items.push({ label: t('weather.waveHeight'), value: `${w.waveHeight}m` });
    if (w.waveDir) items.push({ label: t('weather.waveDir'), value: w.waveDir });
    if (w.wavePeriod != null) items.push({ label: t('weather.wavePeriod'), value: `${w.wavePeriod}s` });
    if (w.precipitation != null && w.precipitation > 0) items.push({ label: t('weather.precipitation'), value: `${w.precipitation}mm` });

    if (items.length) {
      const grid = document.createElement('div');
      grid.className = 'modal__weather-grid';
      grid.innerHTML = items.map(i => `
        <div class="weather-item">
          <div class="weather-item__label">${i.label}</div>
          <div class="weather-item__value">${i.value}</div>
        </div>
      `).join('');
      section.appendChild(grid);
    }

    // ── 7-Day Forecast ──
    if (daily && daily.length) {
      const forecastHtml = `
        <div class="weather-forecast">
          <div class="weather-forecast__title">${t('weather.forecast.title')}</div>
          <div class="weather-forecast__scroll">
            ${daily.map(d => `
              <div class="weather-forecast__day">
                <div class="weather-forecast__day-label">${d.dayLabel}</div>
                <div class="weather-forecast__day-icon">${getWeatherIcon(d.weatherCode)}</div>
                <div class="weather-forecast__day-temp">
                  <span class="weather-forecast__temp-hi">${d.tempMax != null ? Math.round(d.tempMax) + '°' : '-'}</span>
                  <span class="weather-forecast__temp-lo">${d.tempMin != null ? Math.round(d.tempMin) + '°' : '-'}</span>
                </div>
                <div class="weather-forecast__day-wave">${d.waveHeightMax != null ? d.waveHeightMax + 'm' : '-'}</div>
                <div class="weather-forecast__day-stars">${renderDiveStars(d.diveScore)}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
      section.insertAdjacentHTML('beforeend', forecastHtml);
    }
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

// ── Review Rendering ──

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderStars(rating, prefix = 'review-summary') {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${prefix}__star ${i <= rating ? prefix + '__star--filled' : ''}">&#9733;</span>`;
  }
  return html;
}

export function formatReviewDate(ts) {
  if (!ts) return '';
  const seconds = ts.seconds || ts._seconds || (typeof ts === 'number' ? ts : 0);
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  return d.toLocaleDateString();
}

async function loadAndRenderReviews(spotId) {
  const listEl = document.getElementById('review-list');
  if (!listEl) return;
  try {
    const reviews = await loadReviews(spotId);
    renderReviewSummary(reviews);
    const sortWrap = document.getElementById('review-sort-wrap');
    if (sortWrap) sortWrap.style.display = reviews.length > 0 ? '' : 'none';
    renderReviewList(spotId, 'latest');
  } catch {
    listEl.innerHTML = `<div class="review-empty">${t('review.error.load')}</div>`;
  }
}

function renderReviewSummary(reviews) {
  const el = document.getElementById('review-summary');
  if (!el) return;
  if (!reviews || reviews.length === 0) {
    el.innerHTML = '';
    return;
  }
  const avg = getAverageRating(reviews);
  el.innerHTML = `
    <div class="review-summary">
      <span class="review-summary__avg">${avg.toFixed(1)}</span>
      <div class="review-summary__stars">${renderStars(Math.round(avg))}</div>
      <span class="review-summary__count">${reviews.length}${t('review.countSuffix')}</span>
    </div>
  `;
}

function renderReviewList(spotId, sortBy) {
  const listEl = document.getElementById('review-list');
  if (!listEl) return;
  const reviews = getCachedReviews(spotId);
  if (!reviews || reviews.length === 0) {
    listEl.innerHTML = `<div class="review-empty">${t('review.empty')}</div>`;
    return;
  }
  const sorted = sortReviews(reviews, sortBy);
  const uid = getCurrentUid();
  listEl.innerHTML = '';
  sorted.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-card';
    const isOwner = uid && review.userId === uid;
    const mediaThumbs = (review.media || []).map((m, i) => {
      const isVideo = m.url && (m.url.includes('.mp4') || m.url.includes('.mov') || m.url.includes('video'));
      return `<div class="review-card__thumb ${isVideo ? 'review-card__thumb--video' : ''}" data-review-id="${review.id}" data-media-index="${i}">
        <img src="${escapeHtml(m.url)}" alt="" loading="lazy" />
      </div>`;
    }).join('');

    const authorClickable = review.userId ? ' review-card__author--clickable' : '';
    card.innerHTML = `
      <div class="review-card__header">
        <span class="review-card__author${authorClickable}" ${review.userId ? `data-user-id="${review.userId}"` : ''}>${escapeHtml(review.nickname || 'Anonymous')}</span>
        <span class="review-card__date">${formatReviewDate(review.createdAt)}</span>
      </div>
      <div class="review-card__stars">${renderStars(review.rating, 'review-card')}</div>
      ${review.title ? `<div class="review-card__title">${escapeHtml(review.title)}</div>` : ''}
      ${review.content ? `<div class="review-card__content">${escapeHtml(review.content)}</div>` : ''}
      ${review.visitDate ? `<div class="review-card__visit">${escapeHtml(review.visitDate)}</div>` : ''}
      ${mediaThumbs ? `<div class="review-card__media">${mediaThumbs}</div>` : ''}
      ${isOwner ? `<div class="review-card__actions">
        <button class="review-card__edit-btn" data-review-id="${review.id}">${t('review.edit')}</button>
        <button class="review-card__delete-btn" data-review-id="${review.id}">${t('review.delete')}</button>
      </div>` : ''}
    `;

    // Author click → open profile
    const authorEl = card.querySelector('.review-card__author--clickable');
    if (authorEl) {
      authorEl.addEventListener('click', () => {
        const userId = authorEl.dataset.userId;
        if (userId) {
          document.dispatchEvent(new CustomEvent('open-profile', { detail: { userId } }));
        }
      });
    }

    // Media thumbnail click → open viewer
    card.querySelectorAll('.review-card__thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const rId = thumb.dataset.reviewId;
        const idx = parseInt(thumb.dataset.mediaIndex);
        const r = reviews.find(rv => rv.id === rId);
        if (r?.media) {
          document.dispatchEvent(new CustomEvent('open-media-viewer', { detail: { media: r.media, index: idx } }));
        }
      });
    });

    // Edit/Delete buttons
    if (isOwner) {
      card.querySelector('.review-card__edit-btn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('edit-review', { detail: { review, spotId } }));
      });
      card.querySelector('.review-card__delete-btn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('delete-review', { detail: { reviewId: review.id, spotId } }));
      });
    }

    listEl.appendChild(card);
  });
}

export function refreshReviews(spotId) {
  loadAndRenderReviews(spotId);
}
