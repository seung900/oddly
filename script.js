'use strict';
const KEY='seungu-archive-v1';
const $=selector=>document.querySelector(selector);
const editor=$('#editor'),form=$('#entry-form'),type=$('#type'),photo=$('#photo');
let entries=[];
let searchedCover='';
let selectedAlbumMeta=null;
try{const stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(stored))entries=stored;}catch(e){console.warn('저장 데이터 읽기 실패',e)}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(entries));if(window.archiveCloud)window.archiveCloud.queueSave();return true;}catch(e){alert('브라우저 저장 공간이 부족해요. 사진을 줄이거나 BACKUP으로 기록을 먼저 보관해주세요.');return false;}}
function switchType(){const t=type.value;$('#music-search-panel').hidden=t!=='music';['music','eats','moments'].forEach(x=>{$(`#${x}-fields`).hidden=x!==t});$('#rating-label').hidden=t==='moments';$('#form-title').textContent=({music:'Add an album.',eats:'Add a meal.',moments:'Keep a moment.'})[t];}
function openEditor(t='music'){searchedCover='';selectedAlbumMeta=null;$('#search-results').innerHTML='';$('#search-status').textContent='';form.reset();$('#visibility').value='public';$('#form-error').textContent='';$('#image-preview').innerHTML='';type.value=t;$('#rating-value').textContent='4.0 / 5';switchType();editor.showModal();}
$('#add').addEventListener('click',()=>openEditor('music'));
document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.add)));
$('#close').addEventListener('click',()=>editor.close());
editor.addEventListener('click',e=>{if(e.target===editor)editor.close()});
type.addEventListener('change',switchType);
$('#rating').addEventListener('input',e=>$('#rating-value').textContent=`${Number(e.target.value).toFixed(1)} / 5`);
photo.addEventListener('change',()=>{const f=photo.files[0];$('#image-preview').innerHTML='';if(f){const img=document.createElement('img');img.src=URL.createObjectURL(f);img.onload=()=>URL.revokeObjectURL(img.src);$('#image-preview').append(img);}});
function imageData(file){return new Promise((resolve,reject)=>{if(!file)return resolve('');if(!file.type.startsWith('image/'))return reject(new Error('이미지 파일을 선택해 주세요.'));if(file.size>10*1024*1024)return reject(new Error('사진은 10MB 이하로 선택해 주세요.'));const reader=new FileReader();reader.onerror=()=>reject(new Error('사진을 읽을 수 없어요.'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('이미지를 열 수 없어요.'));img.onload=()=>{const scale=Math.min(1,1100/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.75));};img.src=reader.result;};reader.readAsDataURL(file);});}
form.addEventListener('submit',async e=>{e.preventDefault();const data=new FormData(form),t=type.value;const album=String(data.get('album')||'').trim(),artist=String(data.get('artist')||'').trim(),food=String(data.get('food')||'').trim(),momentTitle=String(data.get('momentTitle')||'').trim();if(t==='music'&&(!album||!artist)){ $('#form-error').textContent='앨범명과 아티스트를 입력해 주세요.';return;}if(t==='eats'&&!food){$('#form-error').textContent='음식 이름을 입력해 주세요.';return;}if(t==='moments'&&!photo.files[0]&&!momentTitle){$('#form-error').textContent='사진이나 제목을 입력해 주세요.';return;}const saveBtn=$('.save');saveBtn.disabled=true;saveBtn.textContent='SAVING...';try{const image=photo.files[0]?await imageData(photo.files[0]):(t==='music'?searchedCover:'');const entry={id:uid(),type:t,albumMeta:t==='music'&&selectedAlbumMeta&&selectedAlbumMeta.title===album&&selectedAlbumMeta.artist===artist?selectedAlbumMeta:null,visibility:String(data.get('visibility'))==='public'?'public':'private',image,album,artist,food,restaurant:String(data.get('restaurant')||'').trim(),location:String(data.get('location')||'').trim(),momentTitle,format:String(data.get('format')||'DIGITAL'),rating:Number(data.get('rating')||4),comment:String(data.get('comment')||'').trim(),tracks:String(data.get('tracks')||'').split('\n').map(s=>s.trim()).filter(Boolean).map(name=>({name,liked:false})),created:Date.now()};entries.unshift(entry);if(!persist()){entries.shift();return;}editor.close();render();}catch(err){$('#form-error').textContent=err.message||'저장에 실패했어요.';}finally{saveBtn.disabled=false;saveBtn.textContent='SAVE TO ODDLY ↗';}});
function render(){for(const t of ['music','eats','moments']){const grid=$(`#${t}-grid`);grid.innerHTML='';const filtered=entries.filter(x=>x.type===t);if(!filtered.length){grid.innerHTML='<div class="empty">아직 기록이 없어요. 첫 번째 이야기를 남겨보세요 ↗</div>';continue;}for(const e of filtered){const card=document.createElement('article');card.className='entry';const title=t==='music'?e.album:t==='eats'?e.food:e.momentTitle||'Untitled moment';const subtitle=t==='music'?e.artist:t==='eats'?[e.restaurant,e.location].filter(Boolean).join(' · '):new Date(e.created||Date.now()).toLocaleDateString('ko-KR');const art=e.image?`<img src="${escapeHTML(e.image)}" alt="${escapeHTML(title)}">`:`<span class="placeholder">${t==='music'?'♪':t==='eats'?'✳':'◌'}</span>`;card.innerHTML=`<div class="art">${art}</div><h3>${escapeHTML(title)}</h3><div class="sub">${escapeHTML(subtitle)}</div>${t==='music'?`<span class="format">${escapeHTML(e.format||'DIGITAL')}</span>`:''}${t!=='moments'?`<div class="score">★ ${Number(e.rating||0).toFixed(1)} / 5</div>`:''}${e.comment?`<p class="comment">${escapeHTML(e.comment)}</p>`:''}<div class="privacy-row"><span>${e.visibility==='public'?'🌐 회원 공개':'🔒 비공개'}</span><button type="button" class="privacy-toggle">${e.visibility==='public'?'비공개로 변경':'공개로 변경'}</button></div>${t==='music'&&Array.isArray(e.tracks)&&e.tracks.length?`<div class="tracks">${e.tracks.map((track,i)=>`<div class="track"><span>${escapeHTML(track.name)}</span><button type="button" class="heart ${track.liked?'liked':''}" data-track="${i}" aria-label="${track.liked?'좋아요 취소':'좋아요'}" aria-pressed="${!!track.liked}">${track.liked?'♥':'♡'}</button></div>`).join('')}</div>`:''}<button class="edit-entry" type="button">EDIT RECORD ↗</button><button class="delete" type="button">DELETE ENTRY ×</button>`;attachArtworkPreview(card.querySelector('.art'),e);card.querySelector('.edit-entry').addEventListener('click',()=>openPersonalEdit(e));card.querySelector('.privacy-toggle').addEventListener('click',()=>{if(!window.archiveCloud?.isSignedIn()){alert('공개 설정을 변경하려면 먼저 로그인해 주세요.');return;}const old=e.visibility;e.visibility=old==='public'?'private':'public';if(!persist())e.visibility=old;render();});card.querySelector('.delete').addEventListener('click',()=>{if(confirm('이 기록을 삭제할까요?')){const old=entries;entries=entries.filter(x=>x.id!==e.id);if(!persist())entries=old;else if(window.archiveCloud)window.archiveCloud.removeEntry(e.id);render();}});card.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>{const track=e.tracks[Number(b.dataset.track)];track.liked=!track.liked;if(!persist())track.liked=!track.liked;render();}));grid.append(card);}}}

