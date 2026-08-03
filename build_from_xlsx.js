#!/usr/bin/env node
/**
 * build_from_xlsx.js — regenerate the embedded user data in index.html
 * from the Office_department sheet
 * (columns: Department, Name, Comments, "Quiz to show or not", "Questions to ask").
 *
 *   node build_from_xlsx.js /path/to/Office_department2.0.xlsx
 *   (defaults to ~/Downloads/Office_department2.0.xlsx)
 *
 * Rules:
 *   - Rows with a blank Name OR blank Comments are skipped (kept out for now).
 *   - "Quiz to show or not" (TRUE/FALSE) decides per-user whether the quiz runs.
 *   - "Questions to ask" (e.g. "1,3,6,7") picks which questions from the pool,
 *     1-indexed; stored 0-indexed as `qs`. Empty + quiz=true ⇒ all questions.
 *   - "--ggggg--" or "ggggg" logs in as "ggggg" (display "GG").
 *   - A generic "guest" entry is always kept (no quiz).
 * Needs: npm install xlsx  (run with --no-save if you don't want it in package.json)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const xlsx = require('xlsx');

const file = process.argv[2] || path.join(os.homedir(), 'Downloads', 'Office_department2.0.xlsx');
const rows = xlsx.utils.sheet_to_json(xlsx.readFile(file).Sheets[xlsx.readFile(file).SheetNames[0]], { header: 1, defval: '' });
rows.shift(); // header

const slug = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const truthy = v => v === true || /^(true|yes|1)$/i.test(String(v).trim());
// "1,3,6,7" (1-indexed) → [0,2,5,6] (0-indexed into the QUIZ pool)
const parseQs = s => String(s || '').split(/[^0-9]+/).map(x => parseInt(x, 10))
  .filter(n => !isNaN(n) && n >= 1).map(n => n - 1);

const users = {};
const excluded = [];
for (const r of rows) {
  const dept = String(r[0] || '').trim();
  const name = String(r[1] || '').trim();
  const comment = String(r[2] || '').trim();
  if (!name) continue;
  if (!comment) { excluded.push(name); continue; }

  const quiz = truthy(r[3]);
  const qs = parseQs(r[4]);

  let key, display;
  if (name === '--ggggg--' || name === 'ggggg') { key = 'ggggg'; display = 'GG'; }
  else { key = slug(name); display = name; }

  const rec = { name: display, memory: comment, dept, quiz };
  if (quiz && qs.length) rec.qs = qs;   // omit ⇒ all questions
  users[key] = rec;
}

users['guest'] = {
  name: 'Visitor',
  memory: "Hey, we may have worked together, or maybe we didn't get the chance to work closely. Unfortunately, I wasn't able to write a personalized note for everyone here.\n\nBut please feel free to connect with me offline or on LinkedIn. Even if we haven't worked together directly, I remember faces, and I'd definitely be happy to help if you ever need anything.\n\nKeep growing, keep learning, and wishing you all the success ahead. Stay connected! 😊",
  dept: 'Guest', quiz: false, fallback: true
};

const b64 = Buffer.from(unescape(encodeURIComponent(JSON.stringify(users))), 'binary').toString('base64');
const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/const USERS_B64 = "[^"]+";/, `const USERS_B64 = "${b64}";`);
fs.writeFileSync(htmlPath, html);

console.log(`✓ injected ${Object.keys(users).length} users (incl. guest)`);
console.log(`  quiz: ${Object.values(users).filter(u => u.quiz).length} · no-quiz: ${Object.values(users).filter(u => !u.quiz).length}`);
Object.values(users).filter(u => u.quiz).forEach(u =>
  console.log(`    ${u.name} → Q[${(u.qs ? u.qs.map(i => i + 1) : ['all']).join(',')}]`));
if (excluded.length) console.log(`  skipped (blank comment): ${excluded.join(', ')}`);
