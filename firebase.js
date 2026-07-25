// ====================== FIREBASE CONFIG (CDN) ======================
// File: firebase.js
// Letakkan file ini di folder yang SAMA dengan index.html kamu di Netlify.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
 * Mulai proses Google Sign-In dengan REDIRECT (lebih stabil di browser mobile
 * dibanding popup). Fungsi ini akan mengarahkan user keluar ke halaman Google,
 * jadi TIDAK mengembalikan user secara langsung — halaman akan reload.
 */
export async function signInWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
  // Setelah baris ini, browser akan navigasi ke Google. Kode setelahnya
  // di pemanggil (misalnya index.html) tidak akan sempat jalan.
}

/**
 * Panggil fungsi ini SEKALI setiap kali halaman dimuat (misal di awal script
 * index.html, sebelum atau sesudah cek localStorage). Fungsi ini mengecek
 * apakah user baru saja kembali dari proses redirect Google Sign-In.
 * Mengembalikan object user sederhana jika berhasil, atau null jika tidak
 * ada redirect yang sedang diproses (misal: reload biasa, bukan dari Google).
 */
export async function getGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null; // bukan hasil redirect, reload biasa
    const u = result.user;
    return {
      uid:      u.uid,
      name:     u.displayName || 'Pengguna Google',
      email:    u.email || '',
      photoURL: u.photoURL || null
    };
  } catch (err) {
    console.warn('⚠️ Gagal mengambil hasil redirect Google:', err);
    return null;
  }
}

/**
 * Sign out dari Firebase Auth (dipanggil saat logout, khusus akun Google).
 */
export async function signOutFirebase() {
  try { await signOut(auth); } catch (err) { console.warn('⚠️ Sign out Firebase gagal:', err); }
}

// ====================== HELPER: LOGIN & DAFTAR EMAIL/PASSWORD ASLI ======================
// Menerjemahkan kode error Firebase Auth ke pesan Bahasa Indonesia yang ramah.
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
    default:                          return 'Terjadi kesalahan, coba lagi.';
  }
}

/**
 * Daftar akun baru pakai email & password lewat Firebase Authentication.
 * Mengembalikan object user sederhana: { uid, name, email, photoURL }
 */
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

/**
 * Masuk pakai email & password lewat Firebase Authentication.
 * Mengembalikan object user sederhana: { uid, name, email, photoURL }
 */
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
