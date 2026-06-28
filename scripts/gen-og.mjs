// יוצר תמונת שיתוף (Open Graph) 1200x630 ללינק.
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0A3161"/>
      <stop offset="0.55" stop-color="#0d2f5c"/>
      <stop offset="1" stop-color="#B31942"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe07a"/>
      <stop offset="1" stop-color="#f5b400"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g fill="#ffffff" opacity="0.10">
    <circle cx="120" cy="90" r="5"/><circle cx="300" cy="150" r="4"/><circle cx="1050" cy="100" r="5"/>
    <circle cx="1130" cy="260" r="4"/><circle cx="90" cy="520" r="4"/><circle cx="1080" cy="540" r="5"/>
    <circle cx="500" cy="70" r="3"/><circle cx="950" cy="420" r="4"/>
  </g>
  <g opacity="0.08">
    <rect x="0" y="0" width="1200" height="40" fill="#B31942"/>
    <rect x="0" y="80" width="1200" height="40" fill="#B31942"/>
  </g>

  <!-- גביע -->
  <g transform="translate(600,70) scale(0.62) translate(-256,-120)">
    <g fill="none" stroke="url(#gold)" stroke-width="16">
      <path d="M172 150 C120 150 116 224 176 232"/>
      <path d="M340 150 C392 150 396 224 336 232"/>
    </g>
    <path d="M172 138 H340 V196 C340 250 304 286 256 286 C208 286 172 250 172 196 Z" fill="url(#gold)"/>
    <rect x="244" y="286" width="24" height="40" fill="url(#gold)"/>
    <rect x="206" y="326" width="100" height="16" rx="5" fill="url(#gold)"/>
    <rect x="188" y="344" width="136" height="24" rx="8" fill="url(#gold)"/>
  </g>

  <text x="600" y="375" font-size="96" text-anchor="middle" fill="#ffffff" font-weight="bold" font-family="Arial">מונדיאל 2026</text>
  <text x="600" y="450" font-size="48" text-anchor="middle" fill="#FFC72C" font-weight="bold" font-family="Arial">שלב שמינית הגמר · מי האלופה?</text>
  <rect x="350" y="495" width="500" height="68" rx="34" fill="#B31942"/>
  <text x="600" y="540" font-size="40" text-anchor="middle" fill="#ffffff" font-weight="bold" font-family="Arial">הימור פתוח עד 22:00 הערב</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og-image.png');
console.log('✓ public/og-image.png');
