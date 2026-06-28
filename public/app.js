// ===== מצב גלובלי =====
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  email: '',
  config: null,
};

// ===== עזרי API =====
// בסיס ה-API יחסי לתיקיית הדף — עובד גם בשורש (/) וגם תחת נתיב (/loop-it-mondial/).
const API_PREFIX = location.pathname.replace(/[^/]*$/, '').replace(/\/$/, '') + '/api';

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(API_PREFIX + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || 'שגיאה');
  return data;
}

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function msg(el, text, kind = 'err') {
  el.innerHTML = text ? `<div class="msg ${kind}">${esc(text)}</div>` : '';
}

// תמיד מציג בשעון ישראל (Asia/Jerusalem), לא משנה היכן נמצא הצופה.
function fmtDate(iso) {
  if (!iso) return 'מועד ייקבע';
  const d = new Date(iso);
  return d.toLocaleString('he-IL', {
    weekday: 'short', day: 'numeric', month: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  });
}

// ---- המרת מועד משעון ישראל ל-UTC (ISO) ----
// מפרש "YYYY-MM-DDTHH:mm" כשעון ישראל, ללא תלות באזור הזמן של הדפדפן.
function israelOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUTC - date.getTime()) / 60000;
}
function israelLocalToISO(dateStr, timeStr) {
  // dateStr "YYYY-MM-DD", timeStr "HH:mm" — שניהם שעון ישראל
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = israelOffsetMinutes(new Date(guess));
  return new Date(guess - off * 60000).toISOString();
}

// מיפוי שמות נבחרות נפוצות (עברית/אנגלית) לקוד מדינה (ISO) עבור דגלים מ-flagcdn.
// דגלי אמוג'י לא נתמכים ב-Windows, לכן משתמשים בתמונות דגל שמוצגות בכל מערכת.
const FLAG_ISO = {
  'ארגנטינה': 'ar', 'argentina': 'ar', 'ברזיל': 'br', 'brazil': 'br',
  'צרפת': 'fr', 'france': 'fr', 'אנגליה': 'gb-eng', 'england': 'gb-eng',
  'ספרד': 'es', 'spain': 'es', 'גרמניה': 'de', 'germany': 'de',
  'פורטוגל': 'pt', 'portugal': 'pt', 'הולנד': 'nl', 'netherlands': 'nl',
  'בלגיה': 'be', 'belgium': 'be', 'קרואטיה': 'hr', 'croatia': 'hr',
  'איטליה': 'it', 'italy': 'it', 'אורוגוואי': 'uy', 'uruguay': 'uy',
  'מקסיקו': 'mx', 'mexico': 'mx', 'קנדה': 'ca', 'canada': 'ca',
  'ארה"ב': 'us', 'ארהב': 'us', 'ארצות הברית': 'us', 'usa': 'us', 'united states': 'us',
  'יפן': 'jp', 'japan': 'jp', 'דרום קוריאה': 'kr', 'south korea': 'kr',
  'מרוקו': 'ma', 'morocco': 'ma', 'סנגל': 'sn', 'senegal': 'sn',
  'אוסטרליה': 'au', 'australia': 'au', 'פולין': 'pl', 'poland': 'pl',
  'שווייץ': 'ch', 'switzerland': 'ch', 'דנמרק': 'dk', 'denmark': 'dk',
  'קולומביה': 'co', 'colombia': 'co', 'אקוודור': 'ec', 'ecuador': 'ec',
  'גאנה': 'gh', 'ghana': 'gh', 'ניגריה': 'ng', 'nigeria': 'ng',
  'סעודיה': 'sa', 'saudi arabia': 'sa', 'קטאר': 'qa', 'qatar': 'qa',
  'סקוטלנד': 'gb-sct', 'scotland': 'gb-sct', 'ולס': 'gb-wls', 'wales': 'gb-wls',
  'דרום אפריקה': 'za', 'south africa': 'za', 'חוף השנהב': 'ci', 'ivory coast': 'ci',
  'נורבגיה': 'no', 'norway': 'no', 'פרגוואי': 'py', 'paraguay': 'py',
  'אוסטריה': 'at', 'austria': 'at', "אלג'יריה": 'dz', 'algeria': 'dz',
  'כף ורדה': 'cv', 'cape verde': 'cv', 'שוודיה': 'se', 'sweden': 'se',
  'הרפובליקה הדמוקרטית': 'cd', 'dr congo': 'cd', 'קונגו': 'cd',
  'בוסניה והרצגובינה': 'ba', 'בוסניה': 'ba', 'bosnia': 'ba',
  'מצרים': 'eg', 'egypt': 'eg',
};
function isoFor(name) {
  const raw = String(name || '').trim();
  return FLAG_ISO[raw] || FLAG_ISO[raw.toLowerCase()] || null;
}
// מחזיר HTML של דגל (תמונה אם מזוהה, אחרת כדורגל)
function flagFor(name) {
  const iso = isoFor(name);
  if (iso) return `<img class="flag-img" src="https://flagcdn.com/${iso}.svg" alt="" loading="lazy" />`;
  return '<span class="flag-ball">⚽</span>';
}

