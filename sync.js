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
function cloudLocalSave(){localStorage.setItem(KEY,JSON.stringify(entries));render();}
function cloudUi(){
 document.querySelector('#auth-logged-out').hidden=!!cloudUser;
 document.querySelector('#auth-logged-in').hidden=!cloudUser;
 document.querySelector('#auth-user').textContent=cloudUser?`로그인: ${cloudUser.email}`:'';
 document.querySelector('#profile-open').hidden=!cloudUser;
 cloudButton.textContent=cloudUser?'☁ SYNC ON':'LOGIN / SYNC';
 document.querySelector('#discover-status').textContent=cloudUser?'':'LOGIN REQUIRED';
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
  localStorage.setItem(ownerKey,userId);cloudLocalSave();
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
  const result=action==='signup'?await cloudClient.auth.signUp({email,password,options:{emailRedirectTo:'https://seung900.github.io/seungu-archive/'}}):await cloudClient.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  cloudMessage(action==='signup'&&!result.data.session?'가입 확인 이메일을 보냈어요. 인증 링크를 누른 뒤 로그인해 주세요.':'로그인 성공! 동기화를 시작할게요.');
 }catch(e){cloudMessage('로그인/가입 실패: '+(e.message||e));}
}
document.querySelector('#auth-sign-in').addEventListener('click',()=>cloudAuth('login'));
document.querySelector('#auth-sign-up').addEventListener('click',()=>cloudAuth('signup'));
document.querySelector('#auth-sync-now').addEventListener('click',async()=>{await cloudLastSave;await cloudPull();});
document.querySelector('#auth-sign-out').addEventListener('click',async()=>{
 if(!cloudClient)return;clearTimeout(cloudTimer);await cloudLastSave;
 const {error}=await cloudClient.auth.signOut();if(error){cloudMessage(error.message);return;}
 cloudUser=null;cloudGeneration++;entries=[];cloudLocalSave();cloudUi();clearDiscovery();loadFriends();cloudMessage('로그아웃했어요. 클라우드 기록은 유지돼요.');
});
function clearDiscovery(){document.querySelector('#people-list').innerHTML='';document.querySelector('#public-entries').innerHTML='';document.querySelector('#public-profile').hidden=true;}
function profileText(id,value){document.querySelector(id).textContent=value;}
const profileDialog=document.querySelector('#profile-dialog');
document.querySelector('#profile-open').addEventListener('click',async()=>{
 if(!cloudUser)return;profileDialog.showModal();profileText('#profile-status','불러오는 중...');
 const {data,error}=await cloudClient.from('archive_profiles').select('display_name,bio').eq('id',cloudUser.id).maybeSingle();
 if(error){profileText('#profile-status',error.message+' — 먼저 SQL 설정을 완료해 주세요.');return;}
 document.querySelector('#profile-name').value=data?.display_name||'';
 document.querySelector('#profile-bio').value=data?.bio||'';profileText('#profile-status','');
});
document.querySelector('#profile-close').addEventListener('click',()=>profileDialog.close());
document.querySelector('#profile-save').addEventListener('click',async()=>{
 if(!cloudUser)return;const name=document.querySelector('#profile-name').value.trim(),bio=document.querySelector('#profile-bio').value.trim();
 if(!name){profileText('#profile-status','닉네임을 입력해 주세요.');return;}
 const {error}=await cloudClient.from('archive_profiles').upsert({id:cloudUser.id,display_name:name,bio},{onConflict:'id'});
 profileText('#profile-status',error?'저장 실패: '+error.message:'프로필이 저장됐어요 ✓');
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
async function loadPeople(){
 clearDiscovery();if(!cloudUser){profileText('#discover-status','LOGIN REQUIRED');return;}
 profileText('#discover-status','회원 목록 불러오는 중...');
 const {data,error}=await cloudClient.from('archive_profiles').select('id,display_name,bio').order('created_at',{ascending:false}).limit(100);
 if(error){profileText('#discover-status','목록을 불러오지 못했어요: '+error.message+' (SQL 설정을 확인해 주세요.)');return;}
 profileText('#discover-status',data?.length?`${data.length} MEMBERS`:'아직 공개된 회원 프로필이 없어요. MY PROFILE에서 첫 프로필을 만들어 보세요.');
 for(const person of data||[]){const b=document.createElement('button');b.className='person-card';b.type='button';const name=document.createElement('strong');name.textContent=person.display_name;const bio=document.createElement('small');bio.textContent=person.bio||'';b.append(name,bio);b.addEventListener('click',()=>openPerson(person));peopleList.append(b);}
}
async function openPerson(person){
 if(!cloudUser)return;peopleList.hidden=true;document.querySelector('#public-profile').hidden=false;
 profileText('#public-profile-title',person.display_name);profileText('#public-profile-bio',person.bio||'');
 profileText('#discover-status','공개 기록을 불러오는 중...');const grid=document.querySelector('#public-entries');grid.innerHTML='';
 const {data,error}=await cloudClient.from('archive_entries').select('entry_data').eq('user_id',person.id).eq('entry_data->>visibility','public').order('created_at',{ascending:false}).limit(100);
 if(error){profileText('#discover-status','기록을 불러오지 못했어요: '+error.message);return;}
 profileText('#discover-status',`${data?.length||0}개의 공개 기록`);
 if(!data?.length){grid.textContent='아직 공개한 기록이 없어요.';return;}
 let likeMap;
 try{likeMap=await loadCommunityLikes(data.map(r=>r.entry_data?.id).filter(id=>typeof id==='string'));}
 catch(err){profileText('#discover-status','공개 기록은 보이지만 좋아요를 불러오지 못했어요: '+(err.message||err));likeMap=new Map();}
 for(const row of data){const e=row.entry_data;if(!e||!['music','eats','moments'].includes(e.type))continue;
  const card=document.createElement('article');card.className='entry';const art=document.createElement('div');art.className='art';
  if(typeof e.image==='string'&&e.image.startsWith('data:image/')){const img=document.createElement('img');img.src=e.image;img.alt='';art.append(img);}else{const mark=document.createElement('span');mark.className='placeholder';mark.textContent='♪';art.append(mark);}card.append(art);if(typeof attachArtworkPreview==='function')attachArtworkPreview(art,e);
  const title=document.createElement('h3');title.textContent=e.type==='music'?e.album:e.type==='eats'?e.food:e.momentTitle||'Untitled moment';card.append(title);
  const sub=document.createElement('div');sub.className='sub';sub.textContent=e.type==='music'?e.artist:e.type==='eats'?[e.restaurant,e.location].filter(Boolean).join(' · '):'MOMENTS';card.append(sub);
  if(e.type!=='moments'){const score=document.createElement('div');score.className='score';score.textContent=`★ ${Number(e.rating||0).toFixed(1)} / 5`;card.append(score);}
  if(e.comment){const comment=document.createElement('p');comment.className='comment';comment.textContent=e.comment;card.append(comment);}
  if(e.type==='music'&&Array.isArray(e.tracks)){const tracks=document.createElement('div');tracks.className='tracks';for(const t of e.tracks){const line=document.createElement('div');line.className='track';line.textContent=(t.liked?'♥ ':'')+String(t.name||'');tracks.append(line);}card.append(tracks);}
  if(typeof e.id==='string')card.append(makeCommunityLikeButton(e.id,likeMap.get(e.id)||{count:0,mine:false}));
  grid.append(card);
 }
}
document.querySelector('#people-back').addEventListener('click',()=>{peopleList.hidden=false;document.querySelector('#public-profile').hidden=true;profileText('#discover-status','회원 목록');});
document.querySelector('#discover-refresh').addEventListener('click',loadPeople);
if(cloudClient){
 cloudClient.auth.onAuthStateChange((event,session)=>{
  const next=session?.user||null;if(next?.id===cloudUser?.id)return;
  clearTimeout(cloudTimer);cloudGeneration++;cloudUser=next;if(localStorage.getItem(ownerKey)) {entries=[];cloudLocalSave();}cloudUi();clearDiscovery();loadFriends();
  if(next)setTimeout(()=>cloudPull(true),0);
 });
 cloudClient.auth.getSession().then(({data,error})=>{if(error)cloudMessage(error.message);else if(data?.session?.user&&!cloudUser){cloudUser=data.session.user;cloudGeneration++;cloudUi();cloudPull(true);loadFriends();}}).catch(e=>cloudMessage(e.message));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudUser)cloudPull();});
 window.addEventListener('focus',()=>{if(cloudUser)cloudPull();});
}else cloudMessage('연결 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
cloudUi();

// FRIENDS: friendship requests are enforced by Supabase RLS.
const friendEls={status:document.querySelector('#friends-status'),results:document.querySelector('#friends-results'),accepted:document.querySelector('#friends-accepted'),received:document.querySelector('#friends-received'),sent:document.querySelector('#friends-sent')};
function friendStatus(message){friendEls.status.textContent=message;}
function friendEmpty(el,message){if(!el.children.length){const p=document.createElement('p');p.className='friend-empty';p.textContent=message;el.append(p);}}
function friendButton(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{b.disabled=true;try{await action();await loadFriends();}catch(e){friendStatus('처리 실패: '+(e.message||e));}finally{b.disabled=false;}});return b;}
function friendRow(profile,actions){const row=document.createElement('div');row.className='friend-row';const info=document.createElement('div');info.className='friend-info';const name=document.createElement('strong');name.textContent=profile?.display_name||'Unknown member';const bio=document.createElement('small');bio.textContent=profile?.bio||'';info.append(name,bio);row.append(info);const buttons=document.createElement('div');buttons.className='friend-actions';for(const [label,action] of actions)buttons.append(friendButton(label,action));row.append(buttons);return row;}
async function friendUpdate(id,status){const {error}=await cloudClient.from('archive_friendships').update({status}).eq('id',id);if(error)throw error;}
async function friendRemove(id){const {error}=await cloudClient.from('archive_friendships').delete().eq('id',id);if(error)throw error;}
async function friendSend(id){if(!cloudUser||id===cloudUser.id)return;const {error}=await cloudClient.from('archive_friendships').insert({requester_id:cloudUser.id,addressee_id:id});if(error)throw error;}
let friendRelations=[];
async function loadFriends(){for(const k of ['accepted','received','sent'])friendEls[k].replaceChildren();for(const id of ['friends-count','friends-received-count','friends-sent-count'])document.getElementById(id).textContent='0';if(!cloudUser){friendRelations=[];friendEls.results.replaceChildren();friendStatus('LOGIN REQUIRED');return;}friendStatus('LOADING...');const {data,error}=await cloudClient.from('archive_friendships').select('id,requester_id,addressee_id,status,created_at').or(`requester_id.eq.${cloudUser.id},addressee_id.eq.${cloudUser.id}`).order('created_at',{ascending:false});if(error){friendStatus('친구 목록 오류: '+error.message+' — 제공된 SQL을 먼저 실행해 주세요.');return;}friendRelations=data||[];const ids=[...new Set(friendRelations.map(r=>r.requester_id===cloudUser.id?r.addressee_id:r.requester_id))];let profiles=[];if(ids.length){const result=await cloudClient.from('archive_profiles').select('id,display_name,bio').in('id',ids);if(result.error){friendStatus('프로필 조회 오류: '+result.error.message);return;}profiles=result.data||[];}const byId=new Map(profiles.map(p=>[p.id,p]));const counts={accepted:0,received:0,sent:0};for(const r of friendRelations){const other=r.requester_id===cloudUser.id?r.addressee_id:r.requester_id;const profile=byId.get(other)||{id:other,display_name:'Unknown member'};if(r.status==='accepted'){counts.accepted++;friendEls.accepted.append(friendRow(profile,[['PROFILE',()=>openFriendProfile(profile)],['REMOVE',()=>friendRemove(r.id)]]));}else if(r.status==='pending'&&r.addressee_id===cloudUser.id){counts.received++;friendEls.received.append(friendRow(profile,[['ACCEPT',()=>friendUpdate(r.id,'accepted')],['DECLINE',()=>friendRemove(r.id)]]));}else if(r.status==='pending'){counts.sent++;friendEls.sent.append(friendRow(profile,[['CANCEL',()=>friendRemove(r.id)]]));}}for(const key of Object.keys(counts))document.getElementById(key==='accepted'?'friends-count':`friends-${key}-count`).textContent=counts[key];friendEmpty(friendEls.accepted,'NO FRIENDS');friendEmpty(friendEls.received,'NO REQUESTS');friendEmpty(friendEls.sent,'NO REQUESTS');friendStatus('');}
function openFriendProfile(person){document.querySelector('#discover').scrollIntoView({behavior:'smooth'});openPerson(person);}
async function searchFriends(){friendEls.results.replaceChildren();if(!cloudUser){friendStatus('LOGIN REQUIRED');return;}const q=document.querySelector('#friends-query').value.trim();if(!q){friendStatus('ENTER A NAME');return;}friendStatus('SEARCHING...');const {data,error}=await cloudClient.from('archive_profiles').select('id,display_name,bio').ilike('display_name',`%${q.replace(/[%_,]/g,'')}%`).neq('id',cloudUser.id).limit(30);if(error){friendStatus('검색 오류: '+error.message);return;}for(const p of data||[]){const r=friendRelations.find(r=>r.requester_id===p.id||r.addressee_id===p.id);let actions;if(!r)actions=[['ADD FRIEND',()=>friendSend(p.id)]];else if(r.status==='accepted')actions=[['FRIENDS',async()=>{}]];else if(r.addressee_id===cloudUser.id)actions=[['ACCEPT',()=>friendUpdate(r.id,'accepted')],['DECLINE',()=>friendRemove(r.id)]];else actions=[['REQUEST SENT',async()=>{}],['CANCEL',()=>friendRemove(r.id)]];friendEls.results.append(friendRow(p,actions));}friendEmpty(friendEls.results,'NO RESULTS');friendStatus(`${data?.length||0} RESULTS`);}
document.querySelector('#friends-search-btn').addEventListener('click',searchFriends);document.querySelector('#friends-query').addEventListener('keydown',e=>{if(e.key==='Enter')searchFriends();});document.querySelector('#friends-refresh').addEventListener('click',loadFriends);const friendsDialog=document.querySelector('#friends-dialog');
document.querySelector('#friends-open').addEventListener('click',()=>{if(!friendsDialog.open)friendsDialog.showModal();loadFriends();});
document.querySelector('#friends-close').addEventListener('click',()=>friendsDialog.close());
// VISITS counts one page view per browser tab session (not unique people).
async function loadVisitCounter(){
 const counter=document.querySelector('#visitor-counter');
 if(!cloudClient||!counter)return;
 try{
  const key='oddly-visit-counted-v1';
  const first=!sessionStorage.getItem(key);
  const {data,error}=await cloudClient.rpc(first?'oddly_register_visit':'oddly_get_visits');
  if(error)throw error;
  if(first)sessionStorage.setItem(key,'1');
  document.querySelector('#visitor-count').textContent=Number(data||0).toLocaleString('en-US');
  counter.hidden=false;
 }catch(err){console.warn('Visit counter unavailable:',err.message||err);}
}
loadVisitCounter();
