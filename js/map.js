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
  // Snorkel mask + J-snorkel
  skin: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6.5 Q3 4.5 5 4 L11 4 Q13 4.5 13 6.5 L13 8.5 Q13 10 11 10.5 L9.5 10.5 L8 12 L8 10.5 L5 10.5 Q3 10 3 8.5Z" fill="rgba(255,255,255,0.3)" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
    <line x1="8" y1="5.5" x2="8" y2="9" stroke="white" stroke-width="0.8"/>
    <circle cx="5.8" cy="7.2" r="1" fill="white" opacity="0.6"/>
    <path d="M13 5.5 L14 4 L14 1.5" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="14" cy="1.2" r="0.6" fill="white"/>
  </svg>`,
  // Scuba tank + regulator hose + bubbles
  scuba: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4.5" y="4" width="5" height="9" rx="1.5" fill="rgba(255,255,255,0.3)" stroke="white" stroke-width="1.2"/>
    <line x1="7" y1="4" x2="7" y2="2.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="5.5" y1="2.5" x2="8.5" y2="2.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M9.5 5.5 Q11 5.5 11.5 7 L11.5 8.5" stroke="white" stroke-width="1" stroke-linecap="round" fill="none"/>
    <circle cx="11.5" cy="9.2" r="1" stroke="white" stroke-width="0.8" fill="rgba(255,255,255,0.3)"/>
    <circle cx="13" cy="5" r="1" fill="white" opacity="0.8"/>
    <circle cx="14.2" cy="3" r="0.7" fill="white" opacity="0.6"/>
    <circle cx="12.5" cy="1.8" r="0.5" fill="white" opacity="0.4"/>
  </svg>`,
  // Mask (left) + tank (right) combined
  both: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 6 Q1 4.5 2.5 4.2 L6 4.2 Q7 4.5 7 6 L7 7.5 Q7 8.5 6 8.8 L2.5 8.8 Q1 8.5 1 7.5Z" fill="rgba(255,255,255,0.3)" stroke="white" stroke-width="1"/>
    <circle cx="3.5" cy="6.5" r="0.7" fill="white" opacity="0.6"/>
    <path d="M7 5 L7.8 3.5 L7.8 1.8" stroke="white" stroke-width="1" stroke-linecap="round"/>
    <rect x="9.5" y="4" width="4" height="7.5" rx="1.2" fill="rgba(255,255,255,0.3)" stroke="white" stroke-width="1"/>
    <line x1="11.5" y1="4" x2="11.5" y2="2.8" stroke="white" stroke-width="1" stroke-linecap="round"/>
    <line x1="10.5" y1="2.8" x2="12.5" y2="2.8" stroke="white" stroke-width="1" stroke-linecap="round"/>
    <circle cx="14.5" cy="5.5" r="0.6" fill="white" opacity="0.7"/>
    <circle cx="15" cy="3.8" r="0.4" fill="white" opacity="0.5"/>
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
