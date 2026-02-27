// Leaflet 지도 + 마커 관리
import { t, td } from './i18n.js';

let map;
let markerLayer;
let personalMarkerLayer;
let onSpotClick = () => {};
let onPersonalSpotClick = () => {};

const DIFFICULTY_CLASS = {
  beginner: 'marker--beginner',
  intermediate: 'marker--intermediate',
  advanced: 'marker--advanced',
};

const ICON_SVG = {
  // 스킨: 마스크 심볼 (매우 단순화)
  skin: `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="12" rx="10" ry="6" fill="white" opacity="0.95"/>
    <ellipse cx="7" cy="12" rx="4" ry="4" fill="#29B6F6"/>
    <ellipse cx="17" cy="12" rx="4" ry="4" fill="#29B6F6"/>
    <rect x="11" y="10" width="2" height="4" fill="white"/>
  </svg>`,
  
  // 스쿠버: 탱크 심볼 (매우 단순화)
  scuba: `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="4" width="10" height="18" rx="4" fill="white" opacity="0.95"/>
    <rect x="10" y="1" width="4" height="4" rx="1" fill="white"/>
    <circle cx="19" cy="6" r="2.5" fill="white"/>
    <circle cx="21" cy="10" r="1.5" fill="white" opacity="0.7"/>
  </svg>`,
  
  // 둘 다
  both: `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="8" cy="14" rx="6" ry="4" fill="white" opacity="0.95"/>
    <ellipse cx="5" cy="14" rx="2.5" ry="2.5" fill="#29B6F6"/>
    <ellipse cx="11" cy="14" rx="2.5" ry="2.5" fill="#29B6F6"/>
    <rect x="16" y="6" width="6" height="12" rx="2.5" fill="white" opacity="0.95"/>
    <rect x="17.5" y="3" width="3" height="3" rx="0.8" fill="white"/>
  </svg>`,
};

function createIcon(difficulty, activityTypes) {
  const key = activityTypes.includes('skin') && activityTypes.includes('scuba')
    ? 'both' : activityTypes.includes('skin') ? 'skin' : 'scuba';
  return L.divIcon({
    className: '',
    html: `<div class="marker ${DIFFICULTY_CLASS[difficulty] || ''}"><div class="marker__inner">${ICON_SVG[key]}</div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

function popupHtml(spot) {
  return `
    <div class="popup">
      <div class="popup__name">${td(spot, 'name')}</div>
      <div class="popup__meta">
        <span>${t('difficulty.' + spot.difficulty)}</span>
        <span>${spot.waterTemp.min}~${spot.waterTemp.max}°C</span>
      </div>
      <button class="popup__btn" data-spot-id="${spot.id}">${t('card.detail')}</button>
    </div>
  `;
}

export function initMap() {
  map = L.map('map', {
    center: [0, 130],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  markerLayer = L.featureGroup().addTo(map);
  personalMarkerLayer = L.featureGroup().addTo(map);

  // 팝업 버튼 클릭 이벤트 위임
  map.on('popupopen', e => {
    const btn = e.popup.getElement().querySelector('.popup__btn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (btn.dataset.myspotId) {
          onPersonalSpotClick(+btn.dataset.myspotId);
        } else {
          const id = +btn.dataset.spotId;
          onSpotClick(id);
        }
      });
    }
  });
}

export function setMapSpotClickHandler(fn) {
  onSpotClick = fn;
}

export function updateMarkers(spots, fitToMarkers = false) {
  markerLayer.clearLayers();
  spots.forEach(spot => {
    const marker = L.marker([spot.lat, spot.lng], {
      icon: createIcon(spot.difficulty, spot.activityTypes),
    });
    marker.bindPopup(popupHtml(spot));
    markerLayer.addLayer(marker);
  });
  
  // 첫 로딩 시 모든 마커가 보이도록 지도 범위 조정
  if (fitToMarkers && spots.length > 0) {
    const bounds = markerLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
    }
  }
}

export function flyToSpot(lat, lng) {
  map.flyTo([lat, lng], 10, { duration: 1 });
}

export function invalidateMapSize() {
  if (map) setTimeout(() => map.invalidateSize(), 100);
}

export function getMapInstance() {
  return map;
}

const STAR_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="white" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 1.5l2 4.5 4.5.5-3.5 3 1 4.5L8 11.5 3.5 14l1-4.5L1 6.5 5.5 6z"/>
</svg>`;

function createPersonalIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="marker--personal">${STAR_SVG}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function personalPopupHtml(spot) {
  return `
    <div class="popup">
      <div class="popup__name">${spot.name}</div>
      <div class="popup__meta">
        <span>${t('myspot.badge')}</span>
        ${spot.depth ? `<span>${spot.depth}</span>` : ''}
      </div>
      <button class="popup__btn" data-myspot-id="${spot.id}">${t('card.detail')}</button>
    </div>
  `;
}

export function updatePersonalMarkers(mySpots) {
  personalMarkerLayer.clearLayers();
  mySpots.forEach(spot => {
    const marker = L.marker([spot.lat, spot.lng], {
      icon: createPersonalIcon(),
    });
    marker.bindPopup(personalPopupHtml(spot));
    personalMarkerLayer.addLayer(marker);
  });
}

export function setPersonalSpotClickHandler(fn) {
  onPersonalSpotClick = fn;
}
