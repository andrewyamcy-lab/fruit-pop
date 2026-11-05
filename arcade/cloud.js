/* Friend Arcade: public scores and gatherings + authenticated public lobby summaries. */
const config=window.FRUITPOP_FIREBASE_CONFIG;
const emitCloudError=(kind)=>window.dispatchEvent(new Event(kind));
if(config?.apiKey&&config?.projectId&&config?.appId){
 (async()=>{
  const version="13.1.0";
  const [A,F]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/"+version+"/firebase-firestore.js")
  ]);
  const app=A.initializeApp(config,"friend-arcade-hub"),db=F.getFirestore(app);
  // These two existing public collections work even if anonymous sign-in is disabled.
  F.onSnapshot(F.collection(db,"fruitpop_games_v1"),snapshot=>{
   const rows=snapshot.docs.map(doc=>{
    const data=doc.data();
    return {playerId:data.playerId,score:data.score,createdAt:data.createdAt?.toMillis?.()||0};
   });
   window.dispatchEvent(new CustomEvent("arcade-cloud-scores",{detail:{rows}}));
  },error=>{
   console.warn("Scoreboard unavailable",error);
   emitCloudError("arcade-cloud-error");
  });
  F.onSnapshot(F.collection(db,"friendarcade_gatherings_v1"),snapshot=>{
   const events=snapshot.docs.map(doc=>{
    const data=doc.data();
    return {id:doc.id,title:data.title,month:data.month,status:data.status,
     confirmedDay:data.confirmedDay,createdAt:data.createdAt?.toMillis?.()||0};
   });
   window.dispatchEvent(new CustomEvent("arcade-cloud-gatherings",{detail:{events}}));
  },error=>{
   console.warn("Gatherings unavailable",error);
   emitCloudError("arcade-cloud-gatherings-error");
  });
  try{
   const Auth=await import("https://www.gstatic.com/firebasejs/"+version+"/firebase-auth.js");
   await Auth.signInAnonymously(Auth.getAuth(app));
  }catch(error){
   console.warn("Anonymous sign-in for live room directory unavailable",error);
   for(const game of ["sameword","drawguess"])
    window.dispatchEvent(new CustomEvent("arcade-cloud-rooms-error",{detail:{game}}));
   return;
  }
  const feeds=[
   {game:"sameword",query:F.query(F.collection(db,"friendarcade_sameword_lobbies_v1"),
    F.orderBy("createdAt","desc"),F.limit(30))},
   {game:"drawguess",query:F.query(F.collection(db,"friendarcade_drawguess_lobbies_v1"),
    F.where("stage","==","lobby"),F.limit(30))}
  ];
  for(const feed of feeds){
   F.onSnapshot(feed.query,snapshot=>{
    const rooms=snapshot.docs.map(doc=>({...doc.data(),
     ...(feed.game==="sameword"?{roomId:doc.id}:{code:doc.id})}));
    window.dispatchEvent(new CustomEvent("arcade-cloud-rooms",{detail:{game:feed.game,rooms}}));
   },error=>{
    console.warn(feed.game+" room directory unavailable",error);
    window.dispatchEvent(new CustomEvent("arcade-cloud-rooms-error",{detail:{game:feed.game}}));
   });
  }
 })().catch(error=>{
  console.warn("Friend Arcade Firebase failed",error);
  emitCloudError("arcade-cloud-error");
  emitCloudError("arcade-cloud-gatherings-error");
  for(const game of ["sameword","drawguess"])
   window.dispatchEvent(new CustomEvent("arcade-cloud-rooms-error",{detail:{game}}));
 });
}else{
 emitCloudError("arcade-cloud-error");
 emitCloudError("arcade-cloud-gatherings-error");
 for(const game of ["sameword","drawguess"])
  window.dispatchEvent(new CustomEvent("arcade-cloud-rooms-error",{detail:{game}}));
}
