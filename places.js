'use strict';
(()=>{
const $=s=>document.querySelector(s);
const map=$('#places-map'),status=$('#places-map-status'),list=$('#places-records'),dialog=$('#places-dialog'),form=$('#places-form');
const regions={world:[],korea:[]};let mode='world',records=[],selected=null,owner=null,seq=0;
const clean=s=>String(s??'');
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=clean(txt);return n;};
function setStatus(s){status.textContent=s;}
function currentUser(){return typeof cloudUser!=='undefined'?cloudUser:null;}
function paintCounts(){const places=new Set(records.map(r=>r.placeKey));$('#places-count').textContent=places.size+' PLACES';$('#places-memories').textContent=records.length+' MEMORIES';}
async function loadRecords(){
 const user=currentUser();const token=++seq;owner=user?.id||null;
 if(!user){records=[];paintCounts();renderList();drawMap();return;}
 const {data,error}=await cloudClient.from('archive_entries').select('id,entry_data').eq('user_id',user.id);
 if(token!==seq||currentUser()?.id!==user.id)return;
 if(error){setStatus('기록을 불러오지 못했어요: '+error.message);return;}
 records=(data||[]).map(r=>r.entry_data).filter(r=>r?.type==='places'&&r.placeKey&&r.mapType);
 paintCounts();renderList();drawMap();
}
async function getShapes(type){
 if(regions[type].length)return regions[type];
 if(type==='world'){
  const response=await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  if(!response.ok)throw Error('세계지도 다운로드 실패');
  const topology=await response.json();
  regions.world=topojson.feature(topology,topology.objects.countries).features.map(f=>({key:String(f.id),name:f.properties?.name||String(f.id),feature:f}));
 }else{
  // Prefer a static TopoJSON asset: no third-party metadata API or cross-domain redirects.
  let geo=null,failures=[];
  const sources=[
   'https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/gadm/json/skorea-provinces-topo.json',
   'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/gadm/json/skorea-provinces-topo.json'
  ];
  for(const url of sources){
   try{
    const response=await fetch(url);
    if(!response.ok)throw Error('HTTP '+response.status);
    const topology=await response.json();
    const object=Object.values(topology.objects||{})[0];
    if(!object)throw Error('지도의 행정구역 데이터가 없어요.');
    geo=topojson.feature(topology,object);break;
   }catch(e){failures.push(e.message);}
  }
  if(!geo){
   for(const endpoint of ['https://geoboundaries-dev.org/api/current/gbOpen/KOR/ADM1/','https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM1/']){
    try{
     const info=await fetch(endpoint);if(!info.ok)throw Error('HTTP '+info.status);
     const meta=await info.json();const url=meta.simplifiedGeometryGeoJSON||meta.gjDownloadURL;
     if(!url)throw Error('지도 주소 누락');
     const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
     geo=await response.json();if(!Array.isArray(geo.features))throw Error('지도 형식 오류');break;
    }catch(e){failures.push(e.message);}
   }
  }
  if(!geo)throw Error('국내 지도 제공 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  regions.korea=geo.features.map((f,i)=>({key:clean(f.properties?.shapeID||f.properties?.shapeName||f.properties?.NAME_1||f.properties?.name||i),name:clean(f.properties?.shapeName||f.properties?.NAME_1||f.properties?.name||f.properties?.name_eng||'Region '+(i+1)),feature:f}));
 }
 return regions[type];
}
function populateRegions(){
 const select=$('#places-region');select.replaceChildren();
 for(const r of regions[$('#places-region-type').value]){const o=el('option','',r.name);o.value=r.key;select.append(o);}
 if(selected?.mapType===$('#places-region-type').value)select.value=selected.placeKey;
}
async function showDialog(preset){
 if(!currentUser()){setStatus('장소를 저장하려면 로그인해 주세요.');return;}
 form.reset();selected=preset||null;
 $('#places-region-type').value=preset?.mapType||mode;
 try{await getShapes($('#places-region-type').value);}catch(e){setStatus(e.message);return;}
 populateRegions();
 $('#places-dialog-title').textContent='ADD A PLACE.';
 $('#places-date').value=new Date().toLocaleDateString('en-CA');
 $('#places-form-status').textContent='';
 dialog.showModal();
}
async function drawMap(){
 const type=mode;map.replaceChildren(el('p','places-loading','LOADING MAP...'));
 try{
  const shapes=await getShapes(type);if(type!==mode)return;
  map.replaceChildren();
  const svg=d3.select(map).append('svg').attr('viewBox','0 0 980 530').attr('role','img').attr('aria-label',type==='world'?'세계 국가별 방문 지도':'대한민국 시도별 방문 지도');
  const collection={type:'FeatureCollection',features:shapes.map(r=>r.feature)};
  const projection=(type==='world'?d3.geoNaturalEarth1():d3.geoMercator()).fitExtent([[25,25],[955,505]],collection);
  const path=d3.geoPath(projection);
  const visited=new Set(records.filter(r=>r.mapType===type).map(r=>r.placeKey));
  svg.selectAll('path').data(shapes).enter().append('path')
   .attr('d',r=>path(r.feature)).attr('class',r=>'places-region'+(visited.has(r.key)?' visited':''))
   .attr('tabindex',0).attr('role','button').attr('aria-label',r=>r.name+(visited.has(r.key)?' 방문 기록 있음':''))
   .on('click',(_,r)=>choose(r)).on('keydown',(event,r)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(r);}})
   .append('title').text(r=>r.name);
  setStatus(type==='world'?'국가를 선택해 기록을 확인하거나 추가하세요.':'시·도 지역을 선택해 기록을 확인하거나 추가하세요.');
 }catch(e){map.replaceChildren(el('p','places-error','지도를 불러오지 못했어요. 네트워크 연결을 확인해 주세요.'));setStatus(e.message);}
}
function choose(r){selected={mapType:mode,placeKey:r.key,placeName:r.name};renderList();list.scrollIntoView({behavior:'smooth',block:'nearest'});}
function renderList(){
 list.replaceChildren();
 const title=el('div','places-list-head');
 title.append(el('h3','',selected?.placeName||'TRAVEL JOURNAL'));
 const add=el('button','textbutton','+ ADD MEMORY ↗');add.type='button';add.addEventListener('click',()=>showDialog(selected));title.append(add);list.append(title);
 const visible=selected?records.filter(r=>r.mapType===selected.mapType&&r.placeKey===selected.placeKey):records.filter(r=>r.mapType===mode);
 if(!visible.length){list.append(el('p','places-empty',selected?'아직 이 지역의 기록이 없어요. 첫 추억을 남겨보세요.':'방문한 장소를 지도에 기록해 보세요.'));return;}
 const grid=el('div','places-gallery');list.append(grid);
 for(const r of visible.sort((a,b)=>(b.created||0)-(a.created||0))){
  const card=el('article','places-card');
  if(r.image){const img=el('img');img.src=r.image;img.alt=r.title||r.placeName;img.loading='lazy';card.append(img);}
  card.append(el('small','',r.placeName+' / '+(r.kind||'moment').toUpperCase()));
  card.append(el('h4','',r.title));
  if(r.date)card.append(el('time','',r.date));
  if(r.comment)card.append(el('p','',r.comment));
  const actions=el('div','places-actions');
  if(r.image){const open=el('button','','VIEW PHOTO ↗');open.type='button';open.addEventListener('click',()=>{const w=window.open('','_blank');if(w){w.document.title=r.title;const image=w.document.createElement('img');image.src=r.image;image.style.cssText='max-width:100%;height:auto;display:block;margin:auto';w.document.body.style.background='#111';w.document.body.append(image);}});actions.append(open);}
  const del=el('button','','DELETE ×');del.type='button';del.addEventListener('click',async()=>{if(!confirm('이 장소 기록을 삭제할까요?'))return;const user=currentUser();if(!user)return;del.disabled=true;const {error}=await cloudClient.from('archive_entries').delete().eq('id',r.id).eq('user_id',user.id);if(error){alert(error.message);del.disabled=false;return;}records=records.filter(x=>x.id!==r.id);paintCounts();renderList();drawMap();});actions.append(del);
  card.append(actions);grid.append(card);
 }
}
$('#places-add').addEventListener('click',()=>showDialog(null));
$('#places-close').addEventListener('click',()=>dialog.close());
$('#places-region-type').addEventListener('change',async()=>{const type=$('#places-region-type').value;try{await getShapes(type);populateRegions();}catch(e){$('#places-form-status').textContent=e.message;}});
document.querySelectorAll('[data-places-map]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.placesMap;selected=null;document.querySelectorAll('[data-places-map]').forEach(x=>x.classList.toggle('active',x===b));drawMap();renderList();}));
form.addEventListener('submit',async event=>{
 event.preventDefault();const user=currentUser();if(!user){$('#places-form-status').textContent='로그인이 필요해요.';return;}
 const type=$('#places-region-type').value,key=$('#places-region').value,r=regions[type].find(x=>x.key===key);
 if(!r){$('#places-form-status').textContent='지역을 선택해 주세요.';return;}
 const btn=$('#places-submit');btn.disabled=true;$('#places-form-status').textContent='SAVING...';
 try{
  const file=$('#places-photo').files[0];const image=file?await imageData(file):'';
  const entry={id:crypto.randomUUID(),type:'places',mapType:type,placeKey:key,placeName:r.name,kind:$('#places-kind').value,title:$('#places-title').value.trim(),date:$('#places-date').value,comment:$('#places-comment').value.trim(),image,visibility:$('#places-public').checked?'public':'private',created:Date.now()};
  if(!entry.title)throw Error('제목을 입력해 주세요.');
  const {error}=await cloudClient.from('archive_entries').upsert({id:entry.id,user_id:user.id,entry_data:entry},{onConflict:'id'});
  if(error)throw error;
  records.unshift(entry);mode=type;selected={mapType:type,placeKey:key,placeName:r.name};
  document.querySelectorAll('[data-places-map]').forEach(x=>x.classList.toggle('active',x.dataset.placesMap===type));
  paintCounts();renderList();drawMap();dialog.close();
 }catch(e){$('#places-form-status').textContent='SAVE FAILED: '+e.message;}finally{btn.disabled=false;}
});
cloudClient?.auth.onAuthStateChange(()=>setTimeout(loadRecords,100));
setTimeout(loadRecords,300);
drawMap();
})();