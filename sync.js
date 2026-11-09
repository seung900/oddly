 'use strict';
// Supabase public project URL and publishable key (not secret credentials).
const CLOUD_URL='https://gdxczepnytobckajugay.supabase.co';
const CLOUD_KEY='sb_publishable_VZTrdf-ugJNarK8dDhyhjQ_sidI9okx';
const cloudClient=window.supabase?.createClient(CLOUD_URL,CLOUD_KEY);
const cloudStatus=document.querySelector('#auth-status');
const cloudDialog=document.querySelector('#auth-dialog');
const cloudButton=document.querySelector('#auth-open');
const ownerKey='seungu-archive-cloud-owner';
let cloudUser=null,cloudBusy=false,cloudTimer=null,cloudSuppress=false,cloudLastSave=Promise.resolve();
function cloudMessage(msg){cloudStatus.textContent=msg;}
function cloudLocalSave(){localStorage.setItem(KEY,JSON.stringify(entries));render();}
function cloudUi(){
 document.querySelector('#auth-logged-out').hidden=!!cloudUser;
 document.querySelector('#auth-logged-in').hidden=!cloudUser;
 document.querySelector('#auth-user').textContent=cloudUser?`로그인: ${cloudUser.email}`:'';
 cloudButton.textContent=cloudUser?'☁ SYNC ON':'LOGIN / SYNC';
}
async function cloudPull(first=false){
 if(!cloudUser||cloudBusy)return;
 cloudBusy=true;
 try{
  const {data,error}=await cloudClient.from('archive_entries').select('id,entry_data').eq('user_id',cloudUser.id);
  if(error)throw error;
  const remote=(data||[]).map(x=>x.entry_data).filter(x=>x&&typeof x.id==='string');
  const linkedOwner=localStorage.getItem(ownerKey);
  const importLocal=first && linkedOwner!==cloudUser.id;
  const localOnly=importLocal?entries.filter(e=>!remote.some(r=>r.id===e.id)):[];
  if(localOnly.length){
   const rows=localOnly.map(e=>({id:e.id,user_id:cloudUser.id,entry_data:e}));
   const {error:upErr}=await cloudClient.from('archive_entries').upsert(rows,{onConflict:'id'});
   if(upErr)throw upErr;
  }
  cloudSuppress=true;
  entries=[...remote,...localOnly].sort((a,b)=>(b.created||0)-(a.created||0));
  cloudLocalSave();
  localStorage.setItem(ownerKey,cloudUser.id);
  cloudSuppress=false;
  cloudMessage(`동기화 완료! ${entries.length}개 기록을 불러왔어요.${localOnly.length?' 이 기기의 기존 기록 '+localOnly.length+'개도 업로드했어요.':''}`);
 }catch(e){cloudMessage('동기화 실패: '+(e.message||e));cloudSuppress=false;}
 finally{cloudBusy=false;}
}
function cloudQueueSave(){
 if(!cloudUser||cloudSuppress)return;
 clearTimeout(cloudTimer);
 cloudTimer=setTimeout(()=>{
  const snapshot=entries.map(e=>({...e}));
  cloudLastSave=cloudLastSave.then(async()=>{
   if(!cloudUser||!snapshot.length)return;
   const {error}=await cloudClient.from('archive_entries').upsert(snapshot.map(e=>({id:e.id,user_id:cloudUser.id,entry_data:e})),{onConflict:'id'});
   if(error)throw error;
   cloudMessage('클라우드에 저장됐어요 ✓');
  }).catch(e=>cloudMessage('클라우드 저장 실패: '+(e.message||e)+'\n기기 기록은 남아 있어요. BACKUP으로 보관해 주세요.'));
 },350);
}
function cloudRemoveEntry(id){
 if(!cloudUser)return;
 cloudLastSave=cloudLastSave.then(async()=>{
  const {error}=await cloudClient.from('archive_entries').delete().eq('id',id).eq('user_id',cloudUser.id);
  if(error)throw error;
 }).catch(e=>cloudMessage('클라우드 삭제 실패: '+(e.message||e)));
}
window.archiveCloud={queueSave:cloudQueueSave,removeEntry:cloudRemoveEntry};
cloudButton.addEventListener('click',()=>cloudDialog.showModal());
document.querySelector('#auth-close').addEventListener('click',()=>cloudDialog.close());
async function cloudAuth(action){
 if(!cloudClient){cloudMessage('Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');return;}
 const email=document.querySelector('#auth-email').value.trim();
 const password=document.querySelector('#auth-password').value;
 if(!email||password.length<6){cloudMessage('이메일과 6자 이상의 비밀번호를 입력해 주세요.');return;}
 cloudMessage('처리 중...');
 try{
  const result=action==='signup'?await cloudClient.auth.signUp({email,password}):await cloudClient.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(action==='signup'&&!result.data.session)cloudMessage('가입 확인 이메일을 보냈어요. 이메일의 인증 링크를 누른 뒤 로그인해 주세요.');
  else cloudMessage('로그인 성공! 동기화를 시작할게요.');
 }catch(e){cloudMessage('로그인/가입 실패: '+(e.message||e));}
}
document.querySelector('#auth-sign-in').addEventListener('click',()=>cloudAuth('login'));
document.querySelector('#auth-sign-up').addEventListener('click',()=>cloudAuth('signup'));
document.querySelector('#auth-sync-now').addEventListener('click',async()=>{await cloudLastSave;await cloudPull();});
document.querySelector('#auth-sign-out').addEventListener('click',async()=>{
 if(!cloudClient)return;
 await cloudLastSave;
 const {error}=await cloudClient.auth.signOut();
 if(error){cloudMessage(error.message);return;}
 cloudUser=null;entries=[];cloudLocalSave();cloudUi();cloudMessage('로그아웃했어요. 클라우드 기록은 유지돼요.');
});
if(cloudClient){
 cloudClient.auth.onAuthStateChange((event,session)=>{
  const newUser=session?.user||null;
  if(newUser?.id===cloudUser?.id)return;
  cloudUser=newUser;cloudUi();
  if(newUser)setTimeout(()=>cloudPull(true),0);
 });
 cloudClient.auth.getSession().then(({data,error})=>{
  if(error)cloudMessage(error.message);
  else if(data?.session?.user&&!cloudUser){cloudUser=data.session.user;cloudUi();cloudPull(true);}
 }).catch(e=>cloudMessage(e.message));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudUser)cloudPull();});
 window.addEventListener('focus',()=>{if(cloudUser)cloudPull();});
}else cloudMessage('연결 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
cloudUi();
