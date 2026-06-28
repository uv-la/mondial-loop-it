// סקריפט אתחול אופציונלי — ממלא את שמינית הגמר במשחקים לדוגמה.
// הרצה:  npm run seed
// שימו לב: זה ימחק משחקים קיימים ויזין מקומון. ערכו את הנבחרות בפאנל הניהול
// ברגע שזוגות שמינית הגמר האמיתיים ייקבעו.
import { db } from './db.js';

const sample = [
  ['ארגנטינה', 'אוסטרליה'],
  ['צרפת', 'פולין'],
  ['אנגליה', 'סנגל'],
  ['יפן', 'קרואטיה'],
  ['ברזיל', 'דרום קוריאה'],
  ['מרוקו', 'ספרד'],
  ['פורטוגל', 'שווייץ'],
  ['הולנד', 'ארה"ב'],
];

db.exec('DELETE FROM predictions; DELETE FROM matches;');
const ins = db.prepare(
  'INSERT INTO matches (stage, team_a, team_b, kickoff, sort_order) VALUES (?, ?, ?, ?, ?)'
);
sample.forEach(([a, b], i) => ins.run('round16', a, b, null, i));

console.log(`✓ הוזנו ${sample.length} משחקי שמינית גמר לדוגמה. ערכו אותם בפאנל הניהול.`);
