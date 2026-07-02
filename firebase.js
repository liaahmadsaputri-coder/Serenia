// ====================== FIREBASE CONFIG (CDN) ======================
// File: firebase.js
// Letakkan file ini di folder yang SAMA dengan index.html kamu di Netlify.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// â”€â”€ Konfigurasi Firebase kamu â”€â”€
const firebaseConfig = {
  apiKey:            "AIzaSyBl0aXGlHMGRl-sGPzbKOcV1dRLRmVjk_o",
  authDomain:        "sereniarefleksi.firebaseapp.com",
  projectId:         "sereniarefleksi",
  storageBucket:     "sereniarefleksi.firebasestorage.app",
  messagingSenderId: "251921785852",
  appId:             "1:251921785852:web:b7974f4b5b3702230e4879",
  measurementId:     "G-VS16QPGEL8"
};

// â”€â”€ Inisialisasi Firebase & Firestore â”€â”€
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// â”€â”€ Ekspor db agar bisa dipakai di file lain â”€â”€
export { db };

// ====================== HELPER: SIMPAN DATA USER KE FIRESTORE ======================
// Struktur Firestore:
//   users/
//     â””â”€â”€ {uid}/
//           â””â”€â”€ journals/
//                 â””â”€â”€ data (document)
//                       â”œâ”€â”€ entries   (array jurnal)
//                       â”œâ”€â”€ moods     (array mood)
//                       â”œâ”€â”€ ach       (object achievement)
//                       â”œâ”€â”€ pet       (string tipe pet)
//                       â””â”€â”€ petstats  (object stats pet)

/**
 * Simpan seluruh data user ke Firestore.
 * Dipanggil setiap kali saveUserData() berjalan.
 */
export async function saveToFirestore(uid, data) {
  try {
    const userRef = doc(db, "users", String(uid), "journals", "data");
    await setDoc(userRef, {
      entries:      data.entries      || [],
      moods:        data.moods        || [],
      achievements: data.achievements || {},
      pet:          data.pet          || "cat",
      petStats:     data.petStats     || { hp: 80, happy: 70, xp: 40 },
      updatedAt:    new Date().toISOString()
    }, { merge: true });
    console.log("âœ… Firestore: data tersimpan untuk uid:", uid);
  } catch (err) {
    // Jika Firestore gagal, data tetap aman di localStorage â€” tidak ada yang hilang.
    console.warn("âš ï¸ Firestore save gagal (offline/network?). Data tetap di localStorage.", err);
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
      console.log("âœ… Firestore: data dimuat untuk uid:", uid);
      return snap.data();
    } else {
      console.log("â„¹ï¸ Firestore: belum ada data untuk uid:", uid, "(akan dibuat saat pertama save)");
      return null;
    }
  } catch (err) {
    console.warn("âš ï¸ Firestore load gagal. Menggunakan localStorage sebagai fallback.", err);
    return null;
  }
}
