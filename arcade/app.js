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
  $("welcome").textContent=player?"歡迎返嚟，"+player.name+"！👋":"七個朋友，一個共同基地。";
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
view(location.hash.slice(1)||"home");refreshPlayer();renderScores();renderHomeGatherings();renderHomeActivity();
if(!selectedPlayer)openPicker();
if("serviceWorker" in navigator && location.protocol==="https:"){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
