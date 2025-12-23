const fs = require('fs');
const p = './dados/media.json';
console.log('Reading', p);
const raw = fs.readFileSync(p, 'utf8');
console.log('Raw length', raw.length);
console.log('Raw head:', raw.slice(0,120));
console.log('First chars codes:', raw.slice(0,6).split('').map(c => c.charCodeAt(0)));
try {
  const j = JSON.parse(raw);
  console.log('Parsed length', j.length);
  if (j[0]) console.log('First filename:', j[0].filename);
} catch (e) {
  console.error('JSON parse error:', e.message);
}