// קונפטי חגיגי (לבינגו / זכייה)
function confetti(burst = 70) {
  const layer = $('#confetti');
  if (!layer) return;
  const colors = ['#FFC72C', '#B31942', '#ffffff', '#2e86e6', '#7dffc0'];
  for (let i = 0; i < burst; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3600);
  }
}

// ===== אימות (שם משתמש + סיסמה) =====
let authMode = 'login'; // 'login' | 'register'

function setAuthMode(mode) {
  authMode = mode;
  $('#tab-login').classList.toggle('active', mode === 'login');
  $('#tab-register').classList.toggle('active', mode === 'register');
  $('#auth-sub').textContent = mode === 'login'
    ? 'היכנסו עם שם המשתמש והסיסמה שלכם.'
    : 'בחרו כינוי וסיסמה — בלי מייל, בלי פרטים אישיים.';
  $('#password').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  $('#password').placeholder = mode === 'login' ? 'הסיסמה שלך' : 'בחרו סיסמה (לפחות 4 תווים)';
  $('#btn-auth').innerHTML = mode === 'login' ? 'כניסה ⚽' : 'הרשמה ⚽';
  msg($('#auth-msg'), '');
}
$('#tab-login').onclick = () => setAuthMode('login');
$('#tab-register').onclick = () => setAuthMode('register');

$('#btn-auth').onclick = async () => {
  const username = $('#username').value.trim();
  const password = $('#password').value;
  msg($('#auth-msg'), '');
  if (!username) return msg($('#auth-msg'), 'נא להזין שם משתמש');
  if (!password) return msg($('#auth-msg'), 'נא להזין סיסמה');
  $('#btn-auth').disabled = true;
  try {
    const r = await api('/auth/' + authMode, { method: 'POST', body: { username, password } });
    state.token = r.token;
    state.user = r.user;
    localStorage.setItem('token', r.token);
    $('#password').value = '';
    if (authMode === 'register') confetti(50);
    await afterLogin();
  } catch (e) {
    msg($('#auth-msg'), e.message);
  } finally {
    $('#btn-auth').disabled = false;
  }
};

$('#username').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#password').focus(); });
$('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-auth').click(); });

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  state.token = null; state.user = null;
  localStorage.removeItem('token');
  renderUserbox();
  $('#app').classList.add('hide');
  $('#nav').classList.add('hide');
  $('#auth').classList.remove('hide');
  $('#username').value = ''; $('#password').value = '';
  setAuthMode('login');
}

function renderUserbox() {
  const box = $('#userbox');
  if (state.user) {
    box.innerHTML = `<span class="uname">${esc(state.user.username)}</span>
      <button class="btn ghost small" id="btn-logout">יציאה</button>`;
    $('#btn-logout').onclick = logout;
  } else {
    box.innerHTML = '';
  }
}

async function afterLogin() {
  renderUserbox();
  $('#auth').classList.add('hide');
  $('#app').classList.remove('hide');
  $('#nav').classList.remove('hide');
  if (state.user.isAdmin) $('#tab-admin').classList.remove('hide');
  else $('#tab-admin').classList.add('hide');
  if (!state.config) state.config = await api('/config');
  switchTab('matches');
}

// ===== טאבים =====
const tabs = document.querySelectorAll('.tabs button');
tabs.forEach((b) => b.onclick = () => switchTab(b.dataset.tab));

function switchTab(name) {
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  ['matches', 'leaderboard', 'rules', 'admin'].forEach((t) => {
    const id = t === 'admin' ? 'tab-admin-panel' : 'tab-' + t;
    $('#' + id).classList.toggle('hide', t !== name);
  });
  if (name === 'matches') renderMatches();
  if (name === 'leaderboard') renderLeaderboard();
  if (name === 'rules') renderRules();
  if (name === 'admin') renderAdmin();
}

