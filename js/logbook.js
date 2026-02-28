// 다이빙 로그북 관리 (Firestore + 메모리 캐시)
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

let entries = [];

function userLogCol() {
  const uid = getCurrentUid();
  if (!uid) return null;
  return collection(db, 'users', uid, 'logbook');
}

/** Firestore에서 로그 전체 로드 */
export async function loadLogbook() {
  const col = userLogCol();
  if (!col) { entries = []; return; }
  const snap = await getDocs(col);
  entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 메모리 캐시 초기화 (로그아웃 시) */
export function clearLogbook() {
  entries = [];
}

export function getLogEntries() {
  return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function getLogEntry(id) {
  return entries.find(e => e.id === id) || null;
}

export async function addLogEntry(entry) {
  const col = userLogCol();
  if (!col) return null;
  const data = {
    date: entry.date || new Date().toISOString().slice(0, 10),
    spotName: entry.spotName || '',
    spotId: entry.spotId || null,
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    activityType: entry.activityType || 'skin',
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
  const ref = await addDoc(col, data);
  const newEntry = { id: ref.id, ...data };
  entries.push(newEntry);
  return newEntry;
}

export async function updateLogEntry(id, data) {
  const col = userLogCol();
  if (!col) return null;
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  await updateDoc(doc(col, id), data);
  entries[idx] = { ...entries[idx], ...data, id };
  return entries[idx];
}

export async function deleteLogEntry(id) {
  const col = userLogCol();
  if (!col) return;
  await deleteDoc(doc(col, id));
  entries = entries.filter(e => e.id !== id);
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
