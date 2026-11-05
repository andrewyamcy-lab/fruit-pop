"use strict";
const PLAYERS = [
  {id:"ada",name:"Ada"}, {id:"andrew",name:"Andrew"}, {id:"esther",name:"Esther"},
  {id:"jenny",name:"Jenny"}, {id:"rain",name:"Rain"}, {id:"tom",name:"Tom"},
  {id:"yaki",name:"Yaki"}
];
const STORAGE_KEY = "friendarcade-player-v1";
const $ = id => document.getElementById(id);
const isPlayer = value => PLAYERS.some(p => p.id === value);
let selectedPlayer = null, pendingLaunch = false, cloudReady = false, results = [];
try { const saved=localStorage.getItem(STORAGE_KEY); if(isPlayer(saved))selectedPlayer=saved; }catch(_){}
function writePlayer(id){ try{localStorage.setItem(STORAGE_KEY,id);}catch(_){} }
function setPlayer(id){
  if(!isPlayer(id))return;
  selectedPlayer=id;writePlayer(id);closePicker();refreshPlayer();renderScores();
  if(pendingLaunch){pendingLaunch=false;launchFruitPop();}
}
function refreshPlayer(){
  const player=PLAYERS.find(p=>p.id===selectedPlayer);
  $("currentName").textContent=player?player.name:"選擇玩家";
  $("welcome").textContent=player?player.name+"，今晚玩咩好？":"今晚玩咩好？";
  $("identityDescription").textContent=player
    ?"目前裝置選擇咗 "+player.name+"。進入 Fruit Pop 時會自動沿用呢個名稱。"
    :"選擇你嘅玩家名稱，之後進入 Fruit Pop 會自動沿用。";
  [...$("playerChoices").querySelectorAll("button")].forEach(b=>{
    b.classList.toggle("selected",b.dataset.player===selectedPlayer);
    b.setAttribute("aria-pressed",String(b.dataset.player===selectedPlayer));
  });
}
function openPicker(){
  $("playerOverlay").hidden=false;
  $("closePlayer").focus();
}
function closePicker(){$("playerOverlay").hidden=true;}
function launchFruitPop(){
  if(!selectedPlayer){pendingLaunch=true;openPicker();return;}
  const url=new URL("https://andrewyamcy-lab.github.io/fruit-pop/");
  url.searchParams.set("from","arcade");
  url.searchParams.set("player",selectedPlayer);
  window.location.assign(url.href);
}
function view(name){
  const allowed=["home","games","leaderboard","more"];
  const active=allowed.includes(name)?name:"home";
  document.querySelectorAll("[data-view]").forEach(node=>node.hidden=node.dataset.view!==active);
  document.querySelectorAll("[data-tab]").forEach(button=>{
    if(button.dataset.tab===active)button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  });
  if(active==="leaderboard")renderScores();
  window.scrollTo({top:0,behavior:"instant"});
}
function tab(name){window.location.hash=name;view(name);}
const fmt=n=>n>0?n.toLocaleString("zh-HK"):"—";
function summarized(){
  const totals=new Map(PLAYERS.map(p=>[p.id,{name:p.name,id:p.id,best:0,last:0,games:0,mostRecent:-1}]));
  for(const game of results){
    const row=totals.get(game.playerId);
    if(!row)continue;
    const score=Number(game.score);
    if(!Number.isInteger(score)||score<1||score>10000000)continue;
    row.games++;
    row.best=Math.max(row.best,score);
    if(Number(game.createdAt)>=row.mostRecent){row.mostRecent=Number(game.createdAt)||0;row.last=score;}
  }
  return [...totals.values()].sort((a,b)=>b.best-a.best||a.name.localeCompare(b.name));
}
function cell(row,tag,value,className){
  const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;row.appendChild(e);return e;
}
function renderScores(){
  const data=summarized();
  const top=$("topScores"),all=$("allScores");
  top.replaceChildren();all.replaceChildren();
  for(const [index,p] of data.entries()){
    const tr=document.createElement("tr");
    if(p.id===selectedPlayer)tr.classList.add("current");
    const rankCell=document.createElement("td");
    const rank=document.createElement("span");
    rank.className="rank"+(index===0&&p.best>0?" first":"");
    rank.textContent=String(index+1);
    rankCell.appendChild(rank);tr.appendChild(rankCell);
    cell(tr,"td",p.name);
    cell(tr,"td",fmt(p.best));
    if(index<3)top.appendChild(tr.cloneNode(true));
    cell(tr,"td",fmt(p.last));all.appendChild(tr);
  }
  const current=data.find(p=>p.id===selectedPlayer);
  $("yourBest").textContent=current&&cloudReady?fmt(current.best):"—";
}
function setCloudState(message,online){
  cloudReady=!!online;
  $("cloudStatus").textContent=message;$("leaderStatus").textContent=message;
  $("cloudDot").classList.toggle("on",online);$("leaderDot").classList.toggle("on",online);
  if(!online)$("yourBest").textContent="—";
}