// ===== המשחקים שלי =====
async function renderMatches() {
  const root = $('#tab-matches');
  root.innerHTML = '<div class="card center muted">טוען משחקים…</div>';
  let data;
  try { data = await api('/matches'); } catch (e) { root.innerHTML = `<div class="card"><div class="msg err">${esc(e.message)}</div></div>`; return; }

  if (!data.matches.length) {
    root.innerHTML = '<div class="card center muted">עדיין לא הוזנו משחקים. חכו שהמנהל יוסיף את שמינית הגמר 🏁</div>';
    return;
  }

  // קיבוץ לפי שלב
  const order = state.config.stages.map((s) => s.key);
  const groups = {};
  for (const m of data.matches) (groups[m.stage] ||= []).push(m);

  let html = deadlineBanner();
  for (const stageKey of order) {
    const list = groups[stageKey];
    if (!list || !list.length) continue;
    const stage = state.config.stages.find((s) => s.key === stageKey);
    html += `<div class="stage-title">${esc(stage.label)}
      <span class="mult">בינגו = ${state.config.scoring.bingo * stage.multiplier} נק'</span></div>`;
    for (const m of list) html += matchCard(m);
  }
  root.innerHTML = html;
  bindMatchCards(data.matches);
}

// באנר דדליין — מוצג כשהוגדר מועד סגירה
function deadlineBanner() {
  const dl = state.config.deadline;
  if (!dl) return '';
  const passed = new Date(dl).getTime() <= Date.now();
  if (passed) return `<div class="msg err" style="text-align:center">🔒 ההרשמה והניחושים נסגרו (${esc(fmtDate(dl))})</div>`;
  return `<div class="msg info" style="text-align:center">⏰ אפשר להירשם ולנחש עד <b>${esc(fmtDate(dl))}</b> (שעון ישראל)</div>`;
}

function matchCard(m) {
  const p = m.prediction;
  let badge = m.resultEntered
    ? '<span class="badge done">הסתיים</span>'
    : m.locked ? '<span class="badge locked">🔒 נעול</span>'
    : '<span class="badge open">פתוח לניחוש</span>';

  const selA = p && p.winner === 'A' ? 'sel' : '';
  const selB = p && p.winner === 'B' ? 'sel' : '';
  const dis = m.locked ? 'disabled' : '';
  const scoreA = p ? p.scoreA : '';
  const scoreB = p ? p.scoreB : '';

  let resultLine = '';
  if (m.resultEntered) {
    const winnerName = m.actualWinner === 'A' ? m.teamA : m.teamB;
    let ptsHtml = '';
    if (p) {
      const pts = p.points ?? 0;
      ptsHtml = `<span class="pts ${pts > 0 ? 'win' : 'zero'}">צברת ${pts} נק'</span>`;
    } else {
      ptsHtml = '<span class="muted">לא ניחשת משחק זה</span>';
    }
    resultLine = `<div class="result-line">
      תוצאה רשמית: <b>${esc(m.teamA)} ${m.actualScoreA}–${m.actualScoreB} ${esc(m.teamB)}</b> ·
      עלה/תה: <b>${esc(winnerName)}</b> · ${ptsHtml}</div>`;
  } else if (p) {
    resultLine = `<div class="result-line muted">הניחוש שלך נשמר ✓ · עולה: <b>${esc(p.winner === 'A' ? m.teamA : m.teamB)}</b> · תוצאה ${p.scoreA}–${p.scoreB}</div>`;
  }

  return `<div class="match ${m.resultEntered ? 'done' : ''}" data-id="${m.id}">
    <div class="head">
      <span class="kickoff">🕑 ${esc(fmtDate(m.kickoff))}</span>
      ${badge}
    </div>
    <div class="teams">
      <button class="team-btn ${selA}" data-pick="A" ${dis}><span class="flag">${flagFor(m.teamA)}</span>${esc(m.teamA)}<span class="adv">עולה הלאה ↑</span></button>
      <span class="vs">VS</span>
      <button class="team-btn ${selB}" data-pick="B" ${dis}><span class="flag">${flagFor(m.teamB)}</span>${esc(m.teamB)}<span class="adv">עולה הלאה ↑</span></button>
    </div>
    <div class="score-label">תוצאת 90 הדקות</div>
    <div class="score-row">
      <input type="number" min="0" max="30" inputmode="numeric" class="sa" value="${scoreA}" ${dis} />
      <span class="x">:</span>
      <input type="number" min="0" max="30" inputmode="numeric" class="sb" value="${scoreB}" ${dis} />
    </div>
    ${m.locked ? '' : `<div class="save-row"><button class="btn small save-btn">💾 שמירת ניחוש</button><span class="save-status muted tiny"></span></div>`}
    ${resultLine}
  </div>`;
}

