// localStorage → Firestore 일회성 마이그레이션
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';

const MIGRATED_KEY = 'where2dive_migrated';

export async function migrateLocalStorageToFirestore() {
  const uid = getCurrentUid();
  if (!uid) return;

  // 이미 마이그레이션 완료된 경우 스킵
  if (localStorage.getItem(MIGRATED_KEY) === uid) return;

  const favRaw = localStorage.getItem('where2dive_favorites');
  const logRaw = localStorage.getItem('where2dive_logbook');
  const spotRaw = localStorage.getItem('where2dive_myspots');

  // 마이그레이션할 데이터가 없으면 플래그만 설정
  if (!favRaw && !logRaw && !spotRaw) {
    localStorage.setItem(MIGRATED_KEY, uid);
    return;
  }

  // 즐겨찾기 마이그레이션
  if (favRaw) {
    try {
      const favIds = JSON.parse(favRaw);
      const favCol = collection(db, 'users', uid, 'favorites');
      for (const id of favIds) {
        await setDoc(doc(favCol, String(id)), { spotId: String(id), addedAt: serverTimestamp() });
      }
    } catch { /* ignore parse errors */ }
  }

  // 로그북 마이그레이션
  if (logRaw) {
    try {
      const logEntries = JSON.parse(logRaw);
      const logCol = collection(db, 'users', uid, 'logbook');
      for (const entry of logEntries) {
        const { id, ...data } = entry;
        await addDoc(logCol, data);
      }
    } catch { /* ignore parse errors */ }
  }

  // 내 스팟 마이그레이션
  if (spotRaw) {
    try {
      const spots = JSON.parse(spotRaw);
      const spotCol = collection(db, 'users', uid, 'myspots');
      for (const spot of spots) {
        const { id, ...data } = spot;
        await addDoc(spotCol, { ...data, isPersonal: true });
      }
    } catch { /* ignore parse errors */ }
  }

  // 마이그레이션 완료 플래그 설정 및 기존 키 정리
  localStorage.setItem(MIGRATED_KEY, uid);
  localStorage.removeItem('where2dive_favorites');
  localStorage.removeItem('where2dive_logbook');
  localStorage.removeItem('where2dive_myspots');
  localStorage.removeItem('where2dive_auth');
}
