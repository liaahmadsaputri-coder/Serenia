// ====================== BUBBLES ======================
(function() {
  const container = document.getElementById('bubbles');
  // Nature wellness palette: sky, lake, ocean, forest, sage, cream tones
  const colors = ['#8EB8D9','#5D87B1','#7BA77B','#A6C79F','#DDEEFF','#C8DFF0','#E8F4E8'];
  for(let i = 0; i < 16; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = 18 + Math.random() * 55;
    b.style.cssText = `
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${Math.random()*100}%;
      bottom:-${size}px;
      animation-duration:${9+Math.random()*14}s;
      animation-delay:${Math.random()*12}s;
    `;
    container.appendChild(b);
  }
})();

// ====================== KONEKSI ONLINE/OFFLINE ======================
// Tampilkan banner persisten saat offline, dan begitu koneksi balik,
// kasih tau user + coba sync ulang data yang sempat cuma kesimpen lokal.
function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  banner.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', () => {
  updateOfflineBanner();
  showToast('✅ Online lagi! Menyinkronkan data...');
  if (appState.user && appState.user.id !== 'guest') saveUserData();
});
window.addEventListener('offline', updateOfflineBanner);
updateOfflineBanner();

// ====================== ACHIEVEMENTS CONFIG ======================
const ACHIEVEMENTS = [
  { id:'first_journal', icon:'🌱', name:'Jurnal Pertama', desc:'Tulis entri jurnal pertamamu', target:1, type:'entries' },
  { id:'streak_7',     icon:'⛰️', name:'Mendaki Bukit', desc:'Catat jurnal 7 hari berturut-turut', target:7, type:'streak' },
  { id:'streak_30',    icon:'🏔️', name:'Puncak Gunung', desc:'Streak 30 hari tanpa putus', target:30, type:'streak' },
  { id:'streak_100',   icon:'🗻', name:'Puncak Sejati', desc:'Streak 100 hari luar biasa!', target:100, type:'streak' },
  { id:'streak_365',   icon:'🌌', name:'Aurora Setahun', desc:'365 hari berjurnal tanpa henti', target:365, type:'streak' },
  { id:'entries_10',   icon:'🍃', name:'Penulis Muda', desc:'Simpan 10 entri jurnal', target:10, type:'entries' },
  { id:'entries_50',   icon:'🌿', name:'Penulis Aktif', desc:'Simpan 50 entri jurnal', target:50, type:'entries' },
  { id:'mood_7',       icon:'🌈', name:'Tracker Mood', desc:'Catat mood 7 hari berbeda', target:7, type:'moods' },
  // Habit achievements
  { id:'habit_starter', icon:'🌱', name:'Habit Starter', desc:'Selesaikan habit pertamamu', target:1, type:'habit_done' },
  { id:'habit_streak7', icon:'🔥', name:'Konsisten', desc:'Selesaikan habit 7 hari berturut-turut', target:7, type:'habit_streak' },
  { id:'habit_hero',    icon:'🎯', name:'Habit Hero', desc:'Capai 90% completion rate mingguan', target:90, type:'habit_weekly_pct' },
];

// ====================== SECURITY HELPER ======================
// Escape HTML supaya teks dari user (jurnal, tag, nama habit) tidak
// bisa disisipi tag/script saat dirender via innerHTML (cegah XSS).
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ====================== RELIABILITY HELPERS ======================
// Parse JSON dari localStorage dengan aman — kalau datanya rusak/korup
// (misal gagal nulis separuh jalan), jangan sampai app crash total,
// cukup balik ke nilai default.
function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn('⚠️ Data tersimpan rusak, pakai nilai default.', e);
    return fallback;
  }
}

// Tulis ke localStorage dengan aman — kalau storage penuh (QuotaExceededError,
// sering terjadi di mode private/Safari) atau localStorage diblokir,
// user diberi tahu lewat toast alih-alih data diam-diam gagal tersimpan.
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error('❌ Gagal menyimpan ke localStorage:', key, e);
    showToast('⚠️ Gagal menyimpan data di perangkat ini — penyimpanan mungkin penuh');
    return false;
  }
}

// Bungkus panggilan sync ke Firestore supaya kegagalan (jaringan putus, dll)
// tidak jadi unhandled promise rejection dan tidak mengganggu UI —
// data tetap aman di localStorage, sync akan dicoba lagi di kesempatan berikutnya.
function safeFirestoreSave(uid, payload) {
  if (!window._firestoreSave) return;
  try {
    Promise.resolve(window._firestoreSave(uid, payload)).catch(err => {
      console.warn('⚠️ Sync ke Firestore gagal, data tetap aman secara lokal.', err);
    });
  } catch (err) {
    console.warn('⚠️ Sync ke Firestore gagal, data tetap aman secara lokal.', err);
  }
}

