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
const START_POSITIONS=[
  [.16,.26],[.39,.53],[.62,.23],[.84,.48],[.16,.74],[.49,.78],[.80,.76]
];
function makeFish(i){
 const size=rand(.027,.032),anchor=START_POSITIONS[i%FISH_COUNT],facing=i%2===0?1:-1;
 return {faceIndex:i,x:anchor[0]+rand(-.018,.018),y:anchor[1]+rand(-.018,.018),
  vx:facing*rand(.025,.037),vy:rand(-.009,.009),facing,tilt:0,
  tx:rand(.15,.85),ty:rand(.2,.78),changeIn:rand(1.3,3.8),speed:rand(.029,.047),
  size,palette:palettes[i%palettes.length],phase:rand(0,Math.PI*2),depth:rand(.94,1.07)};
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
function fishSpacing(){
 // Pixel-based distance keeps similar visual spacing across phone and desktop tanks.
 return clamp(worldW*.16,70,118);
}
function chooseTarget(f){
 // Give each fish a destination that is not already crowded by its neighbors.
 let best=null,bestClearance=-Infinity;
 for(let trial=0;trial<6;trial++){
   const x=rand(.13,.87),y=rand(.18,.78);
   let closest=Infinity;
   for(const other of fish){
     if(other===f)continue;
     closest=Math.min(closest,Math.hypot((x-other.x)*worldW,(y-other.y)*worldH));
   }
   const clearance=closest+rand(0,26);
   if(clearance>bestClearance){best={x,y};bestClearance=clearance;}
 }
 if(best){f.tx=best.x;f.ty=best.y;}
 f.changeIn=rand(2.3,5.8);
}

function addFood(x=.48,y=.12){
 const count=6;
 for(let i=0;i<count;i++)foods.push({x:clamp(x+rand(-.048,.048),.04,.96),y:clamp(y+rand(-.02,.02),.05,.83),vy:rand(.05,.095),life:7+rand(0,3),r:rand(2.3,3.3)});
 if(foods.length>90)foods.splice(0,foods.length-90);
 feedCount++;$("feedStat").textContent=String(feedCount);
 $("activityText").textContent="🍤 小魚聞到食物啦！睇吓邊條游得最快。";
}
function update(dt){
 // Frame-rate independent movement, gently limited after a background tab resumes.
 dt=clamp(dt,0,.05);
 elapsed+=dt;
 for(const b of bubbles){
   b.y-=b.speed*dt;b.x+=Math.sin(elapsed*1.3+b.phase)*.00008;
   if(b.y<-.03){b.y=1.04;b.x=rand(.03,.97);}
 }
 for(let i=foods.length-1;i>=0;i--){
   const food=foods[i];food.y=Math.min(.854,food.y+food.vy*dt);food.life-=dt;
   if(food.life<=0)foods.splice(i,1);
 }
 const spacing=fishSpacing();
 for(const f of fish){
   f.changeIn-=dt;
   let targetFood=null,nearest=.24;
   for(const food of foods){
     const d=Math.hypot((food.x-f.x)*worldW,(food.y-f.y)*worldH)/Math.max(1,worldW);
     if(d<nearest){nearest=d;targetFood=food;}
   }
   if(targetFood){
     f.tx=targetFood.x;f.ty=targetFood.y;
     if(Math.hypot((f.tx-f.x)*worldW,(f.ty-f.y)*worldH)<Math.max(9,worldW*f.size*.42)){
       const index=foods.indexOf(targetFood);
       if(index>=0)foods.splice(index,1);
       chooseTarget(f);targetFood=null;
     }
   }else if(f.changeIn<=0||Math.hypot((f.tx-f.x)*worldW,(f.ty-f.y)*worldH)<Math.max(18,spacing*.27)){
     chooseTarget(f);
   }
   const dx=(f.tx-f.x)*worldW,dy=(f.ty-f.y)*worldH;
   const distance=Math.hypot(dx,dy)||1;
   let desiredX=(dx/distance)*(f.speed*(targetFood?1.12:1));
   let desiredY=(dy/distance)*(f.speed*worldW/worldH*.66);
   // Small independent up/down glides feel more like swimming, not straight-line travel.
   desiredY+=Math.sin(elapsed*.85+f.phase)*.0055;
   let avoidX=0,avoidY=0;
   for(const other of fish){
     if(other===f)continue;
     let px=(f.x-other.x)*worldW,py=(f.y-other.y)*worldH;
     let d=Math.hypot(px,py);
     if(d<.001){
       const angle=(f.faceIndex*2.4+other.faceIndex)*2.399;
       px=Math.cos(angle);py=Math.sin(angle);d=1;
     }
     if(d>=spacing)continue;
     const urgency=(spacing-d)/spacing;
     const weight=urgency*(.75+urgency*1.6)*(targetFood?1.4:1);
     avoidX+=(px/d)*weight*125/worldW;
     avoidY+=(py/d)*weight*110/worldH;
   }
   // Soft boundaries keep fish visibly inside the tank before they touch glass.
   const margin=.15;
   if(f.x<margin)avoidX+=(margin-f.x)*.85;
   if(f.x>1-margin)avoidX-=(f.x-(1-margin))*.85;
   if(f.y<.19)avoidY+=(.19-f.y)*.8;
   if(f.y>.78)avoidY-=(f.y-.78)*.8;
   desiredX+=avoidX;desiredY+=avoidY;
   // Cap top speed so avoidance never shoots a fish across the screen.
   const speed=Math.hypot(desiredX,desiredY*worldH/worldW)||1;
   const maxSpeed=targetFood?.11:.092;
   if(speed>maxSpeed){const ratio=maxSpeed/speed;desiredX*=ratio;desiredY*=ratio;}
   const smooth=1-Math.exp(-dt*(targetFood?2.5:1.75));
   f.vx+=(desiredX-f.vx)*smooth;
   f.vy+=(desiredY-f.vy)*smooth;
   f.x+=f.vx*dt;f.y+=f.vy*dt;
   f.x=clamp(f.x,.095,.905);f.y=clamp(f.y,.14,.825);
   // Hysteresis prevents rapid left-right flips while a fish changes direction.
   if(f.vx>.011)f.facing=1;
   else if(f.vx<-.011)f.facing=-1;
   const tiltTarget=clamp(f.vy*worldH/(Math.max(.022,Math.abs(f.vx))*worldW)*.18,-.15,.15);
   f.tilt+=(tiltTarget-f.tilt)*(1-Math.exp(-dt*2.2));
 }
 // Short, small positional corrections prevent permanent portrait-over-portrait stacking.
 // Individual fish remain moving naturally; no teleportation.
 for(let pass=0;pass<2;pass++){
   for(let i=0;i<fish.length;i++)for(let j=i+1;j<fish.length;j++){
     const a=fish[i],b=fish[j];
     let dx=(a.x-b.x)*worldW,dy=(a.y-b.y)*worldH;
     let distance=Math.hypot(dx,dy);
     if(distance<.001){dx=1;dy=0;distance=1;}
     const minimum=spacing*.82;
     if(distance>=minimum)continue;
     const push=Math.min(3.2,(minimum-distance)*.18);
     const nx=dx/distance,ny=dy/distance;
     a.x=clamp(a.x+nx*push/worldW,.095,.905);
     a.y=clamp(a.y+ny*push/worldH,.14,.825);
     b.x=clamp(b.x-nx*push/worldW,.095,.905);
     b.y=clamp(b.y-ny*push/worldH,.14,.825);
   }
 }
}

function paintFish(f){
 const x=f.x*worldW,y=(f.y+Math.sin(elapsed*1.35+f.phase)*.002)*worldH;
 const s=clamp(worldW*.071,25,43)*(f.size/.029)*f.depth;
 const [light,dark,highlight]=f.palette;
 const tailSwing=Math.sin(elapsed*9.4+f.phase)*.22;
 const finSwing=Math.sin(elapsed*5+f.phase)*.13;
 // Fish body faces its actual horizontal swimming direction.
 // Facial portraits remain upright regardless of left/right turns.
 ctx.save();ctx.translate(x,y);ctx.scale(f.facing,1);ctx.rotate(f.tilt*f.facing);
 ctx.shadowColor="#033d5170";ctx.shadowBlur=s*.16;ctx.shadowOffsetY=s*.12;
 ctx.fillStyle=dark;ctx.beginPath();
 ctx.moveTo(-s*.90,0);
 ctx.lineTo(-s*1.78,-s*(.50+tailSwing));
 ctx.quadraticCurveTo(-s*1.43,0,-s*1.78,s*(.50-tailSwing));
 ctx.closePath();ctx.fill();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.fillStyle=light;ctx.beginPath();
 ctx.moveTo(-s*.45,-s*.40);ctx.quadraticCurveTo(-s*.10,-s*(1.10+finSwing),s*.48,-s*.49);ctx.fill();
 ctx.beginPath();
 ctx.moveTo(-s*.10,s*.26);ctx.quadraticCurveTo(-s*.52,s*(.97-finSwing),s*.34,s*.47);ctx.fill();
 const gradient=ctx.createLinearGradient(-s,-s*.56,s,s*.65);
 gradient.addColorStop(0,highlight);gradient.addColorStop(.46,light);gradient.addColorStop(1,dark);
 ctx.fillStyle=gradient;
 ctx.beginPath();ctx.ellipse(0,0,s*1.17,s*.67,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#ffffff4b";ctx.beginPath();
 ctx.ellipse(s*.05,-s*.34,s*.75,s*.12,-.10,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=dark;ctx.globalAlpha=.20;
 for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(-s*(.72-i*.3),0,s*.07,s*.46,0,0,Math.PI*2);ctx.fill();}
 ctx.globalAlpha=1;
 // Natural mouth at the nose; the photograph supplies the face and eyes.
 ctx.strokeStyle=dark;ctx.lineWidth=Math.max(.9,s*.038);ctx.lineCap="round";
 ctx.beginPath();ctx.arc(s*1.06,s*.12,s*.10,.15,1.65);ctx.stroke();
 ctx.restore();
 // Inset face: thinner tonal border and more visible fins/body (not a large sticker).
 const faceX=x+f.facing*s*.18,faceY=y-s*.025,r=s*.52;
 ctx.save();ctx.beginPath();ctx.arc(faceX,faceY,r,0,Math.PI*2);ctx.clip();
 const photo=FACE_IMAGES[f.faceIndex];
 if(photo&&photo.complete&&photo.naturalWidth>0){
   ctx.drawImage(photo,faceX-r,faceY-r,r*2,r*2);
 }else{
   ctx.fillStyle=highlight;ctx.fillRect(faceX-r,faceY-r,r*2,r*2);
   ctx.font="bold "+Math.round(r)+"px system-ui";ctx.textAlign="center";
   ctx.textBaseline="middle";ctx.fillStyle=dark;ctx.fillText(String(f.faceIndex+1),faceX,faceY);
 }
 ctx.restore();
 ctx.lineWidth=Math.max(1,s*.045);ctx.strokeStyle=light;
 ctx.beginPath();ctx.arc(faceX,faceY,r,0,Math.PI*2);ctx.stroke();
 ctx.lineWidth=Math.max(.8,s*.028);ctx.strokeStyle="#ffffffa6";
 ctx.beginPath();ctx.arc(faceX,faceY,r-1.5,Math.PI*.98,Math.PI*1.85);ctx.stroke();
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
window.__aquariumDebug={
 getState:()=>({fish:fish.length,faces:fish.map(f=>f.faceIndex+1),positions:fish.map(f=>({x:f.x,y:f.y,vx:f.vx,vy:f.vy,facing:f.facing,tilt:f.tilt})),spacing:fishSpacing(),
 imageSources:FACE_SOURCES.slice(),imagesLoaded:FACE_IMAGES.filter(img=>img.complete&&img.naturalWidth>0).length,
 foods:foods.length,paused,night:settings.night,feedCount,worldW,worldH}),
 addFood,update,draw,resize,makeFish,
 setFishPositions:p=>p.forEach((xy,i)=>{if(fish[i]){fish[i].x=xy[0];fish[i].y=xy[1];}}),
 stop:()=>cancelAnimationFrame(raf)
};
})();