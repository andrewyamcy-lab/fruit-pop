(() => {
"use strict";
const C=window.SameWordCore;
const $=id=>document.getElementById(id);
const ROOMS="friendarcade_sameword_rooms_v1", STORAGE="friendarcade-player-v1";
const state={
 db:null,sdk:null,uid:null,roomId:null,room:null,ready:false,busy:false,
 unsubscribe:null,answerKey:null,answers:new Map(),history:new Map(),
 roundLoading:false,lastAdvance:0,previousStage:"",historyRequest:new Set(),loadAttempts:new Map(),joined:false
};
let player=null,toastTimeout=null;
try{const stored=localStorage.getItem(STORAGE);if(C.PLAYERS.includes(stored))player=stored;}catch(_){}
function txt(id,value){$(id).textContent=value;}
function info(message){
 txt("toast",message);$("toast").hidden=false;
 if(toastTimeout)clearTimeout(toastTimeout);
 toastTimeout=setTimeout(()=>$("toast").hidden=true,4000);
}
function firebaseError(err,action){
 console.warn(action,err);
 if(err?.code==="permission-denied")info("Firebase 未有 SameWord 權限。請先發布新版 firestore.rules。");
 else if(err?.code==="unavailable")info("網絡暫時中斷，請檢查連線。");
 else info(action+"失敗，請重試。");
}
function coreResult(){return C.result(state.room);}
function roomRef(){return state.sdk.doc(state.db,ROOMS,state.roomId);}
function answersRef(round){return state.sdk.collection(state.db,ROOMS,state.roomId,"rounds",String(round),"answers");}
function answerRef(round,id){return state.sdk.doc(state.db,ROOMS,state.roomId,"rounds",String(round),"answers",id);}
function member(){return !!(player&&state.room?.members?.[player]===state.uid);}
function owner(){return member()&&state.room.hostUid===state.uid;}
function participants(){return Object.keys(state.room?.members||{}).sort((a,b)=>C.PLAYERS.indexOf(a)-C.PLAYERS.indexOf(b));}
function label(id){return C.LABELS[id]||id;}
function choosePlayer(id){
 if(!C.PLAYERS.includes(id))return;
 player=id;
 try{localStorage.setItem(STORAGE,id);}catch(_){}
 txt("playerName",label(id));$("picker").hidden=true;
 render();renderPicker();
}
function renderPicker(){
 $("choices").replaceChildren();
 for(const id of C.PLAYERS){
  const b=document.createElement("button");b.type="button";b.textContent=label(id);
  if(id===player)b.classList.add("chosen");
  b.addEventListener("click",()=>choosePlayer(id));
  $("choices").appendChild(b);
 }
}
$("playerButton").addEventListener("click",()=>{$("picker").hidden=false;renderPicker();});
$("closePicker").addEventListener("click",()=>$("picker").hidden=true);
$("picker").addEventListener("click",e=>{if(e.target===$("picker"))$("picker").hidden=true;});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("picker").hidden=true;});
txt("playerName",player?label(player):"選擇玩家");
if(!player)$("picker").hidden=false;
renderPicker();
function setRoomRoute(id){
 const url=new URL(location.href);
 if(id)url.searchParams.set("room",id);else url.searchParams.delete("room");
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function invitationLink(){
 const url=new URL(location.href);url.searchParams.set("room",state.roomId);
 return url.toString();
}
async function share(){
 if(!state.roomId)return;
 const link=invitationLink();
 try{
  if(navigator.share)await navigator.share({title:"SameWord 房間邀請",text:"🧠 一齊玩 30 秒默契挑戰！",url:link});
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(link);info("✅ 邀請連結已複製，可以發去群組！");}
  else window.prompt("複製房間連結",link);
 }catch(err){if(err?.name!=="AbortError")window.prompt("複製房間連結",link);}
}
$("shareRoom").addEventListener("click",share);
$("leaveRoom").addEventListener("click",()=>{
 if(state.unsubscribe)state.unsubscribe();
 state.unsubscribe=null;state.room=null;state.roomId=null;state.answers.clear();state.history.clear();
 state.answerKey=null;state.historyRequest.clear();state.loadAttempts.clear();setRoomRoute(null);render();
});
function attachRoom(id){
 if(!C.validRoom(id)){info("房間代碼無效。");return;}
 if(!state.ready){info("Firebase 尚未連接。");return;}
 if(state.unsubscribe)state.unsubscribe();
 state.roomId=id;state.room=null;state.answers.clear();state.history.clear();
 state.answerKey=null;state.previousStage="";state.historyRequest.clear();
 setRoomRoute(id);render();
 state.unsubscribe=state.sdk.onSnapshot(roomRef(),snap=>{
  if(!snap.exists()){
   info("搵唔到呢個房間，請檢查邀請連結。");
   if(state.unsubscribe)state.unsubscribe();
   state.unsubscribe=null;state.room=null;state.roomId=null;setRoomRoute(null);render();return;
  }
  const prior=state.room;
  state.room=snap.data();
  const key=String(state.room.round)+":"+state.room.stage;
  if(key!==state.previousStage){
   state.previousStage=key;
   state.answerKey=null;
   state.answers=new Map();
   if(state.room.stage==="input")$("answerWord").value="";
  }
  render();
  if(state.room.stage==="review"||state.room.stage==="between"||state.room.stage==="finished")loadRound(state.room.round,true);
  for(let n=1;n<state.room.round;n++)loadRound(n,false);
 },err=>firebaseError(err,"讀取房間"));
}
function checkName(){
 if(!player){$("picker").hidden=false;renderPicker();info("請先選擇玩家名稱。");return false;}
 if(!state.ready){info("Firebase 尚未連接。");return false;}
 return true;
}
async function createRoom(){
 if(!checkName()||state.busy)return;
 state.busy=true;render();
 try{
  const ref=state.sdk.doc(state.sdk.collection(state.db,ROOMS));
  await state.sdk.setDoc(ref,{
   hostUid:state.uid,hostPlayer:player,lastJoined:player,
   members:{[player]:state.uid},stage:"lobby",round:0,startedAt:null,
   submitted:[],agree:[],disagree:[],createdAt:state.sdk.serverTimestamp()
  });
  attachRoom(ref.id);info("✅ 房間已建立，分享連結俾朋友加入！");
 }catch(err){firebaseError(err,"建立房間");}
 finally{state.busy=false;render();}
}
$("createRoom").addEventListener("click",createRoom);
$("joinForm").addEventListener("submit",e=>{
 e.preventDefault();
 if(!checkName())return;
 const id=$("roomCode").value.trim();
 if(!C.validRoom(id)){info("房間代碼需要 20 個英數字元。");return;}
 attachRoom(id);
});
async function joinSelected(){
 if(!checkName()||!state.room||state.busy)return;
 if(state.room.stage!=="lobby"){info("遊戲已開始，暫時不能中途加入。");return;}
 const occupant=state.room.members?.[player];
 if(occupant===state.uid){info("你已經加入咗呢個房間。");return;}
 if(occupant){info("呢個名字已經由另一部裝置使用。請揀另一個名字。");return;}
 if(Object.keys(state.room.members).length>=7){info("房間已滿。");return;}
 state.busy=true;render();
 try{
  await state.sdk.updateDoc(roomRef(),{["members."+player]:state.uid,lastJoined:player});
  info("✅ 已加入房間！等房主開始遊戲。");
 }catch(err){firebaseError(err,"加入房間");}
 finally{state.busy=false;render();}
}
$("joinSelected").addEventListener("click",joinSelected);
async function startRoom(){
 if(!owner()||state.room.stage!=="lobby"||participants().length<2||state.busy)return;
 state.busy=true;
 try{
  await state.sdk.updateDoc(roomRef(),{
   stage:"input",round:1,startedAt:state.sdk.serverTimestamp()
  });
 }catch(err){firebaseError(err,"開始遊戲");}
 finally{state.busy=false;render();}
}
$("startRoom").addEventListener("click",startRoom);
function roundedSeconds(){
 const stamp=state.room?.startedAt;
 return C.countdown(stamp?.toMillis?.()??null);
}
function renderTimer(){
 if(!state.room||state.room.stage!=="input")return;
 const remaining=roundedSeconds();
 txt("countdown","00:"+String(remaining.seconds).padStart(2,"0"));
 $("timerFill").style.width=remaining.percent+"%";
 $("timerBox").classList.toggle("urgent",remaining.seconds<=10);
 const already=state.room.submitted?.includes(player);
 const editable=member()&&!already&&!remaining.expired&&!state.busy&&!!state.room.startedAt;
 $("answerWord").disabled=!editable;
 $("submitAnswer").disabled=!editable||!C.cleanWord($("answerWord").value);
 txt("answerHint",!member()?"你未有參加呢個房間，不能提交答案。":
 already?"✅ 你已經交咗答案，等待其他玩家。":
 remaining.expired?"⏰ 30 秒已到！未提交嘅玩家會顯示「逾時」。":
 "每人只可以交一個詞語；交咗就唔可以再改，其他人暫時睇唔到。");
}
function wordCard(id,word,me=false){
 const box=document.createElement("div");
 box.className="word"+(word==null?" missing":"")+(me?" mine":"");
 const name=document.createElement("b");name.textContent=label(id)+(me?"（我）":"");
 const value=document.createElement("span");value.textContent=word==null?"⏰ 逾時未答":word;
 box.append(name,value);
 return box;
}
function renderWords(host,answers,people){
 host.replaceChildren();
 for(const id of people)host.appendChild(wordCard(id,answers.get(id)?.word, id===player));
}
function renderLobby(){
 const list=$("lobbyNames");list.replaceChildren();
 for(const id of C.PLAYERS){
  const uid=state.room.members?.[id];
  const e=document.createElement("div");e.className="name"+(uid?" joined":"");
  const first=document.createElement("span");first.textContent=label(id)+(uid===state.uid?"（本機）":"");
  const second=document.createElement("small");second.textContent=uid?"✓ 已加入":"尚未加入";
  e.append(first,second);list.appendChild(e);
 }
 const people=participants();
 const available=state.room.stage==="lobby"&&!!player&&!state.room.members[player]&&people.length<7;
 $("joinSelected").hidden=!available;
 $("joinSelected").disabled=!available||state.busy;
 $("startRoom").hidden=!owner();
 $("startRoom").disabled=!owner()||people.length<2||state.busy;
 $("startRoom").textContent="▶ 開始遊戲（"+people.length+"/7 人）";
}
function renderVote(){
 if(!state.room||state.room.stage!=="review")return;
 const room=state.room,people=participants(),r=coreResult();
 txt("reviewTitle","第 "+room.round+" 輪 · 答案揭曉");
 txt("reviewBadge",r.submittedCount+"/"+r.playerCount+" 位已提交");
 renderWords($("currentWords"),state.answers,people);
 const hasVoted=room.agree.includes(player)||room.disagree.includes(player);
 $("agreeButton").disabled=!member()||hasVoted||state.busy||!state.history.has(room.round);
 $("disagreeButton").disabled=!member()||hasVoted||state.busy||!state.history.has(room.round);
 txt("voteStatus",r.allVoted?"全員已投票，正在處理結果…":
 hasVoted?"✅ 你已投票，等緊其他朋友（"+r.voteCount+"/"+r.playerCount+"）。":
 !member()?"你唔係呢個房間嘅參賽玩家。":
 !state.history.has(room.round)?"正在讀取大家嘅答案…":
 "睇完大家嘅詞語後，請投「同意」或「不同意」。"+
 " 目前 "+r.voteCount+"/"+r.playerCount+" 已投票。");
}
async function vote(agree){
 if(!member()||!state.room||state.room.stage!=="review"||state.busy)return;
 if(state.room.agree.includes(player)||state.room.disagree.includes(player))return;
 state.busy=true;renderVote();
 try{await state.sdk.updateDoc(roomRef(),{[agree?"agree":"disagree"]:state.sdk.arrayUnion(player)});}
 catch(err){firebaseError(err,"提交投票");}
 finally{state.busy=false;renderVote();}
}
$("agreeButton").addEventListener("click",()=>vote(true));
$("disagreeButton").addEventListener("click",()=>vote(false));
async function submitWord(e){
 e.preventDefault();
 if(!member()||!state.room||state.room.stage!=="input"||state.busy)return;
 const word=C.cleanWord($("answerWord").value);
 if(!word){info("請輸入一個詞語。");return;}
 if(roundedSeconds().expired){info("⏰ 30 秒已經完結！");return;}
 if(state.room.submitted.includes(player))return;
 const round=state.room.round;
 const batch=state.sdk.writeBatch(state.db);
 batch.set(answerRef(round,player),{uid:state.uid,playerId:player,word,submittedAt:state.sdk.serverTimestamp()});
 batch.update(roomRef(),{submitted:state.sdk.arrayUnion(player)});
 state.busy=true;renderTimer();
 try{await batch.commit();txt("answerHint","✅ 已成功提交，等待其他人揭曉！");}
 catch(err){firebaseError(err,"提交答案");}
 finally{state.busy=false;renderTimer();}
}
$("answerForm").addEventListener("submit",submitWord);
$("answerWord").addEventListener("input",()=>{
 if(Array.from($("answerWord").value).length>30)$("answerWord").value=C.cleanWord($("answerWord").value);
 renderTimer();
});
async function loadRound(round,current){
 if(!state.sdk||!state.room||round<1)return;
 if(state.history.has(round)&&!current)return;
 const key=state.roomId+":"+round;
 if(state.historyRequest.has(key))return;
 state.historyRequest.add(key);
 try{
  const snap=await state.sdk.getDocs(answersRef(round));
  if(!state.room||state.roomId!==key.split(":")[0])return;
  const map=new Map(snap.docs.map(d=>[d.id,d.data()]));
  state.history.set(round,map);
  if(current&&state.room.round===round)state.answers=map;
  renderHistory();if(current)renderVote();
 }catch(err){
  console.warn("Failed reading revealed round",err);
  const tries=state.loadAttempts.get(key)||0;
  if(tries<3 && state.roomId===key.split(":")[0] && state.room && state.room.round>=round){
   state.loadAttempts.set(key,tries+1);
   setTimeout(()=>loadRound(round,current),1200*(tries+1));
  }else if(current){info("暫時讀唔到已揭曉詞語，請稍後重新整理。");}
 }
 finally{state.historyRequest.delete(key);}
}
function renderHistory(){
 const host=$("historyList");host.replaceChildren();
 if(!state.room){$("historyPanel").hidden=true;return;}
 const count=state.room.stage==="input"?state.room.round-1:state.room.round;
 $("historyPanel").hidden=count<1;
 for(let i=count;i>=1;i--){
  const data=state.history.get(i);
  const block=document.createElement("div");block.className="history-round";
  const title=document.createElement("h3");title.textContent="Round "+i+" · "+(data?"答案紀錄":"讀取中…");
  block.appendChild(title);
  if(data){const words=document.createElement("div");words.className="words";renderWords(words,data,participants());block.appendChild(words);}
  host.appendChild(block);
 }
}
function render(){
 const inRoom=!!state.roomId;
 $("entryView").hidden=inRoom;$("roomView").hidden=!inRoom;
 $("createRoom").disabled=!state.ready||state.busy;
 $("joinRoom").disabled=!state.ready||state.busy;
 if(!inRoom)return;
 txt("displayRoomCode",state.roomId);
 if(!state.room){
  txt("stageBadge","房間載入中…");
  for(const id of ["lobby","inputStage","reviewStage","betweenStage","finishedStage"])$(id).hidden=true;
  return;
 }
 const stage=state.room.stage;
 const badges={lobby:"準備中",input:"⏱ 輸入倒數",review:"🗳️ 詞語揭曉",between:"🔄 下一輪",finished:"🏆 已成功"};
 txt("stageBadge",badges[stage]||stage);
 $("lobby").hidden=stage!=="lobby";
 $("inputStage").hidden=stage!=="input";
 $("reviewStage").hidden=stage!=="review";
 $("betweenStage").hidden=stage!=="between";
 $("finishedStage").hidden=stage!=="finished";
 if(stage==="lobby")renderLobby();
 if(stage==="input"){
  const count=coreResult();
  txt("roundTitle","第 "+state.room.round+" 輪 · 輸入詞語");
  txt("submittedBadge",count.submittedCount+"/"+count.playerCount+" 已提交");
  renderTimer();
 }
 if(stage==="review")renderVote();
 if(stage==="between")txt("transitionStatus","上一輪冇達成一致；新一輪會繼續保留之前嘅詞語。");
 if(stage==="finished")txt("finishedMessage","恭喜 "+participants().map(label).join("、")+"！你哋經過 "+state.room.round+" 輪成功達成一致。");
 renderHistory();
}
async function changeStage(patch){
 if(!state.room||state.busy)return;
 const now=Date.now();
 if(now-state.lastAdvance<1250)return;
 state.lastAdvance=now;
 try{await state.sdk.updateDoc(roomRef(),patch);}
 catch(err){if(err?.code!=="permission-denied"&&err?.code!=="failed-precondition")console.warn("Stage update",err);}
}
function tick(){
 if(!state.room||!member())return;
 const stage=state.room.stage,result=coreResult();
 if(stage==="input"){
  renderTimer();
  if(result.allSubmitted||roundedSeconds().expired)changeStage({stage:"review"});
 }
 if(stage==="review"&&result.allVoted){
  changeStage({stage:result.unanimous?"finished":"between"});
 }
 if(stage==="between"){
  // A short pause allows players to see the round result before the next 30 seconds.
  if(!state.betweenAt)state.betweenAt=Date.now();
  if(Date.now()-state.betweenAt>=2200)changeStage({
   stage:"input",round:state.sdk.increment(1),startedAt:state.sdk.serverTimestamp(),
   submitted:[],agree:[],disagree:[]
  });
 }else state.betweenAt=0;
}
setInterval(tick,220);
function connect(){
 const cfg=window.FRUITPOP_FIREBASE_CONFIG;
 if(!cfg?.apiKey||!cfg?.appId){txt("connectionMessage","無法讀取 Firebase 設定");return;}
 (async()=>{
  const version="13.1.0";
  const [f,a,d]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-firestore.js")
  ]);
  const firebaseApp=f.initializeApp(cfg,"friend-arcade-sameword");
  const signed=await a.signInAnonymously(a.getAuth(firebaseApp));
  state.uid=signed.user.uid;state.sdk=d;state.db=d.getFirestore(firebaseApp);
  state.ready=true;$("connectionDot").classList.add("online");
  txt("connectionMessage","🌐 已連接 Firebase · 可跨手機即時同步");
  render();
  const room=new URLSearchParams(location.search).get("room");
  if(C.validRoom(room))attachRoom(room);
 })().catch(err=>{
  txt("connectionMessage","⚠️ 連線失敗；請檢查 Firebase Authentication / Rules");
  firebaseError(err,"連接 Firebase");
 });
}
window.SameWordDebug={
 getState:()=>({player,ready:state.ready,roomId:state.roomId,stage:state.room?.stage,round:state.room?.round,
  members:participants(),submitted:state.room?.submitted||[],answers:[...state.answers.entries()],history:[...state.history.keys()]}),
 core:C
};
render();connect();
})();