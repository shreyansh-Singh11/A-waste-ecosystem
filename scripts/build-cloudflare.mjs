// Build script for Cloudflare Pages Deployment
// Assembles all 8 role portals, shared assets, _redirects, and _headers into dist/

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('⚡ Preparing Cloudflare Pages production build...');

// Remove and recreate dist/
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

// 1. Root Landing Page -> dist/
console.log('📦 [1/6] Copying Landing portal to dist/...');
copyDirSync(path.join(ROOT_DIR, 'public-landing'), DIST_DIR);

// 2. Shared Assets -> dist/assets/
console.log('📦 [2/6] Copying Design System v2 assets to dist/assets/...');
copyDirSync(path.join(ROOT_DIR, 'public-shared'), path.join(DIST_DIR, 'assets'));

// 3. Portals
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

console.log('📦 [3/6] Packaging 8 dedicated role portals...');
for (const p of portals) {
  copyDirSync(path.join(ROOT_DIR, p.from), path.join(DIST_DIR, p.to));
}

// 4. Ensure speech-script.json is in demo and assets
const speechScriptSrc = path.join(ROOT_DIR, 'public-demo', 'speech-script.json');
if (fs.existsSync(speechScriptSrc)) {
  fs.copyFileSync(speechScriptSrc, path.join(DIST_DIR, 'assets', 'speech-script.json'));
  fs.copyFileSync(speechScriptSrc, path.join(DIST_DIR, 'demo', 'speech-script.json'));
}

// 5. Generate Cloudflare Pages _redirects file
console.log('📄 [4/6] Generating Cloudflare Pages _redirects file...');
const redirectsContent = `# Cloudflare Pages Clean Routing Rules
/user              /user/index.html            200
/collector         /collector/index.html       200
/collector/scan    /collector/scan.html        200
/government        /government/index.html      200
/producer          /producer/index.html        200
/municipal         /municipal/index.html       200
/medical           /medical/index.html         200
/demo              /demo/index.html            200
/track/*           /track/track.html           200
`;
fs.writeFileSync(path.join(DIST_DIR, '_redirects'), redirectsContent.trim() + '\n', 'utf-8');

// 6. Generate Cloudflare Pages _headers file
console.log('📄 [5/6] Generating Cloudflare Pages _headers file...');
const headersContent = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=*, geolocation=*
  Access-Control-Allow-Origin: *

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/user/*
  Cache-Control: public, max-age=0, must-revalidate

/demo/*
  Cache-Control: public, max-age=0, must-revalidate
`;
fs.writeFileSync(path.join(DIST_DIR, '_headers'), headersContent.trim() + '\n', 'utf-8');

// Summary check
console.log('🔍 [6/6] Verifying output directory structure...');
const distFiles = fs.readdirSync(DIST_DIR);
console.log(`✅ Build artifacts ready in ./dist/ (${distFiles.length} root items)`);
console.log('🚀 Ready to upload to Cloudflare Pages via Git or Wrangler CLI:');
console.log('   npx wrangler pages deploy dist');
