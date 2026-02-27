// 앱 엔트리 포인트
import { spots } from './data.js';
import { initMap, updateMarkers, setMapSpotClickHandler, flyToSpot, invalidateMapSize } from './map.js';
import { renderCards, renderFavEmpty, openModal, initModal, setDetailClickHandler, updateFavCount } from './ui.js';
import { initFilters, filterSpots, setFilterListener } from './filters.js';
import { getFavorites } from './favorites.js';

// ── State ──
let currentView = 'map'; // 'map' | 'list' | 'favorites'

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initFilters();
  initModal();

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
});

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
