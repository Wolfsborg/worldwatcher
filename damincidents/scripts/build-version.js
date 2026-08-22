#!/usr/bin/env node
/**
 * Generate version.json for worldwatcher.app
 * 
 * Usage:
 *   node scripts/build-version.js
 * 
 * Output:
 *   damincidents/data/version.json
 * 
 * Format:
 *   {
 *     "version": "2026.08.22-a1b2c3d",
 *     "git": "a1b2c3d4567890",
 *     "built_at": "2026-08-22T06:42:15Z"
 *   }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'version.json');

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn('Could not get git SHA:', err.message);
    return 'unknown';
  }
}

function getGitShortSha() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    return 'dev';
  }
}

function generateVersion() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const shortSha = getGitShortSha();
  
  const version = `${year}.${month}.${day}-${shortSha}`;
  const gitSha = getGitSha();
  const builtAt = now.toISOString();
  
  const versionData = {
    version: version,
    git: gitSha,
    built_at: builtAt
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  
  console.log(`Version generated: ${version}`);
  console.log(`Git SHA: ${gitSha}`);
  console.log(`Built at: ${builtAt}`);
  console.log(`Written to: ${OUTPUT_FILE}`);
}

try {
  generateVersion();
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}
