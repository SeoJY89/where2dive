// Firebase 설정
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC78llCFEQ7o0RR2_qrp7WGbFLplAo9T-o",
  authDomain: "where2dive-1550d.firebaseapp.com",
  projectId: "where2dive-1550d",
  storageBucket: "where2dive-1550d.firebasestorage.app",
  messagingSenderId: "340816532664",
  appId: "1:340816532664:web:c875b157699d27007c104d",
  measurementId: "G-5L6W25D51J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
