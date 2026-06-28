import './env.js'; // חייב להיות ראשון — טוען את .env לפני שאר ההגדרות
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db } from './db.js';
import { scorePrediction } from './scoring.js';
import { apiConfigured, getFixtureById, listWorldCupFixtures, fetchKnockoutFixtures } from './providers.js';
import {
  PORT, ADMIN_USERS, SESSION_TTL_HOURS, DB_PATH,
  STAGES, STAGE_BY_KEY, SCORING, POLL_MINUTES,
} from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- עזרי זמן ----------
const nowIso = () => new Date().toISOString();
const plusHours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const genToken = () => crypto.randomBytes(24).toString('hex');

// ---------- הגדרות מערכת (כולל דדליין הרשמה/ניחושים) ----------
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
}
// דדליין גלובלי (ISO) שאחריו ההרשמה והניחושים נסגרים. null = ללא דדליין.
const getDeadline = () => getSetting('predictions_deadline');
const deadlinePassed = () => { const d = getDeadline(); return d ? d <= nowIso() : false; };

// ---------- סיסמאות (scrypt) ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// אדמין לפי שם משתמש; אם לא הוגדרה רשימה — המשתמש הראשון (id=1) הוא האדמין.
function isAdmin(user) {
  if (!user) return false;
  if (ADMIN_USERS.length) return ADMIN_USERS.includes(String(user.username).toLowerCase());
  return user.id === 1;
}

// ---------- אימות ----------
function authUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!sess) return null;
  if (sess.expires_at < nowIso()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(sess.user_id) || null;
}

function requireAuth(req, res, next) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'יש להתחבר תחילה' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'יש להתחבר תחילה' });
  if (!isAdmin(user)) return res.status(403).json({ error: 'אין הרשאת ניהול' });
  req.user = user;
  next();
}

const publicUser = (u) => ({ id: u.id, username: u.username, isAdmin: isAdmin(u) });

function startSession(user, res) {
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, user.id, plusHours(SESSION_TTL_HOURS));
  res.json({ ok: true, token, user: publicUser(user) });
}

const USERNAME_RE = /^[֐-׿a-zA-Z0-9_\- ]{2,20}$/; // עברית/אנגלית/ספרות, 2-20 תווים

// =================== נתיבי אימות (Auth) ===================

// הרשמה: שם משתמש (כינוי) + סיסמה
app.post('/api/auth/register', (req, res) => {
  if (deadlinePassed()) {
    return res.status(403).json({ error: 'ההרשמה נסגרה (חלף מועד הסגירה)' });
  }
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'שם משתמש לא תקין (2-20 תווים, אותיות/ספרות)' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 4 תווים' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (exists) return res.status(409).json({ error: 'שם המשתמש כבר תפוס, בחרו אחר' });

  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, hashPassword(password));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  startSession(user, res);
});

// כניסה: שם משתמש + סיסמה
app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }
  startSession(user, res);
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// =================== מטא-נתונים ===================
app.get('/api/config', (req, res) => {
  res.json({
    stages: STAGES, scoring: SCORING,
    deadline: getDeadline(),
    registrationOpen: !deadlinePassed(),
  });
});

// אבחון פריסה — לבדוק אם הדיסק הקבוע מחובר ולאן ה-DB נכתב
app.get('/api/health', (req, res) => {
  const abs = path.resolve(DB_PATH);
  const dir = path.dirname(abs);
  let dirExists = false, dirWritable = false;
  try { dirExists = fs.existsSync(dir); } catch {}
  try { fs.accessSync(dir, fs.constants.W_OK); dirWritable = true; } catch {}
  let users = -1;
  try { users = db.prepare('SELECT COUNT(*) c FROM users').get().c; } catch {}
  res.json({
    dbPathEnv: DB_PATH,
    dbAbsolutePath: abs,
    dbDir: dir,
    dbDirExists: dirExists,
    dbDirWritable: dirWritable,
    onPersistentDisk: abs.startsWith('/data') && dirExists && dirWritable,
    users,
  });
});

