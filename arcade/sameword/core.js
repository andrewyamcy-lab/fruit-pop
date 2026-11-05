(function(global){
"use strict";
const PLAYERS=Object.freeze(["ada","andrew","esther","jenny","rain","tom","yaki"]);
const LABELS=Object.freeze({ada:"Ada",andrew:"Andrew",esther:"Esther",jenny:"Jenny",rain:"Rain",tom:"Tom",yaki:"Yaki"});
const TIME_LIMIT=30;
function validRoom(id){return typeof id==="string"&&/^[A-Za-z0-9]{20}$/.test(id);}
function normalizeCode(v){return String(v||"").replace(/[^0-9]/g,"").slice(0,3);}
function validCode(v){return typeof v==="string"&&/^[0-9]{3}$/.test(v);}
function validLegacyCode(v){return typeof v==="string"&&/^[A-Z]{3}$/.test(v);}
function generateCode(bytes){
 if(!bytes||bytes.length<3)throw Error("Three random bytes needed");
 return Array.from(bytes).slice(0,3).map(n=>String(n%10)).join("");
}
const LOBBY_MAX_AGE_MS=6*60*60*1000;
function joinableLobby(data,now=Date.now()){
 const ts=data?.createdAt?.toMillis?.();
 return data?.stage==="lobby"&&data?.listed===true
  &&typeof ts==="number"&&Number.isFinite(ts)
  &&ts<=now+60000&&now-ts<=LOBBY_MAX_AGE_MS
  &&validRoom(data.roomId)&&validCode(data.code)
  &&PLAYERS.includes(data.hostPlayer)
  &&Number.isInteger(data.memberCount)&&data.memberCount>=1&&data.memberCount<7;
}
function cleanWord(word){return Array.from(String(word||"").trim().replace(/\s+/g," ")).slice(0,30).join("");}
function countdown(startedAt,now=Date.now()){
 const ms=startedAt==null?30000:Math.max(0,30000-(now-startedAt));
 return {ms,seconds:Math.ceil(ms/1000),expired:ms<=0,percent:Math.max(0,Math.min(100,ms/300))};
}
function result(room){
 const players=Object.keys(room?.members||{});
 const submitted=Array.isArray(room?.submitted)?room.submitted:[];
 const agree=Array.isArray(room?.agree)?room.agree:[];
 const disagree=Array.isArray(room?.disagree)?room.disagree:[];
 const allSubmitted=submitted.length===players.length&&players.length>=2;
 const allVoted=agree.length+disagree.length===players.length&&players.length>=2;
 const unanimous=allVoted&&allSubmitted&&agree.length===players.length&&disagree.length===0;
 return {playerCount:players.length,submittedCount:submitted.length,voteCount:agree.length+disagree.length,allSubmitted,allVoted,unanimous};
}
global.SameWordCore=Object.freeze({PLAYERS,LABELS,TIME_LIMIT,validRoom,validCode,validLegacyCode,normalizeCode,generateCode,joinableLobby,cleanWord,countdown,result});
})(window);