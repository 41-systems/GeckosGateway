(() => {
  const canvas=document.getElementById("mcgecko-canvas"); if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const scoreEl=document.getElementById("mcgecko-score"), livesEl=document.getElementById("mcgecko-lives");
  const levelEl=document.getElementById("mcgecko-level"), powerEl=document.getElementById("mcgecko-power");
  const statusEl=document.getElementById("mcgecko-status"), startBtn=document.getElementById("mcgecko-start"), pauseBtn=document.getElementById("mcgecko-pause");
  const W=720,H=460,MAX=10,FOV=Math.PI/3;
  canvas.width=W;canvas.height=H;
  const keys=new Set(); let state=null,raf=0,last=0;
  const enemyKinds=["worm","bug","trojan","spyware"];
  const powerups=[
    ["🧱","Firewall","Blocks the next hit."],["⚡","Turbo Scanner","Move faster for 8 seconds."],
    ["🚫","Quarantine","Next malware collision destroys it."],["🧹","Malware Sweep","Clears nearby malware."],
    ["🛡️","Defender","Restores 2 health."],["🔎","Rootkit Scanner","Reveals all pickups."]
  ];
  const levels=[];
  function rnd(n){return Math.floor(Math.random()*n)}
  function shuffle(a){return a.sort(()=>Math.random()-.5)}
  function makeMap(){
    const n=17,m=17, map=Array.from({length:n},()=>Array(m).fill(1));
    function carve(x,y){map[y][x]=0;for(const [dx,dy] of shuffle([[2,0],[-2,0],[0,2],[0,-2]])){const nx=x+dx,ny=y+dy;if(nx>0&&nx<m-1&&ny>0&&ny<n-1&&map[ny][nx]){map[y+dy/2][x+dx/2]=0;carve(nx,ny)}}}
    carve(1,1); for(let y=1;y<n-1;y++)for(let x=1;x<m-1;x++)if(map[y][x]&&Math.random()<.08)map[y][x]=0;
    return {map,w:m,h:n};
  }
  function free(f){const a=[];for(let y=1;y<f.h-1;y++)for(let x=1;x<f.w-1;x++)if(!f.map[y][x])a.push({x:x+.5,y:y+.5});return a}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function pickFar(cells,p,min=3){const a=cells.filter(q=>dist(q,p)>min);return a[rnd(a.length)]||cells[rnd(cells.length)]}
  function buildFloor(){
    const f=makeMap(),cells=free(f),p={x:1.5,y:1.5};
    const used=new Set(["1.5,1.5"]), take=(min=3)=>{const a=cells.filter(q=>!used.has(q.x+","+q.y)&&dist(q,p)>min);const q=a[rnd(a.length)];if(q)used.add(q.x+","+q.y);return q};
    const enemies=[];for(let i=0;i<2+Math.min(5,Math.floor((state.floor-1)/2));i++){const q=take(5);if(q)enemies.push({x:q.x,y:q.y,kind:enemyKinds[rnd(4)],hp:1,dir:Math.random()*Math.PI*2})}
    const cds=[];for(let i=0;i<2+rnd(3);i++){const q=take(3);if(q)cds.push(q)}
    const health=[];for(let i=0;i<2;i++){const q=take(3);if(q)health.push(q)}
    const box=take(4),exit=pickFar(cells,p,9);
    return {f,p,ang:0,enemies,cds,health,box,boxOpen:false,exit,exitOpen:false,flash:0};
  }
  function wall(x,y){const f=state.floorData.f;return y<0||x<0||y>=f.h||x>=f.w||f.map[Math.floor(y)][Math.floor(x)]===1}
  function blocked(x,y,r=.22){return wall(x-r,y-r)||wall(x+r,y-r)||wall(x-r,y+r)||wall(x+r,y+r)}
  function movePlayer(dt){
    const p=state.floorData.p, boost=state.speedUntil>performance.now()?1.8:1;
    let forward=(keys.has("ArrowUp")||keys.has("w")||keys.has("W"))-(keys.has("ArrowDown")||keys.has("s")||keys.has("S"));
    let strafe=(keys.has("ArrowRight")||keys.has("d")||keys.has("D"))-(keys.has("ArrowLeft")||keys.has("a")||keys.has("A"));
    const turn=(keys.has("q")?-1:0)+(keys.has("e")?1:0);
    state.floorData.ang+=turn*2.5*dt;
    const len=Math.hypot(forward,strafe)||1;forward/=len;strafe/=len;
    const dx=(Math.cos(state.floorData.ang)*forward-Math.sin(state.floorData.ang)*strafe)*3*boost*dt;
    const dy=(Math.sin(state.floorData.ang)*forward+Math.cos(state.floorData.ang)*strafe)*3*boost*dt;
    if(!blocked(p.x+dx,p.y))p.x+=dx;if(!blocked(p.x,p.y+dy))p.y+=dy;
  }
  function nearestEnemy(max=1.05){const p=state.floorData.p;return state.floorData.enemies.find(e=>dist(e,p)<max)}
  function collect(){
    const d=state.floorData,p=d.p;
    d.cds=d.cds.filter(q=>{if(dist(q,p)<.5){state.attack++;state.score+=50;statusEl.textContent="💿 Antivirus CD collected — attack charge +1.";return false}return true});
    d.health=d.health.filter(q=>{if(dist(q,p)<.5){state.hp=Math.min(state.maxHp,state.hp+1);state.score+=25;statusEl.textContent="❤️ Health restored.";return false}return true});
    if(d.box&&!d.boxOpen&&dist(d.box,p)<.65){d.boxOpen=true;const power=powerups[rnd(powerups.length)];state.power=power;applyPower(power);state.powerUntil=performance.now()+8000;state.score+=100;statusEl.textContent=power[0]+" "+power[1]+": "+power[2]}
    if(!d.cds.length)d.exitOpen=true;
    if(d.exitOpen&&dist(d.exit,p)<.7){if(state.floor>=MAX){state.running=false;statusEl.textContent="🏆 Gateway secured — 10 floors cleared!";return}state.floor++;state.score+=250;state.floorData=buildFloor();statusEl.textContent="⬇️ Floor "+state.floor+" generated — new threat profile."}
  }
  function applyPower(p){
    if(p[1]==="Firewall")state.shield=true;
    if(p[1]==="Turbo Scanner")state.speedUntil=performance.now()+8000;
    if(p[1]==="Malware Sweep"){const d=state.floorData;d.enemies=d.enemies.filter(e=>dist(e,d.p)>3);statusEl.textContent="🧹 Malware sweep complete!"}
    if(p[1]==="Defender")state.hp=Math.min(state.maxHp,state.hp+2);
    if(p[1]==="Rootkit Scanner")state.revealed=true;
  }
  function updateEnemies(dt){
    const d=state.floorData,p=d.p;
    for(const e of d.enemies){
      const dx=p.x-e.x,dy=p.y-e.y,L=Math.hypot(dx,dy)||1;
      let speed=e.kind==="worm"?1.05:.78;
      if(e.kind==="bug"&&Math.random()<.015)e.dir=Math.random()*Math.PI*2;
      let ang=e.kind==="worm"?Math.atan2(dy,dx):e.dir;
      if(e.kind!=="worm"&&Math.random()<.025)ang=Math.atan2(dy,dx)+(Math.random()-.5)*1.8;
      const nx=e.x+Math.cos(ang)*speed*dt,ny=e.y+Math.sin(ang)*speed*dt;
      if(!blocked(nx,ny,.18))e.x=nx,e.y=ny;else e.dir=Math.random()*Math.PI*2;
      if(dist(e,p)<.48)hitEnemy(e);
    }
  }
  function hitEnemy(e){
    if(state.invuln>performance.now())return;
    if(state.attack>0){state.attack--;state.score+=150;state.floorData.enemies=state.floorData.enemies.filter(x=>x!==e);statusEl.textContent="💿 Antivirus attack quarantined "+e.kind+"!";return}
    if(state.power&&state.power[1]==="Quarantine"){state.floorData.enemies=state.floorData.enemies.filter(x=>x!==e);state.power=null;statusEl.textContent="🚫 Quarantine power destroyed malware!";return}
    if(state.shield){state.shield=false;state.invuln=performance.now()+1200;statusEl.textContent="🧱 Firewall blocked the hit.";return}
    state.hp--;state.invuln=performance.now()+1200;state.floorData.p={x:1.5,y:1.5};
    if(state.hp<=0){state.lives--;state.hp=state.maxHp;if(state.lives<=0){state.running=false;statusEl.textContent="💀 Gecko down — run ended."}else statusEl.textContent="⚠️ Health depleted — one life lost."}
  }
  function reset(){state={floor:1,score:0,lives:3,maxHp:5,hp:5,attack:0,power:null,powerUntil:0,speedUntil:0,shield:false,invuln:0,running:true,paused:false,revealed:false,floorData:null};state.floorData=buildFloor();statusEl.textContent="🦎 Explore the network. Collect CDs, survive, find the exit.";pauseBtn.textContent="⏸ Pause";last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
  function hud(){scoreEl.textContent=state?.score??0;livesEl.textContent=state?.lives??3;levelEl.textContent=state?.floor??1;powerEl.textContent=state?.power?state.power[0]+" "+state.power[1]:(state?.attack?"💿 ×"+state.attack:"—")}
  function drawVoxel(x,y,type,scale){
    const p=state.floorData.p,dx=x-p.x,dy=y-p.y,D=Math.hypot(dx,dy),a=Math.atan2(dy,dx)-state.floorData.ang;
    const ang=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(ang)>FOV*.62)return;
    const sx=W/2+(ang/(FOV/2))*(W/2),col=Math.max(0,Math.min(W-1,Math.floor(sx)));
    if(state.depth[col]<D-.35)return;
    const s=Math.min(105,560/D)*scale,sy=H*.48+H*.27/D;
    const pal={worm:["#83df86","#285f35"],bug:["#d2a9ff","#603b91"],trojan:["#d89b62","#70431f"],spyware:["#d0d7dc","#46525a"],cd:["#9be9ff","#267187"],health:["#ff6d7d","#8b2634"],box:["#f0bb4e","#765719"],exit:["#b8dfcf","#385b4d"]}[type];
    ctx.save();ctx.translate(sx,sy);ctx.globalAlpha=Math.max(.5,1-D/18);
    ctx.fillStyle=pal[1];ctx.fillRect(-s*.43,-s*.48+s*.18,s*.86,s*.82);
    ctx.fillStyle=pal[0];ctx.fillRect(-s*.5,-s*.5,s,s*.75);
    ctx.fillStyle="rgba(255,255,255,.22)";ctx.fillRect(-s*.5,-s*.5,s*.16,s*.75);
    ctx.fillStyle=pal[1];ctx.fillRect(-s*.5,-s*.5,s,s*.11);ctx.fillRect(-s*.5,s*.25,s,s*.11);ctx.fillRect(-s*.5,-s*.5,s*.11,s*.75);ctx.fillRect(s*.39,-s*.5,s*.11,s*.75);
    if(type==="cd"){ctx.fillStyle="#e9fcff";ctx.fillRect(-s*.16,-s*.16,s*.32,s*.32)}
    if(type==="health"){ctx.fillStyle="#fff";ctx.fillRect(-s*.09,-s*.28,s*.18,s*.56);ctx.fillRect(-s*.28,-s*.09,s*.56,s*.18)}
    if(type==="box"){ctx.fillStyle="#654a15";ctx.fillRect(-s*.07,-s*.5,s*.14,s*.75);ctx.fillRect(-s*.5,-s*.05,s,s*.1)}
    if(type==="exit"){ctx.fillStyle="#dffff3";ctx.fillRect(-s*.16,-s*.32,s*.32,s*.64)}
    ctx.restore();
  }
  function render(){
    ctx.fillStyle="#07100d";ctx.fillRect(0,0,W,H);
    if(!state){ctx.fillStyle="#b8ffd0";ctx.font="bold 30px system-ui";ctx.textAlign="center";ctx.fillText("🦎 mcGecko 3D",W/2,H/2);return}
    const d=state.floorData,p=d.p;
    const horizon=H*.48;ctx.fillStyle="#121a20";ctx.fillRect(0,0,W,horizon);ctx.fillStyle="#101815";ctx.fillRect(0,horizon,W,H-horizon);
    const depth=new Float32Array(W);
    for(let x=0;x<W;x++){const ra=d.ang-FOV/2+(x/W)*FOV;let distRay=.03,hit=false;while(distRay<20&&!hit){const rx=p.x+Math.cos(ra)*distRay,ry=p.y+Math.sin(ra)*distRay;if(wall(rx,ry))hit=true;else distRay+=.035}const corrected=distRay*Math.cos(ra-d.ang);depth[x]=corrected;const wh=Math.min(H*1.8,330/(corrected+.05));ctx.fillStyle=corrected<3?"#246342":"#173d2a";ctx.fillRect(x,horizon-wh/2,1,wh)}
    state.depth=depth;
    const objects=[];
    d.enemies.forEach(e=>objects.push({x:e.x,y:e.y,type:e.kind,size:1}));
    d.cds.forEach(q=>objects.push({x:q.x,y:q.y,type:"cd",size:.72}));
    d.health.forEach(q=>objects.push({x:q.x,y:q.y,type:"health",size:.62}));
    if(d.box&&!d.boxOpen)objects.push({x:d.box.x,y:d.box.y,type:"box",size:1});
    objects.push({x:d.exit.x,y:d.exit.y,type:"exit",size:.9});
    objects.sort((a,b)=>dist(b,p)-dist(a,p));
    for(const o of objects)drawVoxel(o.x,o.y,o.type,o.size);
    ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(W/2-1,H/2-10,2,20);ctx.fillRect(W/2-10,H/2-1,20,2);
    ctx.fillStyle="#fff";ctx.font="14px system-ui";ctx.textAlign="left";ctx.fillText("WASD / Arrows: move   Q/E: turn",14,H-14);
  }
  function loop(t){if(!state)return;const dt=Math.min(.05,(t-last)/1000);last=t;if(state.running&&!state.paused){movePlayer(dt);collect();updateEnemies(dt)}render();hud();if(state.running)raf=requestAnimationFrame(loop)}
  window.addEventListener("keydown",e=>{if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D","q","e","Q","E"].includes(e.key)){e.preventDefault();keys.add(e.key)}});
  window.addEventListener("keyup",e=>keys.delete(e.key));
  startBtn.addEventListener("click",reset);
  pauseBtn.addEventListener("click",()=>{if(!state?.running)return;state.paused=!state.paused;pauseBtn.textContent=state.paused?"▶ Resume":"⏸ Pause";statusEl.textContent=state.paused?"Paused.":"Back in the Gateway!";if(!state.paused){last=performance.now();raf=requestAnimationFrame(loop)}});
  render();
})();