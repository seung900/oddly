 'use strict';
const CLOUD_URL='https://gdxczepnytobckajugay.supabase.co';
const CLOUD_KEY='sb_publishable_VZTrdf-ugJNarK8dDhyhjQ_sidI9okx';
const cloudClient=window.supabase?.createClient(CLOUD_URL,CLOUD_KEY);
const cloudStatus=document.querySelector('#auth-status');
const cloudDialog=document.querySelector('#auth-dialog');
const cloudButton=document.querySelector('#auth-open');
const ownerKey='seungu-archive-cloud-owner';
let cloudUser=null,cloudBusy=false,cloudTimer=null,cloudLastSave=Promise.resolve(),cloudGeneration=0;
function cloudMessage(msg){cloudStatus.textContent=msg;}
function cloudLocalSave(){try{localStorage.setItem(KEY,JSON.stringify(entries));}catch(e){console.warn('Local cache unavailable; cloud records remain accessible:',e);}render();}
function cloudUi(){
 document.querySelector('#auth-logged-out').hidden=!!cloudUser;
 document.querySelector('#auth-logged-in').hidden=!cloudUser;
 document.querySelector('#auth-user').textContent=cloudUser?`로그인: ${cloudUser.email}`:'';
 document.querySelector('#profile-open').hidden=!cloudUser;
 cloudButton.textContent=cloudUser?'☁ SYNC ON':'LOGIN / SYNC';
 render();
 document.querySelector('#discover-status').textContent='SEARCH MEMBERS';
}
async function cloudPull(first=false){
 if(!cloudUser||cloudBusy)return;
 cloudBusy=true;
 const userId=cloudUser.id,generation=cloudGeneration;
 try{
  await cloudLastSave;
  const {data,error}=await cloudClient.from('archive_entries').select('id,entry_data').eq('user_id',userId);
  if(error)throw error;
  if(generation!==cloudGeneration||cloudUser?.id!==userId)return;
  const remote=(data||[]).map(x=>x.entry_data).filter(x=>x&&typeof x.id==='string');
  const owner=localStorage.getItem(ownerKey);
  // Only import legacy local records if they have no associated account AND the user approves.
  let localOnly=[];
  if(first&&!owner&&entries.length&&confirm(`이 브라우저의 기존 기록 ${entries.length}개를 현재 계정으로 가져올까요?\n다른 사람의 기록이라면 취소하세요.`)){
   localOnly=entries.filter(e=>!remote.some(r=>r.id===e.id)).map(e=>({...e,visibility:'private'}));
   if(localOnly.length){const {error:upErr}=await cloudClient.from('archive_entries').upsert(localOnly.map(e=>({id:e.id,user_id:userId,entry_data:e})),{onConflict:'id'});if(upErr)throw upErr;}
  }
  if(generation!==cloudGeneration||cloudUser?.id!==userId)return;
  entries=[...remote,...localOnly].map(e=>({...e,visibility:e.visibility==='public'?'public':'private'})).sort((a,b)=>(b.created||0)-(a.created||0));
  try{localStorage.setItem(ownerKey,userId);}catch(e){console.warn('Owner cache unavailable:',e);}cloudLocalSave();
  cloudMessage(`동기화 완료! ${entries.length}개 기록.${localOnly.length?' 기존 기록 '+localOnly.length+'개 가져옴.':''}`);
 }catch(e){cloudMessage('동기화 실패: '+(e.message||e));}
 finally{cloudBusy=false;}
}
function cloudQueueSave(){
 if(!cloudUser)return;
 clearTimeout(cloudTimer);
 const userId=cloudUser.id,generation=cloudGeneration;
 cloudTimer=setTimeout(()=>{
  const snapshot=entries.map(e=>({...e,visibility:e.visibility==='public'?'public':'private'}));
  cloudLastSave=cloudLastSave.catch(()=>{}).then(async()=>{
   if(!cloudUser||cloudUser.id!==userId||generation!==cloudGeneration||!snapshot.length)return;
   const {error}=await cloudClient.from('archive_entries').upsert(snapshot.map(e=>({id:e.id,user_id:userId,entry_data:e})),{onConflict:'id'});
   if(error)throw error;cloudMessage('클라우드에 저장됐어요 ✓');
  }).catch(e=>cloudMessage('클라우드 저장 실패: '+(e.message||e)+'\nBACKUP으로 기록을 보관해 주세요.'));
 },350);
}
function cloudRemoveEntry(id){
 if(!cloudUser)return;
 const userId=cloudUser.id;
 cloudLastSave=cloudLastSave.catch(()=>{}).then(async()=>{
  if(cloudUser?.id!==userId)return;
  const {error}=await cloudClient.from('archive_entries').delete().eq('id',id).eq('user_id',userId);
  if(error)throw error;
 }).catch(e=>cloudMessage('클라우드 삭제 실패: '+(e.message||e)));
}
window.archiveCloud={queueSave:cloudQueueSave,removeEntry:cloudRemoveEntry,isSignedIn:()=>!!cloudUser};
cloudButton.addEventListener('click',()=>cloudDialog.showModal());
document.querySelector('#auth-close').addEventListener('click',()=>cloudDialog.close());
async function cloudAuth(action){
 if(!cloudClient){cloudMessage('Supabase 라이브러리를 불러오지 못했어요.');return;}
 const email=document.querySelector('#auth-email').value.trim(),password=document.querySelector('#auth-password').value;
 if(!email||password.length<6){cloudMessage('이메일과 6자 이상의 비밀번호를 입력해 주세요.');return;}
 cloudMessage('처리 중...');
 try{
  const result=action==='signup'?await cloudClient.auth.signUp({email,password,options:{emailRedirectTo:'https://seung900.github.io/oddly/'}}):await cloudClient.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  cloudMessage(action==='signup'&&!result.data.session?'가입 확인 이메일을 보냈어요. 인증 링크를 누른 뒤 로그인해 주세요.':'로그인 성공! 동기화를 시작할게요.');if(result.data.session&&cloudDialog.open)cloudDialog.close();
 }catch(e){cloudMessage('로그인/가입 실패: '+(e.message||e));}
}
document.querySelector('#auth-sign-in').addEventListener('click',()=>cloudAuth('login'));
document.querySelector('#auth-sign-up').addEventListener('click',()=>cloudAuth('signup'));
document.querySelector('#auth-sync-now').addEventListener('click',async()=>{const button=document.querySelector('#auth-sync-now');if(button.disabled)return;button.disabled=true;button.textContent='SYNCING...';try{await cloudLastSave;await cloudPull();if(cloudDialog.open)cloudDialog.close();}catch(e){cloudMessage('동기화 실패: '+(e.message||e));}finally{button.disabled=false;button.textContent='SYNC NOW ↗';}});
document.querySelector('#auth-sign-out').addEventListener('click',async()=>{
 if(!cloudClient)return;clearTimeout(cloudTimer);await cloudLastSave;
 const {error}=await cloudClient.auth.signOut();if(error){cloudMessage(error.message);return;}
 cloudUser=null;cloudGeneration++;entries=[];cloudLocalSave();cloudUi();clearDiscovery();loadFriends();loadOwnCustom();cloudMessage('로그아웃했어요. 클라우드 기록은 유지돼요.');
});
function clearDiscovery(){document.body.classList.remove('viewing-friend-archive');document.querySelector('#people-list').innerHTML='';document.querySelector('#people-list').hidden=false;for(const type of ['music','eats','moments'])document.querySelector(`#friend-${type}-grid`).replaceChildren();document.querySelector('#public-profile').hidden=true;}
function profileText(id,value){document.querySelector(id).textContent=value;}
const profileDialog=document.querySelector('#profile-dialog');
let currentAvatarUrl=null;
const CUSTOM_DEFAULT={theme:'white',font:'sans',layout:'shelf'};
const CUSTOM_VALUES={theme:['white','black','gray'],font:['sans','serif','mono'],layout:['shelf','grid']};
function normalizeCustom(data){const out={};for(const k of Object.keys(CUSTOM_DEFAULT))out[k]=CUSTOM_VALUES[k].includes(data?.[k])?data[k]:CUSTOM_DEFAULT[k];return out;}
function applyCustom(target,settings){if(!target)return;const c=normalizeCustom(settings);target.dataset.customTheme=c.theme;target.dataset.customFont=c.font;target.dataset.customLayout=c.layout;}
async function loadOwnCustom(){if(!cloudUser){applyCustom(document.body,CUSTOM_DEFAULT);return;}const id=cloudUser.id;const {data,error}=await cloudClient.from('archive_profiles').select('archive_theme,archive_font,archive_layout').eq('id',id).maybeSingle();if(error){console.warn('Custom settings unavailable:',error.message);return;}if(cloudUser?.id===id)applyCustom(document.body,{theme:data?.archive_theme,font:data?.archive_font,layout:data?.archive_layout});}

