// 개인 다이빙 스팟 관리 (Firestore + 메모리 캐시)
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

let mySpots = [];

function userSpotsCol() {
  const uid = getCurrentUid();
  if (!uid) return null;
  return collection(db, 'users', uid, 'myspots');
}

/** Firestore에서 내 스팟 전체 로드 */
export async function loadMySpots() {
  const col = userSpotsCol();
  if (!col) { mySpots = []; return; }
  const snap = await getDocs(col);
  mySpots = snap.docs.map(d => ({ id: d.id, ...d.data(), isPersonal: true }));
}

/** 메모리 캐시 초기화 (로그아웃 시) */
export function clearMySpots() {
  mySpots = [];
}

export function getMySpots() {
  return [...mySpots];
}

export function getMySpot(id) {
  return mySpots.find(s => s.id === id) || null;
}

export async function addMySpot(spot) {
  const col = userSpotsCol();
  if (!col) return null;
  const data = {
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
  const ref = await addDoc(col, data);
  const newSpot = { id: ref.id, ...data };
  mySpots.push(newSpot);
  return newSpot;
}

export async function updateMySpot(id, data) {
  const col = userSpotsCol();
  if (!col) return null;
  const idx = mySpots.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const updateData = { ...data, isPersonal: true };
  await updateDoc(doc(col, id), updateData);
  mySpots[idx] = { ...mySpots[idx], ...updateData, id };
  return mySpots[idx];
}

export async function deleteMySpot(id) {
  const col = userSpotsCol();
  if (!col) return;
  await deleteDoc(doc(col, id));
  mySpots = mySpots.filter(s => s.id !== id);
}
