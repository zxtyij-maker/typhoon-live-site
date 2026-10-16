import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { SOURCE, validateList, normalizeStorm } from './normalize.mjs';

const output = resolve(process.argv[2] || 'data/live.json');
const now = new Date();
const year = Number(new Intl.DateTimeFormat('en', {year:'numeric',timeZone:'Asia/Shanghai'}).format(now));
const attempts = [];
async function getJSON(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: {Accept:'application/json'} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 12_000_000) throw new Error('Unexpected response size');
      attempts.push(url);
      return JSON.parse(text);
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 1500 * (attempt + 1)));
    }
  }
}

let snapshot;
try {
  let list = validateList(await getJSON(`${SOURCE.apiBase}/TyphoonList/${year}`));
  // An active system can cross a year boundary; check the preceding year in January.
  if (new Intl.DateTimeFormat('en', {month:'2-digit',timeZone:'Asia/Shanghai'}).format(now) === '01') {
    list = [...list, ...validateList(await getJSON(`${SOURCE.apiBase}/TyphoonList/${year - 1}`))];
  }
  const active = [...new Map(list.filter((item) => String(item.isactive) === '1').map((item) => [item.tfid,item])).values()];
  if (active.length > 12) throw new Error('Unexpected active storm count');
  const storms = [];
  for (const item of active) {
    const raw = await getJSON(`${SOURCE.apiBase}/TyphoonInfo/${item.tfid}`);
    storms.push(normalizeStorm(Array.isArray(raw) ? raw[0] : raw, item, now));
  }
  snapshot = {schemaVersion:1, status:'ok', fetchedAt:now.toISOString(), lastSuccessfulFetchAt:now.toISOString(), source:SOURCE,
    queriedUrls:attempts, units:{wind:'m/s',moveSpeed:'km/h',pressure:'hPa',coordinates:'degrees'}, warnings:{status:'not-connected'}, storms};
  console.log(`Official source verified: ${storms.length} active storm(s), fetched ${snapshot.fetchedAt}`);
} catch (error) {
  console.error('::warning::Official source refresh failed; publishing explicit failure status.');
  console.error(`Source failure: ${error.cause?.code || error.message}`);
  let previous;
  try { previous = JSON.parse(await readFile(output,'utf8')); } catch { /* A first deployment has no previous snapshot. */ }
  if (previous?.schemaVersion === 1 && Array.isArray(previous.storms) && previous.lastSuccessfulFetchAt) {
    snapshot = {...previous, status:'error', fetchedAt:now.toISOString(), error:'本次官方数据抓取失败；以下为最后一次成功记录，请核对时间。'};
  } else {
    snapshot = {schemaVersion:1,status:'error',fetchedAt:now.toISOString(),lastSuccessfulFetchAt:null,source:SOURCE,units:{wind:'m/s',moveSpeed:'km/h',pressure:'hPa'},warnings:{status:'not-connected'},storms:[],error:'官方数据暂不可用，无法确认当前台风状态。'};
  }
}
await mkdir(dirname(output), {recursive:true});
await writeFile(`${output}.tmp`, `${JSON.stringify(snapshot,null,2)}\n`, 'utf8');
await rename(`${output}.tmp`, output);
await writeFile(output.replace(/\.json$/,'.js'), `window.TYPHOON_DATA = ${JSON.stringify(snapshot).replace(/</g,'\\u003c')};\n`, 'utf8');
