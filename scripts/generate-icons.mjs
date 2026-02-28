import sharp from 'sharp';
import { mkdirSync } from 'fs';

const sizes = [72, 96, 128, 144, 192, 512];
const outDir = 'public/icons';
mkdirSync(outDir, { recursive: true });

// Create a proper app icon SVG with background circle + logo
const makeSvg = (size) => {
  const pad = Math.round(size * 0.15);
  const iconSize = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  // Scale the 24x24 viewBox paths to fit
  const scale = iconSize / 24;
  const tx = pad;
  const ty = pad;

  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d1b2a"/>
  <g transform="translate(${tx},${ty}) scale(${scale})">
    <path d="M2 12C2 7 7 2 12 2s10 5 10 10" fill="none" stroke="#5eead4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 22c-2-3-6-7-6-10a6 6 0 0 1 12 0c0 3-4 7-6 10z" fill="none" stroke="#5eead4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="12" r="2" fill="none" stroke="#5eead4" stroke-width="2"/>
  </g>
</svg>`);
};

for (const size of sizes) {
  await sharp(makeSvg(size))
    .resize(size, size)
    .png()
    .toFile(`${outDir}/icon-${size}x${size}.png`);
  console.log(`Generated icon-${size}x${size}.png`);
}

// Also generate maskable icon (with more padding for safe zone)
const makeMaskableSvg = (size) => {
  const pad = Math.round(size * 0.25); // 25% padding for maskable safe zone
  const iconSize = size - pad * 2;
  const scale = iconSize / 24;
  const tx = pad;
  const ty = pad;

  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0d1b2a"/>
  <g transform="translate(${tx},${ty}) scale(${scale})">
    <path d="M2 12C2 7 7 2 12 2s10 5 10 10" fill="none" stroke="#5eead4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 22c-2-3-6-7-6-10a6 6 0 0 1 12 0c0 3-4 7-6 10z" fill="none" stroke="#5eead4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="12" r="2" fill="none" stroke="#5eead4" stroke-width="2"/>
  </g>
</svg>`);
};

for (const size of [192, 512]) {
  await sharp(makeMaskableSvg(size))
    .resize(size, size)
    .png()
    .toFile(`${outDir}/icon-${size}x${size}-maskable.png`);
  console.log(`Generated icon-${size}x${size}-maskable.png`);
}

console.log('Done!');
