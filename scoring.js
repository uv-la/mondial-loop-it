import { SCORING, STAGE_BY_KEY } from './config.js';

// מחשב את הניקוד של ניחוש בודד מול תוצאה בפועל של משחק.
// match חייב להכיל actual_winner / actual_score_a / actual_score_b.
export function scorePrediction(pred, match) {
  const stage = STAGE_BY_KEY[match.stage];
  const mult = stage ? stage.multiplier : 1;

  const advanceCorrect = pred.winner === match.actual_winner;
  const exactCorrect =
    pred.score_a === match.actual_score_a && pred.score_b === match.actual_score_b;

  let base = 0;
  let label = 'לא הצליח';
  if (advanceCorrect && exactCorrect) {
    base = SCORING.bingo;
    label = 'בינגו מושלם';
  } else if (advanceCorrect) {
    base = SCORING.advance;
    label = 'זהות העולה';
  } else if (exactCorrect) {
    base = SCORING.exact;
    label = 'תוצאה מדויקת';
  }

  return { points: base * mult, label, multiplier: mult };
}