// Edit only personal notes. Preserve the record id, artwork, metadata, track list and likes.
const personalEditDialog=document.createElement('dialog');
personalEditDialog.id='personal-edit-dialog';
personalEditDialog.innerHTML=`<form id="personal-edit-form"><div class="modalhead"><span>EDIT YOUR RECORD</span><button type="button" id="personal-edit-close" aria-label="닫기">✕</button></div><h3 id="personal-edit-title">Your notes.</h3><label id="personal-edit-format-wrap">소장 형태<select name="format"><option value="DIGITAL">DIGITAL</option><option value="LP">LP</option><option value="CD">CD</option><option value="LP + CD">LP + CD</option></select></label><label id="personal-edit-rating-wrap">나의 평점 <span id="personal-edit-rating-value"></span><input name="rating" type="range" min="0.5" max="5" step="0.5"></label><label>나의 감상 / 후기<textarea name="comment" rows="5" maxlength="10000" placeholder="어떤 기억으로 남았나요?"></textarea></label><p id="personal-edit-error" role="alert"></p><button class="save" type="submit">SAVE CHANGES ↗</button></form>`;
document.body.append(personalEditDialog);
let personalEditingId=null;
const personalEditForm=personalEditDialog.querySelector('form');
personalEditDialog.querySelector('#personal-edit-close').addEventListener('click',()=>personalEditDialog.close());
personalEditDialog.addEventListener('close',()=>{personalEditingId=null;});
personalEditDialog.addEventListener('click',event=>{if(event.target===personalEditDialog)personalEditDialog.close();});
personalEditForm.elements.rating.addEventListener('input',()=>{personalEditDialog.querySelector('#personal-edit-rating-value').textContent=Number(personalEditForm.elements.rating.value).toFixed(1)+' / 5';});
function openPersonalEdit(entry){
 if(window.archiveCloud&&!window.archiveCloud.isSignedIn()){alert('수정하려면 로그인해 주세요.');return;}
 personalEditingId=entry.id;
 personalEditForm.reset();
 personalEditDialog.querySelector('#personal-edit-error').textContent='';
 personalEditDialog.querySelector('#personal-edit-title').textContent=entry.type==='music'?'Your album notes.':entry.type==='eats'?'Your food notes.':'Your moment notes.';
 personalEditDialog.querySelector('#personal-edit-format-wrap').hidden=entry.type!=='music';
 personalEditDialog.querySelector('#personal-edit-rating-wrap').hidden=entry.type==='moments';
 personalEditForm.elements.format.value=['LP','CD','LP + CD','DIGITAL'].includes(entry.format)?entry.format:'DIGITAL';
 personalEditForm.elements.rating.value=String(Math.max(.5,Math.min(5,Number(entry.rating)||4)));
 personalEditForm.elements.comment.value=entry.comment||'';
 personalEditDialog.querySelector('#personal-edit-rating-value').textContent=Number(personalEditForm.elements.rating.value).toFixed(1)+' / 5';
 personalEditDialog.showModal();
}
personalEditForm.addEventListener('submit',event=>{
 event.preventDefault();
 const entry=entries.find(item=>item.id===personalEditingId);
 if(!entry){personalEditDialog.querySelector('#personal-edit-error').textContent='기록을 찾을 수 없어요. 새로고침해 주세요.';return;}
 if(window.archiveCloud&&!window.archiveCloud.isSignedIn()){personalEditDialog.querySelector('#personal-edit-error').textContent='로그인 후 수정해 주세요.';return;}
 const previous={comment:entry.comment,rating:entry.rating,format:entry.format};
 entry.comment=personalEditForm.elements.comment.value.trim();
 if(entry.type!=='moments')entry.rating=Number(personalEditForm.elements.rating.value);
 if(entry.type==='music')entry.format=personalEditForm.elements.format.value;
 if(!persist()){Object.assign(entry,previous);return;}
 personalEditDialog.close();render();
});

