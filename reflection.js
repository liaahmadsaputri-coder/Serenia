// ====================== REFLEKSI (CERMIN, BUKAN NASIHAT) ======================
// Prinsip: semua insight lahir murni dari data yang user tulis/catat sendiri.
// Tidak ada AI, tidak ada saran, tidak ada penilaian — hanya menunjukkan pola.

// --- Kamus topik/relasi: dipakai untuk deteksi topik dari teks jurnal ---
// Bisa ditambah kapan saja tanpa mengubah logika di bawahnya.
const REFLEKSI_TOPICS = {
  'Keluarga ❤️':   ['keluarga','ibu','ayah','mama','papa','bunda','ayahku','ibuku','adik','kakak','orangtua','ortu','nenek','kakek','anak'],
  'Teman 🤝':       ['teman','sahabat','temen','circle','geng','sohib'],
  'Pasangan 💕':    ['pacar','gebetan','suami','istri','pasangan','doi','crush'],
  'Kerja 💼':       ['kerja','kantor','kerjaan','deadline','meeting','bos','atasan','proyek','rapat','klien','gaji','resign'],
  'Belajar 📚':     ['kuliah','skripsi','tesis','kampus','sekolah','ujian','tugas','belajar','dosen','guru','nilai'],
  'Kelelahan 😴':   ['capek','cape','lelah','ngantuk','pengen istirahat','burnout'],
  'Syukur 🙏':      ['syukur','bersyukur','alhamdulillah','terima kasih','beruntung'],
  'Masa Depan 🌙':  ['besok','rencana','mimpi','cita-cita','harapan','tahun depan','goals','impian'],
  'Kemarahan 😤':   ['marah','kesal','jengkel','emosi','geram','sebal'],
  'Kesehatan 🩺':   ['sakit','pusing','flu','demam','dokter','sehat'],
};

// --- Stopwords bahasa Indonesia: kata umum yang dibuang dari hitungan kata ---
const REFLEKSI_STOPWORDS = new Set([
  'yang','dan','di','ke','dari','untuk','dengan','ini','itu','ada','tidak','tak','ga','gak','nggak',
  'aku','kamu','saya','kita','kami','dia','mereka','nya','ku','mu',
  'adalah','akan','sudah','belum','masih','juga','saja','aja','lagi','pun','sih','deh','nih','dong','kok',
  'karena','kalau','kalo','jika','saat','ketika','waktu','pas','biar','supaya',
  'tapi','tetapi','namun','atau','serta','sama','sambil',
  'jadi','banget','sangat','sekali','terlalu','agak','cukup',
  'hari','ini','tadi','nanti','sekarang','besok','kemarin',
  'satu','dua','tiga','yg','dg','tp','krn','utk',
  'harus','bisa','mau','ingin','pengen','perlu','coba','mulai',
  'begitu','gitu','seperti','kayak','kaya','gimana','apa','apa-apa',
  'orang','hal','semua','setiap','saja','buat','banget','apapun','lakuin',
  'punya','ngerasa','rasa','emang','memang','betul','entah',
]);

function reflTokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\sà-ÿ]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !REFLEKSI_STOPWORDS.has(w));
}

// Kata mana saja yang jadi anggota topik tertentu (dipakai buat exclude dari top-kata generik jika mau)
function reflDetectTopics(text) {
  const lower = (text || '').toLowerCase();
  const found = [];
  Object.entries(REFLEKSI_TOPICS).forEach(([label, words]) => {
    if (words.some(w => lower.includes(w))) found.push(label);
  });
  return found;
}

// --- Helper rentang tanggal ---
function reflDateStr(d) { return new Date(d).toISOString().slice(0,10); }
function reflDaysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); d.setHours(0,0,0,0); return d; }

function reflEntriesInRange(startDate, endDate) {
  return appState.entries.filter(e => {
    const t = new Date(e.date).getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  });
}
function reflMoodsInRange(startDate, endDate) {
  return appState.moods.filter(m => {
    const t = new Date(m.date).getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  });
}

