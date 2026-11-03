(() => {
"use strict";
const $ = id => document.getElementById(id);
const TOTAL = 10;
const MAX_CHARS = 30;
const FORTUNES = [
 "打走霉運，好運齊來！✨",
 "是非遠離，貴人常在！🧧",
 "煩惱退散，開心每一天！🌈",
 "事事順利，心想事成！🍀",
 "小人遠離，順風順水！🌟",
 "今日好運加倍，笑口常開！😄"
];
const state = {phase:"ready",name:"壞運氣",hits:0,soundOn:true,lastHitAt:-Infinity,finishTimer:null,soundContext:null};
const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
function countChars(input){return Array.from(input).length;}
function cleanName(raw){return Array.from(String(raw||"").trim()).slice(0,MAX_CHARS).join("");}
function showStatus(message){$("liveStatus").textContent=message;}
function updatePreview(){
 const value=cleanName($("targetName").value);
 $("paperName").textContent=value||"等待填寫…";
 $("startButton").disabled=!value;
}
function setHits(value){
 state.hits=Math.max(0,Math.min(TOTAL,value));
 $("hitCount").textContent=state.hits+" / "+TOTAL;
 $("hitProgress").setAttribute("aria-valuenow",String(state.hits));
 $("hitFill").style.width=(state.hits/TOTAL*100)+"%";
 $("paperCracks").style.opacity=String(Math.min(.68,state.hits/TOTAL*.65));
}
function clearEffects(){
 for(const id of ["paperButton","shoe","impact"]){
  const e=$(id);e.classList.remove("hit","finished","swing","pop");
 }
 $("confettiLayer").replaceChildren();
}
function startGame(){
 if(state.finishTimer!==null){clearTimeout(state.finishTimer);state.finishTimer=null;}
 const name=cleanName($("targetName").value);
 if(!name){$("targetName").focus();showStatus("請先填寫小人姓名或者煩惱名稱。");return false;}
 state.phase="playing";state.name=name;state.lastHitAt=-Infinity;
 $("targetName").value=name;$("paperName").textContent=name;
 $("paperButton").disabled=false;$("hitButton").disabled=false;
 $("resultPanel").hidden=true;$("instruction").textContent="👆 點小人紙或按「打一下！」";
 clearEffects();setHits(0);showStatus("用拖鞋拍 10 下，象徵式打走霉運！");
 return true;
}
function reset(){
 if(state.finishTimer!==null){clearTimeout(state.finishTimer);state.finishTimer=null;}
 state.phase="ready";state.lastHitAt=-Infinity;
 $("paperButton").disabled=true;$("hitButton").disabled=true;
 $("resultPanel").hidden=true;$("instruction").textContent="✨ 先填寫名稱，再開始拍打";
 clearEffects();setHits(0);updatePreview();
 showStatus("已重設。輸入名字後，按「開始」再玩！");
}
function sound(){
 if(!state.soundOn)return;
 try {
  const Constructor=window.AudioContext||window.webkitAudioContext;
  if(!Constructor)return;
  const ctx=state.soundContext||(state.soundContext=new Constructor());
  if(ctx.state==="suspended"){const pending=ctx.resume();pending?.catch?.(()=>{});}
  const t=ctx.currentTime;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type="triangle";
  osc.frequency.setValueAtTime(230,t);
  osc.frequency.exponentialRampToValueAtTime(95,t+.085);
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(.14,t+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,t+.14);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(t);osc.stop(t+.15);
 }catch(e){/* Audio is optional on devices that block Web Audio. */}
}
function animateStrike(){
 const paper=$("paperButton"),shoe=$("shoe"),impact=$("impact");
 paper.classList.remove("hit");shoe.classList.remove("swing");impact.classList.remove("pop");
 // Restart the CSS animations on each deliberate tap, including fast successive taps.
 void paper.offsetWidth;
 paper.classList.add("hit");shoe.classList.add("swing");impact.classList.add("pop");
}
function confetti(){
 const layer=$("confettiLayer");layer.replaceChildren();
 if(reducedMotion)return;
 const colors=["#fbe194","#fff3d4","#ed806e","#e7b964","#ffffff","#b97fce"];
 for(let i=0;i<30;i++){
  const item=document.createElement("span");item.className="confetti";
  item.style.setProperty("--x",(4+Math.random()*92).toFixed(1)+"%");
  item.style.setProperty("--delay",(Math.random()*.25).toFixed(2)+"s");
  item.style.setProperty("--duration",(1.05+Math.random()*.95).toFixed(2)+"s");
  item.style.setProperty("--rotation",(Math.random()*360).toFixed(0)+"deg");
  item.style.setProperty("--color",colors[i%colors.length]);
  item.addEventListener("animationend",()=>item.remove(),{once:true});
  layer.appendChild(item);
 }
}
function finish(){
 if(state.phase!=="playing"||state.hits!==TOTAL)return;
 state.phase="finished";$("paperButton").disabled=true;$("hitButton").disabled=true;
 $("instruction").textContent="🧧 大功告成！";
 $("paperButton").classList.remove("hit");
 $("paperButton").classList.add("finished");
 $("fortuneText").textContent=FORTUNES[Math.floor(Math.random()*FORTUNES.length)];
 showStatus("🎉 完成！打走煩惱，迎接好運！");
 confetti();
 const reveal=()=>{
  state.finishTimer=null;$("resultPanel").hidden=false;
  $("resultPanel").scrollIntoView?.({behavior:reducedMotion?"auto":"smooth",block:"nearest"});
 };
 state.finishTimer=setTimeout(reveal,reducedMotion?0:420);
}
function hit(){
 if(state.phase!=="playing")return;
 const now=performance.now();
 if(now-state.lastHitAt<105)return; // Prevent accidental double-firing on touch devices.
 state.lastHitAt=now;
 setHits(state.hits+1);sound();animateStrike();
 if(state.hits===TOTAL){finish();}
 else {
  const remaining=TOTAL-state.hits;
  showStatus("啪！已打 "+state.hits+" 下，仲差 "+remaining+" 下！");
 }
}
$("startForm").addEventListener("submit",event=>{event.preventDefault();startGame();});
$("targetName").addEventListener("input",()=>{if(countChars($("targetName").value)>MAX_CHARS)$("targetName").value=cleanName($("targetName").value);if(state.phase!=="playing")updatePreview();});
$("targetName").addEventListener("change",()=>{if(state.phase!=="playing")updatePreview();});
document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>{
 $("targetName").value=b.dataset.preset;updatePreview();$("targetName").focus();
}));
$("hitButton").addEventListener("click",hit);
$("paperButton").addEventListener("click",hit);
$("resetButton").addEventListener("click",reset);
$("againButton").addEventListener("click",()=>{
 reset();$("startButton").focus();
});
$("soundButton").addEventListener("click",()=>{
 state.soundOn=!state.soundOn;
 $("soundButton").textContent=state.soundOn?"🔊 音效開":"🔇 音效關";
 $("soundButton").setAttribute("aria-pressed",String(state.soundOn));
});
updatePreview();
window.__daSiuYanDebug={
 getState:()=>({phase:state.phase,name:state.name,hits:state.hits,soundOn:state.soundOn,finishPending:state.finishTimer!==null}),
 startGame,hit,reset,finish,cleanName,
 getFortunes:()=>FORTUNES.slice()
};
})();