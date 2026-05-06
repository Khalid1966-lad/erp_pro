#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO — Pre-build script
// Generates /public/build-meta.json with a unique build stamp.
// Updates /public/manifest.webmanifest with the current version.
// This guarantees:
//   - sw.js content changes on every deploy (browser detects update)
//   - manifest.webmanifest always has the correct version (Windows shows it)
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Read version from package.json
const pkg = require(path.join(__dirname, '..', 'package.json'));
const version = pkg.version || '0.0.0';

// Generate build metadata
const now = new Date();
const buildDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
const buildTimestamp = now.getTime();
const cacheName = `gema-erp-v${version}-${buildTimestamp}`;

const meta = {
  version,
  buildDate,
  buildTimestamp,
  cacheName,
};

// ── 1. Write /public/build-meta.json ──
const metaPath = path.join(__dirname, '..', 'public', 'build-meta.json');
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

// ── 2. Update version in /public/manifest.webmanifest ──
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.webmanifest');
try {
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[prebuild] manifest.webmanifest version → ${version}`);
} catch (err) {
  console.warn(`[prebuild] Could not update manifest.webmanifest: ${err.message}`);
}

// ── 3. Inject build stamp into sw.js so the file changes on every build ──
//    The browser compares sw.js bytes to detect updates. Without this,
//    the browser never sees a new version and the old SW keeps serving
//    stale cached HTML with outdated chunk references → ChunkLoadError.
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
try {
  let swContent = fs.readFileSync(swPath, 'utf-8');
  const stampComment = `// BUILD: v${version} | ${buildDate} | ${buildTimestamp}`;
  swContent = swContent.replace(
    /\/\/ __BUILD_STAMP_PLACEHOLDER__/,
    stampComment
  );
  fs.writeFileSync(swPath, swContent);
  console.log(`[prebuild] sw.js build stamp injected — ${stampComment}`);
} catch (err) {
  console.warn(`[prebuild] Could not update sw.js: ${err.message}`);
}

console.log(`[prebuild] build-meta.json generated — v${version} | ${buildDate} | cache: ${cacheName}`);