// --- Distribusi emosi (dari mood tracker, bukan tebakan teks) ---
function reflMoodDistribution(moodsList) {
  const counts = {};
  moodsList.forEach(m => {
    const key = m.emoji + '|' + m.name;
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = moodsList.length;
  return Object.entries(counts)
    .map(([key, count]) => {
      const [emoji, name] = key.split('|');
      return { emoji, name, count, pct: total > 0 ? Math.round(count/total*100) : 0 };
    })
    .sort((a,b) => b.count - a.count);
}

// --- Top kata dari kumpulan entri jurnal ---
function reflTopWords(entries, limit = 8) {
  const counts = {};
  entries.forEach(e => {
    reflTokenize(e.text).forEach(w => { counts[w] = (counts[w]||0) + 1; });
  });
  return Object.entries(counts)
    .map(([word, count]) => ({ word, count }))
    .sort((a,b) => b.count - a.count)
    .slice(0, limit);
}

// --- Korelasi topik x mood: topik apa yang paling sering muncul bareng emosi tertentu ---
// Multi-tag per entri: satu entri bisa nyumbang ke beberapa topik sekaligus.
function reflTopicMoodCorrelation(entries) {
  const tally = {}; // topic -> { emoji: count }
  entries.forEach(e => {
    const topics = reflDetectTopics(e.text);
    if (topics.length === 0) return;
    const ds = reflDateStr(e.date);
    const moodRec = appState.moods.find(m => reflDateStr(m.date) === ds);
    const emoji = moodRec ? moodRec.emoji : (e.mood || null);
    if (!emoji) return;
    topics.forEach(topic => {
      if (!tally[topic]) tally[topic] = {};
      tally[topic][emoji] = (tally[topic][emoji] || 0) + 1;
    });
  });
  return tally;
}

// Cari topik yang paling identik dengan satu mood tertentu, misal buat cari
// "topik apa yang paling sering muncul bareng mood paling dominan minggu ini"
function reflTopTopicForMood(tally, emoji) {
  let best = null, bestCount = 0;
  Object.entries(tally).forEach(([topic, moodCounts]) => {
    const c = moodCounts[emoji] || 0;
    if (c > bestCount) { bestCount = c; best = topic; }
  });
  return bestCount >= 2 ? best : null;
}

// --- Growth / "yang sedang berkembang": bandingkan tema antar dua periode ---
const REFLEKSI_GROWTH_THEMES = [
  { topic: 'Syukur 🙏',      upMsg: 'Kamu lebih sering menulis rasa syukur.',        downMsg: null },
  { topic: 'Kemarahan 😤',   upMsg: null,                                            downMsg: 'Kamu mulai jarang menulis tentang kemarahan.' },
  { topic: 'Masa Depan 🌙',  upMsg: 'Kamu lebih banyak menulis tentang masa depan.', downMsg: null },
  { topic: 'Kelelahan 😴',   upMsg: null,                                            downMsg: 'Kamu mulai jarang menulis tentang kelelahan.' },
];

function reflCountTopicMentions(entries, topicLabel) {
  return entries.filter(e => reflDetectTopics(e.text).includes(topicLabel)).length;
}

function reflGrowthList(currentEntries, previousEntries) {
  const items = [];

  REFLEKSI_GROWTH_THEMES.forEach(theme => {
    const curr = reflCountTopicMentions(currentEntries, theme.topic);
    const prev = reflCountTopicMentions(previousEntries, theme.topic);
    if (curr === 0 && prev === 0) return;
    if (curr > prev && theme.upMsg) items.push(theme.upMsg);
    else if (curr < prev && theme.downMsg) items.push(theme.downMsg);
  });

  // Konsistensi menulis jurnal
  if (previousEntries.length > 0 || currentEntries.length > 0) {
    if (currentEntries.length > previousEntries.length) {
      items.push('Kamu lebih konsisten menulis jurnal.');
    } else if (currentEntries.length === previousEntries.length && currentEntries.length > 0) {
      items.push('Kamu tetap konsisten menulis jurnal seperti periode sebelumnya.');
    }
  }

  return items;
}

// --- Reminder habit generik: bekerja untuk habit apa pun yang sedang aktif user ---
function reflHabitHighlights(rangeDays = 30) {
  const data = loadHabits();
  const habits = data.habits || [];
  if (habits.length === 0) return [];

  const items = [];
  const start = reflDaysAgo(rangeDays - 1);
  const prevStart = reflDaysAgo(rangeDays * 2 - 1);
  const prevEnd = reflDaysAgo(rangeDays);

  habits.forEach(h => {
    let currCount = 0, prevCount = 0;
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (isHabitDoneOnDay(h.id, reflDateStr(d), data)) currCount++;
    }
    for (let i = rangeDays; i < rangeDays*2; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (isHabitDoneOnDay(h.id, reflDateStr(d), data)) prevCount++;
    }
    if (currCount === 0 && prevCount === 0) return;
    if (currCount > prevCount) {
      items.push(`${h.emoji} Bulan ini kamu lebih sering ${h.name.toLowerCase()} dibanding bulan lalu.`);
    } else if (currCount >= Math.max(4, rangeDays * 0.6)) {
      items.push(`${h.emoji} Kamu konsisten ${h.name.toLowerCase()} — ${currCount}x dalam ${rangeDays} hari terakhir.`);
    }
  });
  return items;
}

// ====================== RENDER: TAB MINGGUAN ======================
function renderReflWeekly() {
  const el = document.getElementById('refl-weekly-content');
  const start = reflDaysAgo(6);
  const prevStart = reflDaysAgo(13);
  const prevEnd = reflDaysAgo(7);
  const now = new Date();

  const entries = reflEntriesInRange(start, now);
  const moods = reflMoodsInRange(start, now);
  const prevEntries = reflEntriesInRange(prevStart, prevEnd);

  if (entries.length === 0 && moods.length === 0) {
    el.innerHTML = reflEmptyState('Belum ada catatan minggu ini. Tulis jurnal atau catat mood dulu ya 🌱');
    return;
  }

  const dist = reflMoodDistribution(moods);
  const topMood = dist[0] || null;
  const tally = reflTopicMoodCorrelation(entries);
  const happyTopic = topMood ? reflTopTopicForMood(tally, topMood.emoji) : null;
  const growth = reflGrowthList(entries, prevEntries);
  const tiredDays = moods.filter(m => m.name === 'Lelah').length;

  let html = '<div class="refl-summary-card">';
  if (topMood) {
    html += `<div class="refl-line">Emosi yang paling sering muncul: <b>${topMood.name} ${topMood.emoji}</b></div>`;
  }
  if (happyTopic) {
    html += `<div class="refl-line">Kamu paling sering menulis tentang <b>${happyTopic}</b> saat merasa ${topMood.name.toLowerCase()}.</div>`;
  }
  const gratCurr = reflCountTopicMentions(entries, 'Syukur 🙏');
  const gratPrev = reflCountTopicMentions(prevEntries, 'Syukur 🙏');
  if (gratCurr > 0 || gratPrev > 0) {
    if (gratCurr > gratPrev) html += `<div class="refl-line">Minggu ini kamu lebih banyak bersyukur dibanding minggu lalu.</div>`;
    else if (gratCurr < gratPrev) html += `<div class="refl-line">Rasa syukur yang kamu tulis sedikit lebih jarang dibanding minggu lalu.</div>`;
  }
  if (tiredDays > 0) {
    html += `<div class="refl-line">Ada <b>${tiredDays} hari</b> ketika kamu merasa kelelahan.</div>`;
  }
  html += '</div>';

  if (growth.length > 0) {
    html += '<div class="refl-growth-box"><div class="refl-growth-title">🌱 Yang sedang berkembang</div>';
    growth.forEach(g => { html += `<div class="refl-growth-item">✓ ${g}</div>`; });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ====================== RENDER: TAB BULANAN ======================
function renderReflMonthly() {
  const el = document.getElementById('refl-monthly-content');
  const start = reflDaysAgo(29);
  const prevStart = reflDaysAgo(59);
  const prevEnd = reflDaysAgo(30);
  const now = new Date();

  const entries = reflEntriesInRange(start, now);
  const moods = reflMoodsInRange(start, now);
  const prevMoods = reflMoodsInRange(prevStart, prevEnd);

  if (entries.length === 0 && moods.length === 0) {
    el.innerHTML = reflEmptyState('Belum ada catatan bulan ini. Yuk mulai menulis 🌿');
    return;
  }

  const dist = reflMoodDistribution(moods);
  const prevDist = reflMoodDistribution(prevMoods);
  const words = reflTopWords(entries, 8);

  let html = '';

  if (dist.length > 0) {
    html += '<div class="refl-bar-chart">';
    dist.forEach(d => {
      html += `<div class="refl-bar-row">
        <span class="refl-bar-label">${d.emoji} ${d.name}</span>
        <div class="refl-bar-track"><div class="refl-bar-fill" style="width:${d.pct}%"></div></div>
        <span class="refl-bar-pct">${d.pct}%</span>
      </div>`;
    });
    html += '</div>';

    const topNow = dist[0];
    const topPrevMatch = prevDist.find(p => p.name === topNow.name);
    const prevPct = topPrevMatch ? topPrevMatch.pct : 0;
    if (prevDist.length > 0) {
      if (topNow.pct > prevPct) {
        html += `<div class="refl-callout">Bulan ini kamu lebih sering merasa ${topNow.name.toLowerCase()} dibanding bulan lalu.</div>`;
      } else if (topNow.pct < prevPct) {
        html += `<div class="refl-callout">Rasa ${topNow.name.toLowerCase()} sedikit lebih jarang muncul dibanding bulan lalu.</div>`;
      }
    }
  }

  if (words.length > 0) {
    html += '<div class="refl-words-box"><div class="refl-growth-title">✍️ Kata yang paling sering kamu tulis</div>';
    html += '<div class="refl-words-cloud">';
    words.forEach(w => { html += `<span class="refl-word-pill">${w.word} <b>${w.count}x</b></span>`; });
    html += '</div>';
    html += `<div class="refl-callout" style="margin-top:0.6rem;">Kata "${words[0].word}" muncul ${words[0].count} kali bulan ini.</div>`;
    html += '</div>';
  }

  const habitLines = reflHabitHighlights(30);
  if (habitLines.length > 0) {
    html += '<div class="refl-growth-box"><div class="refl-growth-title">✅ Kebiasaanmu</div>';
    habitLines.forEach(l => { html += `<div class="refl-growth-item">${l}</div>`; });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ====================== RENDER: TAB TIMELINE ======================
function renderReflTimeline() {
  const el = document.getElementById('refl-timeline-content');
  if (appState.moods.length === 0) {
    el.innerHTML = reflEmptyState('Catat mood kamu supaya timeline-nya mulai terbentuk 🌙');
    return;
  }

  const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  let html = '<div class="refl-timeline">';
  months.forEach(({year, month}) => {
    const monthMoods = appState.moods.filter(m => {
      const d = new Date(m.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    const emojiRow = monthMoods.length > 0
      ? monthMoods.map(m => m.emoji).join('')
      : '<span class="refl-timeline-empty">—</span>';

    html += `<div class="refl-timeline-row">
      <div class="refl-timeline-month">${BULAN[month]}</div>
      <div class="refl-timeline-emojis">${emojiRow}</div>
    </div>`;
  });
  html += '</div>';
  html += '<div class="refl-callout" style="margin-top:0.8rem;">Ternyata kamu sudah sejauh ini. 🌿</div>';

  el.innerHTML = html;
}

// ====================== RENDER: TAB SURAT ======================
function renderReflLetter() {
  const el = document.getElementById('refl-letter-content');
  const start = reflDaysAgo(29);
  const now = new Date();
  const entries = reflEntriesInRange(start, now);
  const moods = reflMoodsInRange(start, now);
  const prevStart = reflDaysAgo(59);
  const prevEnd = reflDaysAgo(30);
  const prevMoods = reflMoodsInRange(prevStart, prevEnd);

  if (entries.length === 0) {
    el.innerHTML = reflEmptyState('Suratmu akan muncul di sini setelah kamu mulai menulis jurnal bulan ini 💌');
    return;
  }

  const dist = reflMoodDistribution(moods);
  const prevDist = reflMoodDistribution(prevMoods);
  const words = reflTopWords(entries, 5);
  const tally = reflTopicMoodCorrelation(entries);

  // Topik yang paling sering ditulis (dari semua topik terdeteksi, bukan cuma yang match mood)
  const topicCounts = {};
  entries.forEach(e => reflDetectTopics(e.text).forEach(t => { topicCounts[t] = (topicCounts[t]||0)+1; }));
  const topTopics = Object.entries(topicCounts).sort((a,b) => b[1]-a[1]).slice(0,2).map(t => t[0]);

  const now2 = new Date();
  const namaBulan = now2.toLocaleDateString('id-ID', { month: 'long' });

  let paragraf = `Bulan ${namaBulan} ini kamu menulis jurnal sebanyak ${entries.length} kali. `;
  if (topTopics.length > 0) {
    paragraf += `Kamu paling sering menulis tentang ${topTopics.join(' dan ')}. `;
  }
  if (dist.length > 0 && prevDist.length > 0) {
    const topNow = dist[0];
    const prevMatch = prevDist.find(p => p.name === topNow.name);
    const prevPct = prevMatch ? prevMatch.pct : 0;
    if (topNow.pct > prevPct) {
      paragraf += `Emosi ${topNow.name.toLowerCase()} mulai lebih sering muncul dibanding bulan lalu. `;
    }
  }
  if (words.length > 0) {
    paragraf += `Kata "${words[0].word}" masih sering muncul, `;
    const future = topTopics.includes('Masa Depan 🌙');
    paragraf += future
      ? `tetapi kamu juga mulai lebih sering menulis tentang harapan dan rencana. `
      : `bersama kata-kata lain yang mewarnai harimu. `;
  }
  paragraf += `Apa pun yang terjadi, terima kasih sudah tetap hadir untuk dirimu sendiri.`;

  el.innerHTML = `
    <div class="refl-letter-card">
      <div class="refl-letter-title">🌿 Surat untuk Diriku Bulan ${namaBulan}</div>
      <div class="refl-letter-body">${paragraf}</div>
    </div>`;
}

function reflEmptyState(msg) {
  return `<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1.5rem 1rem;">
    <div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>${msg}</div>`;
}

// ====================== TAB SWITCHING ======================
function switchReflTab(tab) {
  document.querySelectorAll('.refl-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.refl-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`refl-tab-${tab}`).classList.add('active');
  document.getElementById(`refl-panel-${tab}`).classList.add('active');
}

// ====================== INIT ======================
function initReflectionPage() {
  renderReflWeekly();
  renderReflMonthly();
  renderReflTimeline();
  renderReflLetter();
}
// ====================== END REFLEKSI ======================