// =================== משחקים וניחושים ===================

function isLocked(match) {
  if (match.locked) return true;
  if (match.result_entered) return true;
  if (match.kickoff && match.kickoff <= nowIso()) return true;
  if (deadlinePassed()) return true; // דדליין גלובלי לכל הניחושים
  return false;
}

// כל המשחקים + הניחוש של המשתמש הנוכחי לכל משחק
app.get('/api/matches', requireAuth, (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY kickoff IS NULL, kickoff ASC, sort_order, id').all();
  const preds = db.prepare('SELECT * FROM predictions WHERE user_id = ?').all(req.user.id);
  const byMatch = Object.fromEntries(preds.map((p) => [p.match_id, p]));

  const out = matches.map((m) => {
    const locked = isLocked(m);
    const p = byMatch[m.id];
    return {
      id: m.id,
      stage: m.stage,
      stageLabel: STAGE_BY_KEY[m.stage]?.label || m.stage,
      multiplier: STAGE_BY_KEY[m.stage]?.multiplier || 1,
      teamA: m.team_a,
      teamB: m.team_b,
      kickoff: m.kickoff,
      locked,
      resultEntered: !!m.result_entered,
      actualWinner: m.result_entered ? m.actual_winner : null,
      actualScoreA: m.result_entered ? m.actual_score_a : null,
      actualScoreB: m.result_entered ? m.actual_score_b : null,
      prediction: p
        ? { winner: p.winner, scoreA: p.score_a, scoreB: p.score_b, points: p.scored ? p.points : null }
        : null,
    };
  });
  res.json({ matches: out });
});

// שמירת ניחוש (לפני נעילה)
app.post('/api/predictions', requireAuth, (req, res) => {
  const matchId = Number(req.body.matchId);
  const winner = req.body.winner === 'A' ? 'A' : req.body.winner === 'B' ? 'B' : null;
  const scoreA = Number(req.body.scoreA);
  const scoreB = Number(req.body.scoreB);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return res.status(404).json({ error: 'משחק לא נמצא' });
  if (isLocked(match)) return res.status(400).json({ error: 'הניחושים למשחק זה ננעלו' });
  if (!winner) return res.status(400).json({ error: 'יש לבחור מי עולה הלאה' });
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 30 || scoreB > 30) {
    return res.status(400).json({ error: 'תוצאה לא תקינה' });
  }

  db.prepare(
    `INSERT INTO predictions (user_id, match_id, winner, score_a, score_b, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, match_id) DO UPDATE SET
       winner = excluded.winner, score_a = excluded.score_a,
       score_b = excluded.score_b, updated_at = datetime('now')`
  ).run(req.user.id, matchId, winner, scoreA, scoreB);

  res.json({ ok: true });
});