// Nonaktifkan tombol + ganti teksnya jadi "Memproses..." selagi request async
// jalan, supaya (a) user tau app-nya lagi kerja, dan (b) nggak bisa di-tap
// dua kali dan kirim request dobel. Otomatis balik ke teks asli saat selesai.
function setButtonLoading(btnId, isLoading, loadingText = 'Memproses...') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
    btn.style.pointerEvents = 'none';
    btn.innerHTML = `⏳ ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.style.pointerEvents = '';
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

// ====================== APP STATE ======================
let appState = {
  user: null,
  currentMood: null,
  currentMoodName: '',
  entries: [],
  moods: [],
  achievements: {},
  currentPet: 'cat',
  petName: 'Mochi',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  journalTags: [],
  cycleEnabled: false,
  cycleHistory: [],
  cycleCalYear: new Date().getFullYear(),
  cycleCalMonth: new Date().getMonth(),
};

const PETS = {
  cat:     { em:'🐱', name:'Mochi', label:'Kucing' },
  rabbit:  { em:'🐰', name:'Bubu', label:'Kelinci' },
  dog:     { em:'🐶', name:'Coklat', label:'Anjing' },
  fox:     { em:'🦊', name:'Kitsune', label:'Rubah' },
  hamster: { em:'🐹', name:'Piko', label:'Hamster' },
};
const PET_SPEECHES = {
  cat:     ['Meow~ aku senang kamu nulis jurnal! 📝','Purrr... tetap semangat ya! 💙','Aku percaya kamu bisa! 🌟'],
  rabbit:  ['Hop hop! Selamat berjurnal! ✨','Kamu luar biasa! Terus maju! 🌈','Ayo kita tumbuh bersama! 🌱'],
  dog:     ['Guk guk! Aku selalu di sisimu! 💛','Woof! Kamu yang terhebat! 🏆','Semangaaaat! Aku dukung kamu! 🎉'],
  fox:     ['Hmm, pikiran yang menarik hari ini... 🦊','Aku tahu kamu bisa melewatinya! ✨','Tetap bijak dan kuat! 💙'],
  hamster: ['Hiii! Hari yang indah untukmu! 🌸','Kamu sangat berharga! 💕','Cippit cippit! Aku sayang kamu! 🤍'],
};
const QUOTES = [
  { text:'"Setiap hari adalah halaman baru dalam kisah hidupmu. Mulailah menulis yang indah! 🌟"', author:'— Serenia Daily' },
  { text:'"Berjurnal adalah hadiah yang kamu berikan untuk dirimu sendiri di masa depan. 💙"', author:'— Bijak Harian' },
  { text:'"Refleksi diri adalah kunci untuk tumbuh menjadi versi terbaik darimu. ✨"', author:'— Kata Bijak' },
  { text:'"Setiap emosi yang kamu tulis adalah langkah menuju pemahaman diri yang lebih dalam. 🌊"', author:'— Serenia Daily' },
  { text:'"Kecil atau besar, setiap langkah ke depan tetap kemajuan. Terus berjalan! 🌱"', author:'— Inspirasi Harian' },
];

// ====================== AUTH ======================
function switchAuthTab(tab, e) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if(e && e.target) e.target.classList.add('active');
  document.getElementById('login-form').style.display = tab==='login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab==='register' ? 'block' : 'none';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if(!email || !pass) { showToast('⚠️ Isi email dan kata sandi ya!'); return; }
  if (!window._emailSignIn) { showToast('⚠️ Firebase belum siap, tunggu sebentar lalu coba lagi'); return; }
  setButtonLoading('login-submit-btn', true, 'Masuk...');
  try {
    const fUser = await window._emailSignIn(email, pass);
    const user = cacheEmailUserLocally(fUser);
    loginUser(user);
    migrateGuestDataIfAny(user);
  } catch (err) {
    showToast('❌ ' + err.message);
  } finally {
    setButtonLoading('login-submit-btn', false);
  }
}

async function doForgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { showToast('⚠️ Isi dulu email kamu di atas, baru tap "Lupa kata sandi?"'); return; }
  if (!window._forgotPassword) { showToast('⚠️ Firebase belum siap, tunggu sebentar lalu coba lagi'); return; }
  setButtonLoading('forgot-pass-link', true, 'Mengirim...');
  try {
    await window._forgotPassword(email);
    showToast('📩 Link reset kata sandi udah dikirim ke ' + email + ', cek inbox/spam ya');
  } catch (err) {
    showToast('❌ ' + err.message);
  } finally {
    setButtonLoading('forgot-pass-link', false);
  }
}

async function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  if(!name || !email || !pass) { showToast('⚠️ Semua field wajib diisi!'); return; }
  if(pass.length < 6) { showToast('⚠️ Kata sandi minimal 6 karakter'); return; }
  if (!window._emailRegister) { showToast('⚠️ Firebase belum siap, tunggu sebentar lalu coba lagi'); return; }
  setButtonLoading('register-submit-btn', true, 'Mendaftar...');
  try {
    const fUser = await window._emailRegister(name, email, pass);
    const user = cacheEmailUserLocally(fUser);
    loginUser(user);
    migrateGuestDataIfAny(user);
    showToast('🎉 Akun berhasil dibuat! Selamat datang!');
  } catch (err) {
    showToast('❌ ' + err.message);
  } finally {
    setButtonLoading('register-submit-btn', false);
  }
}

// Simpan/update profil (TANPA password — password disimpan aman oleh Firebase
// Auth sendiri, bukan di sini) ke cache lokal, dipakai untuk tampilan offline.
function cacheEmailUserLocally(fUser) {
  let users = safeParseJSON(localStorage.getItem('refleksi_users'), []);
  let user  = users.find(u => u.id === fUser.uid);
  if (!user) {
    user = { name: fUser.name, email: fUser.email, id: fUser.uid, provider:'email', photoURL: fUser.photoURL };
    users.push(user);
  } else {
    user.name = fUser.name; user.email = fUser.email;
  }
  safeSetItem('refleksi_users', JSON.stringify(users));
  return user;
}

async function doGoogleLogin(btnId) {
  if (!window._googleSignIn) {
    showToast('⚠️ Firebase belum siap, tunggu sebentar lalu coba lagi');
    return;
  }
  if (btnId) setButtonLoading(btnId, true, 'Mengalihkan ke Google...');
  showToast('🔵 Mulai redirect ke Google...');   // ← TAMBAHIN INI
  try {
  try {
    // signInWithRedirect: halaman akan dialihkan sepenuhnya ke Google di sini.
    // Hasil login-nya BUKAN didapat lewat baris berikutnya, tapi dicek ulang
    // lewat window._checkGoogleRedirect() saat app dimuat lagi (lihat INIT).
    await window._googleSignIn();
  } catch (err) {
    console.error('Google sign-in error:', err);
    showToast('❌ Login Google gagal, coba lagi');
    if (btnId) setButtonLoading(btnId, false);
  }
}

// Simpan/perbarui profil lokal lalu masuk ke app setelah Google popup berhasil.
function completeGoogleLogin(gUser) {
  let users = safeParseJSON(localStorage.getItem('refleksi_users'), []);
  let user  = users.find(u => u.id === gUser.uid);
  if(!user) {
    user = { name: gUser.name, email: gUser.email, id: gUser.uid, provider:'google', photoURL: gUser.photoURL };
    users.push(user);
  } else {
    user.name = gUser.name; user.email = gUser.email; user.photoURL = gUser.photoURL;
  }
  safeSetItem('refleksi_users', JSON.stringify(users));
  loginUser(user);
  migrateGuestDataIfAny(user);
  showToast('🎉 Berhasil masuk dengan Google!');
}

function guestLogin() {
  loginUser({ name:'Tamu', email:'guest@serenia.app', id:'guest', provider:'guest' });
}

// Kalau ada data mode Tamu tersimpan di HP ini, tawarin buat dipindahkan
// ke akun baru yang baru saja login/daftar (Google atau email).
// Dipanggil SETELAH loginUser() untuk akun non-tamu, supaya appState sudah
// berisi data akun baru (kalau ada), lalu data tamu digabung ke situ.
function migrateGuestDataIfAny(newUser) {
  if (newUser.id === 'guest') return;
  try {
    const gEntries = safeParseJSON(localStorage.getItem('refleksi_entries_guest'), []);
    const gMoods   = safeParseJSON(localStorage.getItem('refleksi_moods_guest'), []);
    const gAch     = safeParseJSON(localStorage.getItem('refleksi_ach_guest'), {});
    const gHabitsRaw = localStorage.getItem('habitTracker_guest');
    const gHabits  = gHabitsRaw ? safeParseJSON(gHabitsRaw, null) : null;
    const hasGuestData = gEntries.length > 0 || gMoods.length > 0 || (gHabits && gHabits.habits && gHabits.habits.length > 0);
    if (!hasGuestData) return;

    if (!confirm('Kamu punya jurnal/data dari mode Tamu di HP ini. Mau dipindahkan ke akun ini?')) return;

    // Gabungkan entri & mood (data tamu ditaruh duluan, biar entri akun yang
    // sudah ada tetap paling atas/terbaru kalau sudah pernah pakai akun ini)
    appState.entries = [...appState.entries, ...gEntries];
    appState.moods    = [...appState.moods, ...gMoods];
    appState.achievements = { ...gAch, ...appState.achievements };

    if (gHabits) {
      const uid = newUser.id;
      const existingRaw = localStorage.getItem(`habitTracker_${uid}`);
      if (!existingRaw) {
        safeSetItem(`habitTracker_${uid}`, gHabitsRaw);
      } else {
        const existing = safeParseJSON(existingRaw, { habits: [], completions: {} });
        const existingNames = new Set(existing.habits.map(h => h.name));
        gHabits.habits.forEach(h => { if (!existingNames.has(h.name)) existing.habits.push(h); });
        Object.keys(gHabits.completions || {}).forEach(hid => {
          existing.completions[hid] = { ...(existing.completions[hid] || {}), ...gHabits.completions[hid] };
        });
        safeSetItem(`habitTracker_${uid}`, JSON.stringify(existing));
      }
    }

    saveUserData();
    ['entries','moods','ach','pet'].forEach(k => localStorage.removeItem(`refleksi_${k}_guest`));
    localStorage.removeItem('habitTracker_guest');

    showToast('✅ Data mode Tamu berhasil dipindahkan ke akunmu!');
    initHomePage();
  } catch (err) {
    console.error('❌ Gagal memindahkan data mode Tamu:', err);
    showToast('⚠️ Gagal memindahkan sebagian data Tamu, akun kamu tetap aman');
  }
}

function loginUser(user) {
  appState.user = user;
  safeSetItem('refleksi_current_user', JSON.stringify(user));
  loadUserData();
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'flex';
  // Set avatar
  const avatar = document.getElementById('nav-avatar');
  if(user.photoURL) {
    avatar.innerHTML = `<img src="${user.photoURL}" alt="Foto profil ${escapeHtml(user.name || '')}">`;
  } else {
    avatar.textContent = user.name[0].toUpperCase();
    avatar.innerHTML = '';
    avatar.textContent = user.name[0].toUpperCase();
  }
  const hour = new Date().getHours();
  const greet = hour<12 ? 'Selamat Pagi' : hour<17 ? 'Selamat Siang' : 'Selamat Malam';
  document.getElementById('nav-greeting').textContent = `${greet}, ${user.name.split(' ')[0]}!`;
  updateNavStreak();
  initHomePage();
  initDefaultHabits();
  goToPage('home');
  checkAndUnlockAchievements(false);
  restoreFromFirestoreIfAvailable();
}

function doLogout() {
  if(!confirm('Yakin mau keluar?')) return;
  if(appState.user && (appState.user.provider === 'google' || appState.user.provider === 'email') && window._firebaseSignOut) {
    window._firebaseSignOut();
  }
  appState.user = null;
  localStorage.removeItem('refleksi_current_user');
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';
}

function loadUserData() {
  const uid = appState.user.id;
  appState.entries      = safeParseJSON(localStorage.getItem(`refleksi_entries_${uid}`), []);
  appState.moods        = safeParseJSON(localStorage.getItem(`refleksi_moods_${uid}`), []);
  appState.achievements = safeParseJSON(localStorage.getItem(`refleksi_ach_${uid}`), {});
  appState.currentPet   = localStorage.getItem(`refleksi_pet_${uid}`)                    || 'cat';
  appState.cycleEnabled = localStorage.getItem(`refleksi_cycleon_${uid}`)                === '1';
  appState.cycleHistory = safeParseJSON(localStorage.getItem(`refleksi_cycle_${uid}`), []);
  // Migrasi format lama: dulu tiap entri cuma tanggal string ('2026-07-26'),
  // sekarang berupa objek {start, end}. Konversi otomatis biar data lama gak hilang.
  let migrated = false;
  appState.cycleHistory = appState.cycleHistory.map(e => {
    if (typeof e === 'string') { migrated = true; return { start: e, end: null }; }
    return e;
  });
  if (migrated) saveUserData();
}

function saveUserData() {
  const uid = appState.user.id;
  // 1. Tetap simpan ke localStorage (cepat, offline-safe)
  safeSetItem(`refleksi_entries_${uid}`,  JSON.stringify(appState.entries));
  safeSetItem(`refleksi_moods_${uid}`,    JSON.stringify(appState.moods));
  safeSetItem(`refleksi_ach_${uid}`,      JSON.stringify(appState.achievements));
  safeSetItem(`refleksi_pet_${uid}`,      appState.currentPet);
  safeSetItem(`refleksi_cycleon_${uid}`,  appState.cycleEnabled ? '1' : '0');
  safeSetItem(`refleksi_cycle_${uid}`,    JSON.stringify(appState.cycleHistory));
  safeSetItem(`refleksi_updatedAt_${uid}`, new Date().toISOString());
  // 2. Juga simpan ke Firestore (async, tidak menghalangi UI, gagal pun tidak crash)
  if (uid !== 'guest') {
    safeFirestoreSave(uid, {
      entries:      appState.entries,
      moods:        appState.moods,
      achievements: appState.achievements,
      pet:          appState.currentPet,
      cycleEnabled: appState.cycleEnabled,
      cycleHistory: appState.cycleHistory
    });
  }
}

/**
 * Tarik data dari Firestore (kalau ada & lebih baru dari data lokal) lalu
 * tulis ke localStorage supaya semua fungsi baca-lokal (renderEntries, loadHabits, dll)
 * otomatis dapat versi terbaru. Dipanggil otomatis setiap login.
 * Hanya menimpa data lokal kalau data cloud memang lebih baru, supaya
 * perubahan yang belum sempat ter-upload tidak hilang.
 */
async function restoreFromFirestoreIfAvailable() {
  const uid = appState.user.id;
  if (!window._firestoreLoad || uid === 'guest') return;
  try {
    const remote = await window._firestoreLoad(uid);
    if (!remote) return;

    const localTime  = localStorage.getItem(`refleksi_updatedAt_${uid}`);
    const remoteTime = remote.updatedAt;
    if (localTime && remoteTime && new Date(remoteTime) <= new Date(localTime)) {
      // Data lokal sama baru atau lebih baru — jangan ditimpa
      return;
    }

    if (remote.entries      !== undefined) safeSetItem(`refleksi_entries_${uid}`,  JSON.stringify(remote.entries));
    if (remote.moods        !== undefined) safeSetItem(`refleksi_moods_${uid}`,    JSON.stringify(remote.moods));
    if (remote.achievements !== undefined) safeSetItem(`refleksi_ach_${uid}`,      JSON.stringify(remote.achievements));
    if (remote.pet          !== undefined) safeSetItem(`refleksi_pet_${uid}`,      remote.pet);
    if (remote.habits       !== undefined) safeSetItem(`habitTracker_${uid}`,      JSON.stringify(remote.habits));
    if (remote.cycleEnabled !== undefined) safeSetItem(`refleksi_cycleon_${uid}`,  remote.cycleEnabled ? '1' : '0');
    if (remote.cycleHistory !== undefined) safeSetItem(`refleksi_cycle_${uid}`,    JSON.stringify(remote.cycleHistory));
    if (remoteTime) safeSetItem(`refleksi_updatedAt_${uid}`, remoteTime);

    // Segarkan tampilan dengan data yang baru dipulihkan
    loadUserData();
    if (document.getElementById('app-screen').classList.contains('active')) {
      initHomePage();
      renderEntries();
      updatePetDisplay();
      checkAndUnlockAchievements(false);
      if (typeof renderHabits === 'function') renderHabits();
    }
      } catch (err) {
    console.warn('⚠️ Gagal memuat data dari Firestore, tetap pakai data lokal.', err);
  }
}

// ====================== NAVIGATION ======================
function goToPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
  const pageEl = document.getElementById(`page-${page}`);
  const navEl  = document.getElementById(`nav-${page}`);
  if(pageEl) pageEl.classList.add('active');
  if(navEl)  { navEl.classList.add('active'); navEl.setAttribute('aria-current', 'page'); }
  const handlers = {
    home: initHomePage, mood: initMoodPage, journal: initJournalPage,
    calendar: initCalendar, pet: initPetPage, achievements: initAchievementsPage,
    settings: initSettingsPage, habits: initHabitsPage,
    refleksi: initReflectionPage,
  };
  if(handlers[page]) handlers[page]();
}

// ====================== HOME ======================
function initHomePage() {
  const q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  // Nature Wellness: prepend time-aware greeting before quote
  const hour = new Date().getHours();
  const greetEmoji = hour < 6 ? '🌙' : hour < 12 ? '🌅' : hour < 17 ? '☀️' : hour < 20 ? '🌤️' : '🌙';
  const greetWord  = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Malam';
  const userName   = appState.user ? appState.user.name.split(' ')[0] : '';
  document.getElementById('hero-quote').innerHTML = `
    <div class="hero-mist"></div>
    <div class="hero-snow"></div>
    <div class="hero-botanical">🌸 🌼 🌿</div>
    <div class="hero-greeting">
      <span class="hero-greeting-name">${greetEmoji} ${greetWord}, ${escapeHtml(userName)}!</span>
    </div>
    <div class="quote-text">${q.text}</div>
    <div class="quote-author">${q.author}</div>`;
  const streak = calcStreak();
  document.getElementById('stat-entries').textContent = appState.entries.length;
  document.getElementById('stat-streak').textContent = streak + (streak>0?'🔥':'');
  const todayMood = getTodayMood();
  document.getElementById('stat-mood-emoji').textContent = todayMood || '—';
  if(todayMood) {
    document.querySelectorAll('#home-mood-grid .mood-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mood===todayMood);
    });
  }
  updateHomePet();
  updateNextAchievementProgress();
  renderHomeCycleCard();
}

function updateNextAchievementProgress() {
  const streak = calcStreak();
  const entries = appState.entries.length;
  // Find next locked achievement
  const next = ACHIEVEMENTS.find(a => !appState.achievements[a.id]);
  if(!next) {
    document.getElementById('next-ach-name').textContent = '🎉 Semua lencana terbuka!';
    document.getElementById('next-ach-bar').style.width = '100%';
    document.getElementById('next-ach-text').textContent = 'Kamu sudah luar biasa!';
    return;
  }
  const current = next.type==='streak' ? streak : next.type==='entries' ? entries : appState.moods.length;
  const pct = Math.min(100, Math.round(current/next.target*100));
  document.getElementById('next-ach-name').textContent = `${next.icon} ${next.name}`;
  document.getElementById('next-ach-bar').style.width = pct+'%';
  document.getElementById('next-ach-text').textContent = `${current} / ${next.target} (${pct}%)`;
}

function updateNavStreak() {
  const s = calcStreak();
  document.getElementById('nav-streak-num').textContent = s;
}

function selectMoodHome(emoji, name) {
  appState.currentMood = emoji; appState.currentMoodName = name;
  document.querySelectorAll('#home-mood-grid .mood-btn').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  document.getElementById('stat-mood-emoji').textContent = emoji;
  saveMoodRecord(emoji, name);
  showToast(`${emoji} Mood "${name}" tercatat!`);
  checkAndUnlockAchievements();
}

function saveQuickEntry() {
  const text = document.getElementById('home-quick-journal').value.trim();
  if(!text) { showToast('⚠️ Tulis sesuatu dulu ya!'); return; }
  const entry = { id:Date.now(), date:new Date().toISOString(), text, mood:appState.currentMood||'😊', tags:[], source:'quick' };
  appState.entries.unshift(entry);
  saveUserData();
  document.getElementById('home-quick-journal').value='';
  document.getElementById('stat-entries').textContent = appState.entries.length;
  showToast('✅ Entri tersimpan! Teman hewanmu senang! 🐾');
  checkAndUnlockAchievements();
  updateNextAchievementProgress();
}

function updateHomePet() {
  const pet = PETS[appState.currentPet];
  document.getElementById('home-pet-display').textContent = pet.em;
  document.getElementById('home-pet-name').textContent = `${pet.name} si ${pet.label}`;
  const speeches = PET_SPEECHES[appState.currentPet];
  document.getElementById('home-pet-speech').textContent = speeches[Math.floor(Math.random()*speeches.length)];
}

// ====================== MOOD ======================
function initMoodPage() {
  const streak = calcStreak();
  document.getElementById('mood-streak-num').textContent = streak;
  const todayMood = getTodayMood();
  if(todayMood) {
    document.querySelectorAll('#mood-main-grid .mood-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mood===todayMood);
    });
  }
  renderMoodWeek();
  renderMoodStats();
  renderInsights();
}

function selectMoodMain(emoji, name) {
  appState.currentMood=emoji; appState.currentMoodName=name;
  document.querySelectorAll('#mood-main-grid .mood-btn').forEach(b=>b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

function saveMood() {
  if(!appState.currentMood) { showToast('⚠️ Pilih mood dulu ya!'); return; }
  saveMoodRecord(appState.currentMood, appState.currentMoodName);
  renderMoodWeek(); renderMoodStats();
  showToast(`${appState.currentMood} Mood "${appState.currentMoodName}" tersimpan!`);
  checkAndUnlockAchievements();
  updateNavStreak();
}

function saveMoodRecord(emoji, name) {
  const today = new Date().toDateString();
  const idx = appState.moods.findIndex(m=>new Date(m.date).toDateString()===today);
  const record = { date:new Date().toISOString(), emoji, name };
  if(idx>=0) appState.moods[idx]=record; else appState.moods.push(record);
  saveUserData();
}

function getTodayMood() {
  const today = new Date().toDateString();
  const m = appState.moods.find(m=>new Date(m.date).toDateString()===today);
  return m ? m.emoji : null;
}

function renderMoodWeek() {
  const days=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  let html='';
  for(let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const m=appState.moods.find(x=>new Date(x.date).toDateString()===d.toDateString());
    html+=`<div class="mood-day-block">
      <div class="mday">${days[d.getDay()]}</div>
      <div class="mem">${m?m.emoji:'⬜'}</div>
    </div>`;
  }
  document.getElementById('mood-week-display').innerHTML = html;
}

function renderMoodStats() {
  const counts={};
  appState.moods.forEach(m=>{counts[m.emoji]=(counts[m.emoji]||0)+1;});
  const total=appState.moods.length;
  let html = total===0
    ? '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem;"><div style="font-size:2rem;margin-bottom:0.5rem;">🌈</div>Belum ada data mood. Mulai catat sekarang! 🌟</div>'
    : '';
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([em,cnt])=>{
    const pct=total>0?Math.round(cnt/total*100):0;
    html+=`<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
      <span style="font-size:1.2rem;">${em}</span>
      <div style="flex:1;height:9px;background:var(--border);border-radius:5px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--ocean),var(--sky));border-radius:5px;transition:width 0.6s;"></div>
      </div>
      <span style="font-size:0.73rem;color:var(--text-muted);min-width:32px;">${pct}%</span>
    </div>`;
  });
  document.getElementById('mood-stats-display').innerHTML = html;
}

// ====================== INSIGHT ======================
// Skor valensi kasar per emoji mood, dipakai buat hitung rata-rata numerik.
const MOOD_SCORE = {
  '😄':5,'🤩':5,'🤗':4,'😌':4,'😐':3,'🫤':3,'🥱':2,'😰':2,'😔':1,'😤':1
};
const HARI_NAMA = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function renderInsights() {
  const el = document.getElementById('insight-display');
  const cards = [];

  // --- 1. Hari terbaik (rata-rata mood per hari dalam seminggu) ---
  if (appState.moods.length >= 5) {
    const byDay = {};
    appState.moods.forEach(m => {
      const d = new Date(m.date).getDay();
      const score = MOOD_SCORE[m.emoji] ?? 3;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(score);
    });
    let bestDay = null, bestAvg = -1;
    Object.entries(byDay).forEach(([d, scores]) => {
      const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
      if (avg > bestAvg) { bestAvg = avg; bestDay = d; }
    });
    if (bestDay !== null) {
      cards.push(`<div class="insight-item">📅 Mood kamu biasanya paling baik di hari <b>${HARI_NAMA[bestDay]}</b></div>`);
    }
  }

  // --- 2. Korelasi mood vs hari mengerjakan habit ---
  const habitData = loadHabits();
  if (appState.moods.length >= 5 && habitData.habits.length > 0) {
    const doneScores = [], notDoneScores = [];
    appState.moods.forEach(m => {
      const ds = new Date(m.date).toISOString().slice(0,10);
      const score = MOOD_SCORE[m.emoji] ?? 3;
      const anyHabitDone = habitData.habits.some(h => isHabitDoneOnDay(h.id, ds, habitData));
      (anyHabitDone ? doneScores : notDoneScores).push(score);
    });
    if (doneScores.length >= 3 && notDoneScores.length >= 3) {
      const avgDone = doneScores.reduce((a,b)=>a+b,0)/doneScores.length;
      const avgNot  = notDoneScores.reduce((a,b)=>a+b,0)/notDoneScores.length;
      if (avgDone - avgNot >= 0.4) {
        cards.push(`<div class="insight-item">💪 Mood kamu cenderung lebih baik di hari kamu ngerjain habit — lanjutkan!</div>`);
      } else if (avgNot - avgDone >= 0.4) {
        cards.push(`<div class="insight-item">🌤️ Menariknya, mood kamu cenderung sama baiknya walau lagi gak sempat ngerjain habit — gak perlu terlalu keras sama diri sendiri.</div>`);
      }
    }
  }

  // --- 3. Streak jurnal terpanjang ---
  if (appState.entries.length >= 3) {
    const uniqueDates = [...new Set(appState.entries.map(e => new Date(e.date).toISOString().slice(0,10)))].sort();
    let longest = 1, run = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i-1]);
      const cur  = new Date(uniqueDates[i]);
      const diffDays = Math.round((cur - prev) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    if (longest >= 2) {
      cards.push(`<div class="insight-item">🔥 Streak jurnal terpanjang kamu: <b>${longest} hari berturut-turut</b></div>`);
    }
  }

  // --- 4. Tren jurnal: minggu ini vs minggu lalu ---
  if (appState.entries.length >= 2) {
    const now = Date.now();
    const oneDay = 86400000;
    const thisWeek = appState.entries.filter(e => (now - new Date(e.date).getTime()) <= 7*oneDay).length;
    const lastWeek = appState.entries.filter(e => {
      const diff = now - new Date(e.date).getTime();
      return diff > 7*oneDay && diff <= 14*oneDay;
    }).length;
    if (thisWeek > lastWeek) {
      cards.push(`<div class="insight-item">📈 Minggu ini kamu nulis jurnal <b>${thisWeek}x</b>, lebih rajin dibanding minggu lalu (${lastWeek}x) 🎉</div>`);
    } else if (thisWeek < lastWeek) {
      cards.push(`<div class="insight-item">📉 Minggu ini baru <b>${thisWeek}x</b> nulis jurnal, minggu lalu ${lastWeek}x — gapapa, pelan-pelan aja 🌱</div>`);
    }
  }

  el.innerHTML = cards.length > 0
    ? cards.join('')
    : `<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem;"><div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>Belum cukup data buat nemuin pola. Terus catat mood, jurnal, dan habit kamu ya! 🌟</div>`;
}

