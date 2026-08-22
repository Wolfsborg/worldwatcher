#!/usr/bin/env node
/**
 * Generate sitemap.xml for worldwatcher.app
 * 
 * Usage:
 *   node scripts/build-sitemap.js
 * 
 * Output:
 *   damincidents/sitemap.xml
 * 
 * Note: Run this script after incidents.json or floods.json updates
 * to keep the sitemap current.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://worldwatcher.app';
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(__dirname, '..', 'sitemap.xml');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle BC dates (starts with -)
  if (String(dateStr).startsWith('-')) return null;
  
  const str = String(dateStr);
  
  // YYYY-MM-DD format
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return str;
  }
  
  // YYYY-MM format -> YYYY-MM-01
  if (str.match(/^\d{4}-\d{2}$/)) {
    return `${str}-01`;
  }
  
  // YYYY format -> YYYY-01-01
  if (str.match(/^\d{4}$/)) {
    return `${str}-01-01`;
  }
  
  return null;
}

function generateSitemap() {
  const urls = [];
  
  // Static pages
  urls.push({
    loc: BASE_URL + '/',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'hourly',
    priority: '1.0'
  });
  
  urls.push({
    loc: BASE_URL + '/standards.html',
    changefreq: 'monthly',
    priority: '0.5'
  });
  
  urls.push({
    loc: BASE_URL + '/terms.html',
    changefreq: 'monthly',
    priority: '0.5'
  });
  
  urls.push({
    loc: BASE_URL + '/privacy.html',
    changefreq: 'monthly',
    priority: '0.5'
  });
  
  // Floods layer page
  urls.push({
    loc: BASE_URL + '/?layer=floods',
    changefreq: 'daily',
    priority: '0.8'
  });
  
  // Load incidents data
  try {
    const incidentsPath = path.join(DATA_DIR, 'incidents.json');
    const incidentsData = JSON.parse(fs.readFileSync(incidentsPath, 'utf8'));
    const incidents = incidentsData.incidents || [];
    
    console.log(`Found ${incidents.length} dam incidents`);
    
    incidents.forEach(incident => {
      const lastmod = formatDate(incident.last_updated || incident.incident_date);
      
      urls.push({
        loc: BASE_URL + '/?id=' + encodeURIComponent(incident.id),
        lastmod: lastmod,
        changefreq: 'weekly',
        priority: '0.6'
      });
    });
  } catch (err) {
    console.error('Error reading incidents.json:', err.message);
  }
  
  // Load floods data
  try {
    const floodsPath = path.join(DATA_DIR, 'floods.json');
    const floodsData = JSON.parse(fs.readFileSync(floodsPath, 'utf8'));
    const floods = floodsData.events || [];
    
    console.log(`Found ${floods.length} flood events`);
    
    floods.forEach(flood => {
      if (!flood.id) return; // Skip if no ID
      
      const lastmod = formatDate(flood.last_updated || flood.incident_date);
      
      urls.push({
        loc: BASE_URL + '/?layer=floods&id=' + encodeURIComponent(flood.id),
        lastmod: lastmod,
        changefreq: 'weekly',
        priority: '0.6'
      });
    });
  } catch (err) {
    console.error('Error reading floods.json:', err.message);
  }
  
  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  urls.forEach(url => {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
    if (url.lastmod) {
      xml += `    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n`;
    }
    if (url.changefreq) {
      xml += `    <changefreq>${escapeXml(url.changefreq)}</changefreq>\n`;
    }
    if (url.priority) {
      xml += `    <priority>${escapeXml(url.priority)}</priority>\n`;
    }
    xml += '  </url>\n';
  });
  
  xml += '</urlset>\n';
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
  console.log(`\nSitemap generated: ${OUTPUT_FILE}`);
  console.log(`Total URLs: ${urls.length}`);
}

// Run the script
try {
  generateSitemap();
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}
