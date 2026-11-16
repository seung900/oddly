'use strict';
(()=>{
const $=s=>document.querySelector(s),types=['movies','anime','series'];
const settings=$('#media-settings-dialog'),editor=$('#media-editor'),form=$('#media-form');
const state={movies:false,anime:false,series:false};let items=[],selected=null,kind='movies',editId=null,seq=0;
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
 const u=user(),token=++seq;items=[];types.forEach(t=>state[t]=false);apply();if(!u){render();return;}
 try{
  const {data,error}=await cloudClient.from('archive_entries').select('id,entry_data').eq('user_id',u.id);
  if(error)throw error;if(token!==seq||user()?.id!==u.id)return;
  const rows=(data||[]).map(x=>x.entry_data).filter(Boolean);
  const pref=rows.find(x=>x.id==='media-settings-'+u.id);
  for(const t of types)state[t]=!!pref?.enabled?.[t];
  items=rows.filter(x=>types.includes(x.type));
  apply();render();
 }catch(e){$('#media-settings-status').textContent='LOAD FAILED: '+e.message;}
}
async function saveSettings(){
 const u=user();if(!u){$('#media-settings-status').textContent='로그인이 필요해요.';return;}
 const entry={id:'media-settings-'+u.id,type:'media-settings',enabled:{...state},visibility:'private'};
 const {error}=await cloudClient.from('archive_entries').upsert({id:entry.id,user_id:u.id,entry_data:entry},{onConflict:'id'});
 $('#media-settings-status').textContent=error?'SAVE FAILED: '+error.message:'SAVED ✓';
}
$('#media-settings-open').onclick=()=>{if(!user()){alert('로그인 후 섹션을 설정할 수 있어요.');return;}settings.showModal();};
$('#media-settings-close').onclick=()=>settings.close();
document.querySelectorAll('[data-media-toggle]').forEach(n=>n.onchange=async()=>{state[n.dataset.mediaToggle]=n.checked;apply();await saveSettings();});
function open(t,entry=null){
 if(!user()){alert('로그인이 필요해요.');return;}
 kind=t;selected=entry?{title:entry.title,year:entry.year,poster:entry.poster,externalId:entry.externalId,subtitle:entry.subtitle}:null;editId=entry?.id||null;
 form.reset();$('#media-editor-label').textContent='ODDLY. / '+t.toUpperCase();
 $('#media-search').value=entry?.title||'';$('#media-rating').value=entry?.rating||4;
 $('#media-rating-value').textContent=Number($('#media-rating').value).toFixed(1)+' / 5';
 $('#media-comment').value=entry?.comment||'';$('#media-watch-status').value=entry?.watchStatus||'completed';
 $('#media-visibility').value=entry?.visibility||'public';
 $('#media-search-results').replaceChildren();$('#media-search-status').textContent='';$('#media-form-status').textContent='';
 showSelected();editor.showModal();
}
document.querySelectorAll('[data-media-add]').forEach(n=>n.onclick=()=>open(n.dataset.mediaAdd));
$('#media-close').onclick=()=>editor.close();
$('#media-rating').oninput=()=>$('#media-rating-value').textContent=Number($('#media-rating').value).toFixed(1)+' / 5';
function showSelected(){
 const box=$('#media-selected');box.replaceChildren();box.hidden=!selected;if(!selected)return;
 const row=node('div','media-result');if(selected.poster){const img=node('img');img.src=selected.poster;img.alt='';row.append(img);}
 const label=node('span','',selected.title+' ('+(selected.year||'—')+')');row.append(label);box.append(row);
}
const strip=s=>safe(s).replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').trim();
async function search(){
 const q=$('#media-search').value.trim();if(!q)return;
 const status=$('#media-search-status'),results=$('#media-search-results');results.replaceChildren();status.textContent='SEARCHING...';
 try{
  let found=[];
  if(kind==='movies'){
   const res=await fetch('https://itunes.apple.com/search?term='+encodeURIComponent(q)+'&entity=movie&limit=20&country=US');if(!res.ok)throw Error('iTunes search failed');
   const data=await res.json();found=(data.results||[]).map(x=>({title:x.trackName,year:x.releaseDate?.slice(0,4)||'',poster:x.artworkUrl100?.replace('100x100bb','600x600bb')||'',externalId:'itunes-'+x.trackId,subtitle:x.primaryGenreName||''}));
  }else if(kind==='anime'){
   const res=await fetch('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(q)+'&limit=15&sfw=true');if(!res.ok)throw Error('Anime search temporarily unavailable');
   const data=await res.json();found=(data.data||[]).map(x=>({title:x.title,year:x.year||x.aired?.from?.slice(0,4)||'',poster:x.images?.jpg?.large_image_url||'',externalId:'mal-'+x.mal_id,subtitle:(x.episodes||'?')+' EPISODES'}));
  }else{
   const res=await fetch('https://api.tvmaze.com/search/shows?q='+encodeURIComponent(q));if(!res.ok)throw Error('Series search failed');
   const data=await res.json();found=data.slice(0,20).map(x=>({title:x.show.name,year:x.show.premiered?.slice(0,4)||'',poster:x.show.image?.medium||'',externalId:'tvmaze-'+x.show.id,subtitle:strip(x.show.genres?.join(', ')||'')}));
  }
  status.textContent=found.length?found.length+' RESULTS':'검색 결과가 없어요.';
  for(const item of found){const btn=node('button','media-result');btn.type='button';if(item.poster){const img=node('img');img.src=item.poster;img.alt='';btn.append(img);}btn.append(node('span','',item.title+' · '+(item.year||'—')+' '+item.subtitle));btn.onclick=()=>{selected=item;showSelected();results.replaceChildren();status.textContent='SELECTED ✓';};results.append(btn);}
 }catch(e){status.textContent='SEARCH FAILED: '+e.message;}
}
$('#media-search-btn').onclick=search;
$('#media-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
form.onsubmit=async e=>{
 e.preventDefault();if(!selected){$('#media-form-status').textContent='검색 결과에서 작품을 선택해 주세요.';return;}
 const u=user();if(!u)return;const btn=$('#media-save');btn.disabled=true;$('#media-form-status').textContent='SAVING...';
 const previous=items.find(x=>x.id===editId);
 const entry={id:editId||crypto.randomUUID(),type:kind,...selected,rating:Number($('#media-rating').value),watchStatus:$('#media-watch-status').value,comment:$('#media-comment').value.trim(),visibility:$('#media-visibility').value,created:previous?.created||Date.now()};
 try{
  const {error}=await cloudClient.from('archive_entries').upsert({id:entry.id,user_id:u.id,entry_data:entry},{onConflict:'id'});if(error)throw error;
  items=items.filter(x=>x.id!==entry.id);items.unshift(entry);render();editor.close();
 }catch(err){$('#media-form-status').textContent='SAVE FAILED: '+err.message;}finally{btn.disabled=false;}
};
function render(){
 for(const t of types){const grid=$('#'+t+'-grid');grid.replaceChildren();
  const subset=items.filter(x=>x.type===t).sort((a,b)=>(b.created||0)-(a.created||0));
  if(!subset.length){grid.append(node('p','media-empty','아직 등록된 작품이 없어요.'));continue;}
  for(const x of subset){
   const card=node('article','media-card');
   if(x.poster){const img=node('img','media-poster');img.src=x.poster;img.alt=x.title+' poster';img.loading='lazy';card.append(img);}
   card.append(node('h3','',x.title));card.append(node('small','',x.year+' · '+x.watchStatus.toUpperCase()));
   card.append(node('p','media-score','★ '+Number(x.rating||0).toFixed(1)+' / 5'));
   if(x.comment)card.append(node('p','media-comment',x.comment));
   const actions=node('div','media-actions'),edit=node('button','','EDIT ↗'),del=node('button','','DELETE ×');
   edit.onclick=()=>open(t,x);del.onclick=async()=>{if(!confirm('이 기록을 삭제할까요?'))return;const u=user();if(!u)return;del.disabled=true;const {error}=await cloudClient.from('archive_entries').delete().eq('id',x.id).eq('user_id',u.id);if(error){alert(error.message);del.disabled=false;return;}items=items.filter(a=>a.id!==x.id);render();};
   actions.append(edit,del);card.append(actions);grid.append(card);
  }
 }
}
cloudClient?.auth.onAuthStateChange(()=>setTimeout(refresh,100));
setTimeout(refresh,400);
apply();render();
})();