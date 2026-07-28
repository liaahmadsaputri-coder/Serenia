// ====================== FIREBASE CONFIG (CDN) ======================
// File: firebase.js
// Letakkan file ini di folder yang SAMA dengan index.html kamu di Netlify.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
impoimport { getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// Set persistence eksplisit ke localStorage. Tanpa ini, sebagian browser HP
// (terutama Safari, dan Chrome dengan pengaturan privasi ketat) gagal diam-diam
// menyimpan status proses redirect saat bolak-balik ke Google — gejalanya:
// layar sempat putih sebentar lalu balik ke halaman login tanpa pesan error.
// Promise ini disimpan supaya signInWithGoogle() bisa menunggunya selesai dulu.
const authReady = setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('⚠️ Gagal set persistence Firebase Auth:', err);
});

// ── Ekspor db & auth agar bisa dipakai di file lain ──
export { db, auth };

// ====================== HELPER: LOGIN GOOGLE ASLI (REDIRECT) ======================
/**
 * Mengalihkan seluruh halaman ke layar login Google (Firebase Authentication).
 * PENTING: ini BUKAN popup — dipakai signInWithRedirect karena signInWithPopup
 * sering gagal di browser HP (terutama in-app browser/WebView). Karena halaman
 * dialihkan sepenuhnya, fungsi ini TIDAK mengembalikan data user secara
 * langsung. Setelah user pilih akun di Google, halaman akan reload balik ke
 * app ini — hasil login-nya baru bisa diambil lewat checkGoogleRedirectResult()
 * yang dipanggil sekali saat app dimuat ulang.
 */
export async function signInWithGoogle() {
  await authReady; // pastikan persistence sudah ter-set sebelum redirect dimulai
  export async function signInWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
  // Baris ini praktis tidak pernah tercapai (halaman keburu dialihkan),
  // tapi tetap ada untuk konsistensi tipe return kalau suatu saat browser
  // menunda redirect-nya.
  return null;
  }

/**
 * Dipanggil SEKALI saat app baru dimuat/reload (window 'load'), untuk mengecek
 * apakah user baru saja kembali dari proses login Google via redirect.
 * Mengembalikan { uid, name, email, photoURL } kalau memang baru login,
 * atau null kalau app dimuat secara normal (bukan hasil redirect).
 */
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
    case 'auth/missing-email':        return 'Isi email dulu ya.';
    default:                          return 'Terjadi kesalahan, coba lagi.';
  }
}

/**
 * Kirim email reset password lewat Firebase Authentication.
 * Kalau email gak terdaftar, Firebase modern biasanya tetap "berhasil"
 * secara diam-diam (demi keamanan, biar orang gak bisa nebak email siapa
 * yang terdaftar) — jadi pesan sukses akan tetap muncul di app.
 */
export async function forgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw new Error(translateAuthError(err));
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
    console.warn('⚠️ Gagal memproses hasil login Google:', err);
    if (typeof showToast === 'function') {
      showToast('❌ Redirect error: ' + (err.code || err.message || String(err)));
    }
    return null;
  }
}