function bindMatchCards(matches) {
  document.querySelectorAll('.match').forEach((el) => {
    const id = Number(el.dataset.id);
    const m = matches.find((x) => x.id === id);
    if (m.locked) return;
    let pick = m.prediction ? m.prediction.winner : null;

    el.querySelectorAll('.team-btn').forEach((btn) => {
      btn.onclick = () => {
        pick = btn.dataset.pick;
        el.querySelectorAll('.team-btn').forEach((b) => b.classList.toggle('sel', b === btn));
      };
    });

    el.querySelector('.save-btn').onclick = async () => {
      const status = el.querySelector('.save-status');
      const scoreA = el.querySelector('.sa').value;
      const scoreB = el.querySelector('.sb').value;
      if (!pick) { status.textContent = 'בחרו מי עולה הלאה'; status.style.color = 'var(--danger)'; return; }
      if (scoreA === '' || scoreB === '') { status.textContent = 'הזינו תוצאה'; status.style.color = 'var(--danger)'; return; }
      try {
        await api('/predictions', { method: 'POST', body: { matchId: id, winner: pick, scoreA: Number(scoreA), scoreB: Number(scoreB) } });
        status.textContent = '✓ נשמר!'; status.style.color = 'var(--gold)';
        confetti(26);
      } catch (e) {
        status.textContent = e.message; status.style.color = 'var(--red-bright)';
      }
    };
  });
}

