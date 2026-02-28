// Firebase Auth 인증 모듈
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDocs,
  query,
  collection,
  where,
} from 'firebase/firestore';

let currentUser = null;
let authReady = false;
let authReadyResolve = null;
const authReadyPromise = new Promise(resolve => { authReadyResolve = resolve; });
let authChangeCallback = null;

// 인증 상태 감시
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (!authReady) {
    authReady = true;
    authReadyResolve();
  }
  if (authChangeCallback) authChangeCallback(user);
});

/** 초기 인증 상태 확인 대기 */
export function waitForAuth() {
  return authReadyPromise;
}

/** 인증 상태 변경 콜백 등록 */
export function onAuthChange(callback) {
  authChangeCallback = callback;
}

/** 로그인 여부 (동기) */
export function isLoggedIn() {
  return currentUser !== null;
}

/** 현재 사용자 UID (동기) */
export function getCurrentUid() {
  return currentUser?.uid ?? null;
}

/** 현재 사용자 객체 (동기) */
export function getCurrentUser() {
  return currentUser;
}

/** 이메일/비밀번호 로그인 */
export async function login(email, pw) {
  await signInWithEmailAndPassword(auth, email, pw);
}

/** 닉네임 중복 확인 */
export async function checkNickname(nickname) {
  const q = query(collection(db, 'nicknames'), where('nickname', '==', nickname));
  const snap = await getDocs(q);
  return snap.empty; // true = 사용 가능
}

/** 이메일/비밀번호 회원가입 (닉네임 + 약관동의 포함) */
export async function signup(email, pw, nickname, { marketingConsent = false } = {}) {
  const cred = await createUserWithEmailAndPassword(auth, email, pw);
  const uid = cred.user.uid;
  const now = new Date().toISOString();

  // Firebase Auth 프로필에 닉네임 저장
  await updateProfile(cred.user, { displayName: nickname });

  // Firestore users 컬렉션에 저장
  await setDoc(doc(db, 'users', uid), {
    nickname,
    email,
    marketingConsent,
    termsAgreedAt: now,
    privacyAgreedAt: now,
    marketingAgreedAt: marketingConsent ? now : null,
    createdAt: now,
  });

  // 닉네임 검색용 별도 컬렉션 (이메일 찾기 기능용 email 포함)
  await setDoc(doc(db, 'nicknames', uid), {
    nickname,
    uid,
    email,
  });
}

/** 비밀번호 재설정 이메일 발송 */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/** 닉네임으로 이메일 찾기 (마스킹 처리) */
export async function findEmailByNickname(nickname) {
  const q = query(collection(db, 'nicknames'), where('nickname', '==', nickname));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const email = snap.docs[0].data().email;
  if (!email) return null;
  // 이메일 마스킹: sj***@gmail.com
  const [local, domain] = email.split('@');
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return visible + '***@' + domain;
}

/** Google 로그인 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

/** 로그아웃 */
export async function logout() {
  await signOut(auth);
}