function calcStreak() {
  // Count consecutive days with EITHER a journal entry OR a mood
  const today=new Date(); today.setHours(0,0,0,0);
  let streak=0;
  for(let i=0;i<365;i++) {
    const d=new Date(today); d.setDate(d.getDate()-i);
    const ds=d.toDateString();
    const hasActivity =
      appState.entries.some(e=>new Date(e.date).toDateString()===ds) ||
      appState.moods.some(m=>new Date(m.date).toDateString()===ds);
    if(hasActivity) streak++;
    else if(i>0) break;
  }
  return streak;
}

// ====================== JOURNAL ======================
function initJournalPage() {
  document.getElementById('journal-today-date').textContent =
    new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  renderEntries();
}

function insertText(text) {
  const ta=document.getElementById('main-journal-editor');
  const pos=ta.selectionStart;
  ta.value=ta.value.substring(0,pos)+text+ta.value.substring(pos);
  ta.selectionStart=ta.selectionEnd=pos+text.length;
  ta.focus();
  updateJournalCharCount();
}

function addTag(e) {
  if(e.key==='Enter'||e.key===',') {
    const val=e.target.value.replace(',','').trim();
    if(val && !appState.journalTags.includes(val)) { appState.journalTags.push(val); renderTags(); }
    e.target.value=''; e.preventDefault();
  }
}
function renderTags() {
  document.getElementById('entry-tags-display').innerHTML =
    appState.journalTags.map((t,i)=>`<span class="tag-pill">#${escapeHtml(t)}<span class="remove-tag" onclick="removeTag(${i})" role="button" tabindex="0" aria-label="Hapus tag ${escapeHtml(t)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();removeTag(${i})}">×</span></span>`).join('');
}
function removeTag(i) { appState.journalTags.splice(i,1); renderTags(); }

