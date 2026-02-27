// 필터 상태 관리 + 필터링 로직
import { spots, REGIONS, COUNTRY_MAP } from './data.js';
import { getLang, t, td } from './i18n.js';

const state = {
  search: '',
  region: '',
  activityType: '',  // '' | 'skin' | 'scuba'
  country: '',       // Korean country name (e.g. '한국')
};

let onChange = () => {};

export function getFilterState() {
  return { ...state };
}

export function setFilterListener(fn) {
  onChange = fn;
}

export function resetFilters() {
  state.search = '';
  state.region = '';
  state.activityType = '';
  state.country = '';
  syncDOM();
  onChange();
}

function syncDOM() {
  document.getElementById('search-input').value = state.search;
  document.getElementById('region-select').value = state.region;

  // Activity toggle
  document.querySelectorAll('.activity-toggle__btn').forEach(btn => {
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
}

export function filterSpots(favOnly = false, favSet = null) {
  return spots.filter(s => {
    if (favOnly && favSet && !favSet.has(s.id)) return false;

    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [
        td(s, 'name'), td(s, 'country'), td(s, 'description'),
        ...(getLang() === 'en' && s.marineLifeEn ? s.marineLifeEn : s.marineLife),
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (state.region && s.region !== state.region) return false;

    // Activity type filter
    if (state.activityType && !s.activityTypes.includes(state.activityType)) return false;

    // Country filter
    if (state.country && s.country !== state.country) return false;

    return true;
  });
}

/** Count spots per activity type using all filters EXCEPT activityType */
export function getActivityCounts(favOnly = false, favSet = null) {
  let total = 0, skin = 0, scuba = 0;
  for (const s of spots) {
    if (favOnly && favSet && !favSet.has(s.id)) continue;
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
    total++;
    if (s.activityTypes.includes('skin')) skin++;
    if (s.activityTypes.includes('scuba')) scuba++;
  }
  return { total, skin, scuba };
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
    btn.innerHTML = label + countHTML;
  });

  // Reset button
  document.getElementById('filter-reset').textContent = t('filter.reset');

  // Mobile filter toggle text
  const filterToggleText = document.getElementById('filter-toggle-text');
  if (filterToggleText) filterToggleText.textContent = t('filter.button');
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

  document.getElementById('filter-reset').addEventListener('click', resetFilters);
  const emptyReset = document.getElementById('empty-reset');
  if (emptyReset) emptyReset.addEventListener('click', resetFilters);

  // ── Activity toggle ──
  document.querySelectorAll('.activity-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activityType = btn.dataset.activity;
      document.querySelectorAll('.activity-toggle__btn').forEach(b => {
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

  // 모바일 필터 토글
  const toggle = document.getElementById('filter-toggle');
  const bar = document.getElementById('filter-bar');
  if (toggle) {
    toggle.addEventListener('click', () => {
      bar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', bar.classList.contains('open'));
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
    if (state.activityType && !s.activityTypes.includes(state.activityType)) return false;
    return true;
  });
}
