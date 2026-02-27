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
  // Snorkel mask + J-snorkel (더 선명한 버전)
  skin: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- 마스크 -->
    <path d="M3 8 Q3 5 6 4.5 L14 4.5 Q17 5 17 8 L17 11 Q17 13.5 14 14 L11 14 L10 16 L10 14 L6 14 Q3 13.5 3 11Z" fill="rgba(255,255,255,0.9)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    <!-- 마스크 중앙선 -->
    <line x1="10" y1="5.5" x2="10" y2="13" stroke="rgba(0,150,200,0.5)" stroke-width="1"/>
    <!-- 마스크 반사광 -->
    <ellipse cx="7" cy="8.5" rx="1.5" ry="1" fill="rgba(255,255,255,0.7)"/>
    <!-- J자 스노클 -->
    <path d="M17 6 L18.5 4 L18.5 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18.5" cy="0.8" r="1" fill="white"/>
  </svg>`,
  // Scuba tank + regulator + bubbles (더 선명한 버전)
  scuba: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- 탱크 본체 -->
    <rect x="5" y="5" width="7" height="12" rx="2" fill="rgba(255,255,255,0.9)" stroke="white" stroke-width="1.5"/>
    <!-- 탱크 밸브 -->
    <rect x="7" y="2" width="3" height="3" rx="0.5" fill="white"/>
    <line x1="8.5" y1="2" x2="8.5" y2="0.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <!-- 레귤레이터 호스 -->
    <path d="M12 7 Q14 7 15 9 L15 11" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <circle cx="15" cy="12" r="1.5" fill="white"/>
    <!-- 공기방울 -->
    <circle cx="16" cy="5" r="1.5" fill="white" opacity="0.9"/>
    <circle cx="18" cy="2.5" r="1" fill="white" opacity="0.7"/>
    <circle cx="17" cy="0.5" r="0.7" fill="white" opacity="0.5"/>
  </svg>`,
  // Mask + tank combined (더 선명한 버전)
  both: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- 마스크 (작게) -->
    <path d="M1 7 Q1 5 3 4.5 L8 4.5 Q9.5 5 9.5 7 L9.5 9 Q9.5 10.5 8 11 L3 11 Q1 10.5 1 9Z" fill="rgba(255,255,255,0.9)" stroke="white" stroke-width="1.2"/>
    <ellipse cx="4" cy="7.5" rx="1" ry="0.7" fill="rgba(255,255,255,0.7)"/>
    <!-- 스노클 -->
    <path d="M9.5 5.5 L10.5 4 L10.5 2" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
    <!-- 탱크 (작게) -->
    <rect x="12" y="5" width="5" height="9" rx="1.5" fill="rgba(255,255,255,0.9)" stroke="white" stroke-width="1.2"/>
    <rect x="13.5" y="3" width="2" height="2" rx="0.3" fill="white"/>
    <!-- 공기방울 -->
    <circle cx="18.5" cy="4" r="1" fill="white" opacity="0.8"/>
    <circle cx="19" cy="2" r="0.6" fill="white" opacity="0.6"/>
  </svg>`,
};

function createIcon(difficulty, activityTypes) {
  const key = activityTypes.includes('skin') && activityTypes.includes('scuba')
    ? 'both' : activityTypes.includes('skin') ? 'skin' : 'scuba';
  return L.divIcon({
    className: '',
    html: `<div class="marker ${DIFFICULTY_CLASS[difficulty] || ''}"><div class="marker__inner">${ICON_SVG[key]}</div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
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
    center: [20, 120],
    zoom: 3,
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

  markerLayer = L.layerGroup().addTo(map);
  personalMarkerLayer = L.layerGroup().addTo(map);

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

export function updateMarkers(spots) {
  markerLayer.clearLayers();
  spots.forEach(spot => {
    const marker = L.marker([spot.lat, spot.lng], {
      icon: createIcon(spot.difficulty, spot.activityTypes),
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
