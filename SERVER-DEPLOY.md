# 🖥️ פריסה על שרת Node משלך (loop-it-mondial)

מדריך להעלאת האתר לשרת שלך כך שיהיה זמין בכתובת
`https://<הדומיין-שלך>/loop-it-mondial`.

האפליקציה היא שרת Node (לא אתר סטטי), לכן צריך: גישה לשרת, Node מותקן,
ו-reverse proxy (בד"כ nginx) שמפנה לכתובת loop-it-mondial.

---

## מה צריך לדעת מראש

1. **כתובת השרת** (IP או דומיין) ו**שם המשתמש** להתחברות.
2. **שיטת ההתחברות** — SSH (מפתח או סיסמה) / פאנל ניהול.
3. שה-**Node מותקן** (בדקו בשרת: `node -v` — צריך 20 ומעלה).
4. איזה **שרת web** רץ מול הדומיין (nginx / apache).

לא בטוח? ראו "איך מזהים את דרך הגישה" בתחתית.

---

## פריסה דרך SSH (הדרך הנפוצה ל-VPS)

```bash
# 1. מהמחשב — העלאת הקבצים לשרת (בלי node_modules):
#    (מתוך תיקיית הפרויקט C:\Users\owner\mondial)
scp -r * <user>@<server>:/var/www/loop-it-mondial/

#    או, אם הקוד ב-GitHub:
ssh <user>@<server>
git clone https://github.com/<USERNAME>/mondial-2026.git /var/www/loop-it-mondial

# 2. בשרת — התקנה והרצה כשירות קבוע:
cd /var/www/loop-it-mondial
bash deploy/setup.sh
```

`setup.sh` מתקין תלויות, מתקין pm2, ומריץ את האפליקציה על פורט 3100.

```bash
# 3. הגדרת nginx — לחשוף את האפליקציה תחת /loop-it-mondial:
sudo cp deploy/nginx-loop-it-mondial.conf /etc/nginx/snippets/
#    הוסיפו בתוך ה-server{} של האתר:   include snippets/nginx-loop-it-mondial.conf;
sudo nginx -t && sudo systemctl reload nginx
```

עכשיו האתר חי ב-`https://<הדומיין>/loop-it-mondial`.

---

## משתני סביבה (מומלץ)

ערכו את `.env` בשרת (או את ה-env בתוך `ecosystem.config.cjs`):

```
ADMIN_EMAILS=uv.levari@gmail.com
DB_PATH=/var/www/loop-it-mondial/mondial.db
# מייל אמיתי (אופציונלי):
SMTP_USER=...
SMTP_PASS=...
# עדכון תוצאות אוטומטי (אופציונלי):
FOOTBALL_API_KEY=...
```

אחרי שינוי env:  `pm2 restart loop-it-mondial`

---

## עדכון גרסה בעתיד

```bash
cd /var/www/loop-it-mondial
git pull            # או scp של הקבצים המעודכנים
npm install --omit=dev
pm2 restart loop-it-mondial
```

---

## איך מזהים את דרך הגישה (אם לא בטוחים)

- **קיבלת מייל מספק האחסון?** חפשו "SSH", "cPanel", "control panel", IP, סיסמה.
- **יש לך כתובת פאנל?** (משהו כמו `https://server.host:2083`) → כנראה cPanel.
- **רכשת VPS** (DigitalOcean / Linode / Hetzner / AWS)? → גישה ב-SSH.
  בלוח הבקרה של הספק תמצאו את ה-IP ואת פרטי ה-root / מפתח ה-SSH.
- בדקו מהמחשב:  `ssh <user>@<server>`  — אם נכנס, יש SSH.

> כששתדע את **כתובת השרת**, **שם המשתמש**, ו**שיטת ההתחברות** — תגיד לי,
> ואלווה אותך צעד-צעד (או אריץ את הפקודות יחד איתך) עד שהאתר עולה.