const JOURNAL_MAX_LEN = 10000;

function updateJournalCharCount() {
  const el = document.getElementById('main-journal-editor');
  const counter = document.getElementById('journal-char-count');
  if (!el || !counter) return;
  const len = el.value.length;
  counter.textContent = `${len.toLocaleString('id-ID')} / ${JOURNAL_MAX_LEN.toLocaleString('id-ID')} karakter`;
  counter.style.color = len >= JOURNAL_MAX_LEN ? 'var(--rose, #c0546b)' : 'var(--text-muted)';
}

function saveJournalEntry() {
  const text=document.getElementById('main-journal-editor').value.trim();
  if(!text) { showToast('⚠️ Tulis sesuatu dulu ya!'); return; }
  if(text.length > JOURNAL_MAX_LEN) { showToast(`⚠️ Entri kepanjangan (maks ${JOURNAL_MAX_LEN.toLocaleString('id-ID')} karakter)`); return; }
  const entry={ id:Date.now(), date:new Date().toISOString(), text, mood:appState.currentMood||'📝', tags:[...appState.journalTags] };
  appState.entries.unshift(entry);
  appState.journalTags=[];
  saveUserData();
  document.getElementById('main-journal-editor').value='';
  updateJournalCharCount();
  renderTags(); renderEntries();
  showToast('✅ Entri jurnal tersimpan! 📖');
  checkAndUnlockAchievements();
  updateNavStreak();
}

