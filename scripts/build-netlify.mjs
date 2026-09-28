// Build script for Netlify Static + Functions Deployment
// Assembles all role portals and shared assets into dist/ directory

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('🚀 Preparing Netlify distribution build...');

// Remove and re-create dist
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Warning: Source directory ${src} does not exist. Skipping.`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Root Landing Page
console.log('📦 Copying Landing portal to dist/...');
copyDirSync(path.join(ROOT_DIR, 'public-landing'), DIST_DIR);

// 2. Shared Assets -> /assets
console.log('📦 Copying Shared Assets to dist/assets/...');
copyDirSync(path.join(ROOT_DIR, 'public-shared'), path.join(DIST_DIR, 'assets'));

// 3. Role Portals
const portals = [
  { from: 'public-user', to: 'user' },
  { from: 'public-collector', to: 'collector' },
  { from: 'public-government', to: 'government' },
  { from: 'public-producer', to: 'producer' },
  { from: 'public-municipal', to: 'municipal' },
  { from: 'public-medical', to: 'medical' },
  { from: 'public-demo', to: 'demo' },
  { from: 'public-track', to: 'track' }
];

for (const p of portals) {
  console.log(`📦 Copying ${p.from} to dist/${p.to}/...`);
  copyDirSync(path.join(ROOT_DIR, p.from), path.join(DIST_DIR, p.to));
}

// 4. Ensure speech-script.json is in assets as well
const speechScriptSrc = path.join(ROOT_DIR, 'public-demo', 'speech-script.json');
if (fs.existsSync(speechScriptSrc)) {
  fs.copyFileSync(speechScriptSrc, path.join(DIST_DIR, 'assets', 'speech-script.json'));
}

console.log('✅ Netlify distribution build completed successfully in ./dist/');