function avatarNode(url,large=false){const box=document.createElement('span');box.className='profile-avatar'+(large?' profile-avatar-large':'');if(typeof url==='string'&&url.startsWith(CLOUD_URL+'/storage/v1/object/public/oddly-avatars/')){const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';box.append(img);}else{box.textContent='◌';}return box;}
function showAvatar(target,url){target.replaceChildren(avatarNode(url,true));}

document.querySelector('#profile-open').addEventListener('click',async()=>{
 if(!cloudUser)return;profileDialog.showModal();profileText('#profile-status','불러오는 중...');
 const {data,error}=await cloudClient.from('archive_profiles').select('display_name,bio,avatar_url,handle,archive_theme,archive_font,archive_layout').eq('id',cloudUser.id).maybeSingle();
 if(error){profileText('#profile-status',error.message+' — 먼저 SQL 설정을 완료해 주세요.');return;}
 document.querySelector('#profile-name').value=data?.display_name||'';document.querySelector('#profile-handle').value=data?.handle||'';
 document.querySelector('#profile-bio').value=data?.bio||'';const custom=normalizeCustom({theme:data?.archive_theme,font:data?.archive_font,layout:data?.archive_layout});for(const k of Object.keys(custom))document.querySelector('#custom-'+k).value=custom[k];currentAvatarUrl=data?.avatar_url||null;document.querySelector('#profile-avatar-file').value='';showAvatar(document.querySelector('#profile-avatar-preview'),currentAvatarUrl);profileText('#profile-status','');
});
document.querySelector('#profile-close').addEventListener('click',()=>profileDialog.close());
document.querySelector('#profile-avatar-file').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>2*1024*1024){profileText('#profile-status','JPG, PNG, WEBP / MAX 2MB');e.target.value='';return;}const url=URL.createObjectURL(f);const preview=document.querySelector('#profile-avatar-preview');preview.replaceChildren();const img=document.createElement('img');img.src=url;img.alt='';img.onload=()=>URL.revokeObjectURL(url);preview.append(img);profileText('#profile-status','');});
document.querySelector('#profile-avatar-remove').addEventListener('click',()=>{currentAvatarUrl=null;document.querySelector('#profile-avatar-file').value='';showAvatar(document.querySelector('#profile-avatar-preview'),null);profileText('#profile-status','SAVE PROFILE to apply');});
document.querySelector('#profile-save').addEventListener('click',async()=>{
 if(!cloudUser)return;const name=document.querySelector('#profile-name').value.trim(),bio=document.querySelector('#profile-bio').value.trim();
 if(!name){profileText('#profile-status','닉네임을 입력해 주세요.');return;}const handle=document.querySelector('#profile-handle').value.trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,19}$/.test(handle)){profileText('#profile-status','USER ID는 영문 소문자로 시작하는 3~20자의 영문 소문자, 숫자, _만 가능해요.');return;}
 const file=document.querySelector('#profile-avatar-file').files?.[0];let avatarUrl=currentAvatarUrl;const custom=normalizeCustom(Object.fromEntries(Object.keys(CUSTOM_DEFAULT).map(k=>[k,document.querySelector('#custom-'+k).value])));
 if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){profileText('#profile-status','JPG, PNG, WEBP / MAX 2MB');return;}
  profileText('#profile-status','UPLOADING...');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=`${cloudUser.id}/avatar-${Date.now()}.${ext}`;
  const upload=await cloudClient.storage.from('oddly-avatars').upload(path,file,{contentType:file.type,upsert:false});if(upload.error){profileText('#profile-status','UPLOAD FAILED: '+upload.error.message);return;}
  avatarUrl=cloudClient.storage.from('oddly-avatars').getPublicUrl(path).data.publicUrl;
 }
 const {error}=await cloudClient.from('archive_profiles').upsert({id:cloudUser.id,display_name:name,handle,bio,avatar_url:avatarUrl,archive_theme:custom.theme,archive_font:custom.font,archive_layout:custom.layout},{onConflict:'id'});
 const duplicateHandle=error&&(error.code==='23505'||/archive_profiles_handle_unique|duplicate key|already exists/i.test(error.message||''));profileText('#profile-status',error?(duplicateHandle?'이미 사용 중인 USER ID예요. 다른 아이디를 입력해 주세요.':'SAVE FAILED: '+error.message):'PROFILE SAVED');if(!error){applyCustom(document.body,custom);currentAvatarUrl=avatarUrl;document.querySelector('#profile-avatar-file').value='';}
});
// Community likes are stored separately from personal track hearts.
// Only signed-in members can like entries shared publicly.
async function loadCommunityLikes(entryIds){
 const result=new Map(entryIds.map(id=>[String(id),{count:0,mine:false}]));
 if(!cloudUser||!entryIds.length)return result;
 const {data,error}=await cloudClient.from('archive_likes').select('entry_id,user_id').in('entry_id',entryIds.map(String));
 if(error)throw error;
 for(const like of data||[]){const info=result.get(like.entry_id);if(info){info.count++;if(like.user_id===cloudUser.id)info.mine=true;}}
 return result;
}
function makeCommunityLikeButton(entryId,info){
 const btn=document.createElement('button');btn.type='button';btn.className='community-like';
 function paint(){btn.textContent=`${info.mine?'♥':'♡'} ${info.count}`;btn.classList.toggle('is-liked',info.mine);btn.setAttribute('aria-pressed',String(info.mine));btn.setAttribute('aria-label',info.mine?'좋아요 취소':'좋아요');}
 paint();
 btn.addEventListener('click',async()=>{
  if(!cloudUser)return;
  const userId=cloudUser.id,wasLiked=info.mine;
  btn.disabled=true;
  try{
   const query=cloudClient.from('archive_likes');
   const {error}=wasLiked
    ?await query.delete().eq('entry_id',String(entryId)).eq('user_id',userId)
    :await query.insert({entry_id:String(entryId),user_id:userId});
   if(error)throw error;
   info.mine=!wasLiked;info.count=Math.max(0,info.count+(wasLiked?-1:1));paint();
  }catch(err){alert('좋아요 저장 실패: '+(err.message||err));}
  finally{btn.disabled=false;}
 });
 return btn;
}
const peopleList=document.querySelector('#people-list');
let discoverRequest=0;
async function loadPeople(){
 const request=++discoverRequest;
 clearDiscovery();peopleList.hidden=false;
 const raw=document.querySelector('#discover-query').value.trim().replace(/^@/,'');
 if(raw.length<2){profileText('#discover-status','닉네임이나 @아이디를 2글자 이상 입력해 주세요.');return;}
 const query=raw.replace(/[%_,()]/g,'').slice(0,40);
 if(query.length<2){profileText('#discover-status','검색어를 확인해 주세요.');return;}
 profileText('#discover-status','SEARCHING...');
 const {data,error}=await cloudClient.from('archive_profiles').select('id,display_name,handle,bio,avatar_url').or(`display_name.ilike.%${query}%,handle.ilike.%${query}%`).limit(30);
 if(request!==discoverRequest)return;
 if(error){profileText('#discover-status','검색 실패: '+error.message+' (USER ID SQL 설정을 확인해 주세요.)');return;}
 profileText('#discover-status',data?.length?`${data.length} RESULTS`:'검색 결과가 없어요.');
 for(const person of data||[]){
  const b=document.createElement('button');b.className='person-card';b.type='button';
  const name=document.createElement('strong');name.textContent=person.display_name||'Member';
  const handle=document.createElement('small');handle.textContent=person.handle?'@'+person.handle:'';
  const bio=document.createElement('small');bio.textContent=person.bio||'';
  b.append(avatarNode(person.avatar_url),name,handle,bio);
  b.addEventListener('click',()=>openPerson(person));peopleList.append(b);
 }
}
document.querySelector('#discover-search').addEventListener('click',loadPeople);
document.querySelector('#discover-query').addEventListener('keydown',e=>{if(e.key==='Enter')loadPeople();});
async function openPerson(person){
 document.body.classList.add('viewing-friend-archive');peopleList.hidden=true;document.querySelector('#public-profile').hidden=false;applyCustom(document.querySelector('#public-profile'),CUSTOM_DEFAULT);
 showAvatar(document.querySelector('#public-profile-avatar'),person.avatar_url);profileText('#public-profile-title',person.display_name);profileText('#public-profile-bio',person.bio||'');
 profileText('#discover-status','LOADING...');
 const profileId=person.id;
 const customization=await cloudClient.from('archive_profiles').select('archive_theme,archive_font,archive_layout').eq('id',profileId).maybeSingle();
 if(!document.body.classList.contains('viewing-friend-archive'))return;
 if(!customization.error)applyCustom(document.querySelector('#public-profile'),{theme:customization.data?.archive_theme,font:customization.data?.archive_font,layout:customization.data?.archive_layout});
 const grids=Object.fromEntries(['music','eats','moments'].map(t=>[t,document.querySelector(`#friend-${t}-grid`)]));
 for(const grid of Object.values(grids))grid.replaceChildren();
 const {data,error}=await cloudClient.from('archive_entries').select('entry_data').eq('user_id',person.id).eq('entry_data->>visibility','public').order('created_at',{ascending:false}).limit(100);
 if(error){profileText('#discover-status','ERROR: '+error.message);return;}
 profileText('#discover-status',`${data?.length||0} RECORDS`);
 let likeMap=new Map();
 if(data?.length){try{likeMap=await loadCommunityLikes(data.map(r=>r.entry_data?.id).filter(id=>typeof id==='string'));}catch(err){console.warn('Likes unavailable',err);}}
 const counts={music:0,eats:0,moments:0};
 for(const row of data||[]){const e=row.entry_data;if(!e||!grids[e.type])continue;counts[e.type]++;
  const card=document.createElement('article');card.className='entry';const art=document.createElement('div');art.className='art';
  if(typeof e.image==='string'&&(e.image.startsWith('data:image/')||e.image.startsWith('https://'))){const img=document.createElement('img');img.src=e.image;img.alt='';art.append(img);}else{const mark=document.createElement('span');mark.className='placeholder';mark.textContent=e.type==='music'?'♪':'◌';art.append(mark);}
  card.append(art);if(typeof attachArtworkPreview==='function')attachArtworkPreview(art,e);
  const title=document.createElement('h3');title.textContent=e.type==='music'?e.album:e.type==='eats'?e.food:e.momentTitle||'';card.append(title);
  const sub=document.createElement('div');sub.className='sub';sub.textContent=e.type==='music'?e.artist:e.type==='eats'?[e.restaurant,e.location].filter(Boolean).join(' · '):new Date(e.created||Date.now()).toLocaleDateString('ko-KR');card.append(sub);
  if(e.type==='music'){const format=document.createElement('span');format.className='format';format.textContent=e.format||'DIGITAL';card.append(format);}
  if(e.type!=='moments'){const score=document.createElement('div');score.className='score';score.textContent=`★ ${Number(e.rating||0).toFixed(1)} / 5`;card.append(score);}
  if(e.comment){const comment=document.createElement('p');comment.className='comment';comment.textContent=e.comment;card.append(comment);}
  if(e.type==='music'&&Array.isArray(e.tracks)&&e.tracks.length){const tracks=document.createElement('div');tracks.className='tracks';for(const t of e.tracks){const line=document.createElement('div');line.className='track';const name=document.createElement('span');name.textContent=String(t.name||'');const heart=document.createElement('span');heart.className='heart'+(t.liked?' liked':'');heart.textContent=t.liked?'♥':'♡';line.append(name,heart);tracks.append(line);}card.append(tracks);}
  if(typeof e.id==='string')card.append(makeCommunityLikeButton(e.id,likeMap.get(e.id)||{count:0,mine:false}));
  grids[e.type].append(card);
 }
 for(const type of Object.keys(grids)){if(!counts[type]){const empty=document.createElement('p');empty.className='friend-empty';empty.textContent='NO RECORDS';grids[type].append(empty);}}
 for(const type of ['eats','moments'])setupFriendArchivePages(grids[type]);
}
function setupFriendArchivePages(grid){
 const cards=[...grid.querySelectorAll(':scope > .entry')];
 grid.parentElement.querySelector('.friend-archive-pager')?.remove();
 if(cards.length<=8)return;
 const mobile=()=>typeof useSwipeArchive==='function'?useSwipeArchive():window.matchMedia('(max-width:650px)').matches;
 const pager=document.createElement('div');pager.className='friend-archive-pager archive-pager';
 let page=0;const max=Math.ceil(cards.length/8);
 const prev=document.createElement('button');prev.type='button';prev.textContent='←';prev.setAttribute('aria-label','Previous page');
 const label=document.createElement('span');
 const next=document.createElement('button');next.type='button';next.textContent='→';next.setAttribute('aria-label','Next page');
 function draw(){grid.replaceChildren(...(mobile()?cards:cards.slice(page*8,page*8+8)));label.textContent=`${page+1} / ${max}`;prev.disabled=page===0;next.disabled=page===max-1;pager.hidden=mobile();}
 prev.addEventListener('click',()=>{page=Math.max(0,page-1);draw();});next.addEventListener('click',()=>{page=Math.min(max-1,page+1);draw();});
 pager.append(prev,label,next);grid.after(pager);draw();
 const media=window.matchMedia('(max-width:900px) and (pointer:coarse)');
 const onChange=()=>{if(!grid.isConnected){media.removeEventListener('change',onChange);return;}draw();};media.addEventListener('change',onChange);
}
document.querySelector('#people-back').addEventListener('click',()=>{document.body.classList.remove('viewing-friend-archive');peopleList.hidden=false;document.querySelector('#public-profile').hidden=true;profileText('#discover-status','검색 결과');});
document.querySelector('#discover-refresh').addEventListener('click',loadPeople);
if(cloudClient){
 cloudClient.auth.onAuthStateChange((event,session)=>{
  const next=session?.user||null;if(next?.id===cloudUser?.id)return;
  clearTimeout(cloudTimer);cloudGeneration++;cloudUser=next;if(localStorage.getItem(ownerKey)&&localStorage.getItem(ownerKey)!==next?.id){entries=[];cloudLocalSave();}cloudUi();clearDiscovery();loadFriends();loadOwnCustom();
  if(next)setTimeout(()=>cloudPull(true),0);
 });
 cloudClient.auth.getSession().then(({data,error})=>{if(error)cloudMessage(error.message);else if(data?.session?.user&&!cloudUser){cloudUser=data.session.user;cloudGeneration++;cloudUi();cloudPull(true);loadFriends();loadOwnCustom();}}).catch(e=>cloudMessage(e.message));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudUser)cloudPull();});
 window.addEventListener('focus',()=>{if(cloudUser)cloudPull();});
}else cloudMessage('연결 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
cloudUi();

// FRIENDS: friendship requests are enforced by Supabase RLS.
const friendEls={status:document.querySelector('#friends-status'),results:document.querySelector('#friends-results'),accepted:document.querySelector('#friends-accepted'),received:document.querySelector('#friends-received'),sent:document.querySelector('#friends-sent')};
function friendStatus(message){friendEls.status.textContent=message;}
function friendEmpty(el,message){if(!el.children.length){const p=document.createElement('p');p.className='friend-empty';p.textContent=message;el.append(p);}}
function friendButton(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{b.disabled=true;try{await action();await loadFriends();}catch(e){friendStatus('처리 실패: '+(e.message||e));}finally{b.disabled=false;}});return b;}
function friendRow(profile,actions){const row=document.createElement('div');row.className='friend-row';const info=document.createElement('div');info.className='friend-info';const name=document.createElement('strong');name.textContent=profile?.display_name||'Unknown member';const bio=document.createElement('small');bio.textContent=profile?.bio||'';info.append(avatarNode(profile?.avatar_url),name,bio);row.append(info);const buttons=document.createElement('div');buttons.className='friend-actions';for(const [label,action] of actions)buttons.append(friendButton(label,action));row.append(buttons);return row;}
async function friendUpdate(id,status){const {error}=await cloudClient.from('archive_friendships').update({status}).eq('id',id);if(error)throw error;}
async function friendRemove(id){const {error}=await cloudClient.from('archive_friendships').delete().eq('id',id);if(error)throw error;}
async function friendSend(id){if(!cloudUser||id===cloudUser.id)return;const {error}=await cloudClient.from('archive_friendships').insert({requester_id:cloudUser.id,addressee_id:id});if(error)throw error;}
let friendRelations=[];
async function loadFriends(){for(const k of ['accepted','received','sent'])friendEls[k].replaceChildren();for(const id of ['friends-count','friends-received-count','friends-sent-count'])document.getElementById(id).textContent='0';if(!cloudUser){friendRelations=[];friendEls.results.replaceChildren();friendStatus('LOGIN REQUIRED');return;}friendStatus('LOADING...');const {data,error}=await cloudClient.from('archive_friendships').select('id,requester_id,addressee_id,status,created_at').or(`requester_id.eq.${cloudUser.id},addressee_id.eq.${cloudUser.id}`).order('created_at',{ascending:false});if(error){friendStatus('친구 목록 오류: '+error.message+' — 제공된 SQL을 먼저 실행해 주세요.');return;}friendRelations=data||[];const ids=[...new Set(friendRelations.map(r=>r.requester_id===cloudUser.id?r.addressee_id:r.requester_id))];let profiles=[];if(ids.length){const result=await cloudClient.from('archive_profiles').select('id,display_name,bio,avatar_url').in('id',ids);if(result.error){friendStatus('프로필 조회 오류: '+result.error.message);return;}profiles=result.data||[];}const byId=new Map(profiles.map(p=>[p.id,p]));const counts={accepted:0,received:0,sent:0};for(const r of friendRelations){const other=r.requester_id===cloudUser.id?r.addressee_id:r.requester_id;const profile=byId.get(other)||{id:other,display_name:'Unknown member'};if(r.status==='accepted'){counts.accepted++;friendEls.accepted.append(friendRow(profile,[['PROFILE',()=>openFriendProfile(profile)],['REMOVE',()=>friendRemove(r.id)]]));}else if(r.status==='pending'&&r.addressee_id===cloudUser.id){counts.received++;friendEls.received.append(friendRow(profile,[['ACCEPT',()=>friendUpdate(r.id,'accepted')],['DECLINE',()=>friendRemove(r.id)]]));}else if(r.status==='pending'){counts.sent++;friendEls.sent.append(friendRow(profile,[['CANCEL',()=>friendRemove(r.id)]]));}}for(const key of Object.keys(counts))document.getElementById(key==='accepted'?'friends-count':`friends-${key}-count`).textContent=counts[key];friendEmpty(friendEls.accepted,'NO FRIENDS');friendEmpty(friendEls.received,'NO REQUESTS');friendEmpty(friendEls.sent,'NO REQUESTS');friendStatus('');}
function openFriendProfile(person){document.querySelector('#friends-dialog').close();openPerson(person);document.querySelector('#discover').scrollIntoView({behavior:'smooth'});}
async function searchFriends(){friendEls.results.replaceChildren();if(!cloudUser){friendStatus('LOGIN REQUIRED');return;}const q=document.querySelector('#friends-query').value.trim();if(!q){friendStatus('ENTER A NAME');return;}friendStatus('SEARCHING...');const {data,error}=await cloudClient.from('archive_profiles').select('id,display_name,handle,bio,avatar_url').ilike('display_name',`%${q.replace(/[%_,]/g,'')}%`).neq('id',cloudUser.id).limit(30);if(error){friendStatus('검색 오류: '+error.message);return;}for(const p of data||[]){const r=friendRelations.find(r=>r.requester_id===p.id||r.addressee_id===p.id);let actions;if(!r)actions=[['ADD FRIEND',()=>friendSend(p.id)]];else if(r.status==='accepted')actions=[['FRIENDS',async()=>{}]];else if(r.addressee_id===cloudUser.id)actions=[['ACCEPT',()=>friendUpdate(r.id,'accepted')],['DECLINE',()=>friendRemove(r.id)]];else actions=[['REQUEST SENT',async()=>{}],['CANCEL',()=>friendRemove(r.id)]];friendEls.results.append(friendRow(p,actions));}friendEmpty(friendEls.results,'NO RESULTS');friendStatus(`${data?.length||0} RESULTS`);}
document.querySelector('#friends-search-btn').addEventListener('click',searchFriends);document.querySelector('#friends-query').addEventListener('keydown',e=>{if(e.key==='Enter')searchFriends();});document.querySelector('#friends-refresh').addEventListener('click',loadFriends);const friendsDialog=document.querySelector('#friends-dialog');
document.querySelector('#friends-open').addEventListener('click',()=>{if(!friendsDialog.open)friendsDialog.showModal();loadFriends();});
document.querySelector('#friends-close').addEventListener('click',()=>friendsDialog.close());
// Count one visit per tab per Korea-local calendar day, not per refresh.
function visitDayKST(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
async function loadVisitCounter(){
 const counter=document.querySelector('#visitor-counter');
 if(!cloudClient||!counter)return;
 try{
  const today=visitDayKST(),key='oddly-visit-counted-'+today;
  const first=!sessionStorage.getItem(key);
  const {data,error}=await cloudClient.rpc('oddly_visit_stats',{register_view:first});
  if(error){
   // Legacy counter remains visible until the SQL migration is installed.
   const legacyKey='oddly-visit-counted-v1';
   const legacyFirst=!sessionStorage.getItem(legacyKey);
   const legacy=await cloudClient.rpc(legacyFirst?'oddly_register_visit':'oddly_get_visits');
   if(legacy.error)throw legacy.error;
   if(legacyFirst)sessionStorage.setItem(legacyKey,'1');
   document.querySelector('#visitor-count').textContent=Number(legacy.data||0).toLocaleString('en-US');
   document.querySelector('#visitor-today').textContent='—';
   counter.hidden=false;
   console.warn('Daily visits need VISIT_STATS_SETUP.sql:',error.message);
   return;
  }
  if(first){sessionStorage.setItem(key,'1');sessionStorage.setItem('oddly-visit-counted-v1','1');}
  document.querySelector('#visitor-today').textContent=Number(data?.today||0).toLocaleString('en-US');
  document.querySelector('#visitor-count').textContent=Number(data?.total||0).toLocaleString('en-US');
  counter.hidden=false;
 }catch(err){console.warn('Visit counter unavailable:',err.message||err);}
}
loadVisitCounter();
let visitCounterDay=visitDayKST();
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible')return;
 const day=visitDayKST();
 if(day!==visitCounterDay){visitCounterDay=day;loadVisitCounter();}
});

