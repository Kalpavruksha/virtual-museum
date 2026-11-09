// Run: npm run assets — downloads every exhibit that has a "download" URL into public/assets/. Safe to re-run.
import fs from 'node:fs'; import path from 'node:path';
const E = JSON.parse(fs.readFileSync('data/exhibits.json', 'utf8')).exhibits;
const credits = ['# Credits\n'];
for (const e of E) {
  credits.push(`- **${e.title}** — ${e.artist} (${e.year}). License: ${e.license}.${e.download ? ' Source: ' + e.download.split('?')[0] : ''}`);
  if (!e.download) { console.log(`skip   ${e.id} (no download URL — add your own file at public${e.src})`); continue; }
  const out = path.join('public', e.src); if (fs.existsSync(out)) { console.log(`have   ${e.id}`); continue; }
  try {
    const res = await fetch(e.download, { headers: { 'User-Agent': 'VirtualMuseumStarter/1.0 (educational project)' } });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`saved  ${e.id} → ${out}`);
  } catch (err) { console.log(`FAILED ${e.id}: ${err.message} — download manually to public${e.src}`); }
}
fs.writeFileSync('CREDITS.md', credits.join('\n') + '\n');
console.log('CREDITS.md written');
