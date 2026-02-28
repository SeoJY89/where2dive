// Firebase Auth 인증 모듈
import { auth } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';

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

/** 이메일/비밀번호 회원가입 */
export async function signup(email, pw) {
  await createUserWithEmailAndPassword(auth, email, pw);
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
