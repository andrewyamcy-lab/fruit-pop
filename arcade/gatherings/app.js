(function(){
"use strict";
const Core=window.GatheringCore;
const PLAYERS=Core.PLAYERS;
const $=id=>document.getElementById(id);
const STORAGE_KEY="friendarcade-player-v1";
const GROUPS="friendarcade_gatherings_v1";
const state={uid:null,db:null,sdk:null,ready:false,events:[],event:null,currentId:null,
 votes:new Map(),draft:new Set(),dirty:false,inspectedDay:0,stopVotes:null,busy:false};
let player=null,toastTimer=null;
try{const old=localStorage.getItem(STORAGE_KEY);if(PLAYERS.includes(old))player=old;}catch(_){}
const button=(label,cls,click)=>{
 const el=document.createElement("button");el.type="button";el.className=cls;el.textContent=label;el.addEventListener("click",click);return el;
};
const el=(tag,txt,cls)=>{
 const node=document.createElement(tag);if(txt!==undefined)node.textContent=String(txt);if(cls)node.className=cls;return node;
};
function toast(message){
 $("toast").textContent=message;$("toast").hidden=false;
 if(toastTimer)clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>$("toast").hidden=true,4200);
}
function status(message,online){
 $("connectionText").textContent=message;
 $("connectionDot").classList.toggle("online",!!online);
}
function editMessage(err,defaultText){
 if(err&&err.code==="permission-denied"){
  toast("Firebase 權限不足：請先喺 Firebase Console 發布新版 firestore.rules。");
  return;
 }
 if(err&&err.code==="unavailable"){toast("網絡暫時無法連線，請重新嘗試。");return;}
 toast(defaultText);
 console.warn(defaultText,err);
}
function choosePlayer(id){
 if(!PLAYERS.includes(id))return;
 player=id;
 try{localStorage.setItem(STORAGE_KEY,id);}catch(_){}
 $("playerLabel").textContent=Core.LABELS[id];
 $("playerOverlay").hidden=true;
 state.dirty=false;
 const own=state.votes.get(player);
 state.draft=new Set(Array.isArray(own?.days)?own.days:[]);
 renderEvent();renderMembers();
}
function renderPlayerChoices(){
 const host=$("playerChoices");host.replaceChildren();
 for(const id of PLAYERS){
  const b=button(Core.LABELS[id],"",()=>choosePlayer(id));
  if(id===player)b.classList.add("chosen");
  host.appendChild(b);
 }
}
function openPlayer(){
 renderPlayerChoices();
 $("playerOverlay").hidden=false;
}
$("playerButton").addEventListener("click",openPlayer);
$("closePlayer").addEventListener("click",()=>$("playerOverlay").hidden=true);
$("playerOverlay").addEventListener("click",e=>{if(e.target===$("playerOverlay"))$("playerOverlay").hidden=true;});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("playerOverlay").hidden=true;});
$("playerLabel").textContent=player?Core.LABELS[player]:"選擇玩家";
if(!player)openPlayer();
const today=new Date();
$("eventMonth").value=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0");
function votesAsArray(){return [...state.votes.values()];}
function votesSummary(){return Core.summary(state.event?.month||"",votesAsArray());}
function selectedEventUrl(id){
 const url=new URL(window.location.href);url.searchParams.set("event",id);url.hash="";
 return url.toString();
}
function syncHistory(id){
 const url=new URL(window.location.href);
 if(id)url.searchParams.set("event",id);else url.searchParams.delete("event");
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function initialFromUrl(){
 const id=new URLSearchParams(window.location.search).get("event");
 return /^[A-Za-z0-9]{20}$/.test(id||"")?id:null;
}
function renderList(){
 const host=$("eventList");host.replaceChildren();
 if(state.events.length===0){
  host.appendChild(el("p","暫時未有聚會，立即建立第一個啦！","note"));return;
 }
 for(const item of state.events){
  const b=button("","event-item"+(state.currentId===item.id?" active":""),()=>activate(item.id));
  const wrap=el("span");
  wrap.appendChild(el("b",item.title));
  wrap.appendChild(el("span",item.month+" · "+(item.status==="confirmed"?"✅ 已確認":"🗓️ 進行中")));
  b.appendChild(wrap);b.appendChild(el("span","›","arrow"));host.appendChild(b);
 }
}
function activate(id){
 const event=state.events.find(v=>v.id===id);
 if(!event){toast("找唔到呢個聚會，可能尚未同步或已移除。");return;}
 const changed=state.currentId!==id || state.event?.id!==id || !state.stopVotes;
 state.currentId=id;state.event=event;syncHistory(id);
 if(changed){
  state.votes=new Map();state.draft=new Set();state.dirty=false;state.inspectedDay=0;
  if(state.stopVotes){state.stopVotes();state.stopVotes=null;}
  const voteCollection=state.sdk.collection(state.sdk.doc(state.db,GROUPS,id),"votes");
  state.stopVotes=state.sdk.onSnapshot(voteCollection,snapshot=>{
   state.votes=new Map(snapshot.docs.map(doc=>[doc.id,{...doc.data(),playerId:doc.id}]));
   const own=state.votes.get(player);
   if(!state.dirty)state.draft=new Set(Array.isArray(own?.days)?own.days:[]);
   renderEvent();renderMembers();
  },err=>{
   editMessage(err,"無法載入朋友空閒日期。");
   renderEvent();
  });
 }
 renderList();renderEvent();renderMembers();
}
$("switchEventButton").addEventListener("click",()=>{
 if(state.stopVotes)state.stopVotes();state.stopVotes=null;state.currentId=null;state.event=null;
 state.votes=new Map();state.draft=new Set();state.dirty=false;
 syncHistory(null);renderEvent();renderList();renderMembers();
 $("eventList").scrollIntoView?.({behavior:"smooth",block:"start"});
});
async function shareEvent(){
 if(!state.currentId)return;
 const url=selectedEventUrl(state.currentId);
 try{
  if(navigator.share)await navigator.share({title:state.event.title,text:"📅 一齊揀得閒日期！",url});
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);toast("✅ 已複製聚會連結，可以貼去群組。");}
  else window.prompt("複製以下聚會連結：",url);
 }catch(err){if(err?.name!=="AbortError")window.prompt("複製以下聚會連結：",url);}
}
$("shareButton").addEventListener("click",shareEvent);
function renderMembers(){
 const host=$("members");host.replaceChildren();
 if(!state.event){host.appendChild(el("p","選擇聚會後顯示提交進度。","note"));return;}
 for(const id of PLAYERS){
  const vote=state.votes.get(id);
  const box=el("div",undefined,"member");
  box.appendChild(el("span",Core.LABELS[id]+(id===player?"（我）":"")));
  box.appendChild(el("small",vote?"✓ 已提交":"未提交",vote?"done":""));
  host.appendChild(box);
 }
}
function canEdit(){
 if(!state.ready||!state.event||state.event.status!=="open"||!player||state.busy)return false;
 const existing=state.votes.get(player);
 return !existing||existing.uid===state.uid;
}
function updateDay(day){
 state.inspectedDay=day;
 if(canEdit()){
  if(state.draft.has(day))state.draft.delete(day);else state.draft.add(day);
  state.dirty=true;
 }
 renderEvent();
}
function renderCalendar(){
 const event=state.event,host=$("calendarDays");
 host.replaceChildren();
 const first=Core.firstWeekday(event.month),last=Core.daysInMonth(event.month);
 const summary=votesSummary();
 for(let i=0;i<first;i++)host.appendChild(el("div","","day empty"));
 for(let day=1;day<=last;day++){
  const n=summary.counts[day]||0,selected=state.draft.has(day);
  let cls="day"+(n>0?" has-votes":"")+(n===7?" good":"")+(selected?" mine":"")+
   (day===state.inspectedDay?" inspect":"");
  const b=button("",cls,()=>updateDay(day));
  b.setAttribute("aria-pressed",String(selected));
  b.setAttribute("aria-label",day+" 日；"+n+"/7 已提交有空"+(selected?"；我有空":""));
  b.appendChild(el("span",day,"num"));
  b.appendChild(el("span",n+"/7","cnt"));
  if(selected)b.appendChild(el("span","✓","tick"));
  host.appendChild(b);
 }
 $("calendarTitle").textContent=event.month.replace("-"," 年 ")+" 月";
 $("submittedCount").textContent=summary.submittedCount+" / 7 已提交";
}
function renderDayDetail(){
 const host=$("dayDetail"),day=state.inspectedDay;
 host.replaceChildren();
 if(!day){
  host.appendChild(el("h3","📆 日期詳情"));
  host.appendChild(el("span","點擊日期可勾選自己得閒嘅日子，同時查看其他人嘅選擇。"));return;
 }
 const event=state.event,summary=votesSummary();
 const available=summary.namesByDay[day];
 const unavailable=PLAYERS.filter(id=>state.votes.has(id)&&!available.includes(id));
 const pending=PLAYERS.filter(id=>!state.votes.has(id));
 host.appendChild(el("h3",Core.dateLabel(event.month,day)+" · "+available.length+"/7"));
 host.appendChild(el("div","✅ 有空："+(available.length?available.map(id=>Core.LABELS[id]).join("、"):"暫時冇人選擇")));
 host.appendChild(el("div","❌ 已提交但當日唔得閒："+(unavailable.length?unavailable.map(id=>Core.LABELS[id]).join("、"):"無")));
 host.appendChild(el("div","⏳ 尚未提交："+(pending.length?pending.map(id=>Core.LABELS[id]).join("、"):"全部已提交")));
}
function renderResults(){
 const event=state.event,host=$("results");
 host.replaceChildren();
 const stats=votesSummary();
 if(event.status==="confirmed"&&event.confirmedDay>0){
  host.classList.remove("pending");
  host.appendChild(el("h3","🎉 聚會日期已確認！"));
  host.appendChild(el("p",Core.dateLabel(event.month,event.confirmedDay)+" · 七位朋友都得閒"));
  return;
 }
 if(stats.allFree.length){
  host.classList.remove("pending");
  host.appendChild(el("h3","🎉 搵到 "+stats.allFree.length+" 個 7/7 全員有空日期！"));
  for(const d of stats.allFree){
   host.appendChild(button(Core.dateLabel(event.month,d),"date-btn",()=>{
    state.inspectedDay=d;renderDayDetail();
   }));
  }
  host.appendChild(el("p","全部七位朋友都選擇咗以上日子，可以安排聚會！"));
 }else{
  host.classList.add("pending");
  host.appendChild(el("h3","📊 暫時未有 7/7 全員有空日期"));
  host.appendChild(el("p",stats.submittedCount+"/7 人已提交，仲有 "+(7-stats.submittedCount)+" 位未交。"));
  const best=stats.ranked.filter(x=>x.count>0).slice(0,3);
  if(best.length)host.appendChild(el("p","目前較多人有空："+best.map(x=>Core.dateLabel(event.month,x.day)+"（"+x.count+"/7）").join("、")));
  if(stats.submittedCount===7)host.appendChild(el("p","七位都交咗，但冇共同日子。可以考慮最多人有空嘅日期，或者建立另一個月份嘅聚會。"));
 }
}
function renderConfirm(){
 const area=$("confirmArea"),host=$("confirmChoices");
 host.replaceChildren();
 const ev=state.event,summary=votesSummary();
 const eligible=state.ready&&ev.status==="open"&&ev.creatorUid===state.uid&&summary.allFree.length>0;
 area.hidden=!eligible;
 if(!eligible)return;
 for(const day of summary.allFree){
  const b=button("✅ 確認 "+Core.dateLabel(ev.month,day),"small",()=>confirmDate(day));
  host.appendChild(b);
 }
}
function renderEvent(){
 const event=state.event;
 $("emptyState").hidden=!!event;$("eventPanel").hidden=!event;
 if(!event)return;
 $("selectedTitle").textContent=event.title;
 $("selectedMeta").textContent="發起人："+(Core.LABELS[event.createdBy]||"朋友")+" · "+event.month;
 $("eventStatus").textContent=event.status==="confirmed"?"✅ 已確認":"🗳️ 投票中";
 $("eventStatus").classList.toggle("confirmed",event.status==="confirmed");
 renderCalendar();renderDayDetail();renderResults();renderConfirm();
 const own=state.votes.get(player),button=$("saveVote"),hint=$("editHint");
 if(!player)hint.textContent="請先選擇玩家，先可以提交日期。";
 else if(event.status!=="open")hint.textContent="聚會日期已確認，暫時唔可以再修改投票。";
 else if(own&&own.uid!==state.uid)hint.textContent="呢位玩家已經喺另一部裝置提交。為保護已有答案，請使用原本嘅手機／瀏覽器修改。";
 else if(!state.ready)hint.textContent="Firebase 仲未連接，或者尚未發布聚會安全規則。";
 else hint.textContent="按日曆勾選有空日期，再按「提交」。即使冇一日有空，都可以提交空白答案。";
 $("editHeading").textContent=player?"✍️ "+Core.LABELS[player]+" 嘅可出席日期":"✍️ 我的可出席日期";
 button.disabled=!canEdit()||!!own&&!state.dirty;
 button.textContent=state.busy?"正在儲存…":own?"更新日期（"+state.draft.size+" 日）":"提交日期（"+state.draft.size+" 日）";
}
async function saveVote(){
 if(!canEdit()||!state.event)return;
 const event=state.event,playerId=player,days=[...state.draft].filter(n=>Number.isInteger(n)&&n>=1&&n<=Core.daysInMonth(event.month)).sort((a,b)=>a-b);
 const ref=state.sdk.doc(state.db,GROUPS,event.id,"votes",playerId);
 const existing=state.votes.get(playerId);
 state.busy=true;renderEvent();
 try{
  if(existing){
   await state.sdk.updateDoc(ref,{days,updatedAt:state.sdk.serverTimestamp()});
  }else{
   await state.sdk.setDoc(ref,{uid:state.uid,playerId,days,updatedAt:state.sdk.serverTimestamp()});
  }
  state.votes.set(playerId,{uid:state.uid,playerId,days});
  state.dirty=false;state.draft=new Set(days);
  toast("✅ 日期已提交！其他朋友可以即時睇到。");
 }catch(err){editMessage(err,"提交唔成功，請再試。");}
 finally{state.busy=false;renderEvent();renderMembers();}
}
$("saveVote").addEventListener("click",saveVote);
async function confirmDate(day){
 if(!state.event||state.event.creatorUid!==state.uid||!votesSummary().allFree.includes(day))return;
 if(!window.confirm("確定將 "+Core.dateLabel(state.event.month,day)+" 設為聚會日期？確認後將無法繼續投票。"))return;
 const ref=state.sdk.doc(state.db,GROUPS,state.event.id);
 try{
  await state.sdk.updateDoc(ref,{status:"confirmed",confirmedDay:day});
  toast("🎉 聚會日期已確認！"); 
 }catch(err){editMessage(err,"未能確認聚會日期。");}
}
async function createGathering(event){
 event.preventDefault();
 if(!player){openPlayer();toast("請先選擇玩家。");return;}
 if(!state.ready||state.busy){toast("請先確認 Firebase 已連接。");return;}
 const title=$("eventTitle").value.trim(),month=$("eventMonth").value;
 if(!title||title.length>80){toast("請輸入 1 至 80 字嘅聚會名稱。");return;}
 if(!Core.validMonth(month)){toast("請選擇有效嘅年月。");return;}
 const ref=state.sdk.doc(state.sdk.collection(state.db,GROUPS));
 state.busy=true;$("createButton").disabled=true;
 try{
  await state.sdk.setDoc(ref,{
   title,month,createdBy:player,creatorUid:state.uid,createdAt:state.sdk.serverTimestamp(),
   status:"open",confirmedDay:0
  });
  $("eventTitle").value="";
  if(state.events.some(item=>item.id===ref.id))activate(ref.id);
  else{state.currentId=ref.id;syncHistory(ref.id);}
  toast("✅ 已建立聚會！可以分享連結俾其他朋友。");
 }catch(err){editMessage(err,"建立聚會失敗，請檢查連線。");}
 finally{state.busy=false;$("createButton").disabled=!state.ready;}
}
$("createForm").addEventListener("submit",createGathering);
async function connect(){
 const config=window.FRUITPOP_FIREBASE_CONFIG;
 if(!config?.apiKey||!config?.projectId||!config?.appId){status("尚未設定 Firebase。",false);return;}
 try{
  const version="13.1.0";
  const [appSDK,authSDK,dbSDK]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-firestore.js")
  ]);
  const app=appSDK.initializeApp(config,"friend-arcade-gatherings");
  const auth=authSDK.getAuth(app);
  const signed=await authSDK.signInAnonymously(auth);
  state.uid=signed.user.uid;
  state.db=dbSDK.getFirestore(app);state.sdk=dbSDK;
  state.ready=true;$("createButton").disabled=false;
  status("🌐 已連接 Firebase · 聚會資料即時同步",true);
  const collection=dbSDK.collection(state.db,GROUPS);
  dbSDK.onSnapshot(collection,snapshot=>{
   state.events=snapshot.docs.map(d=>({...d.data(),id:d.id}))
    .sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
   renderList();
   const preferred=state.currentId||initialFromUrl()||state.events[0]?.id;
   if(preferred){
    if(state.events.some(item=>item.id===preferred)){
      activate(preferred);
    }else if(state.event&&state.event.id===preferred){
      state.event=null;state.currentId=null;renderEvent();
    }
   }
  },error=>{
   state.ready=false;$("createButton").disabled=true;
   status("⚠️ 無法讀取聚會。請先發布新版 Firestore Rules。",false);
   editMessage(error,"載入聚會失敗。");
  });
 }catch(error){
  status("⚠️ 連接 Firebase 失敗。請檢查 Anonymous Authentication。",false);
  editMessage(error,"Firebase 無法連線。");
 }
}
window.GatheringsDebug={getState:()=>({
  player,connected:state.ready,count:state.events.length,eventId:state.currentId,
  draft:[...state.draft],voters:[...state.votes.keys()],
  fullDays:state.event?votesSummary().allFree:[]
 })};
renderMembers();renderEvent();connect();
})();