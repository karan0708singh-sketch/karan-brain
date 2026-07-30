#!/usr/bin/env node
/**
 * build_from_xlsx.js — regenerate the embedded user data in index.html
 * from the Office_department.xlsx sheet (columns: Department, Name, Comments).
 *
 *   node build_from_xlsx.js /path/to/Office_department.xlsx
 *   (defaults to ~/Downloads/Office_department.xlsx)
 *
 * Rules:
 *   - Rows with a blank Name OR blank Comments are skipped (kept out for now).
 *   - Quiz shows for Product Team + Tech team; Business team + CTO skip it.
 *   - "--ggggg--" logs in as "ggggg" (display "GG").
 *   - A generic "guest" entry is always kept (no quiz).
 * Needs: npm install xlsx  (run with --no-save if you don't want it in package.json)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const xlsx = require('xlsx');

const file = process.argv[2] || path.join(os.homedir(), 'Downloads', 'Office_department.xlsx');
const rows = xlsx.utils.sheet_to_json(xlsx.readFile(file).Sheets[xlsx.readFile(file).SheetNames[0]], { header: 1, defval: '' });
rows.shift(); // header

const slug = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const isQuizDept = d => { const x = (d || '').toLowerCase(); return x.includes('product') || x.includes('tech'); };

const users = {};
const excluded = [];
for (const r of rows) {
  const dept = String(r[0] || '').trim();
  const name = String(r[1] || '').trim();
  const comment = String(r[2] || '').trim();
  if (!name) continue;
  if (!comment) { excluded.push(name); continue; }

  let key, display;
  if (name === '--ggggg--') { key = 'ggggg'; display = 'GG'; }
  else { key = slug(name); display = name; }

  users[key] = { name: display, memory: comment, dept, quiz: isQuizDept(dept) };
}

users['guest'] = {
  name: 'Guest',
  memory: "No personal file found in Karan's brain for you -- but if you have this link, you clearly mattered enough to get it. Thank you for being part of the journey. Stay in touch -- the brain may be leaving the building, but it's still online.",
  dept: 'Guest', quiz: false
};

const b64 = Buffer.from(unescape(encodeURIComponent(JSON.stringify(users))), 'binary').toString('base64');
const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/const USERS_B64 = "[^"]+";/, `const USERS_B64 = "${b64}";`);
fs.writeFileSync(htmlPath, html);

console.log(`✓ injected ${Object.keys(users).length} users (incl. guest)`);
console.log(`  quiz: ${Object.values(users).filter(u => u.quiz).length} · no-quiz: ${Object.values(users).filter(u => !u.quiz).length}`);
if (excluded.length) console.log(`  skipped (blank comment): ${excluded.join(', ')}`);
