const fs = require('fs');
const content = fs.readFileSync('scripts/skin.yml', 'utf8').replace(/\r/g, '');
const lines = content.split('\n');

let currentIgn = null, currentSkin = null, currentType = 'Cracked';
let inProfiles = false, inEntry = false;
const invalid = [];

for (const line of lines) {
  if (line.trim() === 'profiles:') { inProfiles = true; continue; }
  if (!inProfiles) continue;
  if (/^  ['"]?\d{15,20}['"]?:/.test(line)) {
    if (currentIgn && currentSkin !== null) {
      const u = currentSkin.trim().replace(/^['"]|['"]$/g, '');
      if (!u.startsWith('http')) {
        invalid.push({ ign: currentIgn, skin: u.slice(0, 80), type: currentType });
      }
    }
    currentIgn = null; currentSkin = null; currentType = 'Cracked'; inEntry = true; continue;
  }
  if (!inEntry) continue;
  const im = line.match(/^    ign:\s*(.+)$/);
  const sm = line.match(/^    skin-url:\s*(.*)$/);
  const am = line.match(/^    account-type:\s*(.+)$/);
  if (im) currentIgn = im[1].trim().replace(/^['"]|['"]$/g, '');
  if (sm) currentSkin = sm[1].trim();
  if (am) currentType = am[1].trim().replace(/^['"]|['"]$/g, '');
}

const patterns = {};
invalid.forEach(p => {
  const key = p.skin.slice(0, 40) || '(empty)';
  if (!patterns[key]) patterns[key] = 0;
  patterns[key]++;
});

console.log('Invalid skin patterns (top 30):');
Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => {
  console.log(v + 'x: [' + k + ']');
});
console.log('\nTotal invalid:', invalid.length);
