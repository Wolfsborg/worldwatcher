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
 *     "version": "0.1.0",
 *     "changelog": [...],
 *     "git": "a1b2c3d4567890",
 *     "built_at": "2026-08-22T06:42:15Z"
 *   }
 * 
 * Reads version from CHANGELOG.md (first [X.Y.Z] entry)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHANGELOG_FILE = path.join(__dirname, '..', '..', 'CHANGELOG.md');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'version.json');

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn('Could not get git SHA:', err.message);
    return 'unknown';
  }
}

function parseChangelog() {
  try {
    const content = fs.readFileSync(CHANGELOG_FILE, 'utf8');
    const lines = content.split('\n');
    
    let currentVersion = null;
    let currentDate = null;
    let currentSection = null;
    const versions = [];
    const versionData = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match version header: ## [0.1.0] - 2026-08-22
      const versionMatch = line.match(/^##\s+\[(\d+\.\d+\.\d+)\]\s+-\s+(\d{4}-\d{2}-\d{2})/);
      if (versionMatch) {
        currentVersion = versionMatch[1];
        currentDate = versionMatch[2];
        
        if (!versions.includes(currentVersion)) {
          versions.push(currentVersion);
          versionData[currentVersion] = {
            version: currentVersion,
            date: currentDate,
            changes: {}
          };
        }
        currentSection = null;
        continue;
      }
      
      // Match section header: ### Added
      const sectionMatch = line.match(/^###\s+(.+)$/);
      if (sectionMatch && currentVersion) {
        currentSection = sectionMatch[1];
        versionData[currentVersion].changes[currentSection] = [];
        continue;
      }
      
      // Match change item: - Interactive map...
      const itemMatch = line.match(/^-\s+(.+)$/);
      if (itemMatch && currentVersion && currentSection) {
        versionData[currentVersion].changes[currentSection].push(itemMatch[1]);
      }
    }
    
    if (versions.length === 0) {
      throw new Error('No version found in CHANGELOG.md');
    }
    
    // Return latest version and all versions data
    const latestVersion = versions[0];
    const changelogArray = versions.slice(0, 5).map(v => versionData[v]); // Keep last 5 versions
    
    return {
      version: latestVersion,
      changelog: changelogArray
    };
  } catch (err) {
    console.error('Error parsing CHANGELOG:', err.message);
    throw err;
  }
}

function generateVersion() {
  const { version, changelog } = parseChangelog();
  const gitSha = getGitSha();
  const builtAt = new Date().toISOString();
  
  const versionData = {
    version: version,
    changelog: changelog,
    git: gitSha,
    built_at: builtAt
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  
  console.log(`Version: v${version}`);
  console.log(`Changelog entries: ${changelog.length}`);
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
