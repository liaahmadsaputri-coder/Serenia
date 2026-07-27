// ====================== HABIT TRACKER ======================
// Default habits shown on first open
const DEFAULT_HABITS = [
  { emoji:'💧', name:'Minum Air',        category:'Health' },
  { emoji:'📖', name:'Membaca',          category:'Learning' },
  { emoji:'📝', name:'Menulis Jurnal',   category:'Productivity' },
  { emoji:'🧘', name:'Meditasi',         category:'Mindfulness' },
  { emoji:'🏃', name:'Olahraga',         category:'Health' },
  { emoji:'🥗', name:'Makan Sehat',      category:'Health' },
  { emoji:'🌞', name:'Berjemur',         category:'Self Care' },
  { emoji:'😴', name:'Tidur sebelum 23.00', category:'Self Care' },
];

const HABIT_EMOJIS = ['💧','📖','📝','🧘','🏃','🥗','🌞','😴','🎯','💪','🌿','🎨','🎵','🧹','💊','🚶','🛁','🍵','☕','🌙','🧴','🎶','🏊','🚴','🍎','🥤','🌸','✏️'];

// --- Storage helpers ---
function loadHabits() {
  const uid = appState.user ? appState.user.id : 'guest';
  const raw = localStorage.getItem(`habitTracker_${uid}`);
  return safeParseJSON(raw, { habits: [], completions: {} });
}

function saveHabits(data) {
  const uid = appState.user ? appState.user.id : 'guest';
  safeSetItem(`habitTracker_${uid}`, JSON.stringify(data));
  safeSetItem(`refleksi_updatedAt_${uid}`, new Date().toISOString());
  if (uid !== 'guest') {
    safeFirestoreSave(uid, { habits: data });
  }
}

// Get today's date string YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().slice(0,10);
}

// Check if a habit was completed on a given dateStr
function isHabitDoneOnDay(habitId, dateStr, data) {
  return !!(data.completions[habitId] && data.completions[habitId][dateStr]);
}

// Toggle completion for today
function toggleHabit(habitId) {
  const data = loadHabits();
  const today = todayStr();
  if (!data.completions[habitId]) data.completions[habitId] = {};
  if (data.completions[habitId][today]) {
    // un-check
    delete data.completions[habitId][today];
    showToast('↩️ Habit dibatalkan');
  } else {
    // check
    data.completions[habitId][today] = true;
    showToast('✅ Habit selesai! Pet kamu senang! 🐾');
    checkAndUnlockAchievements();
  }
  saveHabits(data);
  renderHabits();
  updateHabitProgress();
}

// Calculate streak for one habit
function calculateHabitStreak(habitId, data) {
  const completions = data.completions[habitId] || {};
  let streak = 0;
  const d = new Date();
  // Check if today is done; if not, start from yesterday
  const td = todayStr();
  if (!completions[td]) { d.setDate(d.getDate() - 1); }
  while(true) {
    const ds = d.toISOString().slice(0,10);
    if (completions[ds]) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

// Get weekly completion percentage (all habits, last 7 days)
function getHabitWeeklyPct(data) {
  if (!data.habits || data.habits.length === 0) return 0;
  let total = 0, done = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const ds = new Date(d); ds.setDate(d.getDate() - i);
    const dateStr = ds.toISOString().slice(0,10);
    data.habits.forEach(h => {
      total++;
      if (isHabitDoneOnDay(h.id, dateStr, data)) done++;
    });
  }
  return total > 0 ? Math.round(done / total * 100) : 0;
}

// Update habit stats cards
function updateHabitProgress() {
  const data = loadHabits();
  const today = todayStr();
  const habits = data.habits || [];
  const doneToday = habits.filter(h => isHabitDoneOnDay(h.id, today, data)).length;
  const weeklyPct = getHabitWeeklyPct(data);
  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => calculateHabitStreak(h.id, data))) : 0;

  document.getElementById('hstat-active').textContent = habits.length;
  document.getElementById('hstat-done').textContent = doneToday;
  document.getElementById('hstat-weekly').textContent = weeklyPct + '%';
  document.getElementById('hstat-maxstreak').textContent = maxStreak + (maxStreak > 0 ? '🔥' : '');

  // Week bar
  document.getElementById('habit-week-bar').style.width = weeklyPct + '%';
  document.getElementById('habit-week-pct').textContent = weeklyPct + '%';

  // Week day dots
  renderWeekDots(data);
  // Monthly grid
  renderMonthlyGrid(data);
}

