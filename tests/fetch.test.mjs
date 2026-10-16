import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

async function runFetch({previous,fail=false}) {
  const folder=await mkdtemp(join(tmpdir(),'windwatch-fetch-test-'));
  const output=join(folder,'live.json');
  if(previous)await writeFile(output,JSON.stringify(previous));
  const code=`process.argv[2]=${JSON.stringify(output)};
    globalThis.fetch=async()=>{${fail?"throw new Error('simulated upstream failure')":"return {ok:true,text:async()=>JSON.stringify([])}"}};
    await import(${JSON.stringify(pathToFileURL(resolve('scripts/fetch-data.mjs')).href)});`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:20000,windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  return {snapshot:JSON.parse(await readFile(output,'utf8')),script:await readFile(output.replace(/\.json$/,'.js'),'utf8')};
}
test('successful empty list is an explicit no-active result and does not retain an old active storm',async()=>{
  const result=await runFetch({previous:{schemaVersion:1,status:'ok',lastSuccessfulFetchAt:'2026-01-01T00:00:00Z',storms:[{id:'202630'}]}});
  assert.equal(result.snapshot.status,'ok');assert.deepEqual(result.snapshot.storms,[]);
  assert.ok(result.snapshot.lastSuccessfulFetchAt);assert.match(result.script,/window.TYPHOON_DATA/);
});
test('upstream failure preserves the last successful timestamp and records while marking failure',async()=>{
  const previous={schemaVersion:1,status:'ok',lastSuccessfulFetchAt:'2026-01-01T00:00:00Z',storms:[{id:'202630'}]};
  const {snapshot}=await runFetch({previous,fail:true});
  assert.equal(snapshot.status,'error');assert.equal(snapshot.lastSuccessfulFetchAt,previous.lastSuccessfulFetchAt);
  assert.deepEqual(snapshot.storms,previous.storms);assert.notEqual(snapshot.fetchedAt,previous.lastSuccessfulFetchAt);
});
test('first-fetch failure is unavailable, never a successful empty list or demo fallback',async()=>{
  const {snapshot,script}=await runFetch({fail:true});assert.equal(snapshot.status,'error');
  assert.equal(snapshot.lastSuccessfulFetchAt,null);assert.deepEqual(snapshot.storms,[]);assert.doesNotMatch(script,/DEMO-01|HAILAN|YUNXI/);
});
