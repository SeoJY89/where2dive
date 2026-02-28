// 필터 상태 관리 + 필터링 로직
import { spots, REGIONS, COUNTRY_MAP } from './data.js';
import { getLang, t, td } from './i18n.js';
import { getMySpots } from './myspots.js';

const state = {
  search: '',
  region: '',
  activityType: '',  // '' | 'skin' | 'scuba' | 'myspot'
  country: '',       // Korean country name (e.g. '한국')
  difficulty: '',    // '' | 'beginner' | 'intermediate' | 'advanced'
  season: '',        // '' | '1' ~ '12' (month number)
  tempMin: '',       // '' | '15' | '20' | '25' | '28'
  visibilityMin: '', // '' | '5' | '10' | '15' | '20' | '30'
};

let onChange = () => {};
let onSearchToggle = null;

export function getFilterState() {
  return { ...state };
}

export function setFilterListener(fn) {
  onChange = fn;
}

export function setSearchToggleListener(fn) {
  onSearchToggle = fn;
}

export function resetFilters() {
  state.search = '';
  state.region = '';
  state.activityType = '';
  state.country = '';
  state.difficulty = '';
  state.season = '';
  state.tempMin = '';
  state.visibilityMin = '';
  syncDOM();
  onChange();
}

export function setCountry(koName) {
  state.country = koName;
  syncDOM();
  onChange();
}

/** Parse visibility string like "10~30m" → {min, max} */
function parseVisibility(vis) {
  if (!vis) return null;
  const m = vis.match(/(\d+)~(\d+)/);
  if (m) return { min: +m[1], max: +m[2] };
  const single = vis.match(/(\d+)/);
  if (single) return { min: +single[1], max: +single[1] };
  return null;
}

