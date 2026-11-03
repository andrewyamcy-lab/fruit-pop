(function(global){
"use strict";
const PLAYERS=["ada","andrew","esther","jenny","rain","tom","yaki"];
const LABELS={ada:"Ada",andrew:"Andrew",esther:"Esther",jenny:"Jenny",rain:"Rain",tom:"Tom",yaki:"Yaki"};
function validMonth(value){return /^20[2-9]\d-(0[1-9]|1[0-2])$/.test(value);}
function daysInMonth(month){
 if(!validMonth(month))return 0;
 const [year,number]=month.split("-").map(Number);
 return new Date(Date.UTC(year,number,0)).getUTCDate();
}
function firstWeekday(month){
 if(!validMonth(month))return 0;
 const [year,number]=month.split("-").map(Number);
 return new Date(Date.UTC(year,number-1,1)).getUTCDay();
}
function dateLabel(month,day){
 if(!validMonth(month)||!Number.isInteger(day)||day<1||day>daysInMonth(month))return "";
 const [year,number]=month.split("-").map(Number);
 const weekday=["日","一","二","三","四","五","六"][new Date(Date.UTC(year,number-1,day)).getUTCDay()];
 return year+" 年 "+number+" 月 "+day+" 日（星期"+weekday+"）";
}
function summary(month,votes){
 const count=daysInMonth(month);
 const days=Array(count+1).fill(0);
 const namesByDay=Array.from({length:count+1},()=>[]);
 const submitted=new Set();
 for(const v of votes){
  if(!v||!PLAYERS.includes(v.playerId)||submitted.has(v.playerId))continue;
  submitted.add(v.playerId);
  const unique=new Set(Array.isArray(v.days)?v.days:[]);
  for(const d of unique){
   if(Number.isInteger(d)&&d>=1&&d<=count){days[d]++;namesByDay[d].push(v.playerId);}
  }
 }
 const allFree=[],ranked=[];
 for(let d=1;d<=count;d++){
  if(days[d]===PLAYERS.length)allFree.push(d);
  ranked.push({day:d,count:days[d]});
 }
 ranked.sort((a,b)=>b.count-a.count||a.day-b.day);
 const max=ranked[0]?.count||0;
 return {submitted:[...submitted],submittedCount:submitted.size,counts:days,namesByDay,allFree,ranked,bestCandidates:ranked.filter(x=>x.count===max&&max>0)};
}
global.GatheringCore=Object.freeze({PLAYERS,LABELS,validMonth,daysInMonth,firstWeekday,dateLabel,summary});
})(window);