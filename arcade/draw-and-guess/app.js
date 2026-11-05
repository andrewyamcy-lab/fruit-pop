const Core=window.DrawGuessCore;
const CODES="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOMS="friendarcade_drawguess_rooms_v1", LOBBIES="friendarcade_drawguess_lobbies_v1";
const $=id=>document.getElementById(id);
const state={
 sdk:null,db:null,uid:null,player:"",room:null,ref:null,code:"",
 unsubRoom:null,unsubLobbies:null,unsubStrokes:null,unsubGuesses:null,unsubChoices:null,
 lobbyState:"loading",availableLobbies:[],lastHeartbeatAt:0,
 strokeKey:"",judgeKey:"",secret:null,loadingSecret:false,
 segments:[],pointer:null,strokePoints:[],gesture:0,seq:0,lastFlush:0,
 brush:"#232332",size:6,choiceUsed:false,
 lastGuessAt:0,lastStatus:"",hostWarn:false,busy:false
};
const c=$("canvas"),ctx=c.getContext("2d");ctx.lineCap="round";ctx.lineJoin="round";
function say(message){
 $("connection").textContent=message;state.lastStatus=message;
 $("connectionDot").classList.toggle("online",message.startsWith("🟢"));
}
function notice(message){$("guessNotice").textContent=message;}
function err(error,message){console.warn(message,error);say("⚠️ "+message);notice(message);}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const named=id=>Core.LABELS[id]||id||"朋友";
function roomLink(code){const url=new URL(location.href);url.searchParams.set("room",code);return url.href;}

function lobbyRef(code){return state.sdk.doc(state.db,LOBBIES,code);}
function isJoinableLobby(lobby,now=Date.now()){
 const latest=lobby?.hostSeenAt?.toMillis?.()??lobby?.createdAt?.toMillis?.();
 return lobby?.stage==="lobby"&&Core.validCode(lobby.code)
  &&Core.PLAYERS.includes(lobby.hostPlayer)
  &&Number.isInteger(lobby.memberCount)&&lobby.memberCount>=1&&lobby.memberCount<7
  &&typeof latest==="number"&&Number.isFinite(latest)
  &&latest<=now+60000&&now-latest<=10*60*1000;
}
function renderAvailable(){
 const host=$("availableRooms");host.replaceChildren();
 if(state.lobbyState==="loading"||!state.db){
  $("availableCount").textContent="連線中…";
  host.appendChild(element("p","正在讀取朋友開放中嘅房間…","available-empty"));return;
 }
 if(state.lobbyState==="error"){
  $("availableCount").textContent="暫時無法載入";
  host.appendChild(element("p","⚠️ 暫時讀唔到公開房間。請先發布新 Firebase Rules，或者輸入房號加入。","available-empty"));return;
 }
 const items=state.availableLobbies.filter(item=>isJoinableLobby(item))
  .sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))
  .slice(0,8);
 $("availableCount").textContent=items.length+" 間開放中";
 if(!items.length){
  host.appendChild(element("p","暫時未有可以加入嘅房間。你可以建立新房間，或者輸入朋友嘅六位房號。","available-empty"));return;
 }
 for(const item of items){
  const row=element("div",undefined,"available-room");
  const header=element("div",undefined,"horizontal");
  const info=element("div"),title=element("strong","🎨 "+named(item.hostPlayer)+" 嘅房間");
  const meta=element("small","房號 "+item.code+" · 等待開始");
  info.append(title,meta);
  header.append(info,element("span",item.memberCount+" / 7","badge success"));
  const members=element("p","已加入："+(Array.isArray(item.memberNames)?item.memberNames.map(named).join("、"):"朋友"),"small");
  const progress=element("div",undefined,"available-progress");
  const fill=element("span");fill.style.width=Math.max(0,Math.min(100,item.memberCount/7*100))+"%";progress.appendChild(fill);
  const button=element("button","一鍵加入房間 →","primary wide");
  button.type="button";button.disabled=state.busy;
  button.addEventListener("click",()=>{
   if(!Core.PLAYERS.includes(selectedPlayer())){
    pendingPlayerAction=()=>{$("roomCodeInput").value=item.code;void joinRoom();};openPlayerPicker();return;
   }
   $("roomCodeInput").value=item.code;void joinRoom();
  });
  row.append(header,members,progress,button);host.appendChild(row);
 }
}
function startLobbyFeed(){
 if(state.unsubLobbies)state.unsubLobbies();
 state.lobbyState="loading";renderAvailable();
 // Only lobby summaries are queried: artist secrets and guesses are never listed.
 const q=state.sdk.query(state.sdk.collection(state.db,LOBBIES),
  state.sdk.where("stage","==","lobby"),state.sdk.limit(30));
 state.unsubLobbies=state.sdk.onSnapshot(q,snapshot=>{
  state.availableLobbies=snapshot.docs.map(doc=>({...doc.data(),code:doc.id}));
  state.lobbyState="ready";renderAvailable();
 },error=>{
  console.warn("Draw & Guess room discovery unavailable",error);
  state.availableLobbies=[];state.lobbyState="error";renderAvailable();
 });
}
async function hostHeartbeat(){
 if(!isHost()||state.room?.phase!=="lobby"||!state.db)return;
 const current=Date.now();if(current-state.lastHeartbeatAt<40000)return;
 state.lastHeartbeatAt=current;
 try{
  await state.sdk.updateDoc(lobbyRef(state.code),{hostSeenAt:state.sdk.serverTimestamp()});
 }catch(e){
  console.warn("Draw & Guess host presence could not refresh",e);
 }
}

