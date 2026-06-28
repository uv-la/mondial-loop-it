import './env.js'; // חייב להיות ראשון — טוען את .env לפני שאר ההגדרות
import express from 'express';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db } from './db.js';
import { scorePrediction } from './scoring.js';
import { mailerConfigured, sendOtpEmail, verifyMailer } from './mailer.js';
import { apiConfigured, getFixtureById, listWorldCupFixtures, fetchKnockoutFixtures } from './providers.js';
import {
  PORT, DEMO_MODE, ADMIN_EMAILS, OTP_TTL_MINUTES, SESSION_TTL_HOURS,
  STAGES, STAGE_BY_KEY, SCORING, POLL_MINUTES,
} from './config.js';

// מצב הדגמה פעיל רק אם לא הוגדר שרת מייל אמיתי.
const DEMO_ACTIVE = DEMO_MODE && !mailerConfigured;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- עזרי זמן ----------
const nowIso = () => new Date().toISOString();
const plusMinutes = (m) => new Date(Date.now() + m * 60000).toISOString();
const plusHours = (h) => new Date(Date.now() + h * 3600000).toISOString();

const isAdmin = (email) => ADMIN_EMAILS.includes(String(email).toLowerCase());
const gen6 = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const genToken = () => crypto.randomBytes(24).toString('hex');

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
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.user_id);
  return user || null;
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
  if (!isAdmin(user.email)) return res.status(403).json({ error: 'אין הרשאת ניהול' });
  req.user = user;
  next();
}

const publicUser = (u) => ({
  id: u.id, email: u.email, displayName: u.display_name,
  isAdmin: isAdmin(u.email),
});

// =================== נתיבי אימות (Auth) ===================

// שלב 1: בקשת קוד אקראי למייל (להרשמה ולכל התחברות)
app.post('/api/auth/send-code', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'כתובת מייל לא תקינה' });
  }

  // יצירת משתמש בפעם הראשונה
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const info = db.prepare('INSERT INTO users (email) VALUES (?)').run(email);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const code = gen6();
  db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)')
    .run(email, code, plusMinutes(OTP_TTL_MINUTES));

  const isNew = !user.verified;
  const payload = {
    ok: true,
    isNewUser: isNew,
    message: isNew ? 'נשלח קוד אימות למייל' : 'נשלח קוד התחברות למייל',
  };

  if (DEMO_ACTIVE) {
    // מצב הדגמה — מציגים את הקוד על המסך (במקום מייל אמיתי)
    payload.demoCode = code;
    console.log(`[DEMO] קוד עבור ${email}: ${code}`);
  } else if (mailerConfigured) {
    // שליחת מייל אמיתי
    try {
      await sendOtpEmail(email, code, isNew);
    } catch (e) {
      console.error('שגיאת שליחת מייל:', e.message);
      return res.status(502).json({ error: 'שליחת המייל נכשלה. נסו שוב מאוחר יותר.' });
    }
  } else {
    return res.status(500).json({ error: 'שליחת מייל לא מוגדרת בשרת' });
  }
  res.json(payload);
});

// שלב 2: אימות הקוד → יצירת Session והתחברות
app.post('/api/auth/verify', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();

  const row = db.prepare(
    `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY id DESC LIMIT 1`
  ).get(email, code, nowIso());

  if (!row) return res.status(400).json({ error: 'קוד שגוי או שפג תוקפו' });

  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const info = db.prepare('INSERT INTO users (email, verified) VALUES (?, 1)').run(email);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  } else if (!user.verified) {
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);
    user.verified = 1;
  }

  // קוד אקראי חדש לכל חיבור = token חדש בכל פעם
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, user.id, plusHours(SESSION_TTL_HOURS));

  res.json({ ok: true, token, user: publicUser(user) });
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

// עדכון שם תצוגה (לטבלת הדירוג)
app.post('/api/me/name', requireAuth, (req, res) => {
  const name = String(req.body.displayName || '').trim().slice(0, 40);
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name || null, req.user.id);
  res.json({ ok: true });
});

// =================== מטא-נתונים ===================
app.get('/api/config', (req, res) => {
  res.json({ stages: STAGES, scoring: SCORING, demoMode: DEMO_ACTIVE });
});

// =================== משחקים וניחושים ===================

function isLocked(match) {
  if (match.locked) return true;
  if (match.result_entered) return true;
  if (match.kickoff && match.kickoff <= nowIso()) return true;
  return false;
}

// כל המשחקים + הניחוש של המשתמש הנוכחי לכל משחק
app.get('/api/matches', requireAuth, (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY sort_order, id').all();
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
    SELECT u.id, u.email, u.display_name,
           COALESCE(SUM(CASE WHEN p.scored = 1 THEN p.points ELSE 0 END), 0) AS total,
           COUNT(CASE WHEN p.scored = 1 AND p.points > 0 THEN 1 END) AS hits,
           COUNT(CASE WHEN p.scored = 1 THEN 1 END) AS scored_count
    FROM users u
    LEFT JOIN predictions p ON p.user_id = u.id
    WHERE u.verified = 1
    GROUP BY u.id
    ORDER BY total DESC, hits DESC, u.id ASC
  `).all();

  const nameOf = (r) => r.display_name || r.email.split('@')[0];
  res.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1, name: nameOf(r), total: r.total,
      hits: r.hits, scoredCount: r.scored_count,
    })),
  });
});

// =================== פאנל ניהול ===================

app.get('/api/admin/matches', requireAdmin, (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY sort_order, id').all();
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
  const sortOrder = Number(req.body.sortOrder) || 0;
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
  if (mailerConfigured) {
    const ok = await verifyMailer();
    console.log(`   שליחת מייל: ${ok ? 'מחוברת ✓' : 'מוגדרת אך החיבור נכשל ⚠️'}`);
  } else {
    console.log(`   מצב הדגמה (OTP על המסך): פעיל (לא הוגדר SMTP)`);
  }
  if (apiConfigured) {
    console.log(`   עדכון תוצאות אוטומטי: API מחובר ✓ (בדיקה כל ${POLL_MINUTES} דקות)`);
  } else {
    console.log(`   עדכון תוצאות אוטומטי: כבוי (הזנה ידנית בלבד — לא הוגדר FOOTBALL_API_KEY)`);
  }
  console.log(`   אדמינים: ${ADMIN_EMAILS.join(', ')}\n`);

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
