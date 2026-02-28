// 업적/뱃지 시스템
import { db } from './firebase.js';
import { getCurrentUid } from './auth.js';
import {
  collection, doc, getDoc, setDoc, getDocs, updateDoc, serverTimestamp,
} from 'firebase/firestore';

// ── Achievement Definitions ──

export const ACHIEVEMENT_DEFS = {
  // 다이빙 횟수
  firstDive:    { icon: '\uD83C\uDFCA', category: 'diving',    condition: { type: 'diveCount', value: 1 } },
  fish:         { icon: '\uD83D\uDC1F', category: 'diving',    condition: { type: 'diveCount', value: 10 } },
  dolphin:      { icon: '\uD83D\uDC2C', category: 'diving',    condition: { type: 'diveCount', value: 30 } },
  whale:        { icon: '\uD83D\uDC0B', category: 'diving',    condition: { type: 'diveCount', value: 50 } },
  poseidon:     { icon: '\uD83D\uDD31', category: 'diving',    condition: { type: 'diveCount', value: 100 } },

  // 여행
  explorer:     { icon: '\uD83D\uDDFA\uFE0F', category: 'travel',    condition: { type: 'countryCount', value: 3 } },
  traveler:     { icon: '\u2708\uFE0F',        category: 'travel',    condition: { type: 'countryCount', value: 5 } },
  globalDiver:  { icon: '\uD83C\uDF0F',        category: 'travel',    condition: { type: 'countryCount', value: 10 } },
  worldChamp:   { icon: '\uD83C\uDFC6',        category: 'travel',    condition: { type: 'countryCount', value: 20 } },

  // 스팟
  firstStep:    { icon: '\uD83D\uDCCC', category: 'spots',     condition: { type: 'spotCount', value: 5 } },
  spotHunter:   { icon: '\uD83C\uDFAF', category: 'spots',     condition: { type: 'spotCount', value: 15 } },
  spotMaster:   { icon: '\uD83E\uDDED', category: 'spots',     condition: { type: 'spotCount', value: 30 } },

  // 커뮤니티
  reviewer:     { icon: '\uD83D\uDCDD', category: 'community', condition: { type: 'reviewCount', value: 1 } },
  popularReviewer: { icon: '\u2B50',     category: 'community', condition: { type: 'reviewCount', value: 10 } },
  reviewMaster: { icon: '\uD83D\uDC51', category: 'community', condition: { type: 'reviewCount', value: 30 } },
  photographer: { icon: '\uD83D\uDCF7', category: 'community', condition: { type: 'photoCount', value: 20 } },

  // 특별
  sunriseDiver: { icon: '\uD83C\uDF05', category: 'special',   condition: { type: 'entryBefore', value: '06:00' } },
  nightDiver:   { icon: '\uD83C\uDF19', category: 'special',   condition: { type: 'entryAfter', value: '20:00' } },
  iceDiver:     { icon: '\uD83E\uDD76', category: 'special',   condition: { type: 'waterTempBelow', value: 15 } },
  deepDiver:    { icon: '\uD83C\uDFCA\u200D\u2642\uFE0F', category: 'special', condition: { type: 'depthAbove', value: 30 } },
  consistent:   { icon: '\uD83D\uDCC5', category: 'special',   condition: { type: 'streak', value: 30 } },
};

export const CATEGORIES = ['diving', 'travel', 'spots', 'community', 'special'];

// ── In-memory cache ──

let userAchievements = {}; // id → { unlockedAt, progress, target }
let featuredBadges = [];   // up to 3 achievement IDs

export function getUserAchievements() { return userAchievements; }
export function getFeaturedBadges() { return featuredBadges; }
export function isUnlocked(id) { return !!userAchievements[id]?.unlockedAt; }

export function clearAchievementsCache() {
  userAchievements = {};
  featuredBadges = [];
}

// ── Firestore: load user achievements ──

export async function loadAchievements() {
  const uid = getCurrentUid();
  if (!uid) { userAchievements = {}; featuredBadges = []; return; }

  const col = collection(db, 'users', uid, 'achievements');
  const snap = await getDocs(col);
  userAchievements = {};
  snap.docs.forEach(d => {
    userAchievements[d.id] = d.data();
  });

  // Load featured badges from user doc
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (userSnap.exists()) {
    featuredBadges = userSnap.data().featuredBadges || [];
  }
}

// ── Unlock achievement ──

async function unlockAchievement(id, progress, target) {
  const uid = getCurrentUid();
  if (!uid) return;
  const ref = doc(db, 'users', uid, 'achievements', id);
  const data = {
    unlockedAt: serverTimestamp(),
    progress,
    target,
  };
  await setDoc(ref, data);
  userAchievements[id] = { ...data, unlockedAt: { seconds: Date.now() / 1000 } };
}

// ── Update progress (without unlocking) ──

async function updateProgress(id, progress, target) {
  const uid = getCurrentUid();
  if (!uid) return;
  const ref = doc(db, 'users', uid, 'achievements', id);
  const existing = userAchievements[id];
  if (existing?.unlockedAt) return; // already unlocked
  const data = { progress, target };
  await setDoc(ref, data, { merge: true });
  userAchievements[id] = { ...existing, ...data };
}

