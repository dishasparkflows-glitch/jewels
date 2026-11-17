const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const r2 = require('../src/utils/cloudflareR2');

const CHROME_PATH = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const ASSETS_DIR = path.join(__dirname, '../src/assets/email');
const TEMP_DIR = path.join(__dirname, '../temp_assets');

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const assets = [
  {
    name: 'pwd-reset-badge',
    width: 200,
    height: 200,
    svg: `
      <!-- Top Left Sparkle -->
      <path d="M26 22 L28.5 30 L36 32.5 L28.5 35 L26 43 L23.5 35 L16 32.5 L23.5 30 Z" fill="#C59B27"/>
      <!-- Bottom Left Sparkle -->
      <path d="M20 148 L21.5 153 L26 154.5 L21.5 156 L20 161 L18.5 156 L14 154.5 L18.5 153 Z" fill="#C59B27"/>
      <!-- Top Right Sparkle -->
      <path d="M168 36 L170.5 43 L178 45.5 L170.5 48 L168 55 L165.5 48 L158 45.5 L165.5 43 Z" fill="#C59B27"/>

      <!-- Cream Circle -->
      <circle cx="100" cy="100" r="76" fill="#F8EFE4"/>

      <!-- Padlock Shackle -->
      <path d="M84 92v-16a16 16 0 0 1 32 0v16" stroke="#9B7347" stroke-width="7" stroke-linecap="round" fill="none"/>
      <!-- Padlock Body -->
      <rect x="70" y="92" width="60" height="48" rx="10" fill="#FFFDFB" stroke="#9B7347" stroke-width="6.5"/>
      <!-- Keyhole -->
      <circle cx="100" cy="112" r="5" fill="#9B7347"/>
      <path d="M100 117v7" stroke="#9B7347" stroke-width="5" stroke-linecap="round"/>

      <!-- Refresh Circular Badge -->
      <circle cx="126" cy="126" r="22" fill="#724B2C"/>
      <!-- Refresh Arrow inside badge -->
      <path d="M132 121.5a10 10 0 1 0 1.8 9.5m1.5-10.8v7.5h-7.5" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  {
    name: 'invoice-doc-badge',
    width: 200,
    height: 200,
    svg: `
      <!-- Top Left Sparkle -->
      <path d="M26 22 L28.5 30 L36 32.5 L28.5 35 L26 43 L23.5 35 L16 32.5 L23.5 30 Z" fill="#C59B27"/>
      <!-- Bottom Left Sparkle -->
      <path d="M20 148 L21.5 153 L26 154.5 L21.5 156 L20 161 L18.5 156 L14 154.5 L18.5 153 Z" fill="#C59B27"/>
      <!-- Top Right Sparkle -->
      <path d="M168 36 L170.5 43 L178 45.5 L170.5 48 L168 55 L165.5 48 L158 45.5 L165.5 43 Z" fill="#C59B27"/>

      <!-- Cream Circle -->
      <circle cx="100" cy="100" r="76" fill="#F8EFE4"/>

      <!-- Document Base -->
      <rect x="74" y="66" width="44" height="60" rx="6" fill="#FFFDFB" stroke="#9B7347" stroke-width="5"/>
      <!-- Folded Corner -->
      <path d="M104 66v11a2 2 0 0 0 2 2h12" fill="none" stroke="#9B7347" stroke-width="5"/>
      <!-- Document Lines -->
      <line x1="84" y1="88" x2="102" y2="88" stroke="#9B7347" stroke-width="4" stroke-linecap="round"/>
      <line x1="84" y1="99" x2="106" y2="99" stroke="#9B7347" stroke-width="4" stroke-linecap="round"/>
      <line x1="84" y1="110" x2="98" y2="110" stroke="#9B7347" stroke-width="4" stroke-linecap="round"/>

      <!-- Check Circular Badge -->
      <circle cx="126" cy="126" r="22" fill="#724B2C"/>
      <!-- Checkmark -->
      <path d="M117 126l6 6 12-12" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  {
    name: 'clock-icon',
    width: 48,
    height: 48,
    svg: `
      <circle cx="24" cy="24" r="20" stroke="#9B7347" stroke-width="3.5" fill="none"/>
      <polyline points="24 12 24 24 32 28" stroke="#9B7347" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  {
    name: 'diamond-icon',
    width: 40,
    height: 40,
    svg: `
      <path d="M10 6h20l7 10-17 19L3 16l7-10z" stroke="#A07548" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M3 16h34" stroke="#A07548" stroke-width="3"/>
      <path d="M20 35L12 16l5-10" stroke="#A07548" stroke-width="3"/>
      <path d="M20 35l8-19-5-10" stroke="#A07548" stroke-width="3"/>
    `
  },
  {
    name: 'phone-icon',
    width: 32,
    height: 32,
    svg: `
      <path d="M29.3 22.6v4a2.7 2.7 0 0 1-2.9 2.7 26.4 26.4 0 0 1-11.5-4.1 26 26 0 0 1-8-8A26.4 26.4 0 0 1 2.7 5.7 2.7 2.7 0 0 1 5.5 2.7h4a2.7 2.7 0 0 1 2.7 2.3c.2 1.3.6 2.5.9 3.7a2.7 2.7 0 0 1-.6 2.8L10.8 13a21.3 21.3 0 0 0 8 8l1.7-1.7a2.7 2.7 0 0 1 2.8-.6c1.2.4 2.4.7 3.7.9a2.7 2.7 0 0 1 2.3 3z" stroke="#9B7347" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  {
    name: 'email-icon',
    width: 32,
    height: 32,
    svg: `
      <rect x="2.5" y="5" width="27" height="22" rx="4" stroke="#9B7347" stroke-width="2.8" fill="none"/>
      <path d="M29 7.5L16 17.5 3 7.5" stroke="#9B7347" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  {
    name: 'globe-icon',
    width: 32,
    height: 32,
    svg: `
      <circle cx="16" cy="16" r="13" stroke="#9B7347" stroke-width="2.8" fill="none"/>
      <line x1="3" y1="16" x2="29" y2="16" stroke="#9B7347" stroke-width="2.8"/>
      <path d="M16 3a19.5 19.5 0 0 1 5.5 13 19.5 19.5 0 0 1-5.5 13 19.5 19.5 0 0 1-5.5-13 19.5 19.5 0 0 1 5.5-13z" stroke="#9B7347" stroke-width="2.8" fill="none"/>
    `
  },
  {
    name: 'box-icon',
    width: 44,
    height: 44,
    svg: `
      <path d="M22 3.5l17.5 9.5-17.5 9.5L4.5 13 22 3.5z" stroke="#9B7347" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4.5 13.5V30.5L22 40.5V22.5" stroke="#9B7347" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M39.5 13.5V30.5L22 40.5" stroke="#9B7347" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M13.5 8.5l17.5 9.5" stroke="#9B7347" stroke-width="3.2" stroke-linecap="round"/>
    `
  },
  {
    name: 'coins-icon',
    width: 44,
    height: 44,
    svg: `
      <ellipse cx="28" cy="13" rx="13" ry="5.5" stroke="#9B7347" stroke-width="3.2" fill="none"/>
      <path d="M15 13v7.5c0 3 5.8 5.5 13 5.5s13-2.5 13-5.5V13" stroke="#9B7347" stroke-width="3.2" fill="none"/>
      <path d="M15 20.5v7.5c0 3 5.8 5.5 13 5.5s13-2.5 13-5.5v-7.5" stroke="#9B7347" stroke-width="3.2" fill="none"/>
      <ellipse cx="14" cy="22" rx="10.5" ry="4.5" stroke="#9B7347" stroke-width="3.2" fill="none"/>
      <path d="M3.5 22v6c0 2.5 4.7 4.5 10.5 4.5s10.5-2 10.5-4.5v-6" stroke="#9B7347" stroke-width="3.2" fill="none"/>
      <path d="M3.5 28v6c0 2.5 4.7 4.5 10.5 4.5s10.5-2 10.5-4.5v-6" stroke="#9B7347" stroke-width="3.2" fill="none"/>
    `
  },
  {
    name: 'email-lace-pattern',
    width: 600,
    height: 24,
    svg: `
      <defs>
        <pattern id="lacePat" width="30" height="24" patternUnits="userSpaceOnUse">
          <path d="M 0,24 C 7.5,8 22.5,8 30,24" stroke="#B8956F" stroke-width="1.2" fill="none"/>
          <path d="M 0,16 C 7.5,4 22.5,4 30,16" stroke="#B8956F" stroke-width="0.9" fill="none"/>
          <circle cx="15" cy="10" r="2.2" fill="#B8956F"/>
        </pattern>
      </defs>
      <rect width="600" height="24" fill="url(#lacePat)"/>
    `
  }
];

async function main() {
  console.log('Generating PNG assets via headless Chrome...');
  const uploadedUrls = {};

  for (const item of assets) {
    const htmlPath = path.join(TEMP_DIR, `${item.name}.html`);
    const pngPath = path.join(ASSETS_DIR, `${item.name}.png`);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; width: ${item.width}px; height: ${item.height}px; }
  svg { display: block; }
</style>
</head>
<body>
<svg width="${item.width}" height="${item.height}" viewBox="0 0 ${item.width} ${item.height}" fill="none" xmlns="http://www.w3.org/2000/svg">
${item.svg}
</svg>
</body>
</html>`;

    fs.writeFileSync(htmlPath, htmlContent);

    const cmd = `${CHROME_PATH} --headless --default-background-color=00000000 --screenshot="${pngPath}" --window-size=${item.width},${item.height} --hide-scrollbars "${htmlPath}"`;
    try {
      execSync(cmd, { stdio: 'pipe' });
      console.log(`Generated local PNG: ${item.name}.png (${fs.statSync(pngPath).size} bytes)`);

      // Upload to R2 for universal email rendering
      const buffer = fs.readFileSync(pngPath);
      const uploadRes = await r2.uploadBuffer(buffer, `${item.name}.png`, 'email-assets', 'image/png');
      uploadedUrls[item.name] = uploadRes.url;
      console.log(`  Uploaded to R2: ${uploadRes.url}`);
    } catch (err) {
      console.error(`Error processing ${item.name}:`, err.message);
    }
  }

  const manifestPath = path.join(ASSETS_DIR, 'assets-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(uploadedUrls, null, 2));
  console.log('\nManifest saved to:', manifestPath);
  console.log(JSON.stringify(uploadedUrls, null, 2));
}

main().catch(console.error);