// =================== טבלת דירוג ===================
app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username,
           COALESCE(SUM(CASE WHEN p.scored = 1 THEN p.points ELSE 0 END), 0) AS total,
           COUNT(CASE WHEN p.scored = 1 AND p.points > 0 THEN 1 END) AS hits,
           COUNT(CASE WHEN p.scored = 1 THEN 1 END) AS scored_count
    FROM users u
    LEFT JOIN predictions p ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY total DESC, hits DESC, u.id ASC
  `).all();

  res.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1, name: r.username, total: r.total,
      hits: r.hits, scoredCount: r.scored_count,
    })),
  });
});

// =================== פאנל ניהול ===================

// קביעת/הסרת דדליין הרשמה+ניחושים (ISO). שליחת ערך ריק = הסרה.
app.post('/api/admin/deadline', requireAdmin, (req, res) => {
  const v = req.body.deadline;
  if (!v) { setSetting('predictions_deadline', null); return res.json({ ok: true, deadline: null }); }
  const iso = new Date(v).toISOString();
  if (isNaN(new Date(iso).getTime())) return res.status(400).json({ error: 'מועד לא תקין' });
  setSetting('predictions_deadline', iso);
  res.json({ ok: true, deadline: iso });
});

app.get('/api/admin/matches', requireAdmin, (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY kickoff IS NULL, kickoff ASC, sort_order, id').all();
  res.json({
    matches: matches.map((m) => ({
      id: m.id, stage: m.stage, teamA: m.team_a, teamB: m.team_b,
      kickoff: m.kickoff, locked: !!m.locked, resultEntered: !!m.result_entered,
      actualWinner: m.actual_winner, actualScoreA: m.actual_score_a, actualScoreB: m.actual_score_b,
      sortOrder: m.sort_order,
      providerFixtureId: m.provider_fixture_id || '',
      providerHomeIsA: m.provider_home_is_a == null ? 1 : m.provider_home_is_a,
    })),
  });
});

app.post('/api/admin/matches', requireAdmin, (req, res) => {
  const stage = String(req.body.stage || '');
  if (!STAGE_BY_KEY[stage]) return res.status(400).json({ error: 'שלב לא תקין' });
  const teamA = String(req.body.teamA || '').trim();
  const teamB = String(req.body.teamB || '').trim();
  if (!teamA || !teamB) return res.status(400).json({ error: 'יש להזין שתי נבחרות' });
  const kickoff = req.body.kickoff ? new Date(req.body.kickoff).toISOString() : null;
  // סדר ברירת מחדל לפי מועד הפתיחה (כדי שהרשימה תהיה כרונולוגית)
  const sortOrder = req.body.sortOrder != null
    ? Number(req.body.sortOrder)
    : (kickoff ? Math.floor(new Date(kickoff).getTime() / 1000) : 0);
  const providerFixtureId = req.body.providerFixtureId ? String(req.body.providerFixtureId).trim() : null;
  const providerHomeIsA = req.body.providerHomeIsA === false || req.body.providerHomeIsA === 0 ? 0 : 1;

  const info = db.prepare(
    'INSERT INTO matches (stage, team_a, team_b, kickoff, sort_order, provider_fixture_id, provider_home_is_a) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(stage, teamA, teamB, kickoff, sortOrder, providerFixtureId, providerHomeIsA);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/admin/matches/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  if (!m) return res.status(404).json({ error: 'משחק לא נמצא' });

  const stage = req.body.stage && STAGE_BY_KEY[req.body.stage] ? req.body.stage : m.stage;
  const teamA = req.body.teamA != null ? String(req.body.teamA).trim() : m.team_a;
  const teamB = req.body.teamB != null ? String(req.body.teamB).trim() : m.team_b;
  const kickoff = req.body.kickoff != null
    ? (req.body.kickoff ? new Date(req.body.kickoff).toISOString() : null)
    : m.kickoff;
  const locked = req.body.locked != null ? (req.body.locked ? 1 : 0) : m.locked;
  const sortOrder = req.body.sortOrder != null ? Number(req.body.sortOrder) : m.sort_order;
  const providerFixtureId = req.body.providerFixtureId != null
    ? (String(req.body.providerFixtureId).trim() || null) : m.provider_fixture_id;
  const providerHomeIsA = req.body.providerHomeIsA != null
    ? (req.body.providerHomeIsA ? 1 : 0) : (m.provider_home_is_a == null ? 1 : m.provider_home_is_a);

  db.prepare(
    'UPDATE matches SET stage=?, team_a=?, team_b=?, kickoff=?, locked=?, sort_order=?, provider_fixture_id=?, provider_home_is_a=? WHERE id=?'
  ).run(stage, teamA, teamB, kickoff, locked, sortOrder, providerFixtureId, providerHomeIsA, id);
  res.json({ ok: true });
});

app.delete('/api/admin/matches/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM predictions WHERE match_id = ?').run(id);
  db.prepare('DELETE FROM matches WHERE id = ?').run(id);
  res.json({ ok: true });
});

// פונקציית עזר משותפת: שומרת תוצאה ומחשבת ניקוד מחדש לכל הניחושים של המשחק.
// משמשת גם להזנה ידנית וגם לסנכרון אוטומטי מה-API.
function applyResult(match, winner, scoreA, scoreB) {
  db.prepare(
    `UPDATE matches SET result_entered=1, actual_winner=?, actual_score_a=?, actual_score_b=?, locked=1 WHERE id=?`
  ).run(winner, scoreA, scoreB, match.id);

  const fullMatch = { ...match, actual_winner: winner, actual_score_a: scoreA, actual_score_b: scoreB };
  const preds = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(match.id);
  const tx = db.transaction(() => {
    for (const p of preds) {
      const { points } = scorePrediction(p, fullMatch);
      db.prepare('UPDATE predictions SET points = ?, scored = 1 WHERE id = ?').run(points, p.id);
    }
  });
  tx();
  return preds.length;
}

// הזנת תוצאה ידנית בפועל
app.post('/api/admin/matches/:id/result', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  if (!m) return res.status(404).json({ error: 'משחק לא נמצא' });

  const winner = req.body.winner === 'A' ? 'A' : req.body.winner === 'B' ? 'B' : null;
  const scoreA = Number(req.body.scoreA);
  const scoreB = Number(req.body.scoreB);
  if (!winner) return res.status(400).json({ error: 'יש לבחור מי עלה הלאה' });
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return res.status(400).json({ error: 'תוצאה לא תקינה' });
  }

  const scored = applyResult(m, winner, scoreA, scoreB);
  res.json({ ok: true, scored });
});

// ייבוא אוטומטי של המשחקים (זוגות הנבחרות) מה-API למערכת.
// יוצר משחקים חדשים, ומעדכן זוגות/מועד למשחקים קיימים (לפי מזהה ה-API),
// בלי לגעת בתוצאות שכבר הוזנו.
function importFixtures(fixtures) {
  let created = 0, updatedTeams = 0;
  const tx = db.transaction(() => {
    for (const fx of fixtures) {
      if (!fx.fixtureId || !fx.teamA || !fx.teamB) continue;
      const fid = String(fx.fixtureId);
      const sortOrder = fx.kickoff ? Math.floor(new Date(fx.kickoff).getTime() / 1000) : 0;
      const existing = db.prepare('SELECT * FROM matches WHERE provider_fixture_id = ?').get(fid);
      if (existing) {
        // לא נוגעים במשחק שכבר הוזנה לו תוצאה ידנית/אוטומטית
        if (!existing.result_entered) {
          db.prepare(
            'UPDATE matches SET stage=?, team_a=?, team_b=?, kickoff=?, sort_order=? WHERE id=?'
          ).run(fx.stage, fx.teamA, fx.teamB, fx.kickoff || existing.kickoff, sortOrder, existing.id);
          if (existing.team_a !== fx.teamA || existing.team_b !== fx.teamB) updatedTeams++;
        }
      } else {
        db.prepare(
          'INSERT INTO matches (stage, team_a, team_b, kickoff, sort_order, provider_fixture_id, provider_home_is_a) VALUES (?, ?, ?, ?, ?, ?, 1)'
        ).run(fx.stage, fx.teamA, fx.teamB, fx.kickoff || null, sortOrder, fid);
        created++;
      }
    }
  });
  tx();
  return { created, updatedTeams };
}

// עדכון אוטומטי מלא: מושך את לוח המשחקים מה-API (יוצר/מעדכן משחקים),
// ואז מזין תוצאות לכל המשחקים שהסתיימו. רץ אוטומטית כל כמה שעות + ידנית.
async function runSync() {
  if (!apiConfigured) return { ok: false, error: 'no-key', updated: 0, checked: 0 };

  // 1) ייבוא/עדכון המשחקים מה-API
  let imported = { created: 0, updatedTeams: 0 };
  const fixtures = await fetchKnockoutFixtures();
  if (fixtures.length) imported = importFixtures(fixtures);

  // 2) הזנת תוצאות לכל משחק עם מזהה API שעדיין אין לו תוצאה
  const matches = db.prepare(
    "SELECT * FROM matches WHERE provider_fixture_id IS NOT NULL AND provider_fixture_id != '' AND result_entered = 0"
  ).all();
  const byFid = new Map(fixtures.map((f) => [String(f.fixtureId), f]));
  let updated = 0;
  const details = [];
  for (const m of matches) {
    try {
      // אם כבר משכנו את המשחק למעלה — נשתמש בנתון הזה; אחרת נשלוף בודד
      let r = byFid.get(String(m.provider_fixture_id));
      if (!r) r = await getFixtureById(m.provider_fixture_id, !!m.provider_home_is_a);
      if (r && r.decided) {
        applyResult(m, r.winner, r.scoreA, r.scoreB);
        updated++;
        details.push({ id: m.id, teams: `${m.team_a}-${m.team_b}`, score: `${r.scoreA}-${r.scoreB}`, winner: r.winner });
      }
    } catch (e) {
      details.push({ id: m.id, error: e.message });
    }
  }
  return {
    ok: true,
    imported: imported.created, updatedTeams: imported.updatedTeams,
    checked: matches.length, updated, details,
  };
}

app.post('/api/admin/sync', requireAdmin, async (req, res) => {
  if (!apiConfigured) return res.status(400).json({ error: 'לא הוגדר מפתח API. ראו DEPLOY.md.' });
  try {
    const result = await runSync();
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: 'סנכרון נכשל: ' + e.message });
  }
});

// סטטוס חיבור ה-API (לתצוגה בפאנל)
app.get('/api/admin/provider/status', requireAdmin, (req, res) => {
  res.json({ configured: apiConfigured, pollMinutes: POLL_MINUTES });
});

// רשימת משחקי המונדיאל מה-API — עוזר לאדמין למצוא מזהי משחקים
app.get('/api/admin/provider/fixtures', requireAdmin, async (req, res) => {
  if (!apiConfigured) return res.status(400).json({ error: 'לא הוגדר מפתח API' });
  try {
    const fixtures = await listWorldCupFixtures();
    res.json({ fixtures });
  } catch (e) {
    res.status(502).json({ error: 'שליפה נכשלה: ' + e.message });
  }
});

// ביטול תוצאה (במקרה של טעות) — פותח מחדש את המשחק
app.post('/api/admin/matches/:id/clear-result', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare(
    `UPDATE matches SET result_entered=0, actual_winner=NULL, actual_score_a=NULL, actual_score_b=NULL, locked=0 WHERE id=?`
  ).run(id);
  db.prepare('UPDATE predictions SET points = 0, scored = 0 WHERE match_id = ?').run(id);
  res.json({ ok: true });
});

// דף הבית
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, async () => {
  console.log(`\n⚽ מונדיאל 2026 — שרת הניחושים רץ על http://localhost:${PORT}`);
  console.log(`   רישום: שם משתמש + סיסמה`);
  if (apiConfigured) {
    console.log(`   עדכון משחקים+תוצאות אוטומטי: API מחובר ✓ (כל ${POLL_MINUTES} דקות)`);
  } else {
    console.log(`   עדכון אוטומטי: כבוי (לא הוגדר FOOTBALL_API_KEY)`);
  }
  console.log(`   אדמינים: ${ADMIN_USERS.length ? ADMIN_USERS.join(', ') : 'המשתמש הראשון שנרשם'}\n`);

  // מתזמן רקע: בדיקת תוצאות אוטומטית כל POLL_MINUTES דקות
  if (apiConfigured && POLL_MINUTES > 0) {
    const tick = async () => {
      try {
        const r = await runSync();
        if (r.imported || r.updatedTeams || r.updated) {
          console.log(`[סנכרון] נוצרו ${r.imported || 0} משחקים, עודכנו זוגות ב-${r.updatedTeams || 0}, תוצאות ב-${r.updated || 0}`);
        }
      } catch (e) {
        console.error('[סנכרון] שגיאה:', e.message);
      }
    };
    setInterval(tick, POLL_MINUTES * 60000);
    setTimeout(tick, 8000); // בדיקה ראשונה זמן קצר אחרי העלייה
  }
});