function clearJournalEditor() {
  if(document.getElementById('main-journal-editor').value && !confirm('Hapus draft?')) return;
  document.getElementById('main-journal-editor').value='';
  updateJournalCharCount();
  appState.journalTags=[]; renderTags();
}

function renderEntries() {
  const c=document.getElementById('entries-list');
  if(appState.entries.length===0) {
    c.innerHTML=`<div style="text-align:center;padding:2.5rem;color:var(--text-muted);">
      <div style="font-size:3rem;margin-bottom:0.75rem;">📝</div>
      <div style="font-family:'Nunito',sans-serif;font-weight:700;">Belum ada entri. Mulai jurnal pertamamu! 🌟</div>
    </div>`; return;
  }
  c.innerHTML=appState.entries.slice(0,15).map(e=>{
    const d=new Date(e.date);
    const dateStr=d.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    const timeStr=d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    const rawPreview=e.text.length>130?e.text.substring(0,130)+'...':e.text;
    const preview=escapeHtml(rawPreview);
    const tagsHtml=e.tags&&e.tags.length?e.tags.map(t=>`<span class="entry-tag">#${escapeHtml(t)}</span>`).join(''):'';
    return `<div class="entry-card" onclick="viewEntry(${e.id})">
      <div class="entry-date"><span class="entry-mood-badge">${e.mood}</span>${dateStr} · ${timeStr}</div>
      <div class="entry-preview">${preview}</div>
      ${tagsHtml?`<div class="entry-tags">${tagsHtml}</div>`:''}
    </div>`;
  }).join('');
}

function viewEntry(id) {
  const e=appState.entries.find(x=>x.id===id); if(!e) return;
  const d=new Date(e.date);
  document.getElementById('modal-title').textContent=`${e.mood} ${d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`;
  document.getElementById('modal-content').innerHTML=`
    <div style="white-space:pre-wrap;line-height:1.7;font-size:0.9rem;color:var(--text);margin-bottom:0.85rem;">${escapeHtml(e.text)}</div>
    ${e.tags&&e.tags.length?`<div class="entry-tags" style="margin-bottom:0.75rem;">${e.tags.map(t=>`<span class="entry-tag">#${escapeHtml(t)}</span>`).join('')}</div>`:''}
    <button class="btn-action btn-rose" onclick="deleteEntry(${e.id})">🗑️ Hapus Entri</button>
  `;
  document.getElementById('entry-modal').classList.add('open');
}

function deleteEntry(id) {
  if(!confirm('Hapus entri ini?')) return;
  appState.entries=appState.entries.filter(e=>e.id!==id);
  saveUserData(); closeModal(); renderEntries();
  showToast('🗑️ Entri dihapus');
}
function closeModal() { document.getElementById('entry-modal').classList.remove('open'); }

function getRandomPrompt() {
  const prompts=[
    'Ceritakan 3 hal yang membuatmu tersenyum hari ini, sekecil apapun itu. 😊',
    'Apa tantangan terbesar yang kamu hadapi hari ini dan apa yang kamu pelajari? 💪',
    'Bayangkan versi terbaikmu 1 tahun dari sekarang. Apa yang berbeda dari sekarang? 🌟',
    'Tuliskan surat pendek untuk dirimu sendiri 5 tahun yang lalu. 💌',
    'Apa satu kebiasaan kecil yang ingin kamu mulai atau hentikan mulai besok? 🌱',
    'Apa yang membuatmu paling bersyukur hari ini? 🙏',
    'Siapa satu orang yang ingin kamu ucapkan terima kasih, dan kenapa? 💕',
  ];
  const p=prompts[Math.floor(Math.random()*prompts.length)];
  document.getElementById('main-journal-editor').value=`💭 Prompt hari ini:\n${p}\n\n`;
  document.getElementById('main-journal-editor').focus();
  showToast('✨ Prompt baru siap!');
}

// ====================== CALENDAR ======================
function initCalendar() { renderCalendar(); renderCalMonthStats(); }

function renderCalendar() {
  const year=appState.calYear, month=appState.calMonth;
  const mNames=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  document.getElementById('cal-month-year').textContent=`${mNames[month]} ${year}`;
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const daysInPrev=new Date(year,month,0).getDate();
  const today=new Date();
  let html='';
  ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d=>{html+=`<div class="cal-day-name">${d}</div>`;});
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day other-month">${daysInPrev-firstDay+i+1}</div>`;
  for(let d=1;d<=daysInMonth;d++) {
    const date=new Date(year,month,d);
    const isToday=date.toDateString()===today.toDateString();
    const hasEntry=appState.entries.some(e=>new Date(e.date).toDateString()===date.toDateString());
    const hasMood=appState.moods.some(m=>new Date(m.date).toDateString()===date.toDateString());
    const cls=['cal-day',isToday?'today':'',hasEntry||hasMood?'has-entry':''].filter(Boolean).join(' ');
    html+=`<div class="${cls}" onclick="calSelectDay(${year},${month},${d})">${d}</div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;
}

function calNavigate(dir) {
  appState.calMonth+=dir;
  if(appState.calMonth>11){appState.calMonth=0;appState.calYear++;}
  if(appState.calMonth<0){appState.calMonth=11;appState.calYear--;}
  renderCalendar(); renderCalMonthStats();
}

function calSelectDay(y,m,d) {
  const date=new Date(y,m,d), ds=date.toDateString();
  const entries=appState.entries.filter(e=>new Date(e.date).toDateString()===ds);
  const mood=appState.moods.find(x=>new Date(x.date).toDateString()===ds);
  const box=document.getElementById('cal-selected-info');
  box.style.display='block';
  document.getElementById('cal-selected-date').textContent=`📅 ${date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`;
  let html='';
  if(mood) html+=`<div style="margin-bottom:0.6rem;font-size:0.9rem;display:flex;align-items:center;gap:6px;">Mood: <span style="font-size:1.3rem;">${mood.emoji}</span><span style="color:var(--text-muted);">${escapeHtml(mood.name)}</span></div>`;
  if(entries.length>0) {
    html+=`<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.4rem;">${entries.length} entri jurnal:</div>`;
    entries.forEach(e=>{
      html+=`<div class="entry-card" onclick="viewEntry(${e.id})" style="margin-bottom:0.5rem;">
        <div class="entry-preview">${escapeHtml(e.text.substring(0,100))}${e.text.length>100?'...':''}</div>
      </div>`;
    });
  }
  if(!mood && entries.length===0) html=`<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem;">Tidak ada catatan untuk hari ini.</div>`;
  document.getElementById('cal-selected-content').innerHTML=html;
}

