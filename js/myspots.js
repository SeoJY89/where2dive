// 개인 다이빙 스팟 관리 (localStorage)
const STORAGE_KEY = 'where2dive_myspots';

let mySpots = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mySpots));
}

function nextId() {
  return mySpots.length === 0 ? 1 : Math.max(...mySpots.map(s => s.id)) + 1;
}

export function getMySpots() {
  return [...mySpots];
}

export function getMySpot(id) {
  return mySpots.find(s => s.id === id) || null;
}

export function addMySpot(spot) {
  const newSpot = {
    id: nextId(),
    name: spot.name || '',
    lat: spot.lat ?? 0,
    lng: spot.lng ?? 0,
    depth: spot.depth || '',
    waterTemp: { min: spot.waterTemp?.min ?? null, max: spot.waterTemp?.max ?? null },
    difficulty: spot.difficulty || 'beginner',
    activityTypes: spot.activityTypes || ['skin'],
    memo: spot.memo || '',
    isPersonal: true,
  };
  mySpots.push(newSpot);
  persist();
  return newSpot;
}

export function updateMySpot(id, data) {
  const idx = mySpots.findIndex(s => s.id === id);
  if (idx === -1) return null;
  mySpots[idx] = { ...mySpots[idx], ...data, id, isPersonal: true };
  persist();
  return mySpots[idx];
}

export function deleteMySpot(id) {
  mySpots = mySpots.filter(s => s.id !== id);
  persist();
}
