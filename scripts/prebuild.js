#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO — Pre-build script
// Generates /public/build-meta.json with a unique build stamp.
// This guarantees sw.js content changes on every deploy,
// which forces the browser to detect a Service Worker update.
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

// Write to public/build-meta.json
const outPath = path.join(__dirname, '..', 'public', 'build-meta.json');
fs.writeFileSync(outPath, JSON.stringify(meta, null, 2) + '\n');

console.log(`[prebuild] build-meta.json generated — v${version} | ${buildDate} | cache: ${cacheName}`);
