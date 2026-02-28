// 리뷰 데이터 레이어 (Firestore + Storage)
import { db, storage } from './firebase.js';
import { getCurrentUid, getCurrentUser } from './auth.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage';

const reviewCache = new Map(); // spotId → review[]

// ── Helpers ──

export function resizeImage(file, maxDim = 1920) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(file);
        return;
      }
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), file.type, 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB

export function validateFile(file) {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) return 'type';
  if (isImage && file.size > MAX_IMAGE_SIZE) return 'size';
  if (isVideo && file.size > MAX_VIDEO_SIZE) return 'size';
  return null;
}

export function isVideoFile(file) {
  if (file instanceof File) return ALLOWED_VIDEO_TYPES.includes(file.type);
  if (typeof file === 'string') return file.includes('.mp4') || file.includes('.mov') || file.includes('video');
  return false;
}

function uploadMedia(reviewId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const ext = file.name ? file.name.split('.').pop() : 'jpg';
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageRef = ref(storage, `reviews/${reviewId}/${filename}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed',
      (snap) => { if (onProgress) onProgress(snap.bytesTransferred / snap.totalBytes); },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path: `reviews/${reviewId}/${filename}` });
      }
    );
  });
}

function deleteMedia(storagePath) {
  return deleteObject(ref(storage, storagePath));
}

// ── CRUD ──

export async function loadReviews(spotId) {
  const q = query(collection(db, 'reviews'), where('spotId', '==', spotId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  reviewCache.set(spotId, reviews);
  return reviews;
}

export function getCachedReviews(spotId) {
  return reviewCache.get(spotId) || [];
}

export async function addReview(spotId, data, files, onProgress) {
  const uid = getCurrentUid();
  const user = getCurrentUser();
  if (!uid) throw new Error('Not authenticated');

  const docData = {
    spotId,
    userId: uid,
    nickname: user.displayName || 'Anonymous',
    rating: data.rating,
    title: data.title,
    content: data.content,
    visitDate: data.visitDate || null,
    media: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'reviews'), docData);

  // Upload media files
  if (files && files.length > 0) {
    const mediaResults = [];
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      if (file.type && file.type.startsWith('image/')) {
        file = await resizeImage(file);
      }
      const result = await uploadMedia(docRef.id, file, (p) => {
        if (onProgress) onProgress((i + p) / files.length);
      });
      mediaResults.push(result);
    }
    await updateDoc(docRef, { media: mediaResults });
    docData.media = mediaResults;
  }

  // Update cache
  const newReview = { id: docRef.id, ...docData, createdAt: { seconds: Date.now() / 1000 }, updatedAt: { seconds: Date.now() / 1000 } };
  const cached = reviewCache.get(spotId) || [];
  cached.push(newReview);
  reviewCache.set(spotId, cached);

  return newReview;
}

export async function updateReview(reviewId, spotId, data, newFiles, removedPaths, onProgress) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');

  // Delete removed media
  if (removedPaths && removedPaths.length > 0) {
    for (const path of removedPaths) {
      try { await deleteMedia(path); } catch { /* ignore missing */ }
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
      const result = await uploadMedia(reviewId, file, (p) => {
        if (onProgress) onProgress((i + p) / newFiles.length);
      });
      newMedia.push(result);
    }
  }

  // Merge existing media (minus removed) + new media
  const cached = reviewCache.get(spotId) || [];
  const existing = cached.find(r => r.id === reviewId);
  const existingMedia = (existing?.media || []).filter(m => !removedPaths?.includes(m.path));
  const allMedia = [...existingMedia, ...newMedia];

  const updateData = {
    rating: data.rating,
    title: data.title,
    content: data.content,
    visitDate: data.visitDate || null,
    media: allMedia,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'reviews', reviewId), updateData);

  // Update cache
  if (existing) {
    Object.assign(existing, updateData, { updatedAt: { seconds: Date.now() / 1000 } });
  }

  return { id: reviewId, ...updateData };
}

export async function deleteReview(reviewId, spotId) {
  const uid = getCurrentUid();
  if (!uid) throw new Error('Not authenticated');

  // Delete media files
  const cached = reviewCache.get(spotId) || [];
  const review = cached.find(r => r.id === reviewId);
  if (review?.media) {
    for (const m of review.media) {
      try { await deleteMedia(m.path); } catch { /* ignore */ }
    }
  }

  await deleteDoc(doc(db, 'reviews', reviewId));

  // Update cache
  reviewCache.set(spotId, cached.filter(r => r.id !== reviewId));
}

// ── Utilities ──

export function getAverageRating(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  return sum / reviews.length;
}

export function sortReviews(reviews, sortBy) {
  const arr = [...reviews];
  switch (sortBy) {
    case 'ratingHigh':
      return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'ratingLow':
      return arr.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    default: // 'latest'
      return arr.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
  }
}

export function clearReviewCache() {
  reviewCache.clear();
}
