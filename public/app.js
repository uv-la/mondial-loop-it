// ===== מצב גלובלי =====
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  email: '',
  config: null,
};

// ===== עזרי API =====
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, {
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

function fmtDate(iso) {
  if (!iso) return 'מועד ייקבע';
  const d = new Date(iso);
  return d.toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ===== אימות =====
$('#btn-send-code').onclick = async () => {
  const email = $('#email').value.trim();
  msg($('#auth-msg'), '');
  if (!email) return msg($('#auth-msg'), 'נא להזין כתובת מייל');
  $('#btn-send-code').disabled = true;
  try {
    const r = await api('/auth/send-code', { method: 'POST', body: { email } });
    state.email = email;
    $('#step-email').classList.add('hide');
    $('#step-code').classList.remove('hide');
    if (r.demoCode) {
      $('#demo-box').innerHTML = `מצב הדגמה — הקוד שלך:<div class="demo-code">${esc(r.demoCode)}</div><span class="tiny">(במערכת אמיתית הקוד היה נשלח למייל)</span>`;
      $('#demo-box').classList.remove('hide');
    } else {
      $('#demo-box').innerHTML = `📧 קוד בן 6 ספרות נשלח אל <b>${esc(email)}</b>. בדקו את תיבת הדואר (וגם ספאם).`;
      $('#demo-box').classList.remove('hide');
    }
    $('#code').focus();
  } catch (e) {
    msg($('#auth-msg'), e.message);
  } finally {
    $('#btn-send-code').disabled = false;
  }
};

$('#btn-back').onclick = () => {
  $('#step-code').classList.add('hide');
  $('#step-email').classList.remove('hide');
  $('#code').value = '';
  msg($('#auth-msg'), '');
};

$('#btn-verify').onclick = async () => {
  const code = $('#code').value.trim();
  msg($('#auth-msg'), '');
  if (code.length < 4) return msg($('#auth-msg'), 'נא להזין את הקוד');
  $('#btn-verify').disabled = true;
  try {
    const r = await api('/auth/verify', { method: 'POST', body: { email: state.email, code } });
    state.token = r.token;
    state.user = r.user;
    localStorage.setItem('token', r.token);
    await afterLogin();
  } catch (e) {
    msg($('#auth-msg'), e.message);
  } finally {
    $('#btn-verify').disabled = false;
  }
};

$('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-verify').click(); });
$('#email').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-send-code').click(); });

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  state.token = null; state.user = null;
  localStorage.removeItem('token');
  renderUserbox();
  $('#app').classList.add('hide');
  $('#auth').classList.remove('hide');
  $('#step-code').classList.add('hide');
  $('#step-email').classList.remove('hide');
  $('#email').value = ''; $('#code').value = '';
}

function renderUserbox() {
  const box = $('#userbox');
  if (state.user) {
    box.innerHTML = `<span>${esc(state.user.displayName || state.user.email)}</span>
      <button class="btn ghost small" id="btn-logout">התנתקות</button>`;
    $('#btn-logout').onclick = logout;
  } else {
    box.innerHTML = '';
  }
}

async function afterLogin() {
  renderUserbox();
  $('#auth').classList.add('hide');
  $('#app').classList.remove('hide');
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

  let html = '';
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

  return `<div class="match" data-id="${m.id}">
    <div class="head">
      <span class="kickoff">${esc(fmtDate(m.kickoff))}</span>
      ${badge}
    </div>
    <div class="teams">
      <button class="team-btn ${selA}" data-pick="A" ${dis}>${esc(m.teamA)}<span class="adv">עולה הלאה</span></button>
      <span class="vs muted">נגד</span>
      <button class="team-btn ${selB}" data-pick="B" ${dis}>${esc(m.teamB)}<span class="adv">עולה הלאה</span></button>
    </div>
    <div class="score-label">תוצאת 90 הדקות</div>
    <div class="score-row">
      <input type="number" min="0" max="30" class="sa" value="${scoreA}" ${dis} />
      <span class="x">:</span>
      <input type="number" min="0" max="30" class="sb" value="${scoreB}" ${dis} />
    </div>
    ${m.locked ? '' : `<div class="save-row"><button class="btn small save-btn">שמירת ניחוש</button><span class="save-status muted tiny"></span></div>`}
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
        status.textContent = '✓ נשמר!'; status.style.color = 'var(--accent)';
      } catch (e) {
        status.textContent = e.message; status.style.color = 'var(--danger)';
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
  const myName = state.user.displayName || state.user.email.split('@')[0];
  let rows = data.leaderboard.map((r) => {
    const isMe = r.name === myName;
    const medal = r.rank <= 3 ? `medal-${r.rank}` : '';
    const trophy = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';
    return `<tr class="${medal} ${isMe ? 'me' : ''}">
      <td class="rank">${trophy || r.rank}</td>
      <td>${esc(r.name)}</td>
      <td class="muted tiny">${r.hits} פגיעות</td>
      <td class="total">${r.total}</td>
    </tr>`;
  }).join('');

  root.innerHTML = `<div class="card">
    <h2>🏆 טבלת הדירוג</h2>
    <p class="sub">סך הנקודות מתעדכן עם כל תוצאה שמוזנת.</p>
    <table>
      <thead><tr><th>#</th><th>שחקן/ית</th><th></th><th>נקודות</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="card">
    <h2>שם תצוגה</h2>
    <p class="sub">איך השם שלך יופיע בטבלה (ברירת מחדל: שם המשתמש מהמייל).</p>
    <div class="row">
      <input type="text" id="dispname" maxlength="40" placeholder="הכינוי שלך" value="${esc(state.user.displayName || '')}" />
      <button class="btn" id="save-name" style="flex:0 0 auto">שמירה</button>
    </div>
  </div>`;

  $('#save-name').onclick = async () => {
    const displayName = $('#dispname').value.trim();
    await api('/me/name', { method: 'POST', body: { displayName } });
    state.user.displayName = displayName || null;
    renderUserbox();
    renderLeaderboard();
  };
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
      <li><b>הרשמה:</b> עם כתובת מייל בלבד. בכל כניסה נשלח קוד אקראי לאימות (במצב הדגמה הקוד מוצג על המסך).</li>
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
  </div>`;
}

