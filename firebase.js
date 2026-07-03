// ====================== FIREBASE CONFIG (CDN) ======================
// File: firebase.js
// Letakkan file ini di folder yang SAMA dengan index.html kamu di Netlify.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Konfigurasi Firebase kamu ──
const firebaseConfig = {
  apiKey:            "AIzaSyBl0aXGlHMGRl-sGPzbKOcV1dRLRmVjk_o",
  authDomain:        "sereniarefleksi.firebaseapp.com",
  projectId:         "sereniarefleksi",
  storageBucket:     "sereniarefleksi.firebasestorage.app",
  messagingSenderId: "251921785852",
  appId:             "1:251921785852:web:b7974f4b5b3702230e4879",
  measurementId:     "G-VS16QPGEL8"
};

// ── Inisialisasi Firebase, Firestore & Auth ──
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ── Ekspor db & auth agar bisa dipakai di file lain ──
export { db, auth };

// ====================== HELPER: LOGIN GOOGLE ASLI ======================
/**
 * Buka popup Google Sign-In beneran (Firebase Authentication).
 * Mengembalikan object user sederhana: { uid, name, email, photoURL }
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const u = result.user;
  return {
    uid:      u.uid,
    name:     u.displayName || 'Pengguna Google',
    email:    u.email || '',
    photoURL: u.photoURL || null
  };
}

/**
 * Sign out dari Firebase Auth (dipanggil saat logout, khusus akun Google).
 */
export async function signOutFirebase() {
  try { await signOut(auth); } catch (err) { console.warn('⚠️ Sign out Firebase gagal:', err); }
}

// ====================== HELPER: SIMPAN DATA USER KE FIRESTORE ======================
// Struktur Firestore:
//   users/
//     └── {uid}/
//           └── journals/
//                 └── data (document)
//                       ├── entries   (array jurnal)
//                       ├── moods     (array mood)
//                       ├── ach       (object achievement)
//                       ├── pet       (string tipe pet)
//                       └── petstats  (object stats pet)

/**
 * Simpan seluruh data user ke Firestore.
 * Dipanggil setiap kali saveUserData() berjalan.
 */
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
    // Jika Firestore gagal, data tetap aman di localStorage — tidak ada yang hilang.
    console.warn("⚠️ Firestore save gagal (offline/network?). Data tetap di localStorage.", err);
  }
}

/**
 * Muat data user dari Firestore.
 * Dipanggil saat loginUser() berjalan.
 * Mengembalikan object data jika ada, atau null jika tidak ditemukan.
 */
export async function loadFromFirestore(uid) {
  try {
    const userRef = doc(db, "users", String(uid), "journals", "data");
    const snap    = await getDoc(userRef);
    if (snap.exists()) {
      console.log("✅ Firestore: data dimuat untuk uid:", uid);
      return snap.data();
    } else {
      console.log("ℹ️ Firestore: belum ada data untuk uid:", uid, "(akan dibuat saat pertama save)");
      return null;
    }
  } catch (err) {
    console.warn("⚠️ Firestore load gagal. Menggunakan localStorage sebagai fallback.", err);
    return null;
  }
}