/* Live rooms: subscribe only to the two PUBLIC lobby-summary collections. */
const LIVE_ROOM_CONFIG=Object.freeze({
 sameword:{title:"🧠 SameWord",path:"./sameword/",label:"默契挑戰",max:7},
 drawguess:{title:"🎨 猜猜畫畫",path:"./draw-and-guess/",label:"你畫我估",max:7}
});
const liveRoomFeeds={sameword:{status:"loading",rooms:[]},drawguess:{status:"loading",rooms:[]}};
function roomTimestamp(data){
 return data?.hostSeenAt?.toMillis?.() ?? data?.createdAt?.toMillis?.() ?? null;
}
function joinableFromHome(game,data,now=Date.now()){
 if(!LIVE_ROOM_CONFIG[game]||!data||data.stage!=="lobby")return false;
 const seen=roomTimestamp(data);
 if(!Number.isFinite(seen)||seen>now+60000||now-seen>600000)return false;
 if(!Number.isInteger(data.memberCount)||data.memberCount<1||data.memberCount>=7)return false;
 if(!isPlayer(data.hostPlayer))return false;
 if(game==="sameword"){
  return data.listed===true&&typeof data.code==="string"&&/^[0-9]{3}$/.test(data.code)
   &&typeof data.roomId==="string"&&/^[A-Za-z0-9]{20}$/.test(data.roomId);
 }
 return typeof data.code==="string"&&/^[A-HJ-NP-Z2-9]{6}$/.test(data.code);
}
function allJoinableRooms(now=Date.now()){
 const rooms=[];
 for(const game of Object.keys(LIVE_ROOM_CONFIG)){
  for(const item of liveRoomFeeds[game].rooms){
   if(joinableFromHome(game,item,now))rooms.push({...item,game,seen:roomTimestamp(item)});
  }
 }
 return rooms.sort((a,b)=>b.seen-a.seen||(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,8);
}
function displayName(id){return PLAYERS.find(x=>x.id===id)?.name||"朋友";}
function roomLink(room){
 if(room.game==="sameword")return "./sameword/?code="+encodeURIComponent(room.code);
 return "./draw-and-guess/?room="+encodeURIComponent(room.code)+"&join=1";
}
function liveRoomCard(room){
 const article=document.createElement("article");article.className="live-room "+room.game;
 const top=document.createElement("div");top.className="live-room-top";
 const title=document.createElement("strong");title.className="live-room-title";title.textContent=LIVE_ROOM_CONFIG[room.game].title;
 const badge=document.createElement("span");badge.className="live-room-badge";badge.textContent="● 等待加入";
 top.append(title,badge);
 const meta=document.createElement("p");meta.className="live-room-meta";
 meta.textContent="房主："+displayName(room.hostPlayer)+" · 房號："+room.code;
 const member=document.createElement("p");member.className="live-room-names";
 const names=Array.isArray(room.memberNames)?room.memberNames.filter(isPlayer).slice(0,7):[];
 member.textContent=names.length?"👥 已加入："+names.map(displayName).join("、"):"👥 有朋友等緊你";
 const bottom=document.createElement("div");bottom.className="live-room-bottom";
 const count=document.createElement("span");count.className="live-room-count";count.textContent=room.memberCount+" / 7 玩家";
 const spots=document.createElement("span");spots.className="live-room-spots";spots.textContent="仲有 "+(7-room.memberCount)+" 個位";
 bottom.append(count,spots);
 const track=document.createElement("div");track.className="live-room-track";
 const fill=document.createElement("div");fill.className="live-room-fill";fill.style.width=String(room.memberCount/7*100)+"%";track.appendChild(fill);
 const join=document.createElement("a");join.className="live-room-join";join.href=roomLink(room);
 join.textContent="加入房間 →";join.setAttribute("aria-label","加入 "+LIVE_ROOM_CONFIG[room.game].title+"，房主 "+displayName(room.hostPlayer));
 article.append(top,meta,member,bottom,track,join);
 return article;
}
function liveEmpty(title,message){
 const host=document.createElement("div");host.className="live-empty";
 const icon=document.createElement("span");icon.className="live-empty-icon";icon.textContent="🎲";
 const heading=document.createElement("strong");heading.textContent=title;
 const description=document.createElement("p");description.textContent=message;
 const actions=document.createElement("div");actions.className="live-empty-actions";
 for(const [href,label] of [["./sameword/","🧠 開 SameWord"],["./draw-and-guess/","🎨 開猜猜畫畫"]]){
  const a=document.createElement("a");a.href=href;a.textContent=label;actions.appendChild(a);
 }
 host.append(icon,heading,description,actions);return host;
}
function renderLiveRooms(){
 const host=$("liveRoomGrid");if(!host)return;
 const rooms=allJoinableRooms(),feeds=Object.values(liveRoomFeeds);
 const pending=feeds.every(x=>x.status==="loading");
 const errors=feeds.filter(x=>x.status==="error").length;
 const count=rooms.length;
 host.replaceChildren();
 $("heroRoomsCount").textContent=pending?"—":String(count);
 $("liveRoomBadge").textContent=pending?"…":String(count);
 $("activeRoomsStat").textContent=pending?"—":String(count);
 if(pending){
  $("liveRoomsStatus").textContent="正在連接即時房間…";
  $("heroRoomsHint").textContent="正在讀取朋友開放中嘅房間";
  const loading=document.createElement("div");loading.className="live-empty";loading.textContent="⏳ 正在讀取 SameWord 同猜猜畫畫嘅公開房間…";host.appendChild(loading);
  return;
 }
 if(count){
  for(const item of rooms)host.appendChild(liveRoomCard(item));
  $("liveRoomsStatus").textContent=count+" 間可以加入嘅房間"+(errors?" · 部分房間資料同步失敗":"")+" · 房主 10 分鐘內有活動";
  $("heroRoomsHint").textContent=count+" 間開放中，撳一下就可以加入朋友";
 }else{
  const allFailed=errors===feeds.length;
  const title=allFailed?"暫時無法讀取房間":"暫時未有等待中嘅房間";
  const explanation=allFailed?"可以先入遊戲頁用房號加入；請檢查 Firebase 匿名登入及最新安全規則。":
   errors?"部分房間暫時未能讀取；你仍然可以建立房間或者用房號加入。":
   "做第一個開房嘅朋友，邀請大家入嚟玩！";
  host.appendChild(liveEmpty(title,explanation));
  $("liveRoomsStatus").textContent=allFailed?"⚠️ 房間資料同步失敗":errors?"⚠️ 部分房間無法同步":"目前未有公開房間 · 建立一間邀請朋友";
  $("heroRoomsHint").textContent=allFailed?"暫時無法連接遊戲房間":errors?"部分遊戲房間未能同步":"而家未有人開房，不如你先開始？";
 }
}
window.addEventListener("arcade-cloud-rooms",event=>{
 const data=event.detail,feed=liveRoomFeeds[data?.game];if(!feed)return;
 feed.status="ready";feed.rooms=Array.isArray(data.rooms)?data.rooms:[];renderLiveRooms();
});
window.addEventListener("arcade-cloud-rooms-error",event=>{
 const feed=liveRoomFeeds[event.detail?.game];if(!feed)return;
 feed.status="error";feed.rooms=[];renderLiveRooms();
});
setInterval(()=>{if(!document.hidden)renderLiveRooms();},30000);
$("jumpLive").addEventListener("click",()=>$("liveRooms").scrollIntoView({behavior:"smooth",block:"start"}));
document.querySelectorAll("[data-scroll-live]").forEach(button=>button.addEventListener("click",()=>$("liveRooms").scrollIntoView({behavior:"smooth",block:"start"})));

/* Home dashboard: show live records only; never synthesize friends' activity. */
let gatherings = [], gatheringState = "loading";
function validGatheringLink(event) {
 const id=typeof event?.id==="string"&&/^[A-Za-z0-9]{20}$/.test(event.id)?event.id:null;
 return id?"./gatherings/?event="+encodeURIComponent(id):"./gatherings/";
}
function confirmedGatheringDate(event) {
 if(!event||event.status!=="confirmed")return null;
 const match=/^(20[2-9][0-9])-(0[1-9]|1[0-2])$/.exec(event.month||"");
 if(!match)return null;
 const year=Number(match[1]),month=Number(match[2]);
 const day=Number(event.confirmedDay);
 if(!Number.isInteger(day)||day<1||day>new Date(year,month,0).getDate())return null;
 return new Date(year,month-1,day,12);
}
function dateText(date){
 return new Intl.DateTimeFormat("zh-HK",{month:"long",day:"numeric",weekday:"short"}).format(date);
}
function upcomingConfirmedEvents(){
 const today=new Date();today.setHours(0,0,0,0);
 return gatherings.map(event=>({event,date:confirmedGatheringDate(event)}))
  .filter(item=>item.date&&item.date>=today)
  .sort((a,b)=>a.date-b.date);
}
function openGatherings(){
 const now=new Date(),currentMonth=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
 return gatherings.filter(event=>event.status==="open"
   && typeof event.month==="string"&&/^(20[2-9][0-9])-(0[1-9]|1[0-2])$/.test(event.month)
   && event.month>=currentMonth)
   .sort((a,b)=>a.month.localeCompare(b.month));
}
function appendEmpty(host,message,href,label){
 const p=document.createElement("p");p.className="dashboard-empty";p.textContent=message;
 if(href){const a=document.createElement("a");a.href=href;a.textContent=label;p.appendChild(document.createTextNode(" "));p.appendChild(a);}
 host.appendChild(p);
}
function eventCard(item,confirmed){
 const event=confirmed?item.event:item;
 const a=document.createElement("a");a.className="home-event"+(confirmed?" confirmed":"");a.href=validGatheringLink(event);
 const icon=document.createElement("span");icon.className="event-icon";icon.textContent=confirmed?"✅":"📅";
 const body=document.createElement("span");body.className="event-copy";
 const title=document.createElement("strong");title.textContent=event.title||"朋友聚會";
 const sub=document.createElement("small");
 sub.textContent=confirmed?dateText(item.date)+" · 已確認":event.month+" · 等緊大家揀得閒日子";
 const arrow=document.createElement("span");arrow.className="chevron";arrow.textContent="›";
 body.append(title,sub);a.append(icon,body,arrow);return a;
}
function renderHomeGatherings(){
 const title=$("heroGatheringTitle"),detail=$("heroGatheringDate"),link=$("heroGatheringLink");
 const host=$("upcomingGatherings"),status=$("gatheringsStatus");host.replaceChildren();
 if(gatheringState==="loading"){
  title.textContent="下一次聚會，由你哋決定！";detail.textContent="正在讀取已確認嘅聚會…";
  status.textContent="正在連接聚會資料…";
  appendEmpty(host,"正在讀取聚會資料…");link.href="./gatherings/";return;
 }
 if(gatheringState==="error"){
  title.textContent="一齊約下一次聚會！";detail.textContent="暫時未能讀取聚會資料";
  status.textContent="⚠️ 聚會資料暫時無法同步；可直接前往聚會日曆。";
  appendEmpty(host,"未能讀取 Firebase 聚會紀錄。","./gatherings/","前往聚會日曆 →");link.href="./gatherings/";return;
 }
 const confirmed=upcomingConfirmedEvents(),open=openGatherings();
 status.textContent=confirmed.length+" 場即將舉行 · "+open.length+" 場待投票";
 if(confirmed.length){
  const next=confirmed[0];
  title.textContent=next.event.title||"已確認聚會";
  detail.textContent="🗓 "+dateText(next.date)+" · 已確認";
  link.href=validGatheringLink(next.event);link.textContent="查看聚會詳情 →";
 }else if(open.length){
  title.textContent=open[0].title||"待安排聚會";
  detail.textContent=open[0].month+" · 仲等緊朋友投票";
  link.href=validGatheringLink(open[0]);link.textContent="幫手揀日子 →";
 }else{
  title.textContent="下一次聚會，由你哋決定！";
  detail.textContent="暫時未有已確認嘅未來聚會";
  link.href="./gatherings/";link.textContent="建立新聚會 →";
 }
 const cards=confirmed.slice(0,2).map(item=>({item,confirmed:true}));
 for(const e of open.slice(0,Math.max(0,3-cards.length)))cards.push({item:e,confirmed:false});
 if(cards.length)for(const card of cards)host.appendChild(eventCard(card.item,card.confirmed));
 else appendEmpty(host,"暫時未有未來聚會，立即同朋友約個日子！","./gatherings/","建立聚會 →");
}
function renderHomeActivity(){
 const host=$("activityFeed");host.replaceChildren();
 const activity=[];
 for(const game of results){
  const name=PLAYERS.find(p=>p.id===game.playerId);
  const score=Number(game.score),time=Number(game.createdAt);
  if(!name||!Number.isInteger(score)||score<=0||score>10000000||!Number.isFinite(time)||time<=0)continue;
  activity.push({time,icon:"🏆",title:name.name+" · Fruit Pop "+score.toLocaleString("zh-HK")+" 分",meta:"已完成遊戲 · "+dateText(new Date(time)),url:"./#leaderboard"});
 }
 for(const event of gatherings){
  const time=Number(event.createdAt);
  if(!Number.isFinite(time)||time<=0||typeof event.title!=="string")continue;
  const confirmed=event.status==="confirmed";
  activity.push({time,icon:confirmed?"✅":"📅",title:(confirmed?"已確認：":"聚會投票：")+event.title,
   meta:(event.month||"")+(confirmed?" · 已確認":" · 待大家選日子"),url:validGatheringLink(event)});
 }
 activity.sort((a,b)=>b.time-a.time);
 if(!activity.length){
  appendEmpty(host,gatheringState==="loading"&&!cloudReady?"正在讀取朋友活動…":"暫時未有最新紀錄。玩一局 Fruit Pop 或建立聚會，就會喺呢度顯示。");
  return;
 }
 for(const item of activity.slice(0,4)){
  const a=document.createElement("a");a.className="activity-entry";a.href=item.url;
  const icon=document.createElement("span");icon.className="activity-icon";icon.textContent=item.icon;
  const body=document.createElement("span");body.className="activity-copy";
  const name=document.createElement("strong");name.textContent=item.title;
  const sub=document.createElement("small");sub.textContent=item.meta;
  body.append(name,sub);a.append(icon,body);host.appendChild(a);
 }
}

for(const player of PLAYERS){
  const b=document.createElement("button");
  b.type="button";b.dataset.player=player.id;b.textContent=player.name;
  b.addEventListener("click",()=>setPlayer(player.id));
  $("playerChoices").appendChild(b);
}
document.querySelectorAll("[data-launch]").forEach(button=>button.addEventListener("click",launchFruitPop));
document.querySelectorAll("[data-switch]").forEach(button=>button.addEventListener("click",()=>tab(button.dataset.switch)));
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>tab(button.dataset.tab)));
$("playerPill").addEventListener("click",openPicker);
$("changePlayer").addEventListener("click",openPicker);
$("closePlayer").addEventListener("click",()=>{pendingLaunch=false;closePicker();});
$("skipPlayer").addEventListener("click",()=>{pendingLaunch=false;closePicker();});
$("playerOverlay").addEventListener("click",e=>{if(e.target===$("playerOverlay")){pendingLaunch=false;closePicker();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("playerOverlay").hidden){pendingLaunch=false;closePicker();}});
$("refreshScores").addEventListener("click",()=>window.location.reload());
window.addEventListener("hashchange",()=>view(location.hash.slice(1)));
window.addEventListener("arcade-cloud-scores",e=>{
  results=Array.isArray(e.detail?.rows)?e.detail.rows:[];
  setCloudState("🌐 已連接 Firebase · 跨裝置即時同步",true);
  renderScores();renderHomeActivity();
});
window.addEventListener("arcade-cloud-error",()=>{
  setCloudState("目前無法讀取雲端排行榜，請檢查網絡或 Firebase 設定。",false);
});
window.addEventListener("arcade-cloud-gatherings",e=>{
  gatherings=Array.isArray(e.detail?.events)?e.detail.events:[];
  gatheringState="ready";renderHomeGatherings();renderHomeActivity();
});
window.addEventListener("arcade-cloud-gatherings-error",()=>{
  gatheringState="error";renderHomeGatherings();renderHomeActivity();
});
view(location.hash.slice(1)||"home");refreshPlayer();renderScores();renderHomeGatherings();renderHomeActivity();renderLiveRooms();
if(!selectedPlayer)openPicker();
if("serviceWorker" in navigator && location.protocol==="https:"){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
