(function(global){
"use strict";
const PLAYERS=["ada","andrew","esther","jenny","rain","tom","yaki"];
const LABELS=Object.freeze({ada:"Ada",andrew:"Andrew",esther:"Esther",jenny:"Jenny",rain:"Rain",tom:"Tom",yaki:"Yaki"});
const TERMS=[
["交通","巴士","公車,公共汽車,bus"],["交通","的士","計程車,taxi"],["交通","港鐵","地鐵,鐵路,mtr,subway"],["交通","單車","自行車,bicycle,bike"],["交通","飛機","airplane,plane"],["交通","電車","tram,叮叮"],["交通","直升機","helicopter"],["交通","巴士站","bus stop"],["交通","渡輪","ferry"],["交通","救護車","ambulance"],
["香港美食","菠蘿包","pineapple bun,波羅包"],["香港美食","雞蛋仔","egg waffle"],["香港美食","蛋撻","egg tart"],["香港美食","魚蛋","fish ball,魚丸"],["香港美食","奶茶","milk tea"],["香港美食","叉燒飯","char siu rice"],["香港美食","燒賣","siu mai"],["香港美食","雪糕","ice cream,冰淇淋"],["香港美食","火鍋","hotpot,打邊爐"],["香港美食","珍珠奶茶","bubble tea"],
["動物","熊貓","panda"],["動物","長頸鹿","giraffe"],["動物","企鵝","penguin"],["動物","貓","cat,貓咪"],["動物","狗","dog,狗狗"],["動物","兔仔","兔子,rabbit"],["動物","鯊魚","shark"],["動物","海豚","dolphin"],["動物","猴子","monkey,馬騮"],["動物","獅子","lion"],
["生活用品","手機","電話,mobile phone,phone"],["生活用品","雨傘","umbrella"],["生活用品","牙刷","toothbrush"],["生活用品","風筒","吹風機,hair dryer"],["生活用品","眼鏡","glasses"],["生活用品","鬧鐘","alarm clock"],["生活用品","背囊","背包,backpack"],["生活用品","風扇","fan"],["生活用品","雪櫃","冰箱,fridge"],["生活用品","電視","television,tv"],
["香港地標","天星小輪","star ferry"],["香港地標","維多利亞港","維港,victoria harbour"],["香港地標","大佛","天壇大佛,big buddha"],["香港地標","摩天輪","ferris wheel"],["香港地標","青馬大橋","tsing ma bridge"],["香港地標","山頂纜車","peak tram"],["香港地標","尖沙咀","tsim sha tsui,tst"],["香港地標","太平山","victoria peak"],["香港地標","獅子山","lion rock"],["香港地標","海洋公園","ocean park"],
["活動","游水","游泳,swimming"],["活動","籃球","basketball"],["活動","足球","football,soccer"],["活動","打機","玩遊戲,gaming"],["活動","唱K","卡拉OK,karaoke"],["活動","瞓覺","睡覺,sleeping"],["活動","跳舞","dancing"],["活動","行山","hiking"],["活動","煮飯","cooking"],["活動","影相","拍照,攝影,photography"]
].map(([category,answer,synonyms],i)=>({id:i,category,answer,aliases:synonyms.split(",")}));
function normalize(input){
 return String(input??"").normalize("NFKC").toLocaleLowerCase()
  .replace(/[\s\p{P}\p{S}]/gu,"").trim();
}
function matches(term,guess){
 if(!term)return false;
 const normalized=normalize(guess);
 return !!normalized&&[term.answer,...term.aliases].some(x=>normalize(x)===normalized);
}
function termById(id){return TERMS.find(item=>item.id===Number(id))||null;}
function choicesFor(term,random=Math.random){
 const others=TERMS.filter(x=>x.id!==term.id&&x.category===term.category).map(x=>x.answer);
 for(let i=others.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[others[i],others[j]]=[others[j],others[i]];}
 const values=[term.answer,...others.slice(0,3)];
 for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
 return values;
}
function candidates(random=Math.random){
 const values=TERMS.slice();
 for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
 return values.slice(0,3);
}
function pointsFor(mode,elapsedMs){
 if(mode==="choice")return 30;
 return elapsedMs<30000?100:elapsedMs<60000?70:50;
}
function remaining(startedAt,now=Date.now()){return Math.max(0,90-Math.floor((now-startedAt)/1000));}
function validCode(code){return /^[A-HJ-NP-Z2-9]{6}$/.test(String(code||""));}
function roundId(turn){return String(turn);}
global.DrawGuessCore=Object.freeze({PLAYERS,LABELS,TERMS,normalize,matches,termById,choicesFor,candidates,pointsFor,remaining,validCode,roundId});
})(window);