// חיבור ל-API-Football (API-Sports) לעדכון תוצאות אוטומטי.
// המפתח בכך שה-API מחזיר בנפרד את תוצאת 90 הדקות (score.fulltime)
// ואת הזוכה כולל פנדלים — בדיוק מה ששיטת הניקוד שלנו צריכה.
import {
  FOOTBALL_API_KEY, FOOTBALL_API_HOST, WC_LEAGUE_ID, WC_SEASON,
} from './config.js';

export const apiConfigured = Boolean(FOOTBALL_API_KEY);

const FINISHED = new Set(['FT', 'AET', 'PEN']);

async function apiGet(pathAndQuery) {
  const url = `https://${FOOTBALL_API_HOST}/${pathAndQuery}`;
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': FOOTBALL_API_KEY,
      // תמיכה גם בגישה דרך RapidAPI אם משתמשים בה
      'x-rapidapi-key': FOOTBALL_API_KEY,
      'x-rapidapi-host': FOOTBALL_API_HOST,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length) {
    throw new Error('API: ' + JSON.stringify(data.errors));
  }
  return data.response || [];
}

// מנרמל אובייקט fixture מה-API לתוצאה לפי שיטת הניקוד שלנו.
// homeIsA=true אם נבחרת א' שלנו היא ה-home ב-API.
export function normalizeFixture(f, homeIsA = true) {
  const short = f.fixture?.status?.short;
  const finished = FINISHED.has(short);
  const ft = f.score?.fulltime || {};
  const pen = f.score?.penalty || {};

  // תוצאת 90 הדקות (אם אין fulltime, נופלים ל-goals)
  let h90 = ft.home, a90 = ft.away;
  if (h90 == null || a90 == null) { h90 = f.goals?.home; a90 = f.goals?.away; }

  const scoreA = homeIsA ? h90 : a90;
  const scoreB = homeIsA ? a90 : h90;

  // מי עלה (כולל פנדלים)
  let homeWon = null;
  if (f.teams?.home?.winner === true) homeWon = true;
  else if (f.teams?.away?.winner === true) homeWon = false;
  else if (pen.home != null && pen.away != null) homeWon = pen.home > pen.away;
  else if (h90 != null && a90 != null && h90 !== a90) homeWon = h90 > a90;

  let winner = null;
  if (homeWon != null) winner = homeIsA ? (homeWon ? 'A' : 'B') : (homeWon ? 'B' : 'A');

  return {
    finished,
    statusShort: short,
    scoreA, scoreB, winner,
    home: f.teams?.home?.name,
    away: f.teams?.away?.name,
    fixtureId: f.fixture?.id,
    date: f.fixture?.date,
    decided: finished && winner != null && scoreA != null && scoreB != null,
  };
}

// שולף משחק בודד לפי מזהה
export async function getFixtureById(fixtureId, homeIsA = true) {
  const resp = await apiGet(`fixtures?id=${encodeURIComponent(fixtureId)}`);
  if (!resp.length) return null;
  return normalizeFixture(resp[0], homeIsA);
}

// רשימת כל משחקי המונדיאל (לעזרה לאדמין למצוא מזהי משחקים)
export async function listWorldCupFixtures() {
  const resp = await apiGet(`fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`);
  return resp.map((f) => ({
    fixtureId: f.fixture?.id,
    date: f.fixture?.date,
    status: f.fixture?.status?.short,
    round: f.league?.round,
    home: f.teams?.home?.name,
    away: f.teams?.away?.name,
  }));
}

// ממפה את שם הסבב מה-API לשלב שלנו. מחזיר null לסבבים שלא רלוונטיים
// (בית, שלב 32, מקום שלישי) — המשחק מתחיל משמינית הגמר.
export function roundToStage(round) {
  const r = String(round || '').toLowerCase();
  if (r.includes('round of 16')) return 'round16';
  if (r.includes('quarter')) return 'quarter';
  if (r.includes('semi')) return 'semi';
  if (r.includes('3rd') || r.includes('third')) return null; // משחק על מקום שלישי — מדלגים
  if (r.includes('final')) return 'final';
  return null;
}

// שולף את כל משחקי הנוקאאוט (שמינית→גמר) מנורמלים, כולל זוגות הנבחרות,
// המועד, והתוצאה אם הסתיים. משמש לייבוא אוטומטי למערכת.
export async function fetchKnockoutFixtures() {
  const resp = await apiGet(`fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`);
  const out = [];
  for (const f of resp) {
    const stage = roundToStage(f.league?.round);
    if (!stage) continue; // רק שמינית, רבע, חצי, גמר
    const n = normalizeFixture(f, true); // home = נבחרת א'
    out.push({
      fixtureId: f.fixture?.id,
      stage,
      round: f.league?.round,
      teamA: f.teams?.home?.name,
      teamB: f.teams?.away?.name,
      kickoff: f.fixture?.date,
      finished: n.finished,
      decided: n.decided,
      scoreA: n.scoreA,
      scoreB: n.scoreB,
      winner: n.winner,
    });
  }
  return out;
}
