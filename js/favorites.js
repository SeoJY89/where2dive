// 즐겨찾기 관리 (Firestore + 메모리 캐시)
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import { collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';

let favSet = new Set();

function userFavCol() {
  const uid = getCurrentUid();
  if (!uid) return null;
  return collection(db, 'users', uid, 'favorites');
}

/** Firestore에서 즐겨찾기 전체 로드 */
export async function loadFavorites() {
  const col = userFavCol();
  if (!col) { favSet = new Set(); return; }
  const snap = await getDocs(col);
  favSet = new Set(snap.docs.map(d => d.id));
}

/** 메모리 캐시 초기화 (로그아웃 시) */
export function clearFavorites() {
  favSet = new Set();
}

export function getFavorites() {
  return favSet;
}

export function isFavorite(id) {
  return favSet.has(String(id));
}

/** 즐겨찾기 토글 (async) — 반환: 토글 후 즐겨찾기 여부 */
export async function toggleFavorite(id) {
  const col = userFavCol();
  if (!col) return false;
  const strId = String(id);
  if (favSet.has(strId)) {
    favSet.delete(strId);
    await deleteDoc(doc(col, strId));
    return false;
  } else {
    favSet.add(strId);
    await setDoc(doc(col, strId), { spotId: id, addedAt: serverTimestamp() });
    return true;
  }
}

export function getFavCount() {
  return favSet.size;
}
