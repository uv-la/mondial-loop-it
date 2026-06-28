// יוצר את אייקוני האפליקציה (PWA) מ-SVG ל-PNG.
// הרצה חד-פעמית:  node scripts/gen-icons.mjs   (דורש sharp מותקן זמנית)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const svg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0A3161"/>
      <stop offset="0.6" stop-color="#0d2f5c"/>
      <stop offset="1" stop-color="#B31942"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe07a"/>
      <stop offset="1" stop-color="#f5b400"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <g fill="#ffffff" opacity="0.12">
    <circle cx="80" cy="90" r="4"/><circle cx="150" cy="150" r="3"/><circle cx="430" cy="95" r="4"/>
    <circle cx="455" cy="210" r="3"/><circle cx="95" cy="420" r="3"/><circle cx="385" cy="440" r="4"/>
  </g>
  <g fill="none" stroke="url(#gold)" stroke-width="16">
    <path d="M172 150 C120 150 116 224 176 232"/>
    <path d="M340 150 C392 150 396 224 336 232"/>
  </g>
  <path d="M172 138 H340 V196 C340 250 304 286 256 286 C208 286 172 250 172 196 Z" fill="url(#gold)"/>
  <rect x="244" y="286" width="24" height="40" fill="url(#gold)"/>
  <rect x="206" y="326" width="100" height="16" rx="5" fill="url(#gold)"/>
  <rect x="188" y="344" width="136" height="24" rx="8" fill="url(#gold)"/>
  <text x="256" y="448" font-size="64" text-anchor="middle" fill="#ffffff" font-weight="bold" font-family="Arial, sans-serif" letter-spacing="2">2026</text>
</svg>`;

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg())).resize(t.size, t.size).png().toFile(`public/icons/${t.name}`);
  console.log('✓', t.name);
}
console.log('האייקונים נוצרו ב-public/icons/');
