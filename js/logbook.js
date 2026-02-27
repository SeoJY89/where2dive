// 다이빙 로그북 관리 (localStorage)
const STORAGE_KEY = 'where2dive_logbook';

let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function nextId() {
  return entries.length === 0 ? 1 : Math.max(...entries.map(e => e.id)) + 1;
}

export function getLogEntries() {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function getLogEntry(id) {
  return entries.find(e => e.id === id) || null;
}

export function addLogEntry(entry) {
  const newEntry = {
    id: nextId(),
    date: entry.date || new Date().toISOString().slice(0, 10),
    spotName: entry.spotName || '',
    spotId: entry.spotId || null,
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    activityType: entry.activityType || 'skin', // 'skin' | 'scuba'
    maxDepth: entry.maxDepth ?? null,
    diveTime: entry.diveTime ?? null,
    waterTemp: entry.waterTemp ?? null,
    visibility: entry.visibility ?? null,
    equipment: entry.equipment || '',
    weight: entry.weight ?? null,
    tankPressureStart: entry.tankPressureStart ?? null,
    tankPressureEnd: entry.tankPressureEnd ?? null,
    buddy: entry.buddy || '',
    weather: entry.weather || '',
    memo: entry.memo || '',
  };
  entries.push(newEntry);
  persist();
  return newEntry;
}

export function updateLogEntry(id, data) {
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...data, id };
  persist();
  return entries[idx];
}

export function deleteLogEntry(id) {
  entries = entries.filter(e => e.id !== id);
  persist();
}

export function getLogStats() {
  if (entries.length === 0) return { totalDives: 0, maxDepth: 0, totalTime: 0 };
  let maxDepth = 0;
  let totalTime = 0;
  for (const e of entries) {
    if (e.maxDepth != null && e.maxDepth > maxDepth) maxDepth = e.maxDepth;
    if (e.diveTime != null) totalTime += e.diveTime;
  }
  return { totalDives: entries.length, maxDepth, totalTime };
}