function renderWeekDots(data) {
  const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const today = new Date();
  const todayStr_ = todayStr();
  let html = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const isToday = ds === todayStr_;
    const habits = data.habits || [];
    const total = habits.length;
    const done = total > 0 ? habits.filter(h => isHabitDoneOnDay(h.id, ds, data)).length : 0;
    const allDone = total > 0 && done === total;
    const someDone = done > 0 && !allDone;
    let circleClass = isToday ? 'today-dot' : '';
    if (allDone) circleClass += ' done';
    const label = days[d.getDay()];
    const inner = allDone ? '✓' : (someDone ? done : '');
    html += `<div class="habit-day-dot">
      <div class="habit-day-dot-circle ${circleClass}">${inner}</div>
      <div class="habit-day-label">${label}</div>
    </div>`;
  }
  document.getElementById('habit-week-days').innerHTML = html;
}

function renderMonthlyGrid(data) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const habits = data.habits || [];
  document.getElementById('habit-month-label').textContent =
    now.toLocaleString('id-ID',{month:'long',year:'numeric'});
  let html = '';
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const ds = d.toISOString().slice(0,10);
    const isToday = ds === todayStr();
    const total = habits.length;
    const done = total > 0 ? habits.filter(h => isHabitDoneOnDay(h.id, ds, data)).length : 0;
    let cls = '';
    if (total > 0 && done === total) cls = 'active';
    else if (done > 0) cls = 'partial';
    if (isToday) cls += ' today-cell';
    html += `<div class="habit-month-cell ${cls}" title="${ds}: ${done}/${total} habit"></div>`;
  }
  document.getElementById('habit-monthly-grid').innerHTML = html;
}

