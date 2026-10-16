import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeStorm, sourceTime, numeric, validateList } from '../scripts/normalize.mjs';

const raw = JSON.parse(await readFile(new URL('./fixtures/zhejiang-202630.json',import.meta.url),'utf8'));
const now = new Date('2026-10-16T17:44:36Z');
const summary = {tfid:'202630',isactive:'1'};
test('actual official source sample: units, times, agency identity and missing pressure', () => {
  const storm = normalizeStorm(raw,summary,now);
  assert.equal(storm.id,'202630');
  assert.equal(storm.latest.time,'2026-10-16T15:00:00.000Z');
  assert.equal(storm.latest.wind,30);
  assert.equal(storm.latest.force,11);
  assert.equal(storm.latest.lon,150.8);
  assert.equal(storm.latest.moveSpeed,26);
  assert.equal(storm.forecasts[0].agency,'中国');
  assert.equal(storm.forecasts[0].issuedAt,storm.latest.time);
  assert.ok(storm.forecasts.every(f=>f.points.every(p=>p.time>storm.latest.time)));
  assert.equal(storm.forecasts.find(f=>f.agency==='美国').points[0].pressure,null);
  assert.ok(!('warnlevel' in storm));
  assert.equal(normalizeStorm({...raw,isactive:'0'},summary,now).active,false);
});
test('invalid coordinates, empty observations, ID mismatch and future observations are rejected',()=>{
  assert.throws(()=>normalizeStorm({...raw,tfid:'wrong'},summary,now));
  assert.throws(()=>normalizeStorm({...raw,points:[]},summary,now));
  const invalid=structuredClone(raw); invalid.points[0].lat='900';
  assert.throws(()=>normalizeStorm(invalid,summary,now));
  assert.throws(()=>normalizeStorm(raw,summary,new Date('2020-01-01')));
});
test('nulls stay null; source timestamps are explicitly Beijing time; source lists validate flags',()=>{
  assert.equal(numeric(' ',700,1100),null);
  assert.equal(numeric(null,0,100),null);
  assert.equal(numeric('0',0,200),0);
  assert.equal(sourceTime('2026-10-16 23:00:00'),'2026-10-16T15:00:00.000Z');
  assert.throws(()=>sourceTime('unknown'));
  assert.deepEqual(validateList([]),[]);
  assert.throws(()=>validateList([{tfid:'../../evil',isactive:'1'}]));
  assert.throws(()=>validateList([{tfid:'202630',isactive:'unknown'}]));
});
test('observations are ordered and duplicate observation times do not duplicate the path',()=>{
  const storm=normalizeStorm({...raw,points:[raw.points[1],raw.points[0],raw.points[1]]},summary,now);
  assert.equal(storm.track.length,2);
  assert.equal(storm.latest.time,'2026-10-16T15:00:00.000Z');
});
