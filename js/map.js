// Leaflet 지도 + 마커 관리
let map;
let markerLayer;
let onSpotClick = () => {};

const DIFFICULTY_CLASS = {
  beginner: 'marker--beginner',
  intermediate: 'marker--intermediate',
  advanced: 'marker--advanced',
};

function createIcon(difficulty) {
  return L.divIcon({
    className: '',
    html: `<div class="marker ${DIFFICULTY_CLASS[difficulty] || ''}"><div class="marker__inner"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

const DIFFICULTY_LABEL = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '상급',
};

function popupHtml(spot) {
  return `
    <div class="popup">
      <div class="popup__name">${spot.name}</div>
      <div class="popup__meta">
        <span>${DIFFICULTY_LABEL[spot.difficulty]}</span>
        <span>${spot.waterTemp.min}~${spot.waterTemp.max}°C</span>
      </div>
      <button class="popup__btn" data-spot-id="${spot.id}">상세보기</button>
    </div>
  `;
}

export function initMap() {
  map = L.map('map', {
    center: [20, 120],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  // 팝업 버튼 클릭 이벤트 위임
  map.on('popupopen', e => {
    const btn = e.popup.getElement().querySelector('.popup__btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const id = +btn.dataset.spotId;
        onSpotClick(id);
      });
    }
  });
}

export function setMapSpotClickHandler(fn) {
  onSpotClick = fn;
}

export function updateMarkers(spots) {
  markerLayer.clearLayers();
  spots.forEach(spot => {
    const marker = L.marker([spot.lat, spot.lng], {
      icon: createIcon(spot.difficulty),
    });
    marker.bindPopup(popupHtml(spot));
    markerLayer.addLayer(marker);
  });
}

export function flyToSpot(lat, lng) {
  map.flyTo([lat, lng], 10, { duration: 1 });
}

export function invalidateMapSize() {
  if (map) setTimeout(() => map.invalidateSize(), 100);
}
