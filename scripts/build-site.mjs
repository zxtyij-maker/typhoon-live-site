import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('dist');
await mkdir(`${out}/data`, {recursive:true});
for (const file of ['index.html','styles.css','app.js']) await copyFile(file,`${out}/${file}`);
const snapshot = JSON.parse(await readFile('data/live.json','utf8'));
if (snapshot.schemaVersion !== 1 || !['ok','error'].includes(snapshot.status) || !Array.isArray(snapshot.storms)) throw new Error('Invalid production snapshot');
if (snapshot.storms.some((storm) => /^DEMO/.test(storm.id))) throw new Error('Demo data must not enter production');
await copyFile('data/live.json',`${out}/data/live.json`);
await copyFile('data/live.js',`${out}/data/live.js`);
await writeFile(`${out}/.nojekyll`,'');
console.log('Pages artifact: index.html, styles.css, app.js, data/live.json, data/live.js, .nojekyll');
