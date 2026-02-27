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
  // 스킨다이빙: 마스크 + 스노클 (깔끔하고 굵은 라인)
  skin: `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g fill="white" stroke="white" stroke-width="0.5">
      <!-- 마스크 프레임 -->
      <rect x="2" y="8" width="15" height="10" rx="3" fill="white"/>
      <!-- 왼쪽 렌즈 -->
      <rect x="3.5" y="9.5" width="5" height="7" rx="1.5" fill="#4FC3F7"/>
      <!-- 오른쪽 렌즈 -->
      <rect x="10.5" y="9.5" width="5" height="7" rx="1.5" fill="#4FC3F7"/>
      <!-- 스노클 튜브 -->
      <path d="M17 12 L20 8 L20 2" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <!-- 스노클 마우스피스 -->
      <circle cx="20" cy="1.5" r="2" fill="white"/>
    </g>
  </svg>`,
  
  // 스쿠버: 탱크 + 버블 (깔끔하고 굵은 라인)
  scuba: `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g fill="white">
      <!-- 탱크 본체 -->
      <rect x="5" y="6" width="10" height="16" rx="4" fill="white"/>
      <!-- 탱크 밸브 -->
      <rect x="8" y="2" width="4" height="5" rx="1.5" fill="white"/>
      <!-- 밸브 휠 -->
      <circle cx="10" cy="1.5" r="2" fill="white"/>
      <!-- 레귤레이터 호스 -->
      <path d="M15 10 Q18 10 19 14" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <!-- 2단계 레귤 -->
      <circle cx="19.5" cy="15.5" r="2.5" fill="white"/>
      <!-- 공기방울들 -->
      <circle cx="21" cy="8" r="2.5" fill="white"/>
      <circle cx="23" cy="4" r="1.8" fill="white" opacity="0.8"/>
      <circle cx="20" cy="3" r="1.2" fill="white" opacity="0.6"/>
    </g>
  </svg>`,
  
  // 스킨 + 스쿠버 둘 다
  both: `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g fill="white">
      <!-- 마스크 (좌측) -->
      <rect x="1" y="8" width="10" height="7" rx="2" fill="white"/>
      <rect x="2" y="9" width="3.5" height="5" rx="1" fill="#4FC3F7"/>
      <rect x="6.5" y="9" width="3.5" height="5" rx="1" fill="#4FC3F7"/>
      <!-- 스노클 -->
      <path d="M11 10 L12.5 7 L12.5 4" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- 탱크 (우측) -->
      <rect x="15" y="6" width="6" height="12" rx="2.5" fill="white"/>
      <rect x="16.5" y="3" width="3" height="3.5" rx="1" fill="white"/>
      <!-- 버블 -->
      <circle cx="22.5" cy="5" r="1.8" fill="white"/>
      <circle cx="21" cy="2" r="1.2" fill="white" opacity="0.7"/>
    </g>
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
