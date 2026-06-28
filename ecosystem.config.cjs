// הגדרת PM2 להרצת האתר כשירות קבוע על שרת Node משלך.
// התקנה חד-פעמית של pm2:  npm install -g pm2
// הרצה:                    pm2 start ecosystem.config.cjs
// שמירה שיעלה לבד אחרי ריבוט:  pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'loop-it-mondial',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3100,
        DB_PATH: process.env.DB_PATH || './mondial.db',
        ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'uv.levari@gmail.com',
        // מלאו כאן (או ב-.env) את פרטי המייל וה-API אם רוצים:
        // SMTP_USER, SMTP_PASS, MAIL_FROM, FOOTBALL_API_KEY
      },
    },
  ],
};
