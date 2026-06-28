import nodemailer from 'nodemailer';

// מודול שליחת מייל. נקרא את פרטי ה-SMTP ממשתני הסביבה.
// אם לא הוגדרו SMTP_USER ו-SMTP_PASS — שליחת מייל מושבתת והמערכת תפעל במצב הדגמה.

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
} = process.env;

export const mailerConfigured = Boolean(SMTP_USER && SMTP_PASS);

let transporter = null;
if (mailerConfigured) {
  // ברירת מחדל מותאמת ל-Gmail אם לא צוין host
  const host = SMTP_HOST || 'smtp.gmail.com';
  const port = Number(SMTP_PORT) || (SMTP_SECURE === 'true' ? 465 : 587);
  const secure = SMTP_SECURE != null ? SMTP_SECURE === 'true' : port === 465;
  transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const fromAddress = MAIL_FROM || SMTP_USER;

// שולח את קוד האימות/התחברות למייל. מחזיר true אם נשלח.
export async function sendOtpEmail(to, code, isNewUser) {
  if (!transporter) return false;

  const subject = isNewUser
    ? '⚽ קוד אימות — ניחושי מונדיאל 2026'
    : '⚽ קוד התחברות — ניחושי מונדיאל 2026';

  const html = `
  <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#1b2440;color:#eaf0ff;border-radius:14px;padding:28px;text-align:center">
    <div style="font-size:34px">⚽</div>
    <h2 style="margin:8px 0 4px">ניחושי מונדיאל 2026</h2>
    <p style="color:#97a3c7;margin:0 0 18px">${isNewUser ? 'ברוך הבא! הקוד לאימות החשבון שלך:' : 'הקוד להתחברות שלך:'}</p>
    <div style="font-size:36px;letter-spacing:10px;font-weight:800;color:#ffd23f;direction:ltr">${code}</div>
    <p style="color:#97a3c7;font-size:13px;margin-top:18px">הקוד תקף ל-15 דקות. אם לא ביקשת אותו, התעלם מהמייל הזה.</p>
  </div>`;

  await transporter.sendMail({
    from: `"ניחושי מונדיאל 2026" <${fromAddress}>`,
    to,
    subject,
    text: `הקוד שלך הוא: ${code} (תקף ל-15 דקות)`,
    html,
  });
  return true;
}

// בדיקת חיבור ל-SMTP (לאבחון בעת עלייה)
export async function verifyMailer() {
  if (!transporter) return false;
  try {
    await transporter.verify();
    return true;
  } catch (e) {
    console.error('⚠️  שגיאת חיבור SMTP:', e.message);
    return false;
  }
}
