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
  $("welcome").textContent=player?"歡迎返嚟，"+player.name+"！":"準備好挑戰朋友未？";
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
  renderScores();
});
window.addEventListener("arcade-cloud-error",()=>{
  setCloudState("目前無法讀取雲端排行榜，請檢查網絡或 Firebase 設定。",false);
});
view(location.hash.slice(1)||"home");refreshPlayer();renderScores();
if(!selectedPlayer)openPicker();
if("serviceWorker" in navigator && location.protocol==="https:"){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
