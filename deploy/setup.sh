#!/usr/bin/env bash
# סקריפט התקנה חד-פעמי שמריצים *על השרת* (אחרי שהעלאתם אליו את קבצי הפרויקט).
# הרצה:  bash deploy/setup.sh
set -e

echo "⚽ מתקין את loop-it-mondial..."

# 1. התקנת תלויות
npm install --omit=dev

# 2. התקנת pm2 אם חסר
if ! command -v pm2 >/dev/null 2>&1; then
  echo "מתקין pm2 גלובלית..."
  npm install -g pm2
fi

# 3. הפעלת האפליקציה כשירות קבוע
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✓ האפליקציה רצה על הפורט שהוגדר ב-ecosystem.config.cjs (ברירת מחדל 3100)."
echo "  בדיקה:        curl http://127.0.0.1:3100/"
echo "  להריץ אחרי ריבוט אוטומטית:  pm2 startup   (העתיקו והריצו את הפקודה שמודפסת)"
echo "  הגדרת nginx:  ראו deploy/nginx-loop-it-mondial.conf"