// ── Save featured badges ──

export async function saveFeaturedBadges(badgeIds) {
  const uid = getCurrentUid();
  if (!uid) return;
  const ids = badgeIds.slice(0, 3);
  await updateDoc(doc(db, 'users', uid), { featuredBadges: ids });
  featuredBadges = ids;
}

// ── Check achievements based on stats ──
// Returns array of newly unlocked achievement IDs

export async function checkAchievements(stats) {
  const uid = getCurrentUid();
  if (!uid) return [];

  const newlyUnlocked = [];

  for (const [id, def] of Object.entries(ACHIEVEMENT_DEFS)) {
    if (userAchievements[id]?.unlockedAt) continue; // already unlocked

    const { type, value } = def.condition;
    let current = 0;
    let met = false;

    switch (type) {
      case 'diveCount':
        current = stats.totalDives || 0;
        met = current >= value;
        break;
      case 'countryCount':
        current = stats.countryCount || 0;
        met = current >= value;
        break;
      case 'spotCount':
        current = stats.spotsCount || 0;
        met = current >= value;
        break;
      case 'reviewCount':
        current = stats.reviewCount || 0;
        met = current >= value;
        break;
      case 'photoCount':
        current = stats.photoCount || 0;
        met = current >= value;
        break;
      case 'entryBefore':
        met = !!stats.hasEarlyDive;
        current = met ? 1 : 0;
        break;
      case 'entryAfter':
        met = !!stats.hasNightDive;
        current = met ? 1 : 0;
        break;
      case 'waterTempBelow':
        met = !!stats.hasColdDive;
        current = met ? 1 : 0;
        break;
      case 'depthAbove':
        met = (stats.maxDepth || 0) >= value;
        current = stats.maxDepth || 0;
        break;
      case 'streak':
        current = stats.streak || 0;
        met = current >= value;
        break;
      default:
        break;
    }

    // Update progress for numeric types
    if (['diveCount', 'countryCount', 'spotCount', 'reviewCount', 'photoCount', 'streak'].includes(type)) {
      if (!met && current > 0) {
        // Just update progress silently (don't await to avoid blocking)
        updateProgress(id, current, value).catch(() => {});
      }
    }

    if (met) {
      await unlockAchievement(id, current, value);
      newlyUnlocked.push(id);
    }
  }

  return newlyUnlocked;
}

// ── Build stats object from logbook + review data ──

export function buildAchievementStats(logEntries, reviewCount, photoCount) {
  const totalDives = logEntries.length;
  const countries = new Set();
  const spotNames = new Set();
  let maxDepth = 0;
  let hasEarlyDive = false;
  let hasNightDive = false;
  let hasColdDive = false;

  for (const e of logEntries) {
    // Country: extract from spotName or use a simple heuristic
    // We use spotId-linked country if available, else skip
    if (e.country) countries.add(e.country);
    if (e.spotName) spotNames.add(e.spotName);
    if (e.maxDepth != null && e.maxDepth > maxDepth) maxDepth = e.maxDepth;
    if (e.waterTemp != null && e.waterTemp <= 15) hasColdDive = true;

    // Check entry time for early/night dive
    if (e.entryTime) {
      const [h] = e.entryTime.split(':').map(Number);
      if (h < 6) hasEarlyDive = true;
      if (h >= 20) hasNightDive = true;
    }
  }

  // Calculate streak (consecutive days)
  const dates = logEntries
    .map(e => e.date)
    .filter(Boolean)
    .sort();
  let streak = 0;
  if (dates.length > 0) {
    streak = 1;
    let maxStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else if (diffDays > 1) {
        streak = 1;
      }
    }
    streak = maxStreak;
  }

  return {
    totalDives,
    countryCount: countries.size,
    spotsCount: spotNames.size,
    maxDepth,
    hasEarlyDive,
    hasNightDive,
    hasColdDive,
    reviewCount: reviewCount || 0,
    photoCount: photoCount || 0,
    streak,
  };
}

// ── Count helpers (for reviews/photos from Firestore) ──

export async function countUserReviews() {
  const uid = getCurrentUid();
  if (!uid) return { reviewCount: 0, photoCount: 0 };
  const { query, where, getDocs: gd, collection: col } = await import('firebase/firestore');
  const q = query(col(db, 'reviews'), where('userId', '==', uid));
  const snap = await gd(q);
  let reviewCount = 0;
  let photoCount = 0;
  snap.docs.forEach(d => {
    reviewCount++;
    const media = d.data().media || [];
    photoCount += media.filter(m => !m.url?.includes('video')).length;
  });
  return { reviewCount, photoCount };
}

// ── Get unlocked count ──

export function getUnlockedCount() {
  return Object.values(userAchievements).filter(a => a.unlockedAt).length;
}

export function getTotalCount() {
  return Object.keys(ACHIEVEMENT_DEFS).length;
}
