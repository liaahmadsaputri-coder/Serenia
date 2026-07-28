// ====================== FIREBASE CONFIG (CDN) ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBl0aXGlHMGRl-sGPzbKOcV1dRLRmVjk_o",
  authDomain:        "sereniarefleksi.firebaseapp.com",
  projectId:         "sereniarefleksi",
  storageBucket:     "sereniarefleksi.firebasestorage.app",
  messagingSenderId: "251921785852",
  appId:             "1:251921785852:web:b7974f4b5b3702230e4879",
  measurementId:     "G-VS16QPGEL8"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const authReady = setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('⚠️ Gagal set persistence Firebase Auth:', err);
});

export { db, auth };

// ====================== LOGIN GOOGLE (POPUP) ======================
export async function signInWithGoogle() {
  await authReady;
  const result = await signInWithPopup(auth, googleProvider);
  const u = result.user;
  return {
    uid:      u.uid,
    name:     u.displayName || 'Pengguna Google',
    email:    u.email || '',
    photoURL: u.photoURL || null
  };
}

export async function checkGoogleRedirectResult() {
  try {
    await authReady;
    const result = await getRedirectResult(auth);
    if (!result) return null;
    const u = result.user;
    return {
      uid:      u.uid,
      name:     u.displayName || 'Pengguna Google',
      email:    u.email || '',
      photoURL: u.photoURL || null
    };
  } catch (err) {
    console.warn('⚠️ Gagal memproses hasil login Google:', err);
    return null;
  }
}

export async function signOutFirebase() {
  try { await signOut(auth); } catch (err) { console.warn('⚠️ Sign out Firebase gagal:', err); }
}

function translateAuthError(err) {
  const code = err && err.code ? err.code : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'Email sudah terdaftar, coba masuk saja.';
    case 'auth/invalid-email':        return 'Format email tidak valid.';
    case 'auth/weak-password':        return 'Kata sandi terlalu lemah, minimal 6 karakter.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':   return 'Email atau kata sandi salah.';
    case 'auth/too-many-requests':    return 'Terlalu banyak percobaan, coba lagi nanti.';
    case 'auth/missing-email':        return 'Isi email dulu ya.';
    default:                          return 'Terjadi kesalahan, coba lagi.';
  }
}

export async function forgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw new Error(translateAuthError(err));
  }
}

export async function registerWithEmail(name, email, pass) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(result.user, { displayName: name });
    return {
      uid:      result.user.uid,
      name:     name || 'Pengguna',
      email:    result.user.email || '',
      photoURL: null
    };
  } catch (err) {
    throw new Error(translateAuthError(err));
  }
}

export async function signInWithEmail(email, pass) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const u = result.user;
    return {
      uid:      u.uid,
      name:     u.displayName || 'Pengguna',
      email:    u.email || '',
      photoURL: u.photoURL || null
    };
  } catch (err) {
    throw new Error(translateAuthError(err));
  }
}

export async function saveToFirestore(uid, data) {
  try {
    const userRef = doc(db, "users", String(uid), "journals", "data");
    const payload = { updatedAt: new Date().toISOString() };
    if (data.entries      !== undefined) payload.entries      = data.entries;
    if (data.moods        !== undefined) payload.moods        = data.moods;
    if (data.achievements !== undefined) payload.achievements = data.achievements;
    if (data.pet          !== undefined) payload.pet          = data.pet;
    if (data.petStats     !== undefined) payload.petStats     = data.petStats;
    if (data.habits       !== undefined) payload.habits       = data.habits;
    await setDoc(userRef, payload, { merge: true });
    console.log("✅ Firestore: data tersimpan untuk uid:", uid);
  } catch (err) {
    console.warn("⚠️ Firestore save gagal (offline/network?). Data tetap di localStorage.", err);
  }
}

export async function loadFromFirestore(uid) {
  try {
    const userRef = doc(db, "users", String(uid), "journals", "data");
    const snap    = await getDoc(userRef);
    if (snap.exists()) {
      console.log("✅ Firestore: data dimuat untuk uid:", uid);
      return snap.data();
    } else {
      console.log("ℹ️ Firestore: belum ada data untuk uid:", uid);
      return null;
    }
  } catch (err) {
    console.warn("⚠️ Firestore load gagal. Menggunakan localStorage sebagai fallback.", err);
    return null;
  }
}