$('#export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`seungu-archive-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#import').addEventListener('click',()=>$('#restore-file').click());
$('#restore-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const incoming=Array.isArray(parsed)?parsed:parsed.entries;if(!Array.isArray(incoming)||!incoming.every(x=>x&&['music','eats','moments'].includes(x.type)&&typeof x.id==='string'))throw Error('올바른 아카이브 백업 파일이 아니에요.');if(!confirm('현재 기록을 백업 파일의 기록으로 교체할까요?'))return;const old=entries;entries=incoming.map(x=>({...x,visibility:x.visibility==='public'?'public':'private'}));if(!persist()){entries=old;return;}render();alert('복원이 완료됐어요!');}catch(err){alert(err.message||'복원에 실패했어요.');}finally{e.target.value='';}});

// MusicBrainz: search release groups and load tracklists from a representative release.
const searchInput=$('#music-search'), searchButton=$('#search-album');
const mbFetch=async url=>{const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw Error('음악 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');return res.json();};
const artistName=g=>(g['artist-credit']||[]).map(a=>a.name||a.artist?.name||'').join('')||'Unknown artist';
const coverUrl=id=>`https://coverartarchive.org/release-group/${encodeURIComponent(id)}/front-250`;
async function runAlbumSearch(){
 const query=searchInput.value.trim(),status=$('#search-status'),results=$('#search-results');
 if(!query){status.textContent='앨범명이나 아티스트를 입력해 주세요.';return;}
 searchButton.disabled=true;status.textContent='앨범 검색 중...';results.innerHTML='';
 try{
  const data=await mbFetch(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=12`);
  const groups=(data['release-groups']||[]).filter(g=>g.title);
  if(!groups.length){status.textContent='검색 결과가 없어요. 앨범명과 아티스트를 함께 입력해 보세요.';return;}
  status.textContent='앨범을 선택하면 제목, 아티스트, 트랙 목록을 채워줘요.';
  for(const g of groups){
   const btn=document.createElement('button');btn.type='button';btn.className='search-result';
   const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=coverUrl(g.id);img.onerror=()=>{img.style.visibility='hidden';};
   const label=document.createElement('span');label.textContent=g.title;
   const sub=document.createElement('small');sub.textContent=`${artistName(g)} · ${g['first-release-date']||'발매일 미상'}`;label.append(sub);
   btn.append(img,label);btn.addEventListener('click',()=>selectAlbum(g));results.append(btn);
  }
 }catch(e){status.textContent=e.message||'검색에 실패했어요. 인터넷 연결을 확인해 주세요.';}
 finally{searchButton.disabled=false;}
}
async function selectAlbum(g){
 const status=$('#search-status');status.textContent='트랙 목록 불러오는 중...';
 form.elements.album.value=g.title;form.elements.artist.value=artistName(g);
 selectedAlbumMeta={id:g.id,title:g.title,artist:artistName(g),year:(g['first-release-date']||'').slice(0,4),description:g.disambiguation||''};
 searchedCover=''; 
 try{
  const releases=await mbFetch(`https://musicbrainz.org/ws/2/release/?release-group=${encodeURIComponent(g.id)}&fmt=json&limit=25`);
  const release=(releases.releases||[]).find(r=>r.status==='Official')||(releases.releases||[])[0];
  if(release){
   const detail=await mbFetch(`https://musicbrainz.org/ws/2/release/${encodeURIComponent(release.id)}?inc=recordings&fmt=json`);
   const tracks=(detail.media||[]).flatMap(m=>m.tracks||[]).map(t=>t.title).filter(Boolean);
   if(tracks.length)form.elements.tracks.value=tracks.map((t,i)=>`${String(i+1).padStart(2,'0')}. ${t}`).join('\n');
  }
  // Save cover from Cover Art Archive if cross-origin canvas access is allowed.
  try{
   const cover=coverUrl(g.id);
   const response=await fetch(cover);
   if(response.ok){
    const blob=await response.blob();
    const file=new File([blob],'cover.jpg',{type:blob.type||'image/jpeg'});
    searchedCover=await imageData(file);
    $('#image-preview').innerHTML='';
    const preview=document.createElement('img');preview.src=searchedCover;preview.alt='앨범 커버';$('#image-preview').append(preview);
   }
  }catch(e){console.info('커버 이미지는 자동 저장하지 못했어요. 사진을 직접 선택할 수 있습니다.',e);}
  status.textContent='앨범 정보를 채웠어요! 확인 후 저장하세요.';
 }catch(e){status.textContent='제목과 아티스트는 채웠어요. 트랙 목록은 직접 입력해 주세요.';}
}
searchButton.addEventListener('click',runAlbumSearch);
searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runAlbumSearch();}});