function renderCalMonthStats() {
  const year=appState.calYear,month=appState.calMonth;
  const me=appState.entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===year&&d.getMonth()===month;});
  const mm=appState.moods.filter(m=>{const d=new Date(m.date);return d.getFullYear()===year&&d.getMonth()===month;});
  document.getElementById('cal-month-stats').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;text-align:center;">
      <div style="background:var(--sky-light);border-radius:var(--radius-md);padding:0.85rem;">
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:1.5rem;color:var(--ocean);">${me.length}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);">Entri Jurnal</div>
      </div>
      <div style="background:var(--mint-light);border-radius:var(--radius-md);padding:0.85rem;">
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:1.5rem;color:#1a7a54;">${mm.length}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);">Mood Tercatat</div>
      </div>
      <div style="background:var(--sun-light);border-radius:var(--radius-md);padding:0.85rem;">
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:1.5rem;color:#b45309;">${calcStreak()}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);">Hari Streak</div>
      </div>
    </div>
  `;
}

// ====================== PET ======================
function initPetPage() { selectPet(appState.currentPet); updatePetDisplay(); }

function selectPet(type) {
  appState.currentPet=type;
  const pet=PETS[type];
  appState.petName=pet.name;
  document.querySelectorAll('.pet-choice').forEach(b=>b.classList.remove('active'));
  document.getElementById(`pet-btn-${type}`).classList.add('active');
  updatePetDisplay(); saveUserData();
}

function updatePetDisplay() {
  const pet=PETS[appState.currentPet];
  document.getElementById('pet-main-display').textContent=pet.em;
  document.getElementById('pet-main-name').textContent=pet.name;
  const speeches=PET_SPEECHES[appState.currentPet];
  document.getElementById('pet-speech-bubble').textContent=speeches[Math.floor(Math.random()*speeches.length)];
  updateHomePet();
}

function petInteract() {
  const pet=PETS[appState.currentPet];
  const speeches=PET_SPEECHES[appState.currentPet];
  document.getElementById('pet-speech-bubble').textContent=speeches[Math.floor(Math.random()*speeches.length)];
  showToast(`${pet.em} ${pet.name} senang kamu menyapanya! 💕`);
}

function petActivity(type) {
  const pet=PETS[appState.currentPet];
  const acts={
    feed:  `${pet.em} ${pet.name} makan dengan lahap! ❤️`,
    play:  `${pet.em} ${pet.name} sangat gembira bermain! 🎉`,
    study: `${pet.em} ${pet.name} semangat belajar bersamamu! 📚`,
    sleep: `${pet.em} ${pet.name} beristirahat dengan nyaman... 😴`,
  };
  const sp={feed:'Terima kasih makanannya! Yummy! 😋',play:'Asyik!! Ini seru banget! 🎊',study:'Belajar bareng itu menyenangkan! 🌟',sleep:'Zzz... terima kasih... zzz 💤'};
  document.getElementById('pet-speech-bubble').textContent=sp[type];
  showToast(acts[type]);
}

function getPetWisdom() {
  const pet=PETS[appState.currentPet];
  const wisdoms=[
    `"Setiap langkah kecil itu berarti besar. Kamu luar biasa!" — ${pet.name} ${pet.em}`,
    `"Percayalah pada dirimu. Kamu lebih kuat dari yang kamu kira!" — ${pet.name} ${pet.em}`,
    `"Hari ini mungkin berat, tapi kamu bisa melewatinya. Aku percaya kamu!" — ${pet.name} ${pet.em}`,
    `"Teruslah berjurnal! Setiap kata yang kamu tulis adalah bagian dari pertumbuhanmu!" — ${pet.name} ${pet.em}`,
    `"Istirahat itu bukan kelemahan. Itu cara kamu mengisi ulang energimu! 🌟" — ${pet.name} ${pet.em}`,
  ];
  const wisdom=wisdoms[Math.floor(Math.random()*wisdoms.length)];
  const box=document.getElementById('pet-wisdom-box');
  box.style.display='block';
  box.innerHTML=`<div style="background:linear-gradient(135deg,var(--sky-light),var(--mint-light));border-radius:var(--radius-md);padding:1rem;border:1.5px solid var(--border-soft);">
    <div style="font-size:2rem;text-align:center;margin-bottom:0.5rem;">${pet.em}</div>
    <div style="font-style:italic;font-size:0.85rem;color:var(--text);text-align:center;line-height:1.65;">${wisdom}</div>
  </div>`;
}

// ====================== ACHIEVEMENTS ======================
function initAchievementsPage() {
  const streak=calcStreak();
  document.getElementById('ach-streak-big').textContent=streak;
  // Streak message
  const msgs=['Mulai berjurnal hari ini!','Teruslah konsisten! 💪','Kamu sedang dalam jalur yang baik! 🌟','Luar biasa! Pertahankan! 🔥','Kamu superstar jurnal! 👑'];
  const idx=streak===0?0:streak<7?1:streak<30?2:streak<100?3:4;
  document.getElementById('ach-streak-msg').textContent=msgs[idx];

  // Streak progress to next milestone
  const milestones=[7,30,100,365];
  const next=milestones.find(m=>streak<m)||365;
  const prev=milestones[milestones.indexOf(next)-1]||0;
  const pct=next>prev?Math.min(100,Math.round((streak-prev)/(next-prev)*100)):100;
  document.getElementById('streak-progress-bar').style.width=pct+'%';
  document.getElementById('streak-progress-label').textContent=streak>=365?'Kamu sudah capai semua milestone! 👑':`${streak}/${next} hari menuju lencana berikutnya`;

  renderAchievementsGrid();
}

function renderAchievementsGrid() {
  const streak=calcStreak();
  const entries=appState.entries.length;
  const moods=appState.moods.length;
  const habitData=loadHabits();
  const totalDone=Object.values(habitData.completions||{}).reduce((a,v)=>a+Object.keys(v).length,0);
  const maxHabitStreak=habitData.habits?(Math.max(0,...habitData.habits.map(h=>calculateHabitStreak(h.id,habitData)))):0;
  const weeklyPct=getHabitWeeklyPct(habitData);

  const html=ACHIEVEMENTS.map(a=>{
    const unlocked=!!appState.achievements[a.id];
    let current=0;
    if(a.type==='streak') current=streak;
    else if(a.type==='entries') current=entries;
    else if(a.type==='moods') current=moods;
    else if(a.type==='habit_done') current=totalDone;
    else if(a.type==='habit_streak') current=maxHabitStreak;
    else if(a.type==='habit_weekly_pct') current=weeklyPct;
    const pct=Math.min(100,Math.round(current/a.target*100));
    return `<div class="achievement-card ${unlocked?'unlocked':'locked'}">
      <span class="ach-badge ${unlocked?'done':'locked-badge'}">${unlocked?'✓ Terbuka':'🔒 Terkunci'}</span>
      <span class="ach-icon">${a.icon}</span>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
      <div class="ach-progress">
        <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%"></div></div>
        <div class="ach-progress-text">${unlocked?'Selesai! 🎉':`${Math.min(current,a.target)}/${a.target}`}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('achievements-grid').innerHTML=html;
}

function checkAndUnlockAchievements(showCelebration=true) {
  const streak=calcStreak();
  const entries=appState.entries.length;
  const moods=appState.moods.length;
  // Habit stats for achievements
  const habitData=loadHabits();
  const totalDone=Object.values(habitData.completions||{}).reduce((a,v)=>a+Object.keys(v).length,0);
  const maxHabitStreak=habitData.habits?(Math.max(0,...habitData.habits.map(h=>calculateHabitStreak(h.id,habitData)))):0;
  const weeklyPct=getHabitWeeklyPct(habitData);
  let newUnlock=null;

  ACHIEVEMENTS.forEach(a=>{
    if(appState.achievements[a.id]) return; // already unlocked
    let current=0;
    if(a.type==='streak') current=streak;
    else if(a.type==='entries') current=entries;
    else if(a.type==='moods') current=moods;
    else if(a.type==='habit_done') current=totalDone;
    else if(a.type==='habit_streak') current=maxHabitStreak;
    else if(a.type==='habit_weekly_pct') current=weeklyPct;
    if(current>=a.target) {
      appState.achievements[a.id]=Date.now();
      newUnlock=a;
    }
  });

  if(newUnlock) {
    saveUserData();
    if(showCelebration) celebrateAchievement(newUnlock);
  }
  updateNextAchievementProgress();
  updateNavStreak();
}

function celebrateAchievement(ach) {
  document.getElementById('cel-icon').textContent=ach.icon;
  document.getElementById('cel-title').textContent=`${ach.name} Terbuka!`;
  document.getElementById('cel-desc').textContent=ach.desc;

  const overlay=document.getElementById('celebration-overlay');
  const toast=document.getElementById('celebration-toast');
  overlay.classList.add('active');
  setTimeout(()=>toast.classList.add('active'),50);

  // Confetti
  const colors=['#f9d55b','#6ec6f0','#7dd3b0','#f4a97f','#b8a4e8','#f29aaa'];
  for(let i=0;i<50;i++) {
    const c=document.createElement('div');
    c.className='confetti-piece';
    c.style.cssText=`
      left:${Math.random()*100}%;
      top:-20px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      width:${6+Math.random()*10}px;height:${6+Math.random()*10}px;
      border-radius:${Math.random()>0.5?'50%':'2px'};
      animation-duration:${2+Math.random()*2.5}s;
      animation-delay:${Math.random()*0.8}s;
    `;
    overlay.appendChild(c);
  }

  setTimeout(()=>{
    toast.classList.remove('active');
    setTimeout(()=>{
      overlay.classList.remove('active');
      overlay.querySelectorAll('.confetti-piece').forEach(c=>c.remove());
    },400);
  },3500);
}

// ====================== SETTINGS ======================
function initSettingsPage() {
  const u=appState.user;
  if(!u) return;
  const avatarEl=document.getElementById('settings-avatar-large');
  if(u.photoURL) {
    avatarEl.innerHTML=`<img src="${u.photoURL}" alt="Foto profil ${escapeHtml(u.name || '')}">`;
  } else {
    avatarEl.innerHTML='';
    avatarEl.textContent=u.name[0].toUpperCase();
  }
  document.getElementById('settings-profile-name').textContent=u.name;
  document.getElementById('settings-profile-email').textContent=u.email;

  const unlocked=Object.keys(appState.achievements).length;
  document.getElementById('settings-ach-sub').textContent=`${unlocked}/${ACHIEVEMENTS.length} lencana terbuka`;
  document.getElementById('settings-stats-sub').textContent=`${appState.entries.length} entri · ${appState.moods.length} mood · ${calcStreak()} hari streak`;
  renderCycleUI();
}