// ===== פאנל ניהול =====
async function renderAdmin() {
  const root = $('#tab-admin-panel');
  root.innerHTML = '<div class="card center muted">טוען…</div>';
  let data;
  try { data = await api('/admin/matches'); } catch (e) { root.innerHTML = `<div class="card"><div class="msg err">${esc(e.message)}</div></div>`; return; }

  const stageOpts = state.config.stages.map((s) => `<option value="${s.key}">${esc(s.label)}</option>`).join('');

  // טופס הוספת משחק
  let html = `<div class="card">
    <h2>➕ הוספת משחק</h2>
    <p class="sub">הזינו את שתי הנבחרות, השלב, ומועד הפתיחה (אחרי המועד הניחושים ננעלים אוטומטית).</p>
    <div class="row"><div><label>שלב</label><select id="new-stage">${stageOpts}</select></div>
    <div><label>מועד פתיחה (אופציונלי)</label><input type="datetime-local" id="new-kickoff" /></div></div>
    <div style="height:10px"></div>
    <div class="row"><div><label>נבחרת א'</label><input type="text" id="new-a" placeholder="לדוגמה: ארגנטינה" /></div>
    <div><label>נבחרת ב'</label><input type="text" id="new-b" placeholder="לדוגמה: צרפת" /></div></div>
    <div style="height:12px"></div>
    <button class="btn" id="btn-add-match">הוספת משחק</button>
    <span id="add-status" class="tiny" style="margin-right:10px"></span>
  </div>`;

  // רשימת משחקים קיימים
  html += `<div class="card"><h2>🗂️ ניהול משחקים ותוצאות</h2>`;
  if (!data.matches.length) {
    html += '<p class="muted center">אין עדיין משחקים. הוסיפו את הראשון למעלה.</p>';
  } else {
    for (const m of data.matches) html += adminMatchRow(m);
  }
  html += `</div>`;
  root.innerHTML = html;

  $('#btn-add-match').onclick = async () => {
    const body = {
      stage: $('#new-stage').value,
      teamA: $('#new-a').value.trim(),
      teamB: $('#new-b').value.trim(),
      kickoff: $('#new-kickoff').value || null,
    };
    const st = $('#add-status');
    if (!body.teamA || !body.teamB) { st.textContent = 'נא להזין שתי נבחרות'; st.style.color = 'var(--danger)'; return; }
    try {
      await api('/admin/matches', { method: 'POST', body });
      renderAdmin();
    } catch (e) { st.textContent = e.message; st.style.color = 'var(--danger)'; }
  };

  bindAdminRows(data.matches);
}

function adminMatchRow(m) {
  const stageLabel = state.config.stages.find((s) => s.key === m.stage)?.label || m.stage;
  const wA = m.actualWinner === 'A' ? 'sel' : '';
  const wB = m.actualWinner === 'B' ? 'sel' : '';
  return `<div class="match admin-row" data-id="${m.id}">
    <div class="head">
      <b>${esc(m.teamA)} נגד ${esc(m.teamB)}</b>
      <span class="badge ${m.resultEntered ? 'done' : 'open'}">${esc(stageLabel)}${m.resultEntered ? ' · הוזנה תוצאה' : ''}</span>
    </div>
    <div class="tiny muted">${esc(fmtDate(m.kickoff))}</div>
    <hr class="sep" />
    <label>תוצאה רשמית (90 דקות) ומי עלה הלאה:</label>
    <div class="teams" style="margin-bottom:8px">
      <button class="team-btn r-win ${wA}" data-win="A">${esc(m.teamA)}<span class="adv">עלה/תה</span></button>
      <span class="vs muted">נגד</span>
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

// ===== אתחול =====
(async function init() {
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