// ===== טבלת דירוג =====
async function renderLeaderboard() {
  const root = $('#tab-leaderboard');
  root.innerHTML = '<div class="card center muted">טוען…</div>';
  const data = await api('/leaderboard');
  if (!data.leaderboard.length) {
    root.innerHTML = '<div class="card center muted">אין עדיין משתתפים</div>';
    return;
  }
  const myName = state.user.username;
  const lb = data.leaderboard;
  const initials = (n) => esc(String(n).trim().slice(0, 2).toUpperCase());

  // פודיום ל-3 הראשונים (סדר תצוגה: 2,1,3)
  let podium = '';
  if (lb.length >= 2) {
    const top = lb.slice(0, 3);
    const arrange = [top[1], top[0], top[2]].filter(Boolean);
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    podium = '<div class="podium">' + arrange.map((r) =>
      `<div class="pod p${r.rank}">
        <div class="medal">${medals[r.rank] || ''}</div>
        <div class="av">${initials(r.name)}</div>
        <div class="nm">${esc(r.name)}</div>
        <div class="pt">${r.total} נק'</div>
        <div class="bar"></div>
      </div>`).join('') + '</div>';
  }

  let rows = lb.map((r) => {
    const isMe = r.name === myName;
    const trophy = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
    return `<tr class="${isMe ? 'me' : ''}">
      <td class="rank">${trophy}</td>
      <td>${esc(r.name)}${isMe ? ' <span class="tiny" style="color:var(--gold)">(אתה)</span>' : ''}</td>
      <td class="muted tiny">${r.hits} פגיעות</td>
      <td class="total">${r.total}</td>
    </tr>`;
  }).join('');

  root.innerHTML = `<div class="card">
    <h2>🏆 טבלת הדירוג</h2>
    <p class="sub">סך הנקודות מתעדכן עם כל תוצאה שמוזנת.</p>
    ${podium}
    <table>
      <thead><tr><th>#</th><th>שחקן/ית</th><th></th><th>נק'</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

  // חגיגה אם אתה במקום הראשון עם נקודות
  const leader = lb[0];
  if (leader && leader.name === myName && leader.total > 0) confetti(90);
}

// ===== חוקים =====
function renderRules() {
  const c = state.config;
  const s = c.scoring;
  const stageRows = c.stages.map((st) => `<tr>
    <td>${esc(st.label)}</td>
    <td class="center">${s.advance * st.multiplier}</td>
    <td class="center">${s.exact * st.multiplier}</td>
    <td class="center total">${s.bingo * st.multiplier}</td>
  </tr>`).join('');

  $('#tab-rules').innerHTML = `<div class="card">
    <h2>📜 חוקי המשחק</h2>
    <ul class="scoring-guide">
      <li><b>הרשמה:</b> עם שם משתמש (כינוי) וסיסמה בלבד — בלי מייל ובלי פרטים אישיים.</li>
      <li><b>הניחוש:</b> בכל משחק בוחרים מי <b>עולה הלאה</b> ומה תהיה <b>תוצאת 90 הדקות</b>.</li>
      <li><b>נעילה:</b> אפשר לעדכן ניחוש עד שריקת הפתיחה של המשחק. אחר כך הניחוש ננעל.</li>
      <li>המשחק מתחיל משמינית הגמר, וככל שמתקדמים — הניקוד מוכפל כדי לשמור על מתח עד הסוף.</li>
    </ul>
    <hr class="sep" />
    <h2>🎯 שיטת הניקוד</h2>
    <ul class="scoring-guide">
      <li><b>זהות העולה בלבד — ${s.advance} נק':</b> פגעתם בנבחרת שעלתה, אך לא בתוצאת 90 הדקות.</li>
      <li><b>תוצאה מדויקת ב-90 דקות — ${s.exact} נק':</b> ניחשתם בדיוק את התוצאה (למשל 1–1) לפני ההארכה.</li>
      <li><b>"בינגו" מושלם — ${s.bingo} נק':</b> פגעתם גם בעולה וגם בתוצאה המדויקת.</li>
    </ul>
    <p class="sub" style="margin-top:14px">הנקודות מוכפלות לפי השלב:</p>
    <table>
      <thead><tr><th>שלב</th><th class="center">עולה</th><th class="center">תוצאה מדויקת</th><th class="center">בינגו</th></tr></thead>
      <tbody>${stageRows}</tbody>
    </table>
    <hr class="sep" />
    <h2>📲 התקנת האפליקציה</h2>
    <p class="sub">הוסיפו את המשחק כאפליקציה למסך הבית — אייקון, מסך מלא, וכניסה מהירה.</p>
    <button class="btn btn-block" id="rules-install">📲 התקן אפליקציה</button>
  </div>`;

  $('#rules-install').onclick = () => $('#btn-install').click();
}

// ===== פאנל ניהול =====
async function renderAdmin() {
  const root = $('#tab-admin-panel');
  root.innerHTML = '<div class="card center muted">טוען…</div>';
  let data;
  try { data = await api('/admin/matches'); } catch (e) { root.innerHTML = `<div class="card"><div class="msg err">${esc(e.message)}</div></div>`; return; }

  const stageOpts = state.config.stages.map((s) => `<option value="${s.key}">${esc(s.label)}</option>`).join('');

  // סטטוס חיבור ל-API
  let prov = { configured: false, pollMinutes: 0 };
  try { prov = await api('/admin/provider/status'); } catch {}

  // אפשרויות שעה בקפיצות של חצי שעה
  let timeOpts = '<option value="">שעה</option>';
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) {
    const t = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    timeOpts += `<option value="${t}">${t}</option>`;
  }

  // כרטיס דדליין הרשמה+ניחושים
  const dl = state.config.deadline;
  let html = `<div class="card">
    <h2>⏰ מועד סגירה (הרשמה וניחושים)</h2>
    <p class="sub">${dl ? 'נקבע: <b>' + esc(fmtDate(dl)) + '</b> (שעון ישראל). אחרי המועד אי אפשר להירשם או לנחש.' : 'לא נקבע מועד סגירה. אפשר לקבוע מועד אחיד לכל המשחקים.'}</p>
    <div class="row">
      <div><input type="date" id="dl-date" /></div>
      <div><select id="dl-time">${timeOpts}</select></div>
      <div style="flex:0 0 auto;display:flex;align-items:flex-end"><button class="btn small" id="btn-set-deadline">קבע מועד</button></div>
    </div>
    ${dl ? '<button class="btn small ghost danger" id="btn-clear-deadline" style="margin-top:10px">בטל מועד סגירה</button>' : ''}
    <div id="dl-status" class="tiny" style="margin-top:8px"></div>
  </div>`;

  html += `<div class="card">
    <h2>🔄 עדכון תוצאות אוטומטי</h2>
    ${prov.configured
      ? `<p class="sub">ה-API מחובר ✓ — <b>המשחקים והתוצאות נמשכים אוטומטית</b> מלוח המונדיאל כל ${Math.round(prov.pollMinutes / 60 * 10) / 10} שעות (${prov.pollMinutes} דק'). אפשר גם למשוך עכשיו ידנית.</p>
         <div class="row"><button class="btn blue" id="btn-sync">⚡ משוך משחקים ותוצאות עכשיו</button>
         <button class="btn ghost" id="btn-fixtures">📋 הצג משחקים מה-API</button></div>
         <div id="sync-status"></div><div id="fixtures-box"></div>`
      : `<div class="msg info">ה-API לא מחובר — אין משיכה אוטומטית. כדי להפעיל הגדירו <b>FOOTBALL_API_KEY</b> ב-Render (ראו DEPLOY-loop-it.md). אפשר להזין משחקים ותוצאות ידנית בינתיים.</div>`}
  </div>`;

  // טופס הוספת משחק
  html += `<div class="card">
    <h2>➕ הוספת משחק</h2>
    <p class="sub">הזינו את שתי הנבחרות, השלב, ומועד הפתיחה (אחרי המועד הניחושים ננעלים אוטומטית).</p>
    <div class="row"><div><label>שלב</label><select id="new-stage">${stageOpts}</select></div></div>
    <div class="row"><div><label>נבחרת א'</label><input type="text" id="new-a" placeholder="לדוגמה: ארגנטינה" /></div>
    <div><label>נבחרת ב'</label><input type="text" id="new-b" placeholder="לדוגמה: צרפת" /></div></div>
    <label style="margin-top:12px">מועד פתיחה — שעון ישראל 🇮🇱 (אופציונלי)</label>
    <div class="row">
      <div><input type="date" id="new-date" /></div>
      <div><select id="new-time">${timeOpts}</select></div>
      <div style="flex:0 0 auto;display:flex;align-items:flex-end"><button class="btn small ghost" id="btn-confirm-time">✓ אישור מועד</button></div>
    </div>
    <div id="kickoff-display" class="tiny" style="margin-top:8px"></div>
    ${prov.configured ? `<div class="row" style="margin-top:10px"><div><label>מזהה משחק ב-API (אופציונלי)</label><input type="text" id="new-fix" inputmode="numeric" placeholder="לעדכון אוטומטי" /></div></div>` : ''}
    <div style="height:14px"></div>
    <button class="btn" id="btn-add-match">הוספת משחק</button>
    <span id="add-status" class="tiny" style="margin-right:10px"></span>
  </div>`;

  // רשימת משחקים קיימים
  html += `<div class="card"><h2>🗂️ ניהול משחקים ותוצאות</h2>`;
  if (!data.matches.length) {
    html += '<p class="muted center">אין עדיין משחקים. הוסיפו את הראשון למעלה.</p>';
  } else {
    for (const m of data.matches) html += adminMatchRow(m, prov.configured);
  }
  html += `</div>`;
  root.innerHTML = html;

  // --- דדליין הרשמה/ניחושים ---
  $('#btn-set-deadline').onclick = async () => {
    const st = $('#dl-status');
    const dStr = $('#dl-date').value, tStr = $('#dl-time').value;
    if (!dStr || !tStr) { st.innerHTML = '<span style="color:var(--red-bright)">בחרו תאריך ושעה</span>'; return; }
    try {
      const iso = israelLocalToISO(dStr, tStr);
      const r = await api('/admin/deadline', { method: 'POST', body: { deadline: iso } });
      state.config.deadline = r.deadline;
      state.config.registrationOpen = !r.deadline || new Date(r.deadline).getTime() > Date.now();
      st.innerHTML = `<span style="color:var(--gold)">✓ נקבע: ${esc(fmtDate(r.deadline))}</span>`;
      setTimeout(renderAdmin, 900);
    } catch (e) { st.innerHTML = `<span style="color:var(--red-bright)">${esc(e.message)}</span>`; }
  };
  const clrDl = $('#btn-clear-deadline');
  if (clrDl) clrDl.onclick = async () => {
    await api('/admin/deadline', { method: 'POST', body: { deadline: '' } });
    state.config.deadline = null; state.config.registrationOpen = true;
    renderAdmin();
  };

  // מחזיר את מועד הפתיחה (ISO) מהשדות, או null. מציג תצוגה מאומתת.
  function readKickoff(showFeedback) {
    const dateStr = $('#new-date').value;
    const timeStr = $('#new-time').value;
    const disp = $('#kickoff-display');
    if (!dateStr && !timeStr) { if (showFeedback) disp.innerHTML = ''; return null; }
    if (!dateStr || !timeStr) {
      if (showFeedback) disp.innerHTML = '<span style="color:var(--red-bright)">יש לבחור גם תאריך וגם שעה</span>';
      return false;
    }
    const iso = israelLocalToISO(dateStr, timeStr);
    if (showFeedback) disp.innerHTML = `<span style="color:var(--gold)">📅 נקבע: ${esc(fmtDate(iso))} (שעון ישראל)</span>`;
    return iso;
  }

  $('#btn-confirm-time').onclick = () => readKickoff(true);
  $('#new-time').onchange = () => readKickoff(true);

  $('#btn-add-match').onclick = async () => {
    const st = $('#add-status');
    const kickoff = readKickoff(true);
    if (kickoff === false) { st.textContent = 'מועד הפתיחה לא תקין'; st.style.color = 'var(--red-bright)'; return; }
    const body = {
      stage: $('#new-stage').value,
      teamA: $('#new-a').value.trim(),
      teamB: $('#new-b').value.trim(),
      kickoff: kickoff || null,
    };
    if ($('#new-fix')) body.providerFixtureId = $('#new-fix').value.trim();
    if (!body.teamA || !body.teamB) { st.textContent = 'נא להזין שתי נבחרות'; st.style.color = 'var(--red-bright)'; return; }
    try {
      await api('/admin/matches', { method: 'POST', body });
      renderAdmin();
    } catch (e) { st.textContent = e.message; st.style.color = 'var(--red-bright)'; }
  };

  // סנכרון ידני
  const syncBtn = $('#btn-sync');
  if (syncBtn) syncBtn.onclick = async () => {
    const box = $('#sync-status');
    box.innerHTML = '<div class="msg info">מסנכרן…</div>';
    try {
      const r = await api('/admin/sync', { method: 'POST' });
      box.innerHTML = `<div class="msg ok">הסתיים ✓ — נוצרו ${r.imported || 0} משחקים חדשים, עודכנו זוגות ב-${r.updatedTeams || 0}, ותוצאות ב-${r.updated || 0}.</div>`;
      if (r.imported || r.updatedTeams || r.updated) { confetti(40); setTimeout(renderAdmin, 1400); }
    } catch (e) { box.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
  };

  // הצגת מזהי משחקים מה-API
  const fxBtn = $('#btn-fixtures');
  if (fxBtn) fxBtn.onclick = async () => {
    const box = $('#fixtures-box');
    box.innerHTML = '<div class="msg info">טוען מה-API…</div>';
    try {
      const r = await api('/admin/provider/fixtures');
      if (!r.fixtures.length) { box.innerHTML = '<div class="msg info">לא נמצאו משחקים (ייתכן שהמונדיאל עוד לא במאגר).</div>'; return; }
      const rows = r.fixtures.slice(0, 80).map((f) =>
        `<tr><td class="tiny" style="color:var(--gold)">${f.fixtureId}</td><td class="tiny">${esc(f.home)} – ${esc(f.away)}</td><td class="tiny muted">${esc(f.round || '')}</td></tr>`).join('');
      box.innerHTML = `<p class="tiny muted" style="margin-top:10px">העתיקו את ה"מזהה" אל שדה "מזהה משחק ב-API" של המשחק המתאים:</p>
        <table><thead><tr><th>מזהה</th><th>משחק</th><th>שלב</th></tr></thead><tbody>${rows}</tbody></table>`;
    } catch (e) { box.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
  };

  bindAdminRows(data.matches);
}

function adminMatchRow(m, provConfigured) {
  const stageLabel = state.config.stages.find((s) => s.key === m.stage)?.label || m.stage;
  const wA = m.actualWinner === 'A' ? 'sel' : '';
  const wB = m.actualWinner === 'B' ? 'sel' : '';
  const fixField = provConfigured ? `
    <div class="row" style="margin-bottom:10px">
      <div><label>מזהה משחק ב-API (לעדכון אוטומטי)</label>
      <input type="text" class="r-fix" inputmode="numeric" value="${esc(m.providerFixtureId || '')}" placeholder="ריק = ידני בלבד" /></div>
      <div style="flex:0 0 auto;display:flex;align-items:flex-end"><button class="btn small ghost r-fix-save">קשר</button></div>
    </div>` : '';
  return `<div class="match admin-row" data-id="${m.id}">
    <div class="head">
      <b>${flagFor(m.teamA)} ${esc(m.teamA)} נגד ${esc(m.teamB)} ${flagFor(m.teamB)}</b>
      <span class="badge ${m.resultEntered ? 'done' : 'open'}">${esc(stageLabel)}${m.resultEntered ? ' · הוזנה תוצאה' : ''}</span>
    </div>
    <div class="tiny muted">🕑 ${esc(fmtDate(m.kickoff))}${m.providerFixtureId ? ` · 🔗 API #${esc(m.providerFixtureId)}` : ''}</div>
    <hr class="sep" />
    ${fixField}
    <label>תוצאה רשמית (90 דקות) ומי עלה הלאה:</label>
    <div class="teams" style="margin-bottom:8px">
      <button class="team-btn r-win ${wA}" data-win="A">${esc(m.teamA)}<span class="adv">עלה/תה</span></button>
      <span class="vs">נגד</span>
      <button class="team-btn r-win ${wB}" data-win="B">${esc(m.teamB)}<span class="adv">עלה/תה</span></button>
    </div>
    <div class="score-row">
      <input type="number" min="0" max="30" class="r-sa" value="${m.actualScoreA ?? ''}" />
      <span class="x">:</span>
      <input type="number" min="0" max="30" class="r-sb" value="${m.actualScoreB ?? ''}" />
    </div>
    <div class="save-row" style="margin-top:12px;flex-wrap:wrap">
      <button class="btn small r-save">${m.resultEntered ? 'עדכון תוצאה' : 'שמירת תוצאה'}</button>
      ${m.resultEntered ? '<button class="btn small warn r-clear">ביטול תוצאה</button>' : ''}
      <button class="btn small danger r-del">מחיקת משחק</button>
      <span class="r-status tiny"></span>
    </div>
  </div>`;
}

function bindAdminRows(matches) {
  document.querySelectorAll('.admin-row').forEach((el) => {
    const id = Number(el.dataset.id);
    const m = matches.find((x) => x.id === id);
    let win = m.actualWinner || null;

    el.querySelectorAll('.r-win').forEach((btn) => {
      btn.onclick = () => {
        win = btn.dataset.win;
        el.querySelectorAll('.r-win').forEach((b) => b.classList.toggle('sel', b === btn));
      };
    });

    const status = el.querySelector('.r-status');

    const fixSave = el.querySelector('.r-fix-save');
    if (fixSave) fixSave.onclick = async () => {
      const val = el.querySelector('.r-fix').value.trim();
      try {
        await api(`/admin/matches/${id}`, { method: 'PUT', body: { providerFixtureId: val } });
        fixSave.textContent = '✓';
        setTimeout(() => { fixSave.textContent = 'קשר'; }, 1500);
      } catch (e) { status.textContent = e.message; status.style.color = 'var(--red-bright)'; }
    };

    el.querySelector('.r-save').onclick = async () => {
      const scoreA = el.querySelector('.r-sa').value;
      const scoreB = el.querySelector('.r-sb').value;
      if (!win) { status.textContent = 'בחרו מי עלה'; status.style.color = 'var(--danger)'; return; }
      if (scoreA === '' || scoreB === '') { status.textContent = 'הזינו תוצאה'; status.style.color = 'var(--danger)'; return; }
      try {
        const r = await api(`/admin/matches/${id}/result`, { method: 'POST', body: { winner: win, scoreA: Number(scoreA), scoreB: Number(scoreB) } });
        status.textContent = `✓ נשמר · עודכנו ${r.scored} ניחושים`;
        status.style.color = 'var(--accent)';
        setTimeout(renderAdmin, 800);
      } catch (e) { status.textContent = e.message; status.style.color = 'var(--danger)'; }
    };

    const clearBtn = el.querySelector('.r-clear');
    if (clearBtn) clearBtn.onclick = async () => {
      if (!confirm('לבטל את התוצאה ולאפס את הניקוד למשחק זה?')) return;
      await api(`/admin/matches/${id}/clear-result`, { method: 'POST' });
      renderAdmin();
    };

    el.querySelector('.r-del').onclick = async () => {
      if (!confirm('למחוק את המשחק וכל הניחושים שלו? פעולה בלתי הפיכה.')) return;
      await api(`/admin/matches/${id}`, { method: 'DELETE' });
      renderAdmin();
    };
  });
}

// ===== PWA — התקנה כאפליקציה =====
let deferredPrompt = null;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function showInstallBanner() {
  if (isStandalone() || localStorage.getItem('installDismissed')) return;
  $('#install-banner').classList.remove('hide');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  $('#install-banner').classList.add('hide');
  deferredPrompt = null;
});

$('#btn-install').onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#install-banner').classList.add('hide');
  } else if (isIOS()) {
    alert('להתקנת האפליקציה:\n1. לחצו על כפתור השיתוף ⬆️ בתחתית הדפדפן (Safari)\n2. בחרו "הוסף למסך הבית" / Add to Home Screen');
  } else {
    alert('להתקנה: פתחו את תפריט הדפדפן (⋮) ובחרו "התקן אפליקציה" / Install app');
  }
};
$('#install-close').onclick = () => {
  $('#install-banner').classList.add('hide');
  localStorage.setItem('installDismissed', '1');
};

// ב-iOS אין אירוע התקנה — מציגים את הבאנר עם הוראות
if (isIOS() && !isStandalone()) setTimeout(showInstallBanner, 1500);

// רישום ה-Service Worker (הופך את האתר לאפליקציה הניתנת להתקנה)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// מציג באנר דדליין במסך ההתחברות
function renderAuthDeadline() {
  const el = document.getElementById('auth-deadline');
  if (!el || !state.config) return;
  const dl = state.config.deadline;
  if (!dl) { el.innerHTML = ''; return; }
  if (!state.config.registrationOpen) {
    el.innerHTML = `<div class="msg err">🔒 ההרשמה נסגרה (${esc(fmtDate(dl))}). אפשר עדיין להיכנס עם חשבון קיים.</div>`;
  } else {
    el.innerHTML = `<div class="msg info">⏰ אפשר להירשם ולנחש עד <b>${esc(fmtDate(dl))}</b> (שעון ישראל)</div>`;
  }
}

// ===== אתחול =====
(async function init() {
  try { state.config = await api('/config'); } catch {}
  renderAuthDeadline();
  if (state.token) {
    try {
      const r = await api('/me');
      state.user = r.user;
      await afterLogin();
      return;
    } catch {
      localStorage.removeItem('token');
      state.token = null;
    }
  }
})();
