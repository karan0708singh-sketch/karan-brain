#!/usr/bin/env node
/**
 * build_users.js — inject real user data into index.html from a CSV.
 *
 * CSV format (users.csv, UTF-8, header row required):
 *   username,display_name,memory
 *   rahul,Rahul,"Rahul, that launch night when..."
 *
 * - username: what they type at the identity prompt (lowercase, first name)
 * - display_name: how the terminal greets them
 * - memory: the personalized message (wrap in quotes if it contains commas)
 *
 * A "guest" row is strongly recommended — it's the fallback for anyone
 * whose name isn't in the list (granted automatically after 3 failed tries).
 *
 * Usage: node build_users.js users.csv
 */
const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node build_users.js <users.csv>');
  process.exit(1);
}

// minimal CSV parser (handles quoted fields with commas/newlines/escaped quotes)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  row.push(field);
  if (row.some(f => f.trim() !== '')) rows.push(row);
  return rows;
}

const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
const header = rows.shift().map(h => h.trim().toLowerCase());
const uIdx = header.indexOf('username');
const nIdx = header.indexOf('display_name');
const mIdx = header.indexOf('memory');
if (uIdx === -1 || nIdx === -1 || mIdx === -1) {
  console.error('CSV must have header: username,display_name,memory');
  process.exit(1);
}

const users = {};
for (const r of rows) {
  const key = (r[uIdx] || '').trim().toLowerCase();
  if (!key) continue;
  users[key] = { name: (r[nIdx] || key).trim(), memory: (r[mIdx] || '').trim() };
}

if (!users.guest) {
  console.warn('⚠ no "guest" row found — adding a generic fallback.');
  users.guest = {
    name: 'Guest',
    memory: "No personal file found -- but if you're poking around Karan's brain, you clearly mattered enough to get the link. Thank you for being part of the journey."
  };
}

const b64 = Buffer.from(unescape(encodeURIComponent(JSON.stringify(users))), 'binary').toString('base64');

const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const re = /(\/\*USERS_B64_START\*\/)[\s\S]*?(\/\*USERS_B64_END\*\/)/;
if (!re.test(html)) {
  console.error('Markers not found in index.html');
  process.exit(1);
}
html = html.replace(re, `$1\nconst USERS_B64 = "${b64}";\n$2`);
fs.writeFileSync(htmlPath, html);

console.log(`✓ injected ${Object.keys(users).length} users into index.html:`);
console.log('  ' + Object.keys(users).join(', '));
