export const SOURCE = Object.freeze({
  name: '浙江省台风路径实时发布系统',
  publisher: '浙江省水利厅',
  url: 'https://typhoon.slt.zj.gov.cn/',
  apiBase: 'https://typhoon.slt.zj.gov.cn/Api'
});

export function numeric(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error('Invalid numeric field');
  return number;
}

export function sourceTime(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing source time');
  const time = value.trim().replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(time)) throw new Error('Invalid source time');
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/.test(time) ? time : `${time}+08:00`;
  if (!Number.isFinite(Date.parse(zoned))) throw new Error('Invalid source time');
  return new Date(zoned).toISOString();
}

function point(raw) {
  const lat = numeric(raw.lat, -90, 90);
  const lon = numeric(raw.lng, -180, 180);
  if (lat === null || lon === null) throw new Error('Missing coordinates');
  return {
    time: sourceTime(raw.time), lat, lon,
    force: numeric(raw.power, 0, 25), wind: numeric(raw.speed, 0, 150),
    pressure: numeric(raw.pressure, 700, 1100), intensity: String(raw.strong || ''),
    moveSpeed: numeric(raw.movespeed, 0, 200), moveDirection: String(raw.movedirection || '').trim() || null
  };
}

export function normalizeStorm(raw, summary, now = new Date()) {
  if (!raw || String(raw.tfid) !== String(summary.tfid)) throw new Error('Storm ID mismatch');
  if (!Array.isArray(raw.points) || raw.points.length === 0) throw new Error('Missing observations');
  if (!['0', '1'].includes(String(raw.isactive))) throw new Error('Unknown activity flag');
  const sorted = [...raw.points].sort((a, b) => Date.parse(sourceTime(a.time)) - Date.parse(sourceTime(b.time)));
  const deduped = [...new Map(sorted.map((rawPoint) => { const item = point(rawPoint); return [item.time, {raw:rawPoint, item}]; })).values()];
  const latest = deduped.at(-1);
  if (Date.parse(latest.item.time) > now.getTime() + 15 * 60 * 1000) throw new Error('Observation time is in future');
  const forecasts = (latest.raw.forecast || []).map((forecast) => {
    if (!Array.isArray(forecast.forecastpoints)) throw new Error('Invalid forecast array');
    const times = forecast.forecastpoints.map((p) => p.ybsj).filter(Boolean).map(sourceTime);
    const issuedAt = times.length ? times.sort().at(-1) : null;
    if (issuedAt && Date.parse(issuedAt) > now.getTime() + 15 * 60 * 1000) throw new Error('Forecast issue time in future');
    const points = [...new Map(forecast.forecastpoints.map(point).filter((p) => Date.parse(p.time) > Date.parse(latest.item.time)).map((p) => [p.time, p])).values()].sort((a,b) => a.time.localeCompare(b.time));
    return { agency: String(forecast.tm || '来源未标明机构'), issuedAt, basedOn: latest.item.time, points };
  }).filter((forecast) => forecast.points.length);
  return {
    id: String(raw.tfid), name: String(raw.name || summary.name || '未命名'),
    english: String(raw.enname || summary.enname || ''), active: String(raw.isactive) === '1',
    sourceUrl: `${SOURCE.apiBase}/TyphoonInfo/${raw.tfid}`,
    referencePosition: String(latest.raw.ckposition || '').trim() || null,
    sourceConclusion: String(latest.raw.jl || '').trim() || null,
    latest: latest.item, track: deduped.map((entry) => entry.item), forecasts
    // raw.warnlevel is deliberately not mapped into a local public warning.
  };
}

export function validateList(list) {
  if (!Array.isArray(list)) throw new Error('Expected storm list array');
  for (const item of list) {
    if (!/^\d{6,8}$/.test(String(item.tfid)) || !['0','1'].includes(String(item.isactive))) throw new Error('Invalid storm list entry');
  }
  return list;
}
