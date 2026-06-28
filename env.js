// טוען משתני סביבה מקובץ .env (אם קיים) לפני שאר המודולים.
// חייב להיות מיובא ראשון ב-server.js.
import process from 'node:process';

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile('.env'); // Node 20.6+/22+
  }
} catch {
  // אין קובץ .env — נמשיך עם משתני הסביבה של המערכת (למשל בפריסה).
}
