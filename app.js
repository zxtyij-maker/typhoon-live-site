'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let data = window.TYPHOON_DATA;
  let refreshing = false;
  let toastTimer;
  let networkError = false;
  const state = {stormId:null,agency:null,selected:null,forecast:true};
  const fullDate = new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  const shortDate = new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  const fmt = (time, full=false) => time && Number.isFinite(Date.parse(time)) ? (full?fullDate:shortDate).format(new Date(time)) : '来源未提供';
  const number = (value, unit='') => value === null || value === undefined ? '未提供' : `${value}${unit}`;
  const coords = point => `${Math.abs(point.lat).toFixed(1)}°${point.lat>=0?'N':'S'} / ${Math.abs(point.lon).toFixed(1)}°${point.lon>=0?'E':'W'}`;
  const label = point => point.type==='forecast'?'预报有效时间':point.type==='current'?'最新观测':'历史实况';
  const storm = () => data?.storms.find(item=>item.id===state.stormId);
  const forecast = () => storm()?.forecasts.find(item=>item.agency===state.agency);
  function node(tag, attrs={}, text) {const element=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>element.setAttribute(k,v));if(text!==undefined)element.textContent=text;return element;}
  function notify(text) {clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4000);}
  function validSnapshot(snapshot) {return snapshot?.schemaVersion===1 && ['ok','error'].includes(snapshot.status) && Array.isArray(snapshot.storms) && snapshot.storms.every(item=>/^\d{6,8}$/.test(item.id)&&item.latest&&Array.isArray(item.track)&&Array.isArray(item.forecasts));}

  function status() {
    const age=data?.lastSuccessfulFetchAt ? Date.now()-Date.parse(data.lastSuccessfulFetchAt) : Infinity;
    const failed=!data||data.status!=='ok'||networkError;
    const delayed=age>45*60000;
    $('data-banner').classList.toggle('is-delayed',failed||delayed);
    $('header-dot').classList.toggle('is-stale',failed||delayed);
    $('header-state').textContent=failed?'更新状态异常':delayed?'抓取已延迟':'真实数据快照';
    $('data-state').textContent=failed?'更新暂不可用，请核对数据时间':delayed?'数据抓取已超过 45 分钟':'已接入浙江官方公开台风数据';
    $('data-state-note').textContent=failed?(data?.error||'暂未读取到更新；页面保留最后成功记录。'):delayed?'下方可能是旧记录，请查看官方最新发布。':'每 15 分钟计划更新 · 本站非官方发布系统';
    $('fetched-time').textContent=fmt(data?.lastSuccessfulFetchAt,true);
    const current=storm();
    if(current) {
      const observationOld=Date.now()-Date.parse(current.latest.time)>6*60*60000;
      $('record-status').classList.toggle('record-delayed',observationOld||failed||delayed);
      $('record-status').textContent=`观测时间：${fmt(current.latest.time,true)}（北京时间）${observationOld?' · 观测记录已超过 6 小时，请核对来源更新。':(failed||delayed)?' · 更新异常，以下为最后成功记录。':' · 原始观测时间与网站抓取时间分别展示。'}`;
    }
  }
  function points() {
    const current=storm();if(!current)return [];
    const result=current.track.map((point,index)=>({...point,type:index===current.track.length-1?'current':'history'}));
    if(state.forecast&&forecast()) result.push(...forecast().points.map(point=>({...point,type:'forecast'})));
    return result;
  }
  function selectPoint(index) {
    const list=points(); const point=list[index]; if(!point)return;
    state.selected=index;$('point-type').textContent=label(point);$('point-time').textContent=fmt(point.time,true);$('point-location').textContent=coords(point);$('point-wind').textContent=`${number(point.force,'级')} · ${number(point.wind,' m/s')}`;
    document.querySelectorAll('.track-point').forEach((element,i)=>{element.setAttribute('aria-pressed',String(i===index));element.querySelector('.selection-ring').setAttribute('opacity',i===index?'1':'0');});
  }
  function renderMap() {
    const list=points(),grid=$('coordinate-grid'),layer=$('track-drawing');grid.replaceChildren();layer.replaceChildren();$('track-table').replaceChildren();
    if(!list.length){layer.append(node('text',{x:500,y:290,'text-anchor':'middle',class:'empty-map-text'},data?.status==='ok'?'来源当前无活跃台风':'台风数据暂不可用'));return;}
    // Coordinates are plotted directly; there is no invented coastline or wind radius.
    const all=[...storm().track,...(forecast()?.points||[])];
    let minLon=Math.min(...all.map(p=>p.lon)),maxLon=Math.max(...all.map(p=>p.lon)),minLat=Math.min(...all.map(p=>p.lat)),maxLat=Math.max(...all.map(p=>p.lat));
    const spanLon=Math.max(4,maxLon-minLon),spanLat=Math.max(4,maxLat-minLat);minLon-=spanLon*.12;maxLon+=spanLon*.12;minLat-=spanLat*.18;maxLat+=spanLat*.18;
    if(maxLon-minLon<4){const mid=(maxLon+minLon)/2;minLon=mid-2;maxLon=mid+2;}
    if(maxLat-minLat<4){const mid=(maxLat+minLat)/2;minLat=mid-2;maxLat=mid+2;}
    const project=point=>[65+(point.lon-minLon)/(maxLon-minLon)*870,500-(point.lat-minLat)/(maxLat-minLat)*440];
    for(let i=0;i<=5;i++){
      const x=65+i*174,y=60+i*88;
      grid.append(node('line',{x1:x,y1:60,x2:x,y2:500,stroke:'#bed3d9','stroke-dasharray':'3 5'}));grid.append(node('text',{x,y:525,'text-anchor':'middle',class:'axis-label'},`${(minLon+(maxLon-minLon)*i/5).toFixed(1)}°`));
      grid.append(node('line',{x1:65,y1:y,x2:935,y2:y,stroke:'#bed3d9','stroke-dasharray':'3 5'}));grid.append(node('text',{x:55,y:y+4,'text-anchor':'end',class:'axis-label'},`${(maxLat-(maxLat-minLat)*i/5).toFixed(1)}°`));
    }
    grid.append(node('text',{x:935,y:550,'text-anchor':'end',class:'axis-label'},'经度 → / 纬度 ↑'));
    for(const [type,color] of [['history','#388a8b'],['forecast','#d2944b']]) {
      const path=type==='history'?list.filter(p=>p.type!=='forecast'):list.filter(p=>p.type!=='history');if(type==='forecast'&&!state.forecast)continue;
      layer.append(node('polyline',{points:path.map(p=>project(p).join(',')).join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round',...(type==='forecast'?{'stroke-dasharray':'8 7'}:{})}));
    }
    list.forEach((point,index)=>{
      const [x,y]=project(point),isCurrent=point.type==='current',color=point.type==='forecast'||isCurrent?'#d2944b':'#388a8b';
      const group=node('g',{class:'track-point',role:'button',tabindex:0,'aria-label':`${label(point)}，${fmt(point.time,true)} 北京时间，${coords(point)}，${number(point.force,'级')}`,'aria-pressed':'false'});
      group.append(node('circle',{cx:x,cy:y,r:20,class:'point-hit'}));group.append(node('circle',{cx:x,cy:y,r:isCurrent?21:12,class:'selection-ring',fill:'none',stroke:color,'stroke-width':2,opacity:0}));group.append(node('circle',{cx:x,cy:y,r:isCurrent?8:4.5,class:'point-dot',fill:isCurrent?color:'#fff',stroke:color,'stroke-width':2}));
      if(isCurrent){group.append(node('rect',{x:x-48,y:y-46,width:96,height:26,rx:4,fill:'#235b61','pointer-events':'none'}));group.append(node('text',{x,y:y-28,'text-anchor':'middle',class:'current-label','pointer-events':'none'},`${storm().name} · 最新`));}
      group.addEventListener('click',()=>selectPoint(index));group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectPoint(index);}});layer.append(group);
      const tr=document.createElement('tr');for(const text of [label(point),fmt(point.time,true),coords(point),`${number(point.force,'级')} · ${number(point.wind,' m/s')}`]){const td=document.createElement('td');td.textContent=text;tr.append(td);}$('track-table').append(tr);
    });
    if(state.selected===null||state.selected>=list.length)state.selected=storm().track.length-1;selectPoint(state.selected);
  }
  function renderStorm() {
    const current=storm();
    if(!current){
      for(const id of ['storm-name','storm-coordinates','storm-direction','storm-speed','storm-force','storm-wind','storm-pressure'])$(id).textContent='—';
      $('storm-intensity').textContent=data?.status==='ok'?'当前无活跃台风':'数据暂不可用';$('storm-english').textContent='';$('storm-number').textContent='';
      $('record-status').textContent=data?.status==='ok'?'官方列表当前未返回活跃台风。此状态不等于没有恶劣天气或地区预警。':'无法确认当前活跃台风，请前往官方系统查询。';
      $('source-position').textContent='当前没有可展示的台风记录。';$('source-conclusion').textContent='';$('forecast-agency').replaceChildren(new Option('暂无预报',''));$('forecast-issued').textContent='';$('show-forecast').disabled=true;renderMap();status();return;
    }
    const latest=current.latest;
    $('storm-name').textContent=current.name;$('storm-english').textContent=current.english;$('storm-number').textContent=current.id;$('storm-intensity').textContent=latest.intensity||'来源未提供';$('storm-coordinates').textContent=coords(latest);$('position-note').textContent='最新中心位置 · 经纬度';
    $('storm-direction').textContent=latest.moveDirection||'来源未提供';$('storm-speed').textContent=number(latest.moveSpeed,' km/h');$('storm-force').textContent=number(latest.force);$('storm-wind').textContent=number(latest.wind,' m/s');$('storm-pressure').textContent=number(latest.pressure,' hPa');
    if(!current.forecasts.some(f=>f.agency===state.agency))state.agency=(current.forecasts.find(f=>f.agency==='中国')||current.forecasts[0])?.agency||null;
    $('forecast-agency').replaceChildren(...current.forecasts.map(f=>new Option(f.agency,f.agency)));if(!current.forecasts.length)$('forecast-agency').append(new Option('来源未提供预报',''));
    $('forecast-agency').disabled=!current.forecasts.length;$('show-forecast').disabled=!current.forecasts.length;if(state.agency)$('forecast-agency').value=state.agency;
    $('forecast-issued').textContent=forecast()?`发布时间：${fmt(forecast().issuedAt,true)}（北京时间）`:'来源未提供后续预报';
    $('source-position').textContent=current.referencePosition||'来源未提供参考位置说明。';$('source-conclusion').textContent=current.sourceConclusion||'来源未提供文字趋势结论。';$('source-record').href=current.sourceUrl;
    document.querySelectorAll('[data-storm]').forEach(button=>{const active=button.dataset.storm===current.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});renderMap();status();
  }
  function render() {
    if(!validSnapshot(data))data=undefined;const storms=data?.storms||[];
    if(!storms.some(item=>item.id===state.stormId)){state.stormId=storms[0]?.id||null;state.selected=null;state.agency=null;}
    $('storm-selector').replaceChildren(...storms.map(item=>{const button=document.createElement('button');button.className='storm-tab';button.dataset.storm=item.id;button.textContent=`${item.name} · ${item.id}`;button.addEventListener('click',()=>{state.stormId=item.id;state.selected=null;state.agency=null;renderStorm();});return button;}));
    $('storm-count').textContent=data?.status==='ok'?`${storms.length} 个活跃台风 · 来源列表状态`:'数据更新异常 · 活跃状态待确认';renderStorm();
  }
  async function refresh(manual=false) {
    if(refreshing)return;refreshing=true;$('refresh-data').disabled=true;
    try {
      const response=await fetch(`data/live.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Snapshot unavailable');const snapshot=await response.json();if(!validSnapshot(snapshot))throw new Error('Invalid snapshot');
      data=snapshot;networkError=false;render();if(manual)notify('已检查网站快照；官方抓取时间见页面上方。');
    }catch{networkError=true;status();if(manual)notify('暂时无法读取新快照，已保留当前记录。');}
    finally{refreshing=false;$('refresh-data').disabled=false;}
  }
  $('refresh-data').addEventListener('click',()=>refresh(true));$('show-forecast').addEventListener('change',event=>{state.forecast=event.target.checked;state.selected=null;renderMap();});$('forecast-agency').addEventListener('change',event=>{state.agency=event.target.value;state.selected=null;renderStorm();});
  $('about-data').addEventListener('click',()=>{
    const paragraphs=[
      '本站是独立的信息展示网页，非浙江省水利厅或气象部门官方网站。台风实况和机构预报取自浙江省台风路径实时发布系统的公开数据入口。',
      `最近成功抓取：${fmt(data?.lastSuccessfulFetchAt,true)}（北京时间）。最近一次抓取尝试：${fmt(data?.fetchedAt,true)}（北京时间）。`,
      'GitHub Actions 计划每 15 分钟执行一次。平台调度可能延迟；每次执行会重建静态快照并发布。网页每分钟检查一次已发布快照，按钮不会直接请求官方接口。',
      '观测时间、预报发布时间和抓取时间含义不同。抓取记录超过 45 分钟，或观测记录超过 6 小时时会提示核对更新；阈值用于提示时效，不代表官方发布周期。',
      '经纬度图按公开位置绘制，无地理底图；不代表风圈、影响范围或登陆确定性。不同机构预报分别显示，风速和强度保留来源口径。',
      '地区预警暂未接入；数据接口的 warnlevel 字段未被作为地区预警。抓取失败会明确标记，绝不回退到演示数据。真实防御安排请以当地气象台及政府发布为准。'
    ];$('dialog-body').replaceChildren(...paragraphs.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));$('detail-dialog').showModal();
  });
  for(const id of ['close-dialog','confirm-dialog'])$(id).addEventListener('click',()=>$('detail-dialog').close());
  render();if(!data)refresh();setInterval(()=>{status();if(!document.hidden)refresh();},60000);
})();