switchType();render();

// Artwork previews shared by personal records and DISCOVER. Never modify saved entries.
const artworkDialog=document.createElement('dialog');
artworkDialog.id='artwork-dialog';
artworkDialog.setAttribute('aria-label','기록 자세히 보기');
artworkDialog.innerHTML='<div class="artwork-dialog-head"><span id="artwork-dialog-label">ODDLY. / VIEW</span><button type="button" id="artwork-dialog-close" aria-label="닫기">✕</button></div><div id="artwork-dialog-body"></div>';
document.body.append(artworkDialog);
artworkDialog.querySelector('#artwork-dialog-close').addEventListener('click',()=>artworkDialog.close());
artworkDialog.addEventListener('click',ev=>{if(ev.target===artworkDialog)artworkDialog.close();});
let artworkRequest=0;
function attachArtworkPreview(art,entry){
 if(!art)return;
 const button=document.createElement('button');button.type='button';button.className='artwork-trigger';
 button.setAttribute('aria-label',entry.type==='music'?'앨범 상세 정보 보기':'사진 크게 보기');
 button.title=entry.type==='music'?'앨범 상세 정보':'원본 비율로 사진 보기';
 art.append(button);
 button.addEventListener('click',()=>openArtworkPreview(entry));
}
function addPreviewText(parent,tag,cls,value){if(!value)return;const el=document.createElement(tag);el.className=cls;el.textContent=value;parent.append(el);}
async function openArtworkPreview(entry){
 const request=++artworkRequest;
 const body=artworkDialog.querySelector('#artwork-dialog-body');body.replaceChildren();
 artworkDialog.querySelector('#artwork-dialog-label').textContent=entry.type==='music'?'ODDLY. / ALBUM DETAILS':'ODDLY. / PHOTO VIEW';
 // Open immediately: MusicBrainz requests can take time and must not block the dialog.
 if(!artworkDialog.open)artworkDialog.showModal();
 if(entry.image){const img=document.createElement('img');img.className='artwork-full';img.alt=entry.type==='music'?entry.album:(entry.type==='eats'?entry.food:entry.momentTitle)||'사진';img.src=entry.image;body.append(img);}
 else if(entry.type!=='music'){addPreviewText(body,'p','artwork-note','이 기록에는 사진이 없어요.');}
 if(entry.type==='moments')addPreviewText(body,'h3','artwork-photo-title',entry.momentTitle||'Untitled');
 if(entry.type==='eats')addPreviewText(body,'h3','artwork-photo-title',entry.food||'Untitled');
 if(entry.type==='moments'||entry.type==='eats'){
  const timestamp=Number(entry.created);
  if(Number.isFinite(timestamp)&&timestamp>0){
   const date=new Date(timestamp);
   if(!Number.isNaN(date.getTime()))addPreviewText(body,'p','artwork-photo-date',date.toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}));
  }
 }
 if(entry.type==='music'){
  addPreviewText(body,'h3','artwork-album-title',entry.album||'Untitled');
  addPreviewText(body,'p','artwork-album-artist',entry.artist||'');
  const meta=document.createElement('div');meta.className='artwork-metadata';body.append(meta);
  const cached=entry.albumMeta;
  if(cached?.year)addPreviewText(meta,'p','artwork-year',`RELEASED · ${cached.year}`);
  if(cached?.description)addPreviewText(meta,'p','artwork-description',cached.description);
  if(!cached?.year&&!cached?.description){
   const status=document.createElement('p');status.className='artwork-note';status.textContent='앨범 정보 확인 중…';meta.append(status);
   try{
    const q=`releasegroup:${JSON.stringify(entry.album||'')} AND artist:${JSON.stringify(entry.artist||'')}`;
    const data=await mbFetch(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=5`);
    if(request!==artworkRequest||!artworkDialog.open)return;
    status.remove();
    const match=(data['release-groups']||[]).find(g=>g.title?.toLowerCase()===(entry.album||'').toLowerCase()&&artistName(g).toLowerCase()===(entry.artist||'').toLowerCase());
    const year=(match?.['first-release-date']||'').slice(0,4);
    if(year)addPreviewText(meta,'p','artwork-year',`RELEASED · ${year}`);
    if(match?.disambiguation)addPreviewText(meta,'p','artwork-description',match.disambiguation);
   }catch(err){if(request===artworkRequest)status.remove();}
  }
 }
}
