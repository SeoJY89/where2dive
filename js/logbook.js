// 다이빙 로그북 관리 (Firestore + 메모리 캐시)
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { uploadFile, deleteFile, resizeImage } from './reviews.js';

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

export async function addLogEntry(entry, files, onProgress) {
  const col = userLogCol();
  if (!col) return null;
  const uid = getCurrentUid();
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
    media: [],
  };
  const docRef = await addDoc(col, data);

  if (files && files.length > 0) {
    const mediaResults = [];
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      if (file.type && file.type.startsWith('image/')) {
        file = await resizeImage(file);
      }
      const ext = files[i].name ? files[i].name.split('.').pop() : 'jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `logbook/${uid}/${docRef.id}/${filename}`;
      const result = await uploadFile(path, file, (p) => {
        if (onProgress) onProgress((i + p) / files.length);
      });
      mediaResults.push(result);
    }
    await updateDoc(doc(col, docRef.id), { media: mediaResults });
    data.media = mediaResults;
  }

  const newEntry = { id: docRef.id, ...data };
  entries.push(newEntry);
  return newEntry;
}

export async function updateLogEntry(id, data, newFiles, removedPaths, onProgress) {
  const col = userLogCol();
  if (!col) return null;
  const uid = getCurrentUid();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;

  // Delete removed media
  if (removedPaths && removedPaths.length > 0) {
    for (const p of removedPaths) {
      try { await deleteFile(p); } catch { /* ignore missing */ }
    }
  }

  // Upload new files
  const newMedia = [];
  if (newFiles && newFiles.length > 0) {
    for (let i = 0; i < newFiles.length; i++) {
      let file = newFiles[i];
      if (file.type && file.type.startsWith('image/')) {
        file = await resizeImage(file);
      }
      const ext = newFiles[i].name ? newFiles[i].name.split('.').pop() : 'jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `logbook/${uid}/${id}/${filename}`;
      const result = await uploadFile(path, file, (p) => {
        if (onProgress) onProgress((i + p) / newFiles.length);
      });
      newMedia.push(result);
    }
  }

  // Merge existing media (minus removed) + new media
  const existingMedia = (entries[idx].media || []).filter(m => !removedPaths?.includes(m.path));
  data.media = [...existingMedia, ...newMedia];

  await updateDoc(doc(col, id), data);
  entries[idx] = { ...entries[idx], ...data, id };
  return entries[idx];
}

export async function deleteLogEntry(id) {
  const col = userLogCol();
  if (!col) return;

  // Delete media files
  const entry = entries.find(e => e.id === id);
  if (entry?.media) {
    for (const m of entry.media) {
      try { await deleteFile(m.path); } catch { /* ignore */ }
    }
  }

  await deleteDoc(doc(col, id));
  entries = entries.filter(e => e.id !== id);
}

export function getLogStats() {
  if (entries.length === 0) return null;
  let maxDepth = 0, totalTime = 0, totalDepth = 0, depthCount = 0, timeCount = 0;
  let skinDives = 0, scubaDives = 0;
  const spots = new Map(); // spotName → count
  const monthly = {};      // "YYYY-MM" → count
  const yearly = {};       // "YYYY" → count
  let firstDate = null, lastDate = null;

  for (const e of entries) {
    if (e.maxDepth != null) { totalDepth += e.maxDepth; depthCount++; if (e.maxDepth > maxDepth) maxDepth = e.maxDepth; }
    if (e.diveTime != null) { totalTime += e.diveTime; timeCount++; }
    if (e.activityType === 'skin') skinDives++;
    else if (e.activityType === 'scuba') scubaDives++;
    if (e.spotName) spots.set(e.spotName, (spots.get(e.spotName) || 0) + 1);
    if (e.date) {
      if (!firstDate || e.date < firstDate) firstDate = e.date;
      if (!lastDate || e.date > lastDate) lastDate = e.date;
      const ym = e.date.slice(0, 7);
      monthly[ym] = (monthly[ym] || 0) + 1;
      const y = e.date.slice(0, 4);
      yearly[y] = (yearly[y] || 0) + 1;
    }
  }

  const topSpots = [...spots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Build last 12 months array
  const now = new Date();
  const months12 = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months12.push({ key, label: `${d.getMonth() + 1}월`, count: monthly[key] || 0 });
  }

  return {
    totalDives: entries.length, maxDepth, totalTime,
    avgDepth: depthCount > 0 ? Math.round(totalDepth / depthCount * 10) / 10 : 0,
    avgTime: timeCount > 0 ? Math.round(totalTime / timeCount) : 0,
    skinDives, scubaDives,
    spotsCount: spots.size, topSpots,
    firstDate, lastDate,
    months12,
    yearly: Object.entries(yearly).sort((a, b) => b[0].localeCompare(a[0])),
  };
}
