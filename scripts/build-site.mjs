import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const out = resolve('dist');
await mkdir(`${out}/data`, {recursive:true});
for (const file of ['index.html','styles.css','coastal.css','app.js']) await copyFile(file,`${out}/${file}`);
const snapshot = JSON.parse(await readFile('data/live.json','utf8'));
if (snapshot.schemaVersion !== 1 || !['ok','error'].includes(snapshot.status) || !Array.isArray(snapshot.storms)) throw new Error('Invalid production snapshot');
if (snapshot.storms.some((storm) => /^DEMO/.test(storm.id))) throw new Error('Demo data must not enter production');
await copyFile('data/live.json',`${out}/data/live.json`);
await copyFile('data/live.js',`${out}/data/live.js`);
let html = await readFile('index.html','utf8');
for (const asset of ['styles.css','coastal.css','app.js','data/live.js']) {
  const hash = createHash('sha256').update(await readFile(`${out}/${asset}`)).digest('hex').slice(0,12);
  html = html.replaceAll(`"${asset}"`,`"${asset}?v=${hash}"`);
}
await writeFile(`${out}/index.html`,html,'utf8');
await writeFile(`${out}/.nojekyll`,'');
console.log('Pages artifact: index.html, styles.css, coastal.css, app.js, data/live.json, data/live.js, .nojekyll');
