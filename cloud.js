/* Fruit Pop online scoreboard: anonymous sign-in + Firestore realtime games.
 * Does not load Firebase SDK until firebase-config.js has real values.
 * Scores are independent per anonymous device and chosen player.
 */
const dispatch=(state)=>window.dispatchEvent(new CustomEvent('fruitpop-cloud-status',{detail:{state}}));
const config=window.FRUITPOP_FIREBASE_CONFIG;
if(!config || !config.apiKey || !config.projectId || !config.appId){
  dispatch('setup');
}else{
  (async()=>{
    const VERSION='13.1.0';
    const [appSdk,authSdk,dbSdk]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/'+VERSION+'/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/'+VERSION+'/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/'+VERSION+'/firebase-firestore.js')
    ]);
    const app=appSdk.initializeApp(config);
    const auth=authSdk.getAuth(app);
    const signed=await authSdk.signInAnonymously(auth);
    const uid=signed.user.uid;
    const db=dbSdk.getFirestore(app);
    const collectionRef=dbSdk.collection(db,'fruitpop_games_v1');
    dispatch('online');
    const queueKey='fruitpop-pending-games-v1';
    let uploading=false;
    async function flush(){
      if(uploading)return;
      uploading=true;
      try {
        while(true){
          let queue=[];
          try{queue=JSON.parse(localStorage.getItem(queueKey)||'[]');}catch(_){}
          if(!Array.isArray(queue)||queue.length===0)break;
          const item=queue[0];
          if(!item || !/^[a-z0-9-]{1,64}$/.test(item.id||'')
              || !['ada','andrew','esther','jenny','rain','tom','yaki'].includes(item.playerId)
              || !Number.isInteger(item.score) || item.score<1 || item.score>10000000){
            const latest=JSON.parse(localStorage.getItem(queueKey)||'[]');
            localStorage.setItem(queueKey,JSON.stringify(latest.filter(q=>q.id!==item?.id)));
            continue;
          }
          const gameDoc=dbSdk.doc(db,'fruitpop_games_v1',uid+'_'+item.id);
          // One immutable result per game. Retried uploads cannot double-count.
          await dbSdk.runTransaction(db,async(tx)=>{
            const previous=await tx.get(gameDoc);
            if(!previous.exists())tx.set(gameDoc,{
              uid,playerId:item.playerId,score:item.score,createdAt:dbSdk.serverTimestamp()
            });
          });
          const latest=JSON.parse(localStorage.getItem(queueKey)||'[]');
          localStorage.setItem(queueKey,JSON.stringify(latest.filter(q=>q.id!==item.id)));
        }
      }catch(err){console.warn('Score upload deferred',err);dispatch('upload-error');}
      finally{uploading=false;}
    }
    window.addEventListener('fruitpop-cloud-flush',flush);
    dbSdk.onSnapshot(collectionRef,snapshot=>{
      const rows=snapshot.docs.map(d=>{
        const data=d.data();
        return {playerId:data.playerId,score:data.score,createdAt:data.createdAt?.toMillis?.()||0};
      });
      window.dispatchEvent(new CustomEvent('fruitpop-cloud-data',{detail:{rows}}));
    },error=>{console.warn('Live scores unavailable',error);dispatch('error');});
    await flush();
    window.addEventListener('online',flush);
  })().catch(err=>{console.warn('Firebase initialization failed',err);dispatch('error');});
}