function syncDOM() {
  document.getElementById('search-input').value = state.search;
  document.getElementById('region-select').value = state.region;

  // Activity toggle (desktop + mobile)
  document.querySelectorAll('.activity-toggle__btn, .mobile-activity-tabs__btn').forEach(btn => {
    const isActive = btn.dataset.activity === state.activityType;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  // Country autocomplete
  const countryInput = document.getElementById('country-input');
  const countryClear = document.getElementById('country-clear');
  if (state.country) {
    const entry = COUNTRY_MAP.find(c => c.ko === state.country);
    countryInput.value = entry ? `${entry.en} (${entry.ko})` : state.country;
    countryClear.classList.remove('hidden');
  } else {
    countryInput.value = '';
    countryClear.classList.add('hidden');
  }
  closeCountryList();

  // New filter selects
  const diffSel = document.getElementById('difficulty-select');
  if (diffSel) diffSel.value = state.difficulty;
  const seasonSel = document.getElementById('season-select');
  if (seasonSel) seasonSel.value = state.season;
  const tempSel = document.getElementById('temp-select');
  if (tempSel) tempSel.value = state.tempMin;
  const visSel = document.getElementById('visibility-select');
  if (visSel) visSel.value = state.visibilityMin;
}

export function filterSpots(favOnly = false, favSet = null) {
  // 'myspot' filter shows only personal spots, no regular spots
  if (state.activityType === 'myspot') return [];

  // 'favorites' filter shows only favorited spots
  const isFavFilter = state.activityType === 'favorites';

  return spots.filter(s => {
    if ((favOnly || isFavFilter) && favSet && !favSet.has(String(s.id))) return false;

    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [
        td(s, 'name'), td(s, 'country'), td(s, 'description'),
        ...(getLang() === 'en' && s.marineLifeEn ? s.marineLifeEn : s.marineLife),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (state.region && s.region !== state.region) return false;

    // Activity type filter (skip for 'favorites' — already handled above)
    if (state.activityType && state.activityType !== 'favorites' && !s.activityTypes.includes(state.activityType)) return false;

    // Country filter
    if (state.country && s.country !== state.country) return false;

    // Difficulty filter
    if (state.difficulty && s.difficulty !== state.difficulty) return false;

    // Season filter (month number → Korean month string)
    if (state.season) {
      const monthStr = state.season + '월';
      if (!s.bestSeason || !s.bestSeason.includes(monthStr)) return false;
    }

    // Temperature filter (check if spot's max temp >= selected minimum)
    if (state.tempMin) {
      if (!s.waterTemp || s.waterTemp.max < +state.tempMin) return false;
    }

    // Visibility filter (parse visibility string and check max >= selected minimum)
    if (state.visibilityMin) {
      const vis = parseVisibility(s.visibility);
      if (!vis || vis.max < +state.visibilityMin) return false;
    }

    return true;
  });
}

/** Count spots per activity type using all filters EXCEPT activityType.
 *  Includes personal spots in total/skin/scuba counts. */
export function getActivityCounts(favOnly = false, favSet = null) {
  let total = 0, skin = 0, scuba = 0, myspot = 0, favorites = 0;
  for (const s of spots) {
    if (favOnly && favSet && !favSet.has(String(s.id))) continue;
    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [
        td(s, 'name'), td(s, 'country'), td(s, 'description'),
        ...(getLang() === 'en' && s.marineLifeEn ? s.marineLifeEn : s.marineLife),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    if (state.region && s.region !== state.region) continue;
    if (state.country && s.country !== state.country) continue;
    if (state.difficulty && s.difficulty !== state.difficulty) continue;
    if (state.season) {
      const monthStr = state.season + '월';
      if (!s.bestSeason || !s.bestSeason.includes(monthStr)) continue;
    }
    if (state.tempMin && (!s.waterTemp || s.waterTemp.max < +state.tempMin)) continue;
    if (state.visibilityMin) {
      const vis = parseVisibility(s.visibility);
      if (!vis || vis.max < +state.visibilityMin) continue;
    }
    total++;
    if (s.activityTypes.includes('skin')) skin++;
    if (s.activityTypes.includes('scuba')) scuba++;
    if (favSet && favSet.has(String(s.id))) favorites++;
  }

  // Include personal spots in counts
  const mySpots = getMySpots();
  for (const s of mySpots) {
    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [s.name, s.memo || ''].join(' ').toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    myspot++;
    total++;
    if (s.activityTypes.includes('skin')) skin++;
    if (s.activityTypes.includes('scuba')) scuba++;
  }

  return { total, skin, scuba, myspot, favorites };
}

// ── Country autocomplete helpers ──

let acHighlight = -1;

function getFilteredCountries(query) {
  const q = query.toLowerCase();
  return COUNTRY_MAP.filter(c =>
    c.en.toLowerCase().includes(q) || c.ko.toLowerCase().includes(q)
  );
}

function renderCountryList(matches) {
  const list = document.getElementById('country-list');
  list.innerHTML = '';
  if (matches.length === 0) {
    list.classList.add('hidden');
    return;
  }
  matches.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'autocomplete__item';
    li.setAttribute('role', 'option');
    li.dataset.ko = c.ko;
    li.textContent = `${c.en} (${c.ko})`;
    if (i === acHighlight) li.classList.add('active');
    li.addEventListener('mousedown', e => {
      e.preventDefault();
      selectCountry(c);
    });
    list.appendChild(li);
  });
  list.classList.remove('hidden');
}

function selectCountry(c) {
  state.country = c.ko;
  const countryInput = document.getElementById('country-input');
  countryInput.value = `${c.en} (${c.ko})`;
  document.getElementById('country-clear').classList.remove('hidden');
  closeCountryList();
  onChange();
}

function closeCountryList() {
  const list = document.getElementById('country-list');
  list.classList.add('hidden');
  acHighlight = -1;
}

// ── Refresh labels on language change ──

export function refreshFilterLabels() {
  // Search placeholder
  document.getElementById('search-input').placeholder = t('filter.search.placeholder');

  // Country placeholder
  document.getElementById('country-input').placeholder = t('filter.country.placeholder');

  // Region select
  const regionSel = document.getElementById('region-select');
  regionSel.options[0].textContent = t('filter.region.all');
  REGIONS.forEach((r, i) => {
    if (regionSel.options[i + 1]) {
      regionSel.options[i + 1].textContent = getLang() === 'en' ? r.labelEn : r.label;
    }
  });

  // Activity toggle labels (preserve count spans)
  const actBtns = document.querySelectorAll('.activity-toggle__btn');
  actBtns.forEach(btn => {
    const act = btn.dataset.activity;
    const countSpan = btn.querySelector('.activity-toggle__count');
    const countHTML = countSpan ? countSpan.outerHTML : '';
    let label = '';
    if (act === '') label = t('filter.activity.all');
    else if (act === 'skin') label = t('filter.activity.skin');
    else if (act === 'scuba') label = t('filter.activity.scuba');
    else if (act === 'myspot') label = t('myspot.badge');
    else if (act === 'favorites') label = '♥ ' + t('filter.activity.favorites');
    btn.innerHTML = label + countHTML;
  });

  // New filter selects
  const diffSel = document.getElementById('difficulty-select');
  if (diffSel) {
    diffSel.options[0].textContent = t('filter.difficulty.all');
    for (let i = 1; i < diffSel.options.length; i++) {
      const val = diffSel.options[i].value;
      diffSel.options[i].textContent = t('difficulty.' + val);
    }
  }
  const seasonSel = document.getElementById('season-select');
  if (seasonSel) {
    seasonSel.options[0].textContent = t('filter.season.all');
    for (let i = 1; i <= 12; i++) {
      if (seasonSel.options[i]) seasonSel.options[i].textContent = t('filter.month.' + i);
    }
  }
  const tempSel = document.getElementById('temp-select');
  if (tempSel) {
    tempSel.options[0].textContent = t('filter.temp.all');
  }
  const visSel = document.getElementById('visibility-select');
  if (visSel) {
    visSel.options[0].textContent = t('filter.visibility.all');
  }

  // Reset button
  document.getElementById('filter-reset').textContent = t('filter.reset');

  // Mobile filter toggle text (now search button)
  const filterToggleText = document.getElementById('filter-toggle-text');
  if (filterToggleText) filterToggleText.textContent = t('filter.search.button');

  // Mobile activity tab labels
  const mobActLabels = {
    'mob-act-all-text': 'filter.activity.all',
    'mob-act-skin-text': 'filter.activity.skin',
    'mob-act-scuba-text': 'filter.activity.scuba',
    'mob-act-myspot-text': 'myspot.badge',
  };
  for (const [id, key] of Object.entries(mobActLabels)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }
  const mobFavEl = document.getElementById('mob-act-fav-text');
  if (mobFavEl) mobFavEl.textContent = '♥';
}

// ── Init ──

export function initFilters() {
  // 지역 드롭다운 채우기
  const regionSel = document.getElementById('region-select');
  REGIONS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = getLang() === 'en' ? r.labelEn : r.label;
    regionSel.appendChild(opt);
  });

  // 이벤트 바인딩
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value.trim();
    onChange();
  });
  document.getElementById('region-select').addEventListener('change', e => {
    state.region = e.target.value;
    onChange();
  });

  // New filter selects
  const diffSel = document.getElementById('difficulty-select');
  if (diffSel) diffSel.addEventListener('change', e => { state.difficulty = e.target.value; onChange(); });
  const seasonSel = document.getElementById('season-select');
  if (seasonSel) seasonSel.addEventListener('change', e => { state.season = e.target.value; onChange(); });
  const tempSel = document.getElementById('temp-select');
  if (tempSel) tempSel.addEventListener('change', e => { state.tempMin = e.target.value; onChange(); });
  const visSel = document.getElementById('visibility-select');
  if (visSel) visSel.addEventListener('change', e => { state.visibilityMin = e.target.value; onChange(); });

  document.getElementById('filter-reset').addEventListener('click', resetFilters);
  const emptyReset = document.getElementById('empty-reset');
  if (emptyReset) emptyReset.addEventListener('click', resetFilters);

  // ── Activity toggle (desktop + mobile) ──
  document.querySelectorAll('.activity-toggle__btn, .mobile-activity-tabs__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activityType = btn.dataset.activity;
      document.querySelectorAll('.activity-toggle__btn, .mobile-activity-tabs__btn').forEach(b => {
        const isActive = b.dataset.activity === state.activityType;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive);
      });
      onChange();
    });
  });

  // ── Country autocomplete ──
  const countryInput = document.getElementById('country-input');
  const countryClear = document.getElementById('country-clear');

  countryInput.addEventListener('input', () => {
    const q = countryInput.value.trim();
    const hadCountry = !!state.country;

    // Any text edit clears the current country selection
    if (state.country) {
      state.country = '';
      countryClear.classList.add('hidden');
    }

    if (!q) {
      closeCountryList();
    } else {
      acHighlight = -1;
      const matches = getFilteredCountries(q);
      renderCountryList(matches);
    }

    if (hadCountry) onChange();
  });

  countryInput.addEventListener('focus', () => {
    const q = countryInput.value.trim();
    if (q && !state.country) {
      const matches = getFilteredCountries(q);
      renderCountryList(matches);
    }
  });

  countryInput.addEventListener('keydown', e => {
    const list = document.getElementById('country-list');
    const items = list.querySelectorAll('.autocomplete__item');
    if (list.classList.contains('hidden') || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acHighlight = Math.min(acHighlight + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === acHighlight));
      items[acHighlight]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acHighlight = Math.max(acHighlight - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === acHighlight));
      items[acHighlight]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acHighlight >= 0 && acHighlight < items.length) {
        const ko = items[acHighlight].dataset.ko;
        const entry = COUNTRY_MAP.find(c => c.ko === ko);
        if (entry) selectCountry(entry);
      }
    } else if (e.key === 'Escape') {
      closeCountryList();
    }
  });

  countryInput.addEventListener('blur', () => {
    // Delay to allow mousedown on list items
    setTimeout(closeCountryList, 150);
  });

  countryClear.addEventListener('click', () => {
    state.country = '';
    countryInput.value = '';
    countryClear.classList.add('hidden');
    closeCountryList();
    onChange();
  });

  // 모바일 검색 버튼
  const toggle = document.getElementById('filter-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (onSearchToggle) onSearchToggle();
    });
  }

  // Apply initial i18n labels
  refreshFilterLabels();
}

/** Filter personal spots by search and activity type */
export function filterMySpots(mySpots) {
  return mySpots.filter(s => {
    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [s.name, s.memo || ''].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    // 'myspot' filter shows all personal spots; skin/scuba filters match activity
    if (state.activityType && state.activityType !== 'myspot' && !s.activityTypes.includes(state.activityType)) return false;
    return true;
  });
}