function randomCode(){
 const array=new Uint32Array(6);crypto.getRandomValues(array);
 return [...array].map(v=>CODES[v%CODES.length]).join("");
}
function selectedPlayer(){return $("nameSelect").value;}
function syncPlayerDisplay(){
 const player=selectedPlayer();
 $("playerName").textContent=Core.LABELS[player]||"選擇玩家";
 document.querySelectorAll("[data-pick-player]").forEach(b=>{
  b.classList.toggle("selected",b.dataset.pickPlayer===player);
 });
}
function hidePlayerPicker(){$("playerPicker").hidden=true;$("playerButton").focus();}
function openPlayerPicker(){
 if(state.room)return;
 $("playerPicker").hidden=false;
 document.querySelector('[data-pick-player="'+(selectedPlayer()||"ada")+'"]')?.focus();
}
let pendingPlayerAction=null;
function savePlayer(p){
 state.player=p;$("nameSelect").value=p;syncPlayerDisplay();
 try{localStorage.setItem("friendarcade-player-v1",p);}catch(_){}
}
function mine(){return state.room&&state.room.members?.[state.player]===state.uid;}
function isHost(){return state.room?.ownerUid===state.uid;}
function isArtist(){return state.room?.artistUid===state.uid&&state.room?.artistId===state.player;}
function activeRound(){return state.room&&["drawing","choosing","result"].includes(state.room.phase);}
function roundRef(){return state.sdk.doc(state.db,ROOMS,state.code,"rounds",Core.roundId(state.room.turn));}
function secretRef(){return state.sdk.doc(roundRef(),"secret","current");}
function guessCollection(){return state.sdk.collection(roundRef(),"guesses");}
function choiceCollection(){return state.sdk.collection(roundRef(),"choices");}
function strokeCollection(){return state.sdk.collection(roundRef(),"strokes");}
function elapsed(){return state.room?.startedAt?.toMillis?Math.max(0,Date.now()-state.room.startedAt.toMillis()):0;}
function timerLeft(){return Math.max(0,Math.ceil((90000-elapsed())/1000));}
function element(tag,text,cls){
 const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;
}
function action(label,handler,style="secondary",disabled=false){
 const b=element("button",label,style);b.type="button";b.disabled=disabled;
 b.addEventListener("click",()=>{Promise.resolve().then(handler).catch(e=>err(e,"操作失敗，請再試。"));});return b;
}
function showEntry(){ $("entryView").hidden=false;$("gameLayout").hidden=true;$("playerButton").disabled=false;renderAvailable();}
function showGame(){ $("entryView").hidden=true;$("gameLayout").hidden=false;$("playerButton").disabled=true;$("playerPicker").hidden=true;}
function cleanSubs(){
 for(const key of ["unsubStrokes","unsubGuesses","unsubChoices"]){
  if(state[key]){state[key]();state[key]=null;}
 }
 state.strokeKey="";state.judgeKey="";state.segments=[];state.secret=null;state.loadingSecret=false;
 state.choiceUsed=false;state.seq=0;state.gesture=0;resetCanvas();
}
function resetCanvas(){ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);}
async function createRoom(){
 if(!state.db||state.busy)return;
 const p=selectedPlayer();if(!Core.PLAYERS.includes(p)){pendingPlayerAction=()=>void createRoom();openPlayerPicker();return;}
 state.busy=true;$("createRoom").disabled=true;
 try{
  for(let tries=0;tries<5;tries++){
   const code=randomCode(),ref=state.sdk.doc(state.db,ROOMS,code),publicRef=lobbyRef(code);
   try{
    await state.sdk.runTransaction(state.db,async tx=>{
     const [snap,publicSnap]=await Promise.all([tx.get(ref),tx.get(publicRef)]);
     if(snap.exists()||publicSnap.exists())throw new Error("CODE_COLLISION");
     const stamp=state.sdk.serverTimestamp();
     tx.set(ref,{ownerUid:state.uid,hostPlayer:p,members:{[p]:state.uid},lastJoined:p,
      roster:[],phase:"lobby",turn:-1,artistId:"",artistUid:"",scores:{[p]:0},solved:{},
      startedAt:null,hintCategory:"",hintLength:0,options:[],boardVersion:0,
      revealedAnswer:"",createdAt:stamp});
     tx.set(publicRef,{code,hostPlayer:p,memberNames:[p],memberCount:1,stage:"lobby",
       createdAt:stamp,hostSeenAt:stamp});
    });
    savePlayer(p);state.lastHeartbeatAt=Date.now();subscribeRoom(code);return;
   }catch(e){if(e.message==="CODE_COLLISION")continue;throw e;}
  }
  throw new Error("無法產生未使用嘅房號。");
 }catch(e){err(e,"建立房間失敗，請檢查 Firebase Rules。");}
 finally{state.busy=false;$("createRoom").disabled=false;}
}
async function joinRoom(){
 if(!state.db||state.busy)return;
 const p=selectedPlayer(),code=$("roomCodeInput").value.trim().toUpperCase();
 if(!Core.PLAYERS.includes(p)){pendingPlayerAction=()=>void joinRoom();openPlayerPicker();return;}
 if(!Core.validCode(code)){alert("房號需要 6 位英文字母或數字。");return;}
 state.busy=true;$("joinRoom").disabled=true;
 try{
  const ref=state.sdk.doc(state.db,ROOMS,code);
  await state.sdk.runTransaction(state.db,async tx=>{
   const publicRef=lobbyRef(code);
   const [snap,publicSnap]=await Promise.all([tx.get(ref),tx.get(publicRef)]);
   if(!snap.exists())throw new Error("房間不存在。");
   const room=snap.data(),assigned=room.members?.[p];
   if(assigned===state.uid)return;
   if(assigned)throw new Error("呢個玩家名字已經被另一部裝置使用。");
   if(room.phase!=="lobby")throw new Error("遊戲已經開始，暫時唔可以新加入。");
   if(Object.keys(room.members||{}).length>=7)throw new Error("房間已滿。");
   if(publicSnap.exists()&&publicSnap.data().stage!=="lobby")throw new Error("房間已經關閉，請揀其他房間。");
   tx.update(ref,{members:{...room.members,[p]:state.uid},lastJoined:p});
   if(publicSnap.exists()){
    const listed=publicSnap.data();
    tx.update(publicRef,{
     memberNames:[...(listed.memberNames||[]),p],
     memberCount:(listed.memberCount||0)+1
    });
   }
  });
  savePlayer(p);subscribeRoom(code);
 }catch(e){err(e,e.message||"加入房間失敗");}
 finally{state.busy=false;$("joinRoom").disabled=false;}
}
function subscribeRoom(code){
 if(state.unsubRoom)state.unsubRoom();
 cleanSubs();state.code=code;state.room=null;
 const url=new URL(location.href);url.searchParams.set("room",code);history.replaceState({},'',url.pathname+url.search);
 $("roomCode").textContent=code;showGame();
 state.ref=state.sdk.doc(state.db,ROOMS,code);
 state.unsubRoom=state.sdk.onSnapshot(state.ref,snap=>{
  if(!snap.exists()){say("⚠️ 房間已不存在");return;}
  const previous=state.room,room={...snap.data(),code};state.room=room;
  if(previous&&(previous.turn!==room.turn||previous.phase!==room.phase&&room.phase==="choosing"))cleanSubs();
  renderRoom();
  configureRound();
 },e=>err(e,"房間同步失敗。請檢查 Firebase Rules。"));
}
function renderRoom(){
 const r=state.room;if(!r)return;
 say("🟢 已連接房間 "+state.code);showGame();$("roomCode").textContent=state.code;
 const host=$("players");host.replaceChildren();
 for(const p of Core.PLAYERS){
  if(!r.members?.[p])continue;
  const box=element("div",undefined,"player"+(p===state.player?" you":""));
  box.append(element("span",named(p)),element("span",p===r.artistId?"🎨":p===state.player?"（我）":"✓"));
  host.appendChild(box);
 }
 const count=Object.keys(r.members||{}).length;
 $("lobbyStatus").textContent=r.phase==="lobby"?count+"/7 人已加入 · 至少 2 人即可測試，齊 7 人最適合正式玩":count+" 位朋友參與 · "+(r.turn>=0?"第 "+(r.turn+1)+" 回合":"等緊開始");
 const score=$("scoreboard");score.replaceChildren();
 for(const id of (r.roster?.length?r.roster:Object.keys(r.members||{})).slice().sort((a,b)=>(r.scores?.[b]||0)-(r.scores?.[a]||0))){
  const row=element("div",undefined,"score-row");row.append(element("span",named(id)+(id===r.artistId?" 🎨":"")),element("b",r.scores?.[id]||0));score.appendChild(row);
 }
 const labels={lobby:"等候其他朋友加入",choosing:"畫家揀題目中",drawing:"即時猜題進行中",result:"回合結果",finished:"全局結束"};
 $("stageName").textContent=(labels[r.phase]||"遊戲")+" · "+(r.turn>=0?(r.turn+1)+"/"+r.roster.length+" 回合":"大廳");
 $("stageDescription").textContent=r.artistId?"🎨 畫家："+named(r.artistId):"房主："+named(r.hostPlayer);
 $("clock").textContent=r.phase==="drawing"?timerLeft()+"s":"—";
 $("drawingTools").hidden=!(r.phase==="drawing"&&isArtist());
 $("canvas").classList.toggle("locked",!(r.phase==="drawing"&&isArtist()));
 $("guesserUI").hidden=!(r.phase==="drawing"&&mine()&&!isArtist()&&!r.solved?.[state.player]);
 $("roundResult").hidden=r.phase!=="result"&&r.phase!=="finished";
 if(r.phase==="result"){
  $("roundResult").textContent="🎉 正確答案："+(r.revealedAnswer||"未公布")+"　·　本回合 "+Object.keys(r.solved||{}).length+" 人猜中";
 }else if(r.phase==="finished"){
  const scores=Object.entries(r.scores||{}).sort((a,b)=>b[1]-a[1]);
  const winners=scores.filter(x=>x[1]===scores[0]?.[1]).map(x=>named(x[0])).join("、");
  $("roundResult").textContent="🏆 冠軍："+winners+"！　"+scores.map(x=>named(x[0])+": "+x[1]+"分").join(" · ");
 }
 updateGuessUI();renderActions();
}
function renderActions(){
 const box=$("gameActions"),r=state.room;box.replaceChildren();
 if(!r)return;
 if(r.phase==="lobby"&&isHost()){
  box.appendChild(action("▶ 開始遊戲（共 "+Object.keys(r.members).length+" 人）",startRoom,"primary",Object.keys(r.members).length<2));
 }
 if(r.phase==="choosing"&&isArtist())box.appendChild(action("🎨 選擇繪畫題目",openTopics,"primary"));
 if(r.phase==="drawing"&&isArtist())box.appendChild(action("⏭ 提早結束回合",()=>endRound(false),"secondary"));
 if(r.phase==="drawing"&&isHost()&&!isArtist()&&elapsed()>100000)box.appendChild(action("⏭ 畫家離線，跳過回合",()=>endRound(true),"secondary"));
 if(r.phase==="result"&&isHost())box.appendChild(action("➡ 下一回合",advanceRound,"primary"));
 if(r.phase==="finished")box.appendChild(action("🔄 新開一局",()=>location.href="./","secondary"));
}
async function startRoom(){
 if(!isHost()||state.room.phase!=="lobby")return;
 const roster=Object.keys(state.room.members).sort(),first=roster[0];
 if(roster.length<2)return;
 const scores=Object.fromEntries(roster.map(id=>[id,0]));
 const publicSnap=await state.sdk.getDoc(lobbyRef(state.code));
 const batch=state.sdk.writeBatch(state.db);
 batch.update(state.ref,{phase:"choosing",turn:0,roster,artistId:first,artistUid:state.room.members[first],scores,solved:{}});
 if(publicSnap.exists())batch.update(lobbyRef(state.code),{stage:"started"});
 await batch.commit();
}
let proposed=[];
function openTopics(){
 if(!isArtist()||state.room.phase!=="choosing")return;
 proposed=Core.candidates();const host=$("topicOptions");host.replaceChildren();
 for(const term of proposed){
  const b=element("button",undefined,"topic");
  b.append(element("b",term.answer),element("span",term.category+" · "+Array.from(term.answer).length+" 個字"));
  b.addEventListener("click",()=>selectTopic(term));
  host.appendChild(b);
 }
 $("topicModal").hidden=false;
}
async function selectTopic(term){
 if(!isArtist()||state.room.phase!=="choosing")return;
 $("topicModal").hidden=true;
 try{
  const secret={uid:state.uid,answer:term.answer,answerId:term.id,options:Core.choicesFor(term)};
  await state.sdk.setDoc(secretRef(),secret);
  state.secret=secret;
  await state.sdk.updateDoc(state.ref,{phase:"drawing",startedAt:state.sdk.serverTimestamp(),
   hintCategory:term.category,hintLength:Array.from(term.answer).length,options:[],revealedAnswer:"",solved:{},boardVersion:0});
  notice("成功揀題目，開始畫啦！");
 }catch(e){err(e,"未能開始回合，請先發布新安全規則。");}
}
$("closeTopics").addEventListener("click",()=>$("topicModal").hidden=true);
async function advanceRound(){
 if(!isHost()||state.room.phase!=="result")return;
 const next=state.room.turn+1;
 if(next>=state.room.roster.length){await state.sdk.updateDoc(state.ref,{phase:"finished"});return;}
 const id=state.room.roster[next];
 await state.sdk.updateDoc(state.ref,{phase:"choosing",turn:next,artistId:id,artistUid:state.room.members[id],
 startedAt:null,hintCategory:"",hintLength:0,options:[],boardVersion:0,solved:{},revealedAnswer:""});
}
async function endRound(force){
 const r=state.room;
 if(!r||r.phase!=="drawing")return;
 if(force){
  if(!isHost()||elapsed()<100000)return;
  await state.sdk.updateDoc(state.ref,{phase:"result",revealedAnswer:"（畫家離線，題目略過）"});return;
 }
 if(!isArtist()||!state.secret)return;
 if(elapsed()<90000&&Object.keys(r.solved||{}).length<r.roster.length-1){
  if(!confirm("仲有朋友未估中，要提早結束回合嗎？"))return;
 }
 await state.sdk.updateDoc(state.ref,{phase:"result",revealedAnswer:state.secret.answer});
}
function configureRound(){
 const r=state.room;if(!r||r.turn<0||!activeRound())return;
 const key=state.code+":"+r.turn;
 if(state.strokeKey!==key){
  if(state.unsubStrokes)state.unsubStrokes();
  state.strokeKey=key;state.segments=[];resetCanvas();
  state.unsubStrokes=state.sdk.onSnapshot(strokeCollection(),snap=>{
   state.segments=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.seq-b.seq);
   if(!isArtist()||state.room?.phase!=="drawing")renderCanvas();
  },e=>err(e,"畫板同步失敗"));
 }
 if(isArtist()&&r.phase==="drawing"){
  if(state.secret)startJudgeListeners();
  else loadArtistSecret();
 }
 if(r.phase==="choosing"&&isArtist()&&$("topicModal").hidden&&!state.secret)openTopics();
 if(r.phase==="result"||r.phase==="finished")renderCanvas();
 tick();
}
async function loadArtistSecret(){
 if(state.loadingSecret||state.secret||state.room?.phase!=="drawing")return;
 state.loadingSecret=true;
 try{
  const doc=await state.sdk.getDoc(secretRef());
  if(doc.exists()){state.secret=doc.data();startJudgeListeners();}
  else notice("私人題目尚未建立，請由畫家重新選題。");
 }catch(e){err(e,"無法讀取畫家私人題目。");}
 finally{state.loadingSecret=false;}
}
function startJudgeListeners(){
 const key=state.code+":"+state.room.turn;
 if(state.judgeKey===key||!isArtist()||!state.secret)return;
 state.judgeKey=key;
 const handled=new Set();
 const onDocs=snap=>{
  for(const d of snap.docs){
   if(d.data().verdict!=="pending"||handled.has(d.id))continue;
   handled.add(d.id);
   void judge(d).catch(e=>{handled.delete(d.id);console.warn("猜題判斷出錯",e);});
  }
 };
 state.unsubGuesses=state.sdk.onSnapshot(guessCollection(),onDocs,e=>err(e,"文字猜題同步失敗"));
 state.unsubChoices=state.sdk.onSnapshot(choiceCollection(),onDocs,e=>err(e,"四選一同步失敗"));
}
async function judge(doc){
 const data=doc.data(),r=state.room;
 if(!r||r.phase!=="drawing"||!state.secret)return;
 const member=r.members?.[data.playerId];
 if(!member||member!==data.uid||data.playerId===r.artistId)return;
 const term=Core.termById(state.secret.answerId);
 const correct=Core.matches(term,data.text);
 if(correct){
  await state.sdk.runTransaction(state.db,async tx=>{
   const snap=await tx.get(state.ref);
   if(!snap.exists())return;
   const room=snap.data();
   if(room.phase!=="drawing"||room.turn!==r.turn||room.solved?.[data.playerId])return;
   const ms=(data.createdAt?.toMillis?.()||Date.now())-(room.startedAt?.toMillis?.()||Date.now());
   const point=Core.pointsFor(data.mode,ms);
   const scores={...room.scores,[data.playerId]:(room.scores?.[data.playerId]||0)+point,
     [r.artistId]:(room.scores?.[r.artistId]||0)+20};
   tx.update(state.ref,{solved:{...room.solved,[data.playerId]:point},scores});
  });
 }
 await state.sdk.updateDoc(doc.ref,{verdict:correct?"correct":"wrong"});
}
function renderCanvas(){
 resetCanvas();
 const r=state.room;
 if(!r)return;
 const segs=state.segments.filter(s=>s.boardVersion===r.boardVersion);
 for(const seg of segs)drawPath(seg.points,seg.color,seg.width);
}
function drawPath(points,color,width){
 if(!Array.isArray(points)||!points.length)return;
 const list=points.filter(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
 if(!list.length)return;
 ctx.beginPath();ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap="round";ctx.lineJoin="round";
 ctx.moveTo(list[0][0],list[0][1]);
 for(let i=1;i<list.length;i++)ctx.lineTo(list[i][0],list[i][1]);
 if(list.length===1){ctx.lineTo(list[0][0]+.01,list[0][1]+.01);}
 ctx.stroke();
}
function mousePosition(e){
 const rect=c.getBoundingClientRect();
 return [Math.max(0,Math.min(c.width,Math.round((e.clientX-rect.left)/rect.width*c.width))),
         Math.max(0,Math.min(c.height,Math.round((e.clientY-rect.top)/rect.height*c.height)))];
}
function canDraw(){return state.room?.phase==="drawing"&&isArtist()&&elapsed()<90000;}
function beginStroke(e){
 if(!canDraw())return;
 e.preventDefault();c.setPointerCapture?.(e.pointerId);
 state.pointer=e.pointerId;state.gesture++;state.strokePoints=[mousePosition(e)];state.lastFlush=performance.now();
}
function continueStroke(e){
 if(state.pointer!==e.pointerId||!canDraw())return;
 e.preventDefault();const point=mousePosition(e),pts=state.strokePoints;
 if(!pts.length)return;
 const last=pts[pts.length-1];
 if(Math.abs(point[0]-last[0])+Math.abs(point[1]-last[1])<2)return;
 drawPath([last,point],state.brush,state.size);pts.push(point);
 if(performance.now()-state.lastFlush>190||pts.length>14)void flushStroke();
}
function flushStroke(){
 if(!state.strokePoints.length||!canDraw())return Promise.resolve();
 const points=state.strokePoints.slice(),version=state.room.boardVersion;
 state.strokePoints=[points[points.length-1]];state.lastFlush=performance.now();
 if(points.length===1)points.push(points[0]);
 const seq=++state.seq;
 return state.sdk.addDoc(strokeCollection(),{
  uid:state.uid,boardVersion:version,points,color:state.brush,width:state.size,seq,
  gesture:state.gesture,createdAt:state.sdk.serverTimestamp()
 }).catch(e=>console.warn("筆跡傳送失敗",e));
}
function stopStroke(e){
 if(state.pointer!==e.pointerId)return;
 e.preventDefault();
 const pt=mousePosition(e);
 if(state.strokePoints.length===1){
  const start=state.strokePoints[0];drawPath([start,pt],state.brush,state.size);state.strokePoints.push(pt);
 }
 void flushStroke();state.pointer=null;state.strokePoints=[];
}
c.addEventListener("pointerdown",beginStroke);
c.addEventListener("pointermove",continueStroke);
c.addEventListener("pointerup",stopStroke);
c.addEventListener("pointercancel",stopStroke);
for(const b of document.querySelectorAll("[data-color]")){
 b.addEventListener("click",()=>{
  state.brush=b.dataset.color;
  document.querySelectorAll("[data-color]").forEach(x=>x.classList.toggle("selected",x===b));
  $("eraser").classList.remove("selected");
 });
}
$("eraser").addEventListener("click",()=>{state.brush="#ffffff";$("eraser").classList.add("selected");document.querySelectorAll("[data-color]").forEach(x=>x.classList.remove("selected"));});
$("brushSize").addEventListener("input",e=>{state.size=Math.max(3,Math.min(20,Number(e.target.value)||6));});
$("clearBoard").addEventListener("click",async()=>{
 if(!canDraw())return;
 if(!confirm("清空所有人見到嘅畫？"))return;
 await state.sdk.updateDoc(state.ref,{boardVersion:state.sdk.increment(1)});
 resetCanvas();
});
function updateGuessUI(){
 const r=state.room;if(!r)return;
 const p=state.player,solved=!!r.solved?.[p],isGuessing=r.phase==="drawing"&&mine()&&!isArtist()&&!solved;
 $("guesserUI").hidden=!isGuessing;
 $("guessInput").disabled=!isGuessing;$("guessButton").disabled=!isGuessing;
 const showChoices=isGuessing&&elapsed()>=60000&&r.options?.length===4;
 $("choicesSection").hidden=!showChoices;
 if(showChoices){
  const wrap=$("choiceButtons");wrap.replaceChildren();
  for(const option of r.options){
   wrap.appendChild(action(option,()=>submitGuess(option,"choice"),"choice",state.choiceUsed));
  }
 }
}
async function submitGuess(value,mode="free"){
 if(!state.room||state.room.phase!=="drawing"||isArtist()||!mine()||state.room.solved?.[state.player])return;
 const text=String(value||"").trim();
 if(!text||Array.from(text).length>30)return;
 if(mode==="choice"&&(state.choiceUsed||elapsed()<60000||!state.room.options.includes(text)))return;
 const now=Date.now();
 if(now-state.lastGuessAt<1100){notice("請稍等一陣再估。");return;}
 if(elapsed()>=90000)return;
 state.lastGuessAt=now;
 const data={uid:state.uid,playerId:state.player,text,mode,verdict:"pending",createdAt:state.sdk.serverTimestamp()};
 try{
  let ref;
  if(mode==="choice"){
   ref=state.sdk.doc(choiceCollection(),state.player);
   await state.sdk.setDoc(ref,data);
   state.choiceUsed=true;
  }else{
   ref=await state.sdk.addDoc(guessCollection(),data);
   $("guessInput").value="";
  }
  notice("📨 已提交："+text+"，等畫家判定。");
  const unsub=state.sdk.onSnapshot(ref,snap=>{
   const verdict=snap.data()?.verdict;
   if(verdict==="correct"){notice("🎉 答啱！已取得分數。");unsub();}
   if(verdict==="wrong"){notice("❌ 未估中，再試吓！");unsub();}
  },()=>{});
  updateGuessUI();
 }catch(e){err(e,"未能提交猜測，請檢查網絡及規則。");}
}
$("guessForm").addEventListener("submit",e=>{e.preventDefault();void submitGuess($("guessInput").value,"free");});
function renderFeed(){
 const host=$("feed");host.replaceChildren();
 const r=state.room;
 if(!r)return;
 const solved=Object.keys(r.solved||{});
 if(!solved.length){host.appendChild(element("p","仲未有人猜中，繼續加油！","small"));return;}
 for(const name of solved){
  host.appendChild(element("div","✅ "+named(name)+" 猜中咗！（+"+r.solved[name]+" 分）","feed-item"));
 }
}
let lastRenderKey="";
function tick(){
 if(!state.room)return;
 if(state.room.phase==="lobby")void hostHeartbeat();
 const r=state.room;if(!r)return;
 if(r.phase==="drawing"){
  const seconds=timerLeft();$("clock").textContent=seconds+"s";
  const ms=elapsed();
  const myTurn=isArtist();
  if(myTurn){
   $("boardHint").textContent="🎨 你畫緊："+(state.secret?.answer||"準備中…")+"　·　其他人睇唔到答案";
   if(ms>=60000&&r.options?.length===0&&state.secret&&!state.publishingOptions){
    state.publishingOptions=true;
    state.sdk.updateDoc(state.ref,{options:state.secret.options}).catch(e=>console.warn("未能提供四選一",e)).finally(()=>{state.publishingOptions=false;});
   }
   if((ms>=90000||Object.keys(r.solved||{}).length>=r.roster.length-1)&&state.secret&&!state.ending){
    state.ending=true;void endRound(false).finally(()=>{state.ending=false;});
   }
  }else{
   $("boardHint").textContent=ms<30000?"✏️ 猜畫緊乜嘢？":ms<60000?"💡 "+r.hintCategory+" · "+r.hintLength+" 字":"🧩 最後 30 秒 · 四選一已開放";
  }
  $("hintPanel").textContent=ms<30000?"0–30 秒：自由輸入，最快猜中得 100 分":ms<60000?
   "30–60 秒：提示「"+r.hintCategory+" · "+r.hintLength+" 字」，文字猜中得 70 分":
   "60–90 秒：四選一猜中得 30 分；自由輸入猜中得 50 分。四選一每人只可以揀一次。";
  const phaseKey=r.turn+":"+Math.floor(ms/1000)+":"+r.options?.length+":"+Object.keys(r.solved||{}).length;
  if(lastRenderKey!==phaseKey){lastRenderKey=phaseKey;updateGuessUI();renderFeed();renderActions();}
 }else{
  $("boardHint").textContent=r.phase==="choosing"?"🎨 等畫家揀題目":r.phase==="lobby"?"👥 等緊其他玩家":r.phase==="result"?"🎉 回合已完成":"🏆 遊戲完結";
  $("hintPanel").textContent=r.phase==="lobby"?"房主等至少兩位朋友入房後，就可以開始。建議七位全部到齊。":r.phase==="choosing"?"由 "+named(r.artistId)+" 從三個題目入面揀一個。":r.phase==="result"?"正確答案："+r.revealedAnswer:"多謝大家參加！";
 }
}
$("shareRoom").addEventListener("click",async()=>{
 const url=roomLink(state.code);
 try{
  if(navigator.share)await navigator.share({title:"🎨 Friend Arcade 猜猜畫畫",url});
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);notice("✅ 已複製邀請連結，貼去 WhatsApp 就可以。");}
  else prompt("複製房間連結",url);
 }catch(e){if(e.name!=="AbortError")prompt("複製房間連結",url);}
});
$("playerButton").addEventListener("click",openPlayerPicker);
$("closePlayerPicker").addEventListener("click",hidePlayerPicker);
$("playerPicker").addEventListener("click",e=>{if(e.target===$("playerPicker"))hidePlayerPicker();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("playerPicker").hidden)hidePlayerPicker();});
document.querySelectorAll("[data-pick-player]").forEach(b=>b.addEventListener("click",()=>{
 const p=b.dataset.pickPlayer;
 if(!Core.PLAYERS.includes(p))return;
 $("nameSelect").value=p;
 syncPlayerDisplay();
 try{localStorage.setItem("friendarcade-player-v1",p);}catch(_){}
 hidePlayerPicker();
 const action=pendingPlayerAction;pendingPlayerAction=null;
 if(action)action();
}));
$("joinForm").addEventListener("submit",e=>{e.preventDefault();void joinRoom();});
$("createRoom").addEventListener("click",()=>void createRoom());
$("joinRoom").addEventListener("click",()=>void joinRoom());
$("roomCodeInput").addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);});
try{
 const saved=localStorage.getItem("friendarcade-player-v1");
 if(Core.PLAYERS.includes(saved))$("nameSelect").value=saved;
}catch(_){}
syncPlayerDisplay();
async function connect(){
 const cfg=window.FRUITPOP_FIREBASE_CONFIG;
 if(!cfg?.apiKey){say("⚠️ 未設定 Firebase");state.lobbyState="error";renderAvailable();return;}
 try{
  const version="13.1.0";
  const [A,Auth,F]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-firestore.js")
  ]);
  const app=A.initializeApp(cfg,"friendarcade-draw-guess");
  const signed=await Auth.signInAnonymously(Auth.getAuth(app));
  state.uid=signed.user.uid;state.sdk=F;state.db=F.getFirestore(app);
  say("🟢 Firebase 已連接 · 可跨手機即時同步");
  $("createRoom").disabled=false;$("joinRoom").disabled=false;
  const code=new URLSearchParams(location.search).get("room")?.toUpperCase();
  if(Core.validCode(code))$("roomCodeInput").value=code;
  showEntry();resetCanvas();startLobbyFeed();
 }catch(e){state.lobbyState="error";renderAvailable();err(e,"Firebase 無法連接，請確認匿名登入已啟用。");}
}
window.addEventListener("pagehide",()=>{state.unsubRoom?.();state.unsubLobbies?.();cleanSubs();});
window.DrawGuessDebug={state,Core,tick,elapsed,renderCanvas,submitGuess,renderAvailable,isJoinableLobby,startLobbyFeed};
setInterval(tick,350);
setInterval(()=>{if(!state.room&&state.lobbyState==="ready")renderAvailable();},30000);
connect();
