// 프로필 데이터 레이어 (Firestore + Storage)
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import { uploadFile, deleteFile, resizeImage } from './reviews.js';
import {
  doc, getDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs, orderBy, limit,
} from 'firebase/firestore';

// ── Certification org/level data ──

export const CERT_ORGS = {
  PADI: ['Open Water Diver', 'Advanced Open Water', 'Rescue Diver', 'Divemaster', 'Instructor'],
  SSI: ['Open Water Diver', 'Advanced Adventurer', 'Diver Stress & Rescue', 'Dive Guide', 'Instructor'],
  NAUI: ['Scuba Diver', 'Advanced Scuba Diver', 'Rescue Diver', 'Divemaster', 'Instructor'],
  CMAS: ['1 Star Diver', '2 Star Diver', '3 Star Diver', '4 Star Diver', 'Instructor'],
  SDI: ['Open Water Scuba Diver', 'Advanced Diver', 'Rescue Diver', 'Divemaster', 'Instructor'],
};

// ── In-memory cache ──

let cachedProfile = null;

export function getCachedProfile() {
  return cachedProfile;
}

export function clearProfileCache() {
  cachedProfile = null;
}

// ── Load own profile ──

export async function loadProfile() {
  const uid = getCurrentUid();
  if (!uid) { cachedProfile = null; return null; }
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) { cachedProfile = null; return null; }
  cachedProfile = { id: snap.id, ...snap.data() };
  return cachedProfile;
}

// ── Save profile fields ──

export async function saveProfile(data) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  // Update cache
  if (cachedProfile) {
    Object.assign(cachedProfile, data);
  }
}

// ── Profile photo upload ──

export async function uploadProfilePhoto(file, onProgress) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  const resized = await resizeImage(file, 512);
  const ext = file.name ? file.name.split('.').pop() : 'jpg';
  const filename = `profile_${Date.now()}.${ext}`;
  const path = `profiles/${uid}/${filename}`;

  // Delete old photo if exists
  if (cachedProfile?.photoPath) {
    try { await deleteFile(cachedProfile.photoPath); } catch { /* ignore */ }
  }

  const result = await uploadFile(path, resized, onProgress);
  await updateDoc(doc(db, 'users', uid), {
    photoURL: result.url,
    photoPath: result.path,
    updatedAt: serverTimestamp(),
  });

  if (cachedProfile) {
    cachedProfile.photoURL = result.url;
    cachedProfile.photoPath = result.path;
  }
  return result;
}

// ── Cert photo upload ──

export async function uploadCertPhoto(file, onProgress) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  const ext = file.name ? file.name.split('.').pop() : 'jpg';
  const filename = `cert_${Date.now()}.${ext}`;
  const path = `profiles/${uid}/certs/${filename}`;
  return uploadFile(path, file, onProgress);
}

// ── Certifications (stored as array in user doc) ──

export async function addCertification(cert) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  const certs = cachedProfile?.certifications || [];
  const newCert = {
    id: `cert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    org: cert.org,
    level: cert.level,
    date: cert.date || '',
    certNumber: cert.certNumber || '',
    photoURL: cert.photoURL || '',
    photoPath: cert.photoPath || '',
  };
  const updated = [...certs, newCert];
  await updateDoc(doc(db, 'users', uid), {
    certifications: updated,
    updatedAt: serverTimestamp(),
  });
  if (cachedProfile) cachedProfile.certifications = updated;
  return newCert;
}

export async function removeCertification(certId) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');
  const certs = cachedProfile?.certifications || [];
  const cert = certs.find(c => c.id === certId);
  if (cert?.photoPath) {
    try { await deleteFile(cert.photoPath); } catch { /* ignore */ }
  }
  const updated = certs.filter(c => c.id !== certId);
  await updateDoc(doc(db, 'users', uid), {
    certifications: updated,
    updatedAt: serverTimestamp(),
  });
  if (cachedProfile) cachedProfile.certifications = updated;
}

// ── Public profile (other users) ──

export async function loadPublicProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return { id: userId, isPublic: false, nickname: 'Unknown' };
  const data = snap.data();
  if (!data.isPublic) {
    return { id: userId, isPublic: false, nickname: data.nickname || 'Unknown' };
  }
  return { id: snap.id, isPublic: true, ...data };
}

// ── User review queries ──

export async function getUserReviewCount(userId) {
  const q = query(collection(db, 'reviews'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.size;
}

export async function getUserRecentReviews(userId, max = 3) {
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
