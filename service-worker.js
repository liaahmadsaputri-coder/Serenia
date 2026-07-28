// ====================== SERENIA SERVICE WORKER ======================
// Cache-first untuk file inti, biar app tetap bisa dibuka pas offline.
// Kalau kamu update app.js/style.css dll, NAIKKAN nomor versi CACHE_NAME
// di bawah ini (misal jadi 'serenia-v3') supaya HP user ambil versi baru,
// bukan versi lama yang ke-cache.
const CACHE_NAME = 'serenia-v1';

const CORE_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './habits.js',
  './reflection.js',
  './firebase.js',
  './firebase-bridge.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: simpan file inti ke cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

// Activate: hapus cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: coba dari cache dulu, kalau ga ada baru ke network
self.addEventListener('fetch', (event) => {
  // Jangan cache request ke Firebase/Firestore/Google — itu harus selalu live
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com') ||
      event.request.url.includes('accounts.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Kalau offline dan ga ada di cache, fallback ke index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