function exportData() {
  try {
    const data={
      user:{name:appState.user.name, email:appState.user.email},
      entries:appState.entries,
      moods:appState.moods,
      achievements:appState.achievements,
      cycleHistory:appState.cycleHistory,
      habits:(typeof loadHabits==='function') ? loadHabits() : null,
      exportedAt:new Date().toISOString()
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`serenia-backup-${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📤 Data berhasil diekspor!');
  } catch (err) {
    console.error('❌ Gagal mengekspor data:', err);
    showToast('⚠️ Gagal mengekspor data, coba lagi');
  }
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      importSereniaData(data);
    } catch (err) {
      console.error('❌ Gagal membaca file impor:', err);
      showToast('⚠️ File tidak valid atau rusak, pastikan itu file backup Serenia (.json)');
    }
    event.target.value = ''; // reset biar bisa pilih file yang sama lagi kalau perlu
  };
  reader.onerror = () => showToast('⚠️ Gagal membaca file');
  reader.readAsText(file);
}

function importSereniaData(data) {
  if (!data || typeof data !== 'object') {
    showToast('⚠️ Format file tidak dikenali');
    return;
  }
  const inEntries = Array.isArray(data.entries) ? data.entries : [];
  const inMoods = Array.isArray(data.moods) ? data.moods : [];
  const inAch = (data.achievements && typeof data.achievements === 'object') ? data.achievements : {};
  const inCycle = Array.isArray(data.cycleHistory) ? data.cycleHistory : [];
  const inHabitsData = (data.habits && typeof data.habits === 'object') ? data.habits : null;

  if (inEntries.length === 0 && inMoods.length === 0 && !inHabitsData) {
    showToast('⚠️ File ini tidak berisi data yang bisa diimpor');
    return;
  }

  const ringkasan = `File ini berisi ${inEntries.length} entri jurnal, ${inMoods.length} catatan mood` +
    (inHabitsData && inHabitsData.habits ? `, ${inHabitsData.habits.length} habit` : '') +
    `.\n\nData ini akan DIGABUNGKAN dengan data yang sudah ada di app ini — data yang sudah ada TIDAK akan hilang atau tertimpa, dan entri yang sama tidak akan digandakan.\n\nLanjutkan impor?`;
  if (!confirm(ringkasan)) return;

  // --- Gabung entri jurnal: lewati id yang sudah ada ---
  const existingEntryIds = new Set(appState.entries.map(e => e.id));
  let addedEntries = 0;
  inEntries.forEach(e => {
    if (e && e.id !== undefined && !existingEntryIds.has(e.id)) {
      appState.entries.push(e);
      existingEntryIds.add(e.id);
      addedEntries++;
    }
  });

  // --- Gabung mood: lewati tanggal yang catatannya sudah ada ---
  const existingMoodDates = new Set(appState.moods.map(m => new Date(m.date).toDateString()));
  let addedMoods = 0;
  inMoods.forEach(m => {
    if (m && m.date) {
      const ds = new Date(m.date).toDateString();
      if (!existingMoodDates.has(ds)) {
        appState.moods.push(m);
        existingMoodDates.add(ds);
        addedMoods++;
      }
    }
  });

  // --- Gabung achievement: union, sekali terbuka tetap terbuka ---
  Object.keys(inAch).forEach(k => {
    if (inAch[k]) appState.achievements[k] = appState.achievements[k] || inAch[k];
  });

  // --- Gabung riwayat siklus: dedupe berdasarkan start+end ---
  const existingCycleKeys = new Set(appState.cycleHistory.map(c => c.start + '|' + c.end));
  inCycle.forEach(c => {
    const key = c.start + '|' + c.end;
    if (!existingCycleKeys.has(key)) { appState.cycleHistory.push(c); existingCycleKeys.add(key); }
  });

  // --- Gabung habit: cocokkan berdasarkan nama, gabung riwayat completion-nya ---
  let addedHabits = 0;
  if (inHabitsData && Array.isArray(inHabitsData.habits) && typeof loadHabits === 'function') {
    const habitData = loadHabits();
    if (!habitData.habits) habitData.habits = [];
    if (!habitData.completions) habitData.completions = {};
    inHabitsData.habits.forEach(h => {
      let target = habitData.habits.find(existing => existing.name === h.name);
      if (!target) {
        target = { id: 'h_import_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), name: h.name, emoji: h.emoji, category: h.category, createdAt: h.createdAt || todayStr() };
        habitData.habits.push(target);
        addedHabits++;
      }
      const inCompletions = (inHabitsData.completions && inHabitsData.completions[h.id]) || {};
      if (!habitData.completions[target.id]) habitData.completions[target.id] = {};
      Object.keys(inCompletions).forEach(ds => {
        if (inCompletions[ds]) habitData.completions[target.id][ds] = true;
      });
    });
    saveHabits(habitData);
  }

  saveUserData();
  showToast(`✅ Impor selesai: +${addedEntries} entri, +${addedMoods} mood${addedHabits ? `, +${addedHabits} habit` : ''}`);

  // Segarkan tampilan halaman yang lagi aktif
  initSettingsPage();
  if (document.getElementById('page-home').classList.contains('active')) initHomePage();
  if (typeof renderHabits === 'function') renderHabits();
}


function clearAllData() {
  if(!confirm('Hapus SEMUA jurnal, mood, dan pencapaian? Ini tidak bisa dibatalkan!')) return;
  if(!confirm('Yakin benar-benar mau hapus semua data?')) return;
  const uid=appState.user.id;
  ['entries','moods','ach','pet','petstats','cycle','cycleon'].forEach(k=>{
    localStorage.removeItem(`refleksi_${k}_${uid}`);
  });
  appState.entries=[]; appState.moods=[]; appState.achievements={};
  appState.cycleEnabled=false; appState.cycleHistory=[];
  showToast('🗑️ Semua data telah dihapus');
  initSettingsPage();
}

// ====================== KALENDER SIKLUS (opsional) ======================
let cycleEditIndex = null;

function toggleCycleFeature() {
  appState.cycleEnabled = !appState.cycleEnabled;
  saveUserData();
  renderCycleUI();
  renderHomeCycleCard();
  showToast(appState.cycleEnabled ? '🩸 Kalender Siklus diaktifkan — isi di Beranda' : 'Kalender Siklus disembunyikan');
}

function renderCycleUI() {
  const sw = document.getElementById('cycle-toggle-switch');
  const panel = document.getElementById('cycle-settings-panel');
  if (!sw || !panel) return;
  sw.classList.toggle('on', appState.cycleEnabled);
  panel.style.display = appState.cycleEnabled ? 'block' : 'none';
}

// Ubah 1 hari string 'YYYY-MM-DD' dengan offset n hari, tetap sebagai string
// (dipakai untuk semua hitungan tanggal siklus biar aman dari isu zona waktu).
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
function fmtID(dateStr, opts) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', opts);
}

function calcAvgCycleLength(entries) {
  if (entries.length < 2) return 28;
  let total = 0;
  for (let i = 1; i < entries.length; i++) {
    total += Math.round((new Date(entries[i].start+'T00:00:00') - new Date(entries[i-1].start+'T00:00:00')) / 86400000);
  }
  return Math.max(15, Math.round(total / (entries.length - 1)));
}

function calcAvgPeriodLength(entries) {
  const withEnd = entries.filter(e => e.end);
  if (withEnd.length === 0) return 5;
  const total = withEnd.reduce((sum,e) => sum + (Math.round((new Date(e.end+'T00:00:00') - new Date(e.start+'T00:00:00'))/86400000) + 1), 0);
  return Math.max(1, Math.round(total / withEnd.length));
}

function predictNextCycleStart(entries) {
  if (entries.length === 0) return null;
  return addDaysStr(entries[entries.length-1].start, calcAvgCycleLength(entries));
}

function classifyCycleDay(ds, entries, nextStart, nextEnd, ovulation, fertileStart, fertileEnd) {
  for (const e of entries) {
    const end = e.end || e.start;
    if (ds >= e.start && ds <= end) return 'cycle-period';
  }
  if (nextStart && ds >= nextStart && ds <= nextEnd) return 'cycle-predicted';
  if (ovulation && ds === ovulation) return 'cycle-ovulation';
  if (fertileStart && ds >= fertileStart && ds <= fertileEnd) return 'cycle-fertile';
  return '';
}

function cycleCalNavigate(dir) {
  appState.cycleCalMonth += dir;
  if (appState.cycleCalMonth > 11) { appState.cycleCalMonth = 0; appState.cycleCalYear++; }
  if (appState.cycleCalMonth < 0)  { appState.cycleCalMonth = 11; appState.cycleCalYear--; }
  renderHomeCycleCard();
}

function saveCycleEntry() {
  const startEl = document.getElementById('cycle-start-input');
  const endEl   = document.getElementById('cycle-end-input');
  const start = startEl.value;
  const end   = endEl.value || null;
  if (!start) { showToast('⚠️ Isi tanggal mulai dulu ya'); return; }
  if (end && end < start) { showToast('⚠️ Tanggal selesai gak boleh sebelum tanggal mulai'); return; }

  if (cycleEditIndex !== null) {
    appState.cycleHistory[cycleEditIndex] = { start, end };
  } else {
    appState.cycleHistory.push({ start, end });
  }
  appState.cycleHistory.sort((a,b) => a.start.localeCompare(b.start));
  cycleEditIndex = null;
  saveUserData();
  startEl.value = ''; endEl.value = '';
  document.getElementById('cycle-cancel-btn').style.display = 'none';
  document.getElementById('cycle-save-btn').textContent = '🩸 Simpan Catatan';
  renderHomeCycleCard();
  showToast('✅ Catatan siklus tersimpan');
}

function editCycleEntry(idx) {
  const e = appState.cycleHistory[idx];
  cycleEditIndex = idx;
  document.getElementById('cycle-start-input').value = e.start;
  document.getElementById('cycle-end-input').value = e.end || '';
  document.getElementById('cycle-cancel-btn').style.display = 'inline-block';
  document.getElementById('cycle-save-btn').textContent = '💾 Update Catatan';
  document.getElementById('cycle-form-anchor')?.scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelCycleEdit() {
  cycleEditIndex = null;
  document.getElementById('cycle-start-input').value = '';
  document.getElementById('cycle-end-input').value = '';
  document.getElementById('cycle-cancel-btn').style.display = 'none';
  document.getElementById('cycle-save-btn').textContent = '🩸 Simpan Catatan';
}

function deleteCycleEntry(idx) {
  appState.cycleHistory.splice(idx, 1);
  saveUserData();
  if (cycleEditIndex === idx) cancelCycleEdit();
  renderHomeCycleCard();
}

// Kartu di Beranda — kalender bulan + prediksi + form catat, muncul HANYA kalau fitur diaktifkan.
function renderHomeCycleCard() {
  const card = document.getElementById('home-cycle-card');
  if (!card) return;
  if (!appState.cycleEnabled) { card.style.display = 'none'; card.innerHTML = ''; return; }
  card.style.display = 'block';

  const entries = appState.cycleHistory;
  const nextStart = predictNextCycleStart(entries);
  const avgCycle  = calcAvgCycleLength(entries);
  const avgPeriod = calcAvgPeriodLength(entries);
  let nextEnd = null, ovulation = null, fertileStart = null, fertileEnd = null;
  if (nextStart) {
    nextEnd      = addDaysStr(nextStart, avgPeriod - 1);
    ovulation    = addDaysStr(nextStart, -14);
    fertileStart = addDaysStr(ovulation, -5);
    fertileEnd   = addDaysStr(ovulation, 1);
  }

  const year = appState.cycleCalYear, month = appState.cycleCalMonth;
  const mNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const daysInPrev  = new Date(year,month,0).getDate();
  const todayStr = new Date().toISOString().slice(0,10);
  let cal = '';
  ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d => { cal += `<div class="cal-day-name">${d}</div>`; });
  for (let i=0;i<firstDay;i++) cal += `<div class="cal-day other-month">${daysInPrev-firstDay+i+1}</div>`;
  for (let d=1; d<=daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls = classifyCycleDay(ds, entries, nextStart, nextEnd, ovulation, fertileStart, fertileEnd);
    cal += `<div class="cal-day ${cls} ${ds===todayStr?'today':''}">${d}</div>`;
  }

  let predictHtml;
  if (nextStart) {
    const daysLeft = Math.round((new Date(nextStart+'T00:00:00') - new Date(todayStr+'T00:00:00')) / 86400000);
    const label = daysLeft>0 ? `${daysLeft} hari lagi` : daysLeft===0 ? 'Hari ini' : `${Math.abs(daysLeft)} hari lewat perkiraan`;
    predictHtml = `<div class="cycle-predict-box">
      <div class="big">Perkiraan siklus berikutnya: ${fmtID(nextStart,{day:'numeric',month:'long'})}</div>
      <div class="small">${label} · rata-rata siklus ${avgCycle} hari, haid ${avgPeriod} hari</div>
      <div class="small">🌱 Masa subur: ${fmtID(fertileStart,{day:'numeric',month:'short'})}–${fmtID(fertileEnd,{day:'numeric',month:'short'})} · Ovulasi: ${fmtID(ovulation,{day:'numeric',month:'short'})}</div>
    </div>`;
  } else {
    predictHtml = `<div style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:0.5rem 0;">Catat minimal 1 siklus buat mulai lihat prediksi & masa subur.</div>`;
  }

  const formHtml = `
    <div id="cycle-form-anchor" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.85rem 0 0.5rem;">
      <div style="flex:1;min-width:130px;">
        <label class="form-label" for="cycle-start-input" style="font-size:0.72rem;">Tanggal Mulai</label>
        <input class="form-input" type="date" id="cycle-start-input" style="padding:0.55rem 0.7rem;">
      </div>
      <div style="flex:1;min-width:130px;">
        <label class="form-label" for="cycle-end-input" style="font-size:0.72rem;">Tanggal Selesai (opsional)</label>
        <input class="form-input" type="date" id="cycle-end-input" style="padding:0.55rem 0.7rem;">
      </div>
    </div>
    <div style="display:flex;gap:0.5rem;">
      <button class="btn-action btn-ocean" style="flex:1;" onclick="saveCycleEntry()" id="cycle-save-btn">🩸 Simpan Catatan</button>
      <button class="btn-action btn-sky" style="display:none;" onclick="cancelCycleEdit()" id="cycle-cancel-btn">Batal</button>
    </div>`;

  let historyHtml = '';
  if (entries.length > 0) {
    historyHtml += `<div style="font-size:0.78rem;color:var(--text-muted);margin:0.85rem 0 0.3rem;">Riwayat (tap buat edit)</div>`;
    entries.forEach((e, idx) => {
      const rangeText = e.end
        ? `${fmtID(e.start,{day:'numeric',month:'short'})} – ${fmtID(e.end,{day:'numeric',month:'short',year:'numeric'})}`
        : fmtID(e.start,{day:'numeric',month:'long',year:'numeric'});
      historyHtml += `<div class="cycle-entry-row">
        <span onclick="editCycleEntry(${idx})" style="cursor:pointer;flex:1;">${rangeText}</span>
        <span class="cycle-remove-btn" onclick="deleteCycleEntry(${idx})">✕</span>
      </div>`;
    });
  }

  card.innerHTML = `
    <div class="card" style="margin-bottom:1rem;">
      <div class="card-title">🩸 Kalender Siklus</div>
      <div class="calendar-header">
        <button class="cal-nav" onclick="cycleCalNavigate(-1)">◀</button>
        <div class="cal-month">${mNames[month]} ${year}</div>
        <button class="cal-nav" onclick="cycleCalNavigate(1)">▶</button>
      </div>
      <div class="cal-grid">${cal}</div>
      <div class="cycle-legend">
        <span><i class="cycle-dot cycle-period"></i>Haid</span>
        <span><i class="cycle-dot cycle-predicted"></i>Prediksi</span>
        <span><i class="cycle-dot cycle-fertile"></i>Masa Subur</span>
        <span><i class="cycle-dot cycle-ovulation"></i>Ovulasi</span>
      </div>
      ${predictHtml}
      ${formHtml}
      ${historyHtml}
    </div>`;
}

function showAbout() {
  document.getElementById('modal-title').textContent='🌊 Tentang Serenia';
  document.getElementById('modal-content').innerHTML=`
    <div style="text-align:center;padding:0.5rem;">
      <div style="font-size:3rem;margin-bottom:0.75rem;">🌊</div>
      <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:1.2rem;color:var(--deep);margin-bottom:0.5rem;">Serenia v2.0</div>
      <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.65;">
        Jurnal harian yang menyenangkan dan menenangkan.<br>Tulis, refleksi, dan tumbuh setiap hari.<br><br>
        ✨ Fitur:<br>📖 Jurnal Harian · 🌈 Pelacak Mood<br>📅 Kalender · 🐾 Teman Hewan<br>🏆 Sistem Pencapaian · 🔥 Daily Streak
      </div>
    </div>
  `;
  document.getElementById('entry-modal').classList.add('open');
}

// ====================== TOAST ======================
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer);
  // Pesan error/peringatan (❌/⚠️) dikasih waktu lebih lama biar sempat kebaca
  const isWarning = msg.startsWith('❌') || msg.startsWith('⚠️');
  t._timer=setTimeout(()=>t.classList.remove('show'), isWarning ? 5500 : 2800);
}


