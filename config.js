// הגדרות מרכזיות של המערכת
// ניתן לשנות דרך משתני סביבה (env) בעת פריסה לאינטרנט.

export const PORT = process.env.PORT || 3000;

// מצב הדגמה: הקוד האקראי (OTP) יוחזר ויוצג על המסך במקום להישלח במייל.
// כדי לעבור לשליחת מייל אמיתית — שנה ל-false והגדר שרת SMTP.
export const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// רשימת מנהלים (אדמינים) — מופרדים בפסיק. למייל הזה יופיע פאנל ניהול.
// בפריסה: הגדר ADMIN_EMAILS="your@email.com,friend@email.com"
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'uv.levari@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// נתיב קובץ מסד הנתונים (SQLite)
export const DB_PATH = process.env.DB_PATH || './mondial.db';

// תוקף קוד אימות בדקות
export const OTP_TTL_MINUTES = 15;

// תוקף Session (חיבור) בשעות — אחרי זה צריך קוד חדש
export const SESSION_TTL_HOURS = 12;

// ----- חוקי הניקוד -----
// בסיס: זהות העולה = 2, תוצאה מדויקת = 3, בינגו מושלם = 5.
// ככל שהטורניר מתקדם מכפילים: שמינית ×1, רבע ×2, חצי ×3, גמר ×4.
export const SCORING = {
  advance: 2, // זהות העולה בלבד
  exact: 3,   // תוצאה מדויקת ב-90 דקות
  bingo: 5,   // בינגו מושלם (עולה + תוצאה)
};

// השלבים והמכפילים שלהם
export const STAGES = [
  { key: 'round16', label: 'שמינית הגמר', multiplier: 1 },
  { key: 'quarter', label: 'רבע הגמר', multiplier: 2 },
  { key: 'semi', label: 'חצי הגמר', multiplier: 3 },
  { key: 'final', label: 'הגמר', multiplier: 4 },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]));

// ----- חיבור ל-API כדורגל (API-Football / API-Sports) לעדכון תוצאות אוטומטי -----
// מפתח חינמי בהרשמה עצמית: https://dashboard.api-football.com  (או דרך RapidAPI)
// אם לא מוגדר מפתח — העדכון האוטומטי כבוי וההזנה הידנית עובדת כרגיל.
export const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
export const FOOTBALL_API_HOST = process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io';
export const WC_LEAGUE_ID = process.env.WC_LEAGUE_ID || '1';   // מזהה המונדיאל ב-API-Football
export const WC_SEASON = process.env.WC_SEASON || '2026';
// כל כמה דקות לעדכן משחקים+תוצאות אוטומטית (0 = כבוי). ברירת מחדל: כל שעתיים.
export const POLL_MINUTES = Number(process.env.POLL_MINUTES || 120);
