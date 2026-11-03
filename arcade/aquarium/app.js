(() => {
"use strict";
const $=id=>document.getElementById(id);
const canvas=$("aquarium"), ctx=canvas.getContext("2d",{alpha:false});
if(!ctx){$("activityText").textContent="此瀏覽器未能顯示動態水族箱。";return;}
const palettes=[
  ["#ffbd7c","#fa795b","#fff2d1"],["#ffdf76","#f1a645","#fff5c0"],
  ["#fbb0d0","#e867a9","#fff4f5"],["#b6a2f6","#7972d2","#e4defd"],
  ["#9be4d4","#3ab9a6","#d8fff5"],["#9fcdff","#438ed0","#d8f0ff"],
  ["#f5a8a1","#ed7065","#ffe1d7"],["#e2dd8f","#a8b754","#f5f8c5"]
];
const FISH_COUNT=7;
const FACE_SOURCES=Object.freeze(Array.from({length:FISH_COUNT},(_,i)=>"../../balls/ball"+(i+1)+".png"));
const FACE_IMAGES=FACE_SOURCES.map(src=>{
  const image=new Image();
  image.decoding="async";
  image.onload=()=>draw();
  image.onerror=()=>console.warn("人像圖片載入失敗：",src);
  image.src=src;
  return image;
});
const settingsKey="friendarcade-aquarium-v1";
let settings={night:false};
try{
 const old=JSON.parse(localStorage.getItem(settingsKey)||"null");
 if(old&&typeof old.night==="boolean")settings.night=old.night;
}catch(_){}
const save=()=>{try{localStorage.setItem(settingsKey,JSON.stringify({night:settings.night}));}catch(_){}};
const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
let paused=reduced, worldW=0,worldH=0,background=null,fish=[],bubbles=[],foods=[],feedCount=0, last=0,elapsed=0,raf=0,active=true;
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function makeFish(i){
 const size=rand(.027,.034);
 return {faceIndex:i,x:rand(.10,.90),y:rand(.18,.77),vx:rand(-.038,.038)||.025,vy:rand(-.008,.008),
 tx:rand(.12,.88),ty:rand(.17,.77),changeIn:rand(.7,3.3),speed:rand(.022,.055),
 size,palette:palettes[i%palettes.length],phase:rand(0,Math.PI*2),depth:rand(.85,1.08)};
}
// Fixed collection: exactly one fish for each original Fruit Pop ball (1–7).
for(let i=0;i<FISH_COUNT;i++)fish.push(makeFish(i));
$("fishStat").textContent=String(FISH_COUNT);
function backgroundPaint(){
 const bg=document.createElement("canvas");bg.width=Math.max(1,Math.round(worldW));bg.height=Math.max(1,Math.round(worldH));
 const g=bg.getContext("2d");const w=bg.width,h=bg.height;
 let grad=g.createLinearGradient(0,0,0,h);
 if(settings.night){grad.addColorStop(0,"#092843");grad.addColorStop(.6,"#07405a");grad.addColorStop(1,"#0e5860");}
 else{grad.addColorStop(0,"#58c5dd");grad.addColorStop(.55,"#148fa9");grad.addColorStop(1,"#116777");}
 g.fillStyle=grad;g.fillRect(0,0,w,h);
 if(!settings.night){
  for(let i=0;i<6;i++){
   const x=w*(.08+i*.17);g.fillStyle="#ffffff09";
   g.beginPath();g.moveTo(x,0);g.lineTo(x+w*.07,0);g.lineTo(x+w*.20,h*.83);g.lineTo(x+w*.035,h*.83);g.closePath();g.fill();
  }
 }
 g.fillStyle=settings.night?"#194c57":"#bcdda6";
 g.beginPath();g.moveTo(0,h*.88);
 for(let i=0;i<=18;i++){const x=w*i/18;g.lineTo(x,h*(.88+Math.sin(i*.67)*.009));}
 g.lineTo(w,h);g.lineTo(0,h);g.fill();
 for(let i=0;i<33;i++){
  const x=(i*97+31)%w,y=h*(.91+(i*13%7)*.011);
  g.beginPath();g.ellipse(x,y,rand(5,12),rand(2,5),0,0,Math.PI*2);
  g.fillStyle=settings.night?"#486967":i%3===0?"#c3dac9":"#dfd9b4";g.fill();
 }
 for(let n=0;n<12;n++){
  const x=w*(.025+n*.083),y=h*.91,l=h*(.15+(n*7%5)*.038);
  g.strokeStyle=settings.night?"#286f6a":n%3===0?"#168b79":"#248c78";
  g.lineWidth=clamp(w*.006,2,6);g.lineCap="round";
  for(let j=0;j<3;j++){
   const dx=(j-1)*w*.017;
   g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+dx,y-l*.35,x-dx*.8,y-l*.67,x+dx*1.4,y-l);
   g.stroke();
  }
 }
 for(let n=0;n<6;n++){
  const x=w*(.07+n*.173),y=h*.902,r=clamp(w*.015,5,12);
  g.fillStyle=settings.night?"#30647a":n%2?"#f4a0a1":"#f5b873";
  for(let j=0;j<4;j++){
   g.beginPath();g.ellipse(x+(j-1.5)*r*.75,y-j*r*.58,r*.38,r*1.17,-.25+j*.09,0,Math.PI*2);g.fill();
  }
 }
 background=bg;
}
function resize(){
 const rect=canvas.getBoundingClientRect(),w=Math.max(250,rect.width),h=Math.max(310,rect.height);
 worldW=w;worldH=h;
 const dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 backgroundPaint();draw();
}
function makeBubble(){
 return {x:rand(.04,.96),y:rand(.1,1.05),r:rand(1.2,4),speed:rand(.015,.07),phase:rand(0,6.28)};
}
for(let i=0;i<27;i++)bubbles.push(makeBubble());
function chooseTarget(f){
 f.tx=rand(.09,.91);f.ty=rand(.18,.77);f.changeIn=rand(1.5,4.5);
}
function addFood(x=.48,y=.12){
 const count=6;
 for(let i=0;i<count;i++)foods.push({x:clamp(x+rand(-.048,.048),.04,.96),y:clamp(y+rand(-.02,.02),.05,.83),vy:rand(.05,.095),life:7+rand(0,3),r:rand(2.3,3.3)});
 if(foods.length>90)foods.splice(0,foods.length-90);
 feedCount++;$("feedStat").textContent=String(feedCount);
 $("activityText").textContent="🍤 小魚聞到食物啦！睇吓邊條游得最快。";
}
function update(dt){
 elapsed+=dt;
 for(const b of bubbles){b.y-=b.speed*dt;b.x+=Math.sin(elapsed*1.3+b.phase)*.00008;if(b.y<-.03){b.y=1.04;b.x=rand(.03,.97);}}
 for(let i=foods.length-1;i>=0;i--){
  const food=foods[i];food.y=Math.min(.854,food.y+food.vy*dt);food.life-=dt;
  if(food.life<=0)foods.splice(i,1);
 }
 for(const f of fish){
  f.changeIn-=dt;
  let target=null,nearest=.22;
  for(const food of foods){
   const d=Math.hypot(food.x-f.x,(food.y-f.y)*1.25);
   if(d<nearest){nearest=d;target=food;}
  }
  if(target){
   f.tx=target.x;f.ty=target.y;
   if(Math.hypot(target.x-f.x,target.y-f.y)<f.size*.7){
    const index=foods.indexOf(target);if(index>=0)foods.splice(index,1);chooseTarget(f);
   }
  }else if(f.changeIn<=0||Math.hypot(f.tx-f.x,f.ty-f.y)<.05)chooseTarget(f);
  const dx=f.tx-f.x,dy=f.ty-f.y;
  const angle=Math.atan2(dy,dx),desiredX=Math.cos(angle)*f.speed,desiredY=Math.sin(angle)*f.speed*.75;
  const smoothing=Math.min(1,dt*(target?2.1:1.2));
  f.vx+=(desiredX-f.vx)*smoothing;f.vy+=(desiredY-f.vy)*smoothing;
  f.x+=f.vx*dt;f.y+=f.vy*dt;
  if(f.x<.055){f.x=.055;f.tx=rand(.35,.9);f.changeIn=3;}
  if(f.x>.945){f.x=.945;f.tx=rand(.1,.65);f.changeIn=3;}
  if(f.y<.12){f.y=.12;f.ty=rand(.32,.75);f.changeIn=3;}
  if(f.y>.82){f.y=.82;f.ty=rand(.2,.63);f.changeIn=3;}
 }
}
function paintFish(f){
 const x=f.x*worldW,y=f.y*worldH,
  s=clamp(worldW*.077,25,46)*(f.size/.029)*f.depth,
  angle=Math.atan2(f.vy*(worldH/worldW),f.vx);
 const [light,dark,highlight]=f.palette,tailSwing=Math.sin(elapsed*9+f.phase)*.27;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 // shadow and tail
 ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-s*.78,0);
 ctx.lineTo(-s*(1.65+Math.sin(tailSwing)*.16),-s*(.56+tailSwing));
 ctx.quadraticCurveTo(-s*1.26,0,-s*(1.65+Math.sin(tailSwing)*.16),s*(.56-tailSwing));
 ctx.closePath();ctx.fill();
 // dorsal and pectoral fins
 ctx.fillStyle=light;
 ctx.beginPath();ctx.moveTo(-s*.29,-s*.46);ctx.quadraticCurveTo(0,-s*1.13,s*.38,-s*.35);ctx.fill();
 ctx.beginPath();ctx.moveTo(-s*.18,s*.3);ctx.quadraticCurveTo(-s*.65,s*.77,s*.38,s*.45);ctx.fill();
 const g=ctx.createLinearGradient(-s,-s,s,s);
 g.addColorStop(0,highlight);g.addColorStop(.45,light);g.addColorStop(1,dark);
 ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,s*.99,s*.55,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#ffffff50";ctx.beginPath();ctx.ellipse(-s*.05,-s*.2,s*.55,s*.1,-.1,0,Math.PI*2);ctx.fill();
 // spot pattern
 ctx.fillStyle=dark;ctx.globalAlpha=.25;
 for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(-s*(.55-i*.33),0,s*.06,s*.42,0,0,Math.PI*2);ctx.fill();}
 ctx.globalAlpha=1;
 ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s*.56,-s*.18,Math.max(2,s*.14),0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#203e55";ctx.beginPath();ctx.arc(s*.61,-s*.18,Math.max(1.15,s*.075),0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=dark;ctx.lineWidth=Math.max(.8,s*.04);ctx.beginPath();ctx.arc(s*.68,s*.12,s*.09,.04,1.8);ctx.stroke();
 ctx.restore();
 // Keep the face upright even when a fish turns left.
 // Clip each original ball photo into a circular portrait over its fish body.
 ctx.save();ctx.translate(x,y);
 const portraitRadius=s*.63;
 ctx.beginPath();ctx.arc(0,0,portraitRadius,0,Math.PI*2);
 ctx.fillStyle=highlight;ctx.fill();
 ctx.save();ctx.clip();
 const photo=FACE_IMAGES[f.faceIndex];
 if(photo && photo.complete && photo.naturalWidth>0){
   ctx.drawImage(photo,-portraitRadius,-portraitRadius,portraitRadius*2,portraitRadius*2);
 }else{
   ctx.fillStyle="#fffc";ctx.fillRect(-portraitRadius,-portraitRadius,portraitRadius*2,portraitRadius*2);
   ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold "+Math.round(portraitRadius)+"px system-ui";
   ctx.fillStyle=dark;ctx.fillText(String(f.faceIndex+1),0,0);
 }
 ctx.restore();
 ctx.lineWidth=Math.max(1.6,s*.095);ctx.strokeStyle="#ffffffed";
 ctx.beginPath();ctx.arc(0,0,portraitRadius,0,Math.PI*2);ctx.stroke();
 ctx.restore();
}
function draw(){
 if(!worldW||!worldH||!background)return;
 ctx.drawImage(background,0,0,worldW,worldH);
 ctx.save();
 for(const b of bubbles){
  const x=b.x*worldW,y=b.y*worldH;
  ctx.strokeStyle=settings.night?"#def7ff79":"#e4fbff8c";ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(x,y,b.r,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#ffffff66";ctx.beginPath();ctx.arc(x-b.r*.28,y-b.r*.3,Math.max(.6,b.r*.18),0,Math.PI*2);ctx.fill();
 }
 fish.slice().sort((a,b)=>a.depth-b.depth).forEach(paintFish);
 for(const food of foods){
  ctx.fillStyle="#e99f62";ctx.beginPath();ctx.arc(food.x*worldW,food.y*worldH,food.r,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
function frame(t){
 raf=requestAnimationFrame(frame);
 if(!active||document.hidden||paused){last=t;return;}
 if(!last){last=t;return;}
 const dt=Math.min(.05,(t-last)/1000);last=t;
 update(dt);draw();
}
function refreshButtons(){
 $("pauseButton").textContent=paused?"▶ 繼續":"⏸ 暫停";
 $("pauseButton").setAttribute("aria-pressed",String(paused));
 $("modeButton").textContent=settings.night?"☀️ 日間模式":"🌙 夜間模式";
 $("modeButton").setAttribute("aria-pressed",String(settings.night));
 $("status").textContent=settings.night?"🌙 夜間水族箱":"🌊 海洋模式";
}
$("pauseButton").addEventListener("click",()=>{
 paused=!paused;last=0;refreshButtons();
 $("activityText").textContent=paused?"⏸ 小魚暫停游動。":"🐠 小魚又開始自由游動！";
});
$("modeButton").addEventListener("click",()=>{
 settings.night=!settings.night;save();backgroundPaint();draw();refreshButtons();
});
$("feedButton").addEventListener("click",()=>addFood(rand(.2,.8),.12));
canvas.addEventListener("pointerdown",event=>{
 if(event.pointerType==="mouse"&&event.button!==0)return;
 const rect=canvas.getBoundingClientRect();
 const x=clamp((event.clientX-rect.left)/rect.width,0,1);
 const y=clamp((event.clientY-rect.top)/rect.height,0,.8);
 addFood(x,y);
},{passive:true});
document.addEventListener("visibilitychange",()=>{last=0;active=!document.hidden;if(active)draw();});
window.addEventListener("pagehide",()=>{active=false;last=0;});
window.addEventListener("pageshow",()=>{active=true;last=0;});
window.addEventListener("resize",resize);
refreshButtons();resize();
if(reduced){$("activityText").textContent="已按系統減少動態效果設定暫停。按「繼續」可讓小魚游動。";}
raf=requestAnimationFrame(frame);
window.__aquariumDebug={getState:()=>({fish:fish.length,faces:fish.map(f=>f.faceIndex+1),imageSources:FACE_SOURCES.slice(),imagesLoaded:FACE_IMAGES.filter(img=>img.complete&&img.naturalWidth>0).length,foods:foods.length,paused,night:settings.night,feedCount,worldW,worldH}),addFood,update,draw,resize,makeFish,stop:()=>cancelAnimationFrame(raf)};
})();