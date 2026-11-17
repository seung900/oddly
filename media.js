'use strict';
(()=>{
const $=s=>document.querySelector(s),types=['music','eats','moments','movies','anime','series'],mediaTypes=['movies','anime','series'];
const editor=$('#media-editor'),form=$('#media-form');
const state={music:true,eats:true,moments:true,movies:true,anime:false,series:false};let itemsSettingsId=null;let items=[],selected=null,kind='movies',editId=null,seq=0;const posterAttempts=new Set();let refreshTimer=null;
const user=()=>typeof cloudUser!=='undefined'?cloudUser:null;
const safe=s=>String(s??'');
const node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=safe(txt);return n;};
function apply(){
 for(const t of types){
  $('#'+t).hidden=!state[t];document.querySelectorAll('[data-media-nav="'+t+'"]').forEach(n=>n.hidden=!state[t]);
  const toggle=$('[data-media-toggle="'+t+'"]');if(toggle)toggle.checked=state[t];
 }
}
async function refresh(){
 const u=user(),token=++seq;if(!u){items=[];itemsSettingsId=null;types.forEach(t=>state[t]=!['anime','series'].includes(t));apply();render();return;}
 try{
  const {data,error}=await cloudClient.from('archive_entries').select('id,entry_data').eq('user_id',u.id);
  if(error)throw error;if(token!==seq||user()?.id!==u.id)return;
  const rows=(data||[]).map(x=>x.entry_data).filter(Boolean);
  const pref=rows.find(x=>x.type==='media-settings');itemsSettingsId=pref?.id||null;
  for(const t of types)state[t]=['anime','series'].includes(t)?!!pref?.enabled?.[t]:pref?.enabled?.[t]!==false;
  items=rows.filter(x=>mediaTypes.includes(x.type));
  apply();render();
  // Do not block the gallery or retry missing posters on every tab visit.
  for(const entry of items.filter(x=>x.type==='movies'&&!x.poster&&!posterAttempts.has(x.id))){
   posterAttempts.add(entry.id);
   fillPoster(entry,true).catch(console.warn);
  }
 }catch(e){$('#media-settings-status').textContent='LOAD FAILED: '+e.message;}
}
async function saveSettings(){
 const u=user();if(!u){$('#media-settings-status').textContent='로그인이 필요해요.';return;}
 const existing=itemsSettingsId;
 const entry={id:existing||crypto.randomUUID(),type:'media-settings',enabled:{...state},visibility:'private'};
 const {error}=await cloudClient.from('archive_entries').upsert({id:entry.id,user_id:u.id,entry_data:entry},{onConflict:'id'});
 if(!error)itemsSettingsId=entry.id;
 $('#media-settings-status').textContent=error?'SAVE FAILED: '+error.message:'SAVED ✓';
}
document.querySelectorAll('[data-media-toggle]').forEach(n=>n.onchange=async()=>{if(!user()){n.checked=state[n.dataset.mediaToggle];return;}state[n.dataset.mediaToggle]=n.checked;apply();await saveSettings();});
function open(t,entry=null){
 if(!user()){alert('로그인이 필요해요.');return;}
 kind=t;selected=entry?{title:entry.title,year:entry.year,poster:entry.poster,externalId:entry.externalId,subtitle:entry.subtitle}:null;editId=entry?.id||null;
 form.reset();$('#media-editor-label').textContent='ODDLY. / '+t.toUpperCase();
 $('#media-search').value=entry?.title||'';$('#media-rating').value=entry?.rating||4;
 $('#media-rating-value').textContent=Number($('#media-rating').value).toFixed(1)+' / 5';
 $('#media-comment').value=entry?.comment||'';$('#media-watch-status').value=entry?.watchStatus||'completed';
 $('#media-visibility').value=entry?.visibility||'public';
 $('#media-poster-upload').value='';$('#media-search-results').replaceChildren();$('#media-search-status').textContent='';$('#media-form-status').textContent='';
 showSelected();editor.showModal();
 if(t==='movies'&&selected&&!selected.poster){const original=selected;findMoviePoster(selected.title,selected.year).then(poster=>{if(poster&&selected===original){selected={...selected,poster};showSelected();}}).catch(console.warn);}
}
document.querySelectorAll('[data-media-add]').forEach(n=>n.onclick=()=>open(n.dataset.mediaAdd));
$('#media-close').onclick=()=>editor.close();
$('#media-rating').oninput=()=>$('#media-rating-value').textContent=Number($('#media-rating').value).toFixed(1)+' / 5';
async function findMoviePoster(title,year=''){
 const query=title.trim();if(!query)return '';
 const jobs=['KR','US'].map(async country=>{
  const url='https://itunes.apple.com/search?'+new URLSearchParams({term:query,media:'movie',entity:'movie',limit:'40',country});
  const response=await fetch(url);if(!response.ok)return [];
  const data=await response.json();return (data.results||[]).filter(x=>x.trackName&&x.artworkUrl100);
 });
 const normalize=v=>safe(v).toLocaleLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
 const results=(await Promise.allSettled(jobs)).filter(x=>x.status==='fulfilled').flatMap(x=>x.value);
 const exact=results.filter(x=>normalize(x.trackName)===normalize(query));
 const match=exact.find(x=>!year||x.releaseDate?.startsWith(String(year)))||exact[0];
 if(match)return match.artworkUrl100.replace(/100x100(?:bb)?/,'600x600bb');
 for(const lang of (/[가-힣]/.test(query)?['ko','en']:['en','ko'])){
  try{
   const params=new URLSearchParams({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:query+' '+(lang==='ko'?'영화':'film'),gsrnamespace:'0',gsrlimit:'10',prop:'pageimages|categories|description',piprop:'thumbnail',pithumbsize:'600',cllimit:'15',origin:'*'});
   const res=await fetch('https://'+lang+'.wikipedia.org/w/api.php?'+params);if(!res.ok)continue;
   const data=await res.json();
   const pages=(data.query?.pages||[]).filter(p=>/영화|film|movie|cinema/i.test([p.description,...(p.categories||[]).map(c=>c.title)].join(' ')));
   const page=pages.find(p=>normalize(p.title.replace(/\s*\([^)]*\)$/,''))===normalize(query)&&p.thumbnail?.source);
   if(page)return page.thumbnail.source;
  }catch(e){console.warn('Poster lookup:',e);}
 }
 return '';
}
async function fillPoster(entry,persist=false){
 if(entry.poster||entry.type!=='movies')return;
 const poster=await findMoviePoster(entry.title,entry.year);
 if(!poster||entry.poster)return;
 entry.poster=poster;
 if(persist&&user()){
  const u=user();const {error}=await cloudClient.from('archive_entries').upsert({id:entry.id,user_id:u.id,entry_data:entry},{onConflict:'id'});
  if(error)console.warn('Could not save movie poster:',error);
 }
 render();
}
function showSelected(){
 const box=$('#media-selected');box.replaceChildren();box.hidden=!selected;if(!selected)return;
 const row=node('div','media-result');if(selected.poster){const img=node('img');img.src=selected.poster;img.alt='';row.append(img);}
 const label=node('span','',selected.title+' ('+(selected.year||'—')+')');row.append(label);box.append(row);
}
async function posterFromFile(file){
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  const scale=Math.min(1,720/img.naturalWidth,1000/img.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.76);
 }finally{URL.revokeObjectURL(url);}
}
$('#media-poster-upload').addEventListener('change',async()=>{
 const file=$('#media-poster-upload').files?.[0];if(!file||!selected)return;
 try{selected={...selected,poster:await posterFromFile(file)};showSelected();$('#media-form-status').textContent='포스터가 준비됐어요 ✓';}
 catch(e){$('#media-form-status').textContent='이미지를 읽지 못했어요: '+e.message;}
});
const strip=s=>safe(s).replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').trim();
async function search(){
 const q=$('#media-search').value.trim();if(!q)return;
 const status=$('#media-search-status'),results=$('#media-search-results');results.replaceChildren();status.textContent='SEARCHING...';
 try{
  let found=[];
  if(kind==='movies'){
   // Korean and international catalogs plus Korean/English Wikipedia fallback.
   // Filter out unrelated search matches and rank exact titles first.
   const normalize=v=>safe(v).toLocaleLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
   const target=normalize(q);
   const score=v=>{const n=normalize(v);if(!n)return 0;if(n===target)return 100;if(n.startsWith(target))return 80;if(n.includes(target))return 60;if(target.includes(n)&&n.length>2)return 35;return 0;};
   const catalogs=['KR','US'];
   const jobs=catalogs.map(async country=>{
    const url='https://itunes.apple.com/search?'+new URLSearchParams({term:q,media:'movie',entity:'movie',limit:'50',country});
    const response=await fetch(url);if(!response.ok)throw Error('iTunes '+country+' HTTP '+response.status);
    const data=await response.json();
    return (data.results||[]).filter(x=>x.trackName).map(x=>({
     title:x.trackName,year:x.releaseDate?.slice(0,4)||'',
     poster:x.artworkUrl100?.replace(/100x100(?:bb)?/,'600x600bb')||'',
     externalId:'itunes-'+x.trackId,subtitle:x.primaryGenreName||'',source:'iTunes '+country
    }));
   });
   // Wikipedia pages are a fallback for titles not carried by iTunes.
   for(const lang of (/[가-힣]/.test(q)?['ko']:['en'])){
    jobs.push((async()=>{
     const params=new URLSearchParams({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:q+' 영화',gsrnamespace:'0',gsrlimit:'15',prop:'pageimages|categories|description',piprop:'thumbnail',pithumbsize:'450',cllimit:'20',origin:'*'});
     const response=await fetch('https://'+lang+'.wikipedia.org/w/api.php?'+params);
     if(!response.ok)throw Error('Wikipedia HTTP '+response.status);
     const data=await response.json();
     return (data.query?.pages||[]).filter(x=>{
      const label=[x.description,...(x.categories||[]).map(c=>c.title)].join(' ').toLowerCase();
      return /영화|film|movie|cinema/.test(label)&&!/영화 감독|film director|영화 배우/.test(label);
     }).map(x=>({
      title:x.title.replace(/\s*\((영화|film|\d{4}년 영화|\d{4} film)\)$/i,''),
      year:(x.title.match(/(?:19|20)\d{2}/)||[])[0]||'',
      poster:x.thumbnail?.source||'',externalId:'wikipedia-'+lang+'-'+x.pageid,
      subtitle:x.description||'Wikipedia',source:'Wikipedia'
     }));
    })());
   }
   const outcomes=await Promise.allSettled(jobs);
   const merged=outcomes.filter(x=>x.status==='fulfilled').flatMap(x=>x.value);
   if(!merged.length&&outcomes.every(x=>x.status==='rejected'))status.textContent='검색 서비스 연결 실패. 제목을 직접 등록할 수 있어요.';
   const seen=new Set();
   found=merged.map(x=>({...x,rank:score(x.title)})).filter(x=>x.rank>0)
    .sort((a,b)=>b.rank-a.rank||(!!b.poster)-(!!a.poster))
    .filter(x=>{const key=normalize(x.title)+'-'+x.year;if(seen.has(key))return false;seen.add(key);return true;})
    .slice(0,30);
   if(!found.length)status.textContent='일치하는 영화가 없어요. 원제나 영어 제목으로도 검색해 보세요.';
  }else if(kind==='anime'){
   const res=await fetch('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(q)+'&limit=15&sfw=true');if(!res.ok)throw Error('Anime search temporarily unavailable');
   const data=await res.json();found=(data.data||[]).map(x=>({title:x.title,year:x.year||x.aired?.from?.slice(0,4)||'',poster:x.images?.jpg?.large_image_url||'',externalId:'mal-'+x.mal_id,subtitle:(x.episodes||'?')+' EPISODES'}));
  }else{
   const res=await fetch('https://api.tvmaze.com/search/shows?q='+encodeURIComponent(q));if(!res.ok)throw Error('Series search failed');
   const data=await res.json();found=data.slice(0,20).map(x=>({title:x.show.name,year:x.show.premiered?.slice(0,4)||'',poster:x.show.image?.medium||'',externalId:'tvmaze-'+x.show.id,subtitle:strip(x.show.genres?.join(', ')||'')}));
  }
  status.textContent=found.length?found.length+' RESULTS':'검색 결과가 없어요. 아래에서 직접 등록할 수 있어요.';
  if(kind==='movies'){
   const manual=node('button','media-result','+ "'+q+'" 직접 등록하기 (포스터 없이)');manual.type='button';manual.onclick=()=>{selected={title:q,year:'',poster:'',externalId:'manual-'+Date.now(),subtitle:'MANUAL'};showSelected();results.replaceChildren();status.textContent='제목이 선택됐어요. 아래에서 저장하세요.';};results.append(manual);
  }
  for(const item of found){const btn=node('button','media-result');btn.type='button';if(item.poster){const img=node('img');img.src=item.poster;img.alt='';btn.append(img);}btn.append(node('span','',item.title+' · '+(item.year||'—')+' '+item.subtitle));btn.onclick=()=>{selected=item;showSelected();results.replaceChildren();status.textContent='SELECTED ✓';if(kind==='movies'&&!item.poster){findMoviePoster(item.title,item.year).then(poster=>{if(poster&&selected===item){selected={...item,poster};showSelected();}}).catch(console.warn);}};results.append(btn);}
 }catch(e){status.textContent='SEARCH FAILED: '+e.message+' · 제목을 직접 등록할 수 있어요.';if(kind==='movies'){const manual=node('button','media-result','+ "'+q+'" 직접 등록하기');manual.type='button';manual.onclick=()=>{selected={title:q,year:'',poster:'',externalId:'manual-'+Date.now(),subtitle:'MANUAL'};showSelected();results.replaceChildren();status.textContent='제목 선택 완료';};results.append(manual);}}
}
$('#media-search-btn').onclick=search;
$('#media-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
form.onsubmit=async e=>{
 e.preventDefault();if(!selected){$('#media-form-status').textContent='검색 결과에서 작품을 선택해 주세요.';return;}
 const u=user();if(!u)return;const btn=$('#media-save');btn.disabled=true;$('#media-form-status').textContent='SAVING...';
 const previous=items.find(x=>x.id===editId);
 if(kind==='movies'&&!selected.poster){$('#media-form-status').textContent='포스터 검색 중…';try{const poster=await findMoviePoster(selected.title,selected.year);if(poster)selected={...selected,poster};}catch(e){console.warn(e);}}
 const entry={id:editId||crypto.randomUUID(),type:kind,...selected,rating:Number($('#media-rating').value),watchStatus:$('#media-watch-status').value,comment:$('#media-comment').value.trim(),visibility:$('#media-visibility').value,created:previous?.created||Date.now()};
 try{
  const {error}=await cloudClient.from('archive_entries').upsert({id:entry.id,user_id:u.id,entry_data:entry},{onConflict:'id'});if(error)throw error;
  items=items.filter(x=>x.id!==entry.id);items.unshift(entry);state[kind]=true;apply();render();editor.close();
  await saveSettings();
 }catch(err){$('#media-form-status').textContent='SAVE FAILED: '+err.message;}finally{btn.disabled=false;}
};
function render(){
 for(const t of mediaTypes){const grid=$('#'+t+'-grid');grid.replaceChildren();
  const subset=items.filter(x=>x.type===t).sort((a,b)=>(b.created||0)-(a.created||0));
  if(!subset.length){grid.append(node('p','media-empty','아직 등록된 작품이 없어요.'));continue;}
  for(const x of subset){
   const card=node('article','media-card');
   if(x.poster){const img=node('img','media-poster');img.src=x.poster;img.alt=x.title+' poster';img.loading='lazy';img.decoding='async';img.onerror=()=>{img.replaceWith(node('div','media-poster media-poster-empty','NO POSTER'));};card.append(img);}else card.append(node('div','media-poster media-poster-empty','NO POSTER'));
   card.append(node('h3','',x.title));card.append(node('small','',x.year+' · '+x.watchStatus.toUpperCase()));
   card.append(node('p','media-score','★ '+Number(x.rating||0).toFixed(1)+' / 5'));
   if(x.comment)card.append(node('p','media-comment',x.comment));
   const actions=node('div','media-actions'),edit=node('button','','EDIT ↗'),del=node('button','','DELETE ×');
   edit.onclick=()=>open(t,x);del.onclick=async()=>{if(!confirm('이 기록을 삭제할까요?'))return;const u=user();if(!u)return;del.disabled=true;const {error}=await cloudClient.from('archive_entries').delete().eq('id',x.id).eq('user_id',u.id);if(error){alert(error.message);del.disabled=false;return;}items=items.filter(a=>a.id!==x.id);render();};
   actions.append(edit,del);card.append(actions);grid.append(card);
  }
 }
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,250);}
cloudClient?.auth.onAuthStateChange((event)=>{if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED')scheduleRefresh();});
setTimeout(()=>{if(user())scheduleRefresh();},650);
apply();render();
})();