// Render the habits list
function renderHabits() {
  const data = loadHabits();
  const habits = data.habits || [];
  const today = todayStr();
  const container = document.getElementById('habits-list');

  if (habits.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:2rem;border:2px dashed var(--border);">
      <div style="font-size:2.5rem;margin-bottom:0.5rem;">🌱</div>
      <div style="font-family:'Nunito',sans-serif;font-weight:800;color:var(--deep);margin-bottom:0.3rem;">Belum ada habit</div>
      <div style="font-size:0.82rem;color:var(--text-muted);">Tambah habit pertamamu dan mulai perjalanan!</div>
    </div>`;
    return;
  }

  // Sort: undone first, done at bottom
  const sorted = [...habits].sort((a,b) => {
    const da = isHabitDoneOnDay(a.id, today, data) ? 1 : 0;
    const db = isHabitDoneOnDay(b.id, today, data) ? 1 : 0;
    return da - db;
  });

  container.innerHTML = sorted.map(h => {
    const done = isHabitDoneOnDay(h.id, today, data);
    const streak = calculateHabitStreak(h.id, data);
    return `<div class="habit-card ${done ? 'done-today' : ''}" id="hcard-${h.id}">
      <div class="habit-emoji-wrap">${h.emoji}</div>
      <div class="habit-info">
        <div class="habit-name">${escapeHtml(h.name)}</div>
        <div class="habit-meta">
          ${streak > 0 ? `<div class="habit-streak-badge">🔥 ${streak} hari</div>` : ''}
          <div class="habit-category-badge">${h.category}</div>
        </div>
      </div>
      <div class="habit-checkbox ${done ? 'checked' : ''}" onclick="toggleHabit('${h.id}')" role="checkbox" aria-checked="${done}" tabindex="0" aria-label="Tandai ${escapeHtml(h.name)} selesai hari ini" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleHabit('${h.id}')}">
        ${done ? '✓' : ''}
      </div>
      <div class="habit-actions">
        <button class="habit-action-btn" onclick="openHabitModal('${h.id}')" aria-label="Edit habit ${escapeHtml(h.name)}">✏️</button>
        <button class="habit-action-btn del" onclick="deleteHabit('${h.id}')" aria-label="Hapus habit ${escapeHtml(h.name)}">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// Open add/edit modal
let selectedEmoji = '💧';
function openHabitModal(editId) {
  selectedEmoji = '💧';
  document.getElementById('habit-name-input').value = '';
  document.getElementById('habit-category-select').value = 'Health';
  document.getElementById('habit-edit-id').value = '';
  document.getElementById('habit-modal-title').textContent = '➕ Tambah Habit Baru';

  if (editId) {
    const data = loadHabits();
    const h = (data.habits||[]).find(x => x.id === editId);
    if (h) {
      document.getElementById('habit-name-input').value = h.name;
      document.getElementById('habit-category-select').value = h.category;
      document.getElementById('habit-edit-id').value = h.id;
      document.getElementById('habit-modal-title').textContent = '✏️ Edit Habit';
      selectedEmoji = h.emoji;
    }
  }

  // Build emoji picker
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = HABIT_EMOJIS.map(em =>
    `<div class="emoji-option ${em === selectedEmoji ? 'selected' : ''}" onclick="selectHabitEmoji('${em}')">${em}</div>`
  ).join('');

  document.getElementById('habit-modal').classList.add('open');
  setTimeout(() => document.getElementById('habit-name-input').focus(), 100);
}

function selectHabitEmoji(em) {
  selectedEmoji = em;
  document.querySelectorAll('.emoji-option').forEach(el => {
    el.classList.toggle('selected', el.textContent === em);
  });
}

function closeHabitModal() {
  document.getElementById('habit-modal').classList.remove('open');
}

// Save habit from modal
function saveHabitFromModal() {
  const name = document.getElementById('habit-name-input').value.trim();
  const category = document.getElementById('habit-category-select').value;
  const editId = document.getElementById('habit-edit-id').value;
  if (!name) { showToast('⚠️ Nama habit tidak boleh kosong!'); return; }

  const data = loadHabits();
  if (!data.habits) data.habits = {};
  if (!Array.isArray(data.habits)) data.habits = [];

  if (editId) {
    const idx = data.habits.findIndex(h => h.id === editId);
    if (idx > -1) { data.habits[idx].name = name; data.habits[idx].emoji = selectedEmoji; data.habits[idx].category = category; }
    showToast('✅ Habit diperbarui!');
  } else {
    data.habits.push({ id: 'h_' + Date.now(), name, emoji: selectedEmoji, category, createdAt: todayStr() });
    showToast('🌱 Habit baru ditambahkan!');
  }

  saveHabits(data);
  closeHabitModal();
  renderHabits();
  updateHabitProgress();
}

// Delete a habit
function deleteHabit(habitId) {
  if (!confirm('Hapus habit ini?')) return;
  const data = loadHabits();
  data.habits = (data.habits || []).filter(h => h.id !== habitId);
  delete data.completions[habitId];
  saveHabits(data);
  renderHabits();
  updateHabitProgress();
  showToast('🗑️ Habit dihapus');
}

// Initialize default habits for a new user
function initDefaultHabits() {
  const data = loadHabits();
  if (data.habits && data.habits.length > 0) return; // already has habits
  data.habits = DEFAULT_HABITS.map((h, i) => ({
    id: 'h_default_' + i,
    name: h.name,
    emoji: h.emoji,
    category: h.category,
    createdAt: todayStr(),
  }));
  if (!data.completions) data.completions = {};
  saveHabits(data);
}

// Main init function for habits page
function initHabitsPage() {
  initDefaultHabits();
  renderHabits();
  updateHabitProgress();
}

// ====================== END HABIT TRACKER ======================
