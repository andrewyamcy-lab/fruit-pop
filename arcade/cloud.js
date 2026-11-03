// Public scoreboard reader: no login and no writes from the hub.
// All players' scores come from the existing Fruit Pop Firestore collection.
const config=window.FRUITPOP_FIREBASE_CONFIG;
if(config?.apiKey && config?.projectId && config?.appId){
  (async()=>{
    const v="13.1.0";
    const [appSDK,dbSDK]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/"+v+"/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/"+v+"/firebase-firestore.js")
    ]);
    const firebaseApp=appSDK.initializeApp(config,"friend-arcade-hub");
    const db=dbSDK.getFirestore(firebaseApp);
    dbSDK.onSnapshot(dbSDK.collection(db,"fruitpop_games_v1"),snapshot=>{
      const rows=snapshot.docs.map(d=>{
        const r=d.data();
        return {playerId:r.playerId,score:r.score,createdAt:r.createdAt?.toMillis?.()||0};
      });
      window.dispatchEvent(new CustomEvent("arcade-cloud-scores",{detail:{rows}}));
    },error=>{
      console.warn("Shared score feed unavailable",error);
      window.dispatchEvent(new Event("arcade-cloud-error"));
    });
  })().catch(error=>{
    console.warn("Firebase failed",error);
    window.dispatchEvent(new Event("arcade-cloud-error"));
  });
}else{
  window.dispatchEvent(new Event("arcade-cloud-error"));
}
