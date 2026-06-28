# 🚀 פריסה ל-mondial.loop-it.org דרך Render

מדריך ממוקד: להעלות את אתר המונדיאל כשירות נפרד ב-Render ולחבר אותו
לכתובת `https://mondial.loop-it.org` — בלי לגעת באתר loop-it.org הקיים.

3 שלבים: GitHub → Render → DNS.

---

## שלב 1 — העלאת הקוד ל-GitHub

1. היכנס ל-<https://github.com> → **New repository**.
   - שם: `mondial-loop-it` (או כל שם), **Private** או Public, **בלי** README/‏gitignore.
   - **Create repository**.
2. GitHub יציג כתובת ריפו. בטרמינל, בתיקיית הפרויקט
   (`C:\Users\owner\mondial`), הרץ:

```bash
git remote add origin https://github.com/<USERNAME>/mondial-loop-it.git
git branch -M main
git push -u origin main
```

(אם git מבקש התחברות — אשר דרך הדפדפן.)

---

## שלב 2 — יצירת השירות ב-Render

1. <https://dashboard.render.com> → **New +** → **Blueprint**.
2. בחר את הריפו `mondial-loop-it`. Render יקרא את `render.yaml` אוטומטית
   (כולל השם, הדיסק הקבוע, ותת-הדומיין mondial.loop-it.org).
3. לפני האישור, הזן את משתני הסוד (Environment / "sync: false"):
   - `SMTP_USER` = כתובת הג'ימייל שלך
   - `SMTP_PASS` = App Password של Gmail (16 תווים, בלי רווחים)
     → יוצרים כאן: <https://myaccount.google.com/apppasswords> (דורש אימות דו-שלבי)
   - `MAIL_FROM` = כתובת הג'ימייל שלך
   - `FOOTBALL_API_KEY` = (אופציונלי) לעדכון תוצאות אוטומטי
   - `ADMIN_EMAILS` כבר מוגדר ל-uv.levari@gmail.com
4. **Apply / Create**. אחרי דקה-שתיים האתר חי בכתובת זמנית כמו
   `https://mondial-loop-it.onrender.com` — כדאי לבדוק שהיא עובדת.

> 💾 **שמירת נתונים:** ה-blueprint כולל דיסק קבוע (תוכנית `starter`, ~7$/חודש)
> כדי שהניחושים והדירוג לא יימחקו. רוצה חינם לניסוי? מחק מ-`render.yaml` את
> `plan: starter`, את בלוק `disk:` ואת `DB_PATH` (אך הנתונים יתאפסו בכל פריסה).

---

## שלב 3 — חיבור תת-הדומיין mondial.loop-it.org

1. ב-Render, בשירות → **Settings → Custom Domains**. אמור להופיע שם
   `mondial.loop-it.org` (מה-blueprint). Render יציג לך **יעד CNAME**
   (משהו כמו `mondial-loop-it.onrender.com`).
2. אצל מנהל הדומיין של loop-it.org (היכן שקנית/מנהל את loop-it.org —
   ספק הדומיין או Render אם הדומיין מנוהל שם), הוסף רשומת DNS:

   | סוג | שם / Host | יעד / Value |
   |-----|-----------|-------------|
   | CNAME | `mondial` | `mondial-loop-it.onrender.com` (היעד ש-Render נתן) |

3. שמור. תוך כמה דקות (לפעמים עד שעה) Render יאמת את הדומיין ויפיק SSL.
   האתר יהיה זמין ב-**https://mondial.loop-it.org** 🎉

---

## שלב 4 — קישור מהאתר הראשי (אופציונלי)

באתר loop-it.org הקיים, הוסף כפתור/קישור:
`<a href="https://mondial.loop-it.org">⚽ ניחושי מונדיאל 2026</a>`

---

## אחרי שעולה
1. היכנס עם המייל שלך (תקבל קוד אמיתי במייל) — אתה אדמין.
2. טאב **ניהול** → הוסף את משחקי שמינית הגמר.
3. שלח את הלינק לחברים. עדכן תוצאות בפאנל (או חבר API לעדכון אוטומטי).

נתקעת בשלב כלשהו? תגיד לי באיזה שלב אתה ומה אתה רואה, ונפתור יחד.
