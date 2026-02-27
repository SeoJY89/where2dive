// 필터 상태 관리 + 필터링 로직
import { spots, REGIONS } from './data.js';

const state = {
  search: '',
  region: '',
  difficulty: '',
  tempMin: 0,
  tempMax: 35,
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
  state.difficulty = '';
  state.tempMin = 0;
  state.tempMax = 35;
  syncDOM();
  onChange();
}

function syncDOM() {
  document.getElementById('search-input').value = state.search;
  document.getElementById('region-select').value = state.region;
  document.getElementById('difficulty-select').value = state.difficulty;
  document.getElementById('temp-min').value = state.tempMin;
  document.getElementById('temp-max').value = state.tempMax;
  updateTempLabel();
}

function updateTempLabel() {
  document.getElementById('temp-value').textContent = `${state.tempMin}°C ~ ${state.tempMax}°C`;
}

export function filterSpots(favOnly = false, favSet = null) {
  return spots.filter(s => {
    if (favOnly && favSet && !favSet.has(s.id)) return false;

    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [s.name, s.country, s.description, ...s.marineLife].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (state.region && s.region !== state.region) return false;
    if (state.difficulty && s.difficulty !== state.difficulty) return false;

    const spotMin = s.waterTemp.min;
    const spotMax = s.waterTemp.max;
    if (spotMax < state.tempMin || spotMin > state.tempMax) return false;

    return true;
  });
}

export function initFilters() {
  // 지역 드롭다운 채우기
  const regionSel = document.getElementById('region-select');
  REGIONS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.label;
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
  document.getElementById('difficulty-select').addEventListener('change', e => {
    state.difficulty = e.target.value;
    onChange();
  });

  const tempMin = document.getElementById('temp-min');
  const tempMax = document.getElementById('temp-max');

  function handleTemp() {
    let lo = +tempMin.value;
    let hi = +tempMax.value;
    if (lo > hi) { [lo, hi] = [hi, lo]; tempMin.value = lo; tempMax.value = hi; }
    state.tempMin = lo;
    state.tempMax = hi;
    updateTempLabel();
    onChange();
  }
  tempMin.addEventListener('input', handleTemp);
  tempMax.addEventListener('input', handleTemp);

  document.getElementById('filter-reset').addEventListener('click', resetFilters);
  const emptyReset = document.getElementById('empty-reset');
  if (emptyReset) emptyReset.addEventListener('click', resetFilters);

  // 모바일 필터 토글
  const toggle = document.getElementById('filter-toggle');
  const bar = document.getElementById('filter-bar');
  if (toggle) {
    toggle.addEventListener('click', () => {
      bar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', bar.classList.contains('open'));
    });
  }
}