// ====================== INIT ======================
window.addEventListener('load', ()=>{
  setTimeout(async ()=>{
    document.getElementById('loading-screen').classList.add('hidden');
    showToast('🟢 App dimuat ulang, cek status Google...');   // ← BARIS BARU 1

    // Cek dulu: apakah user baru saja kembali dari proses login Google (redirect)?
    // Ini harus dicek SEBELUM sesi lokal biasa, karena setelah redirect balik,
    // halaman ini dimuat ulang dari nol seolah-olah baru pertama kali dibuka.
    if (window._checkGoogleRedirect) {
      try {
        const gUser = await window._checkGoogleRedirect();
        if (gUser) {
          completeGoogleLogin(gUser);
          return; // sesi baru dari Google login, tidak perlu cek sesi lokal lagi
        } else {
          showToast('⚪ Redirect result kosong (null)');   // ← BARIS BARU 2
        }
      } catch (e) {
        console.error('❌ Gagal memproses hasil login Google:', e);
      }
    }

    const saved=localStorage.getItem('refleksi_current_user');
    if(saved) {
      const savedUser = safeParseJSON(saved, null);
      if (savedUser) {
        try {
          loginUser(savedUser);
        } catch(e) {
          console.error('❌ Gagal memulihkan sesi login:', e);
          localStorage.removeItem('refleksi_current_user');
          showToast('⚠️ Gagal memuat data terakhirmu, silakan masuk lagi');
        }
      } else {
        localStorage.removeItem('refleksi_current_user');
      }
    }
  }, 1400);
});
