(() => {
  const canvas=document.getElementById("mcgecko-canvas"); if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const scoreEl=document.getElementById("mcgecko-score"), livesEl=document.getElementById("mcgecko-lives");
  const levelEl=document.getElementById("mcgecko-level"), powerEl=document.getElementById("mcgecko-power");
  const statusEl=document.getElementById("mcgecko-status"), startBtn=document.getElementById("mcgecko-start"), pauseBtn=document.getElementById("mcgecko-pause");
  const TILE=28, MAX_FLOORS=10, W=19, H=15;
  const dirs={ArrowLeft:[-1,0],a:[-1,0],A:[-1,0],ArrowRight:[1,0],d:[1,0],D:[1,0],ArrowUp:[0,-1],w:[0,-1],W:[0,-1],ArrowDown:[0,1],s:[0,1],S:[0,1]};
  canvas.width=W*TILE; canvas.height=H*TILE;
  let state=null,raf=0,last=0;
  const enemyKinds=["worm","bug","trojan","spyware"];
  const powers=[
    {name:"Firewall",emoji:"🧱",desc:"Blocks the next hit.",kind:"shield"},
    {name:"Turbo Scanner",emoji:"⚡",desc:"Move faster for 12 seconds.",kind:"speed"},
    {name:"Quarantine",emoji:"🚫",desc:"Your next enemy collision is always safe.",kind:"quarantine"},
    {name:"Malware Sweep",emoji:"🧹",desc:"Damages every nearby malware.",kind:"sweep"},
    {name:"Defender",emoji:"🛡️",desc:"Restore 2 health.",kind:"heal"},
    {name:"Rootkit Scanner",emoji:"🔎",desc:"Reveal all pickups on this floor.",kind:"reveal"}
  ];

  function rand(n){return Math.floor(Math.random()*n)}
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
  function makeFloor(){
    const map=Array.from({length:H},()=>Array(W).fill("#"));
    const carve=(r,c)=>{map[r][c]="."; [[0,2],[2,0],[0,-2],[-2,0]].sort(()=>Math.random()-.5).forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(nr>0&&nr<H-1&&nc>0&&nc<W-1&&map[nr][nc]==="#"){map[r+dr/2][c+dc/2]=".";carve(nr,nc)}})};
    carve(1,1);
    for(let r=1;r<H-1;r++)for(let c=1;c<W-1;c++)if(map[r][c]==="#"&&Math.random()<.14)map[r][c]=".";
    const cells=[];for(let r=1;r<H-1;r++)for(let c=1;c<W-1;c++)if(map[r][c]===".")cells.push({r,c});
    const start={r:1,c:1}; const far=cells.filter(x=>Math.abs(x.r-start.r)+Math.abs(x.c-start.c)>8).sort(()=>Math.random()-.5);
    const exit=far[0]||cells[cells.length-1];
    const used=new Set(["1,1",exit.r+","+exit.c]);
    const pick=()=>{const opts=cells.filter(x=>!used.has(x.r+","+x.c));const p=opts[rand(opts.length)];if(p)used.add(p.r+","+p.c);return p};
    const enemies=[]; for(let i=0;i<Math.min(2+Math.floor(state?.floor/2||0),7);i++){const p=pick();if(p)enemies.push({r:p.r,c:p.c,kind:enemyKinds[rand(4)],dir:dirsList()[rand(4)],hp:1})}
    const cds=[]; for(let i=0;i<2+rand(3);i++){const p=pick();if(p)cds.push(p)}
    const heals=[]; for(let i=0;i<1+rand(2);i++){const p=pick();if(p)heals.push(p)}
    const box=pick();
    return {map,player:{...start,dir:[0,0],next:[0,0]},enemies,cds,heals,box,exit,exitOpen:false,seen:false};
  }
  function dirsList(){return [[1,0],[-1,0],[0,1],[0,-1]]}
  function wall(f,r,c){return r<0||r>=H||c<0||c>=W||f.map[r][c]==="#"}
  function can(f,e,d){return !wall(f,e.r+d[1],e.c+d[0])}
  function same(a,b){return a&&b&&a.r===b.r&&a.c===b.c}
  function reset(){state={floor:1,score:0,lives:3,maxHealth:5,health:5,power:null,powerUntil:0,cdMod:0,invuln:0,running:true,paused:false,gameOver:false}; newFloor(); statusEl.textContent="🦎 Enter the Gateway. Reach the exit on every floor."; pauseBtn.textContent="⏸ Pause"; cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(loop)}
  function newFloor(){state.floor=Math.min(state.floor,MAX_FLOORS);state.floorData=makeFloor();state.floorData.exitOpen=false;state.floorData.cds.forEach(x=>x.used=false);state.power=null;state.powerUntil=0;state.cdMod=0;state.invuln=900;updateHud()}
  function setDir(d){if(!state?.running||state.paused)return;state.floorData.player.next=d;if(can(state.floorData,state.floorData.player,d))state.floorData.player.dir=d}
  function move(e,d){if(can(state.floorData,e,d)){e.c+=d[0];e.r+=d[1];return true}return false}
  function enemyStep(e){
    const f=state.floorData, options=dirsList().filter(d=>can(f,e,d));if(!options.length)return;
    const reverse=[-e.dir[0],-e.dir[1]], choices=options.filter(d=>d[0]!==reverse[0]||d[1]!==reverse[1]);
    if(e.kind==="worm"){choices.sort((a,b)=>(Math.abs(e.r+a[1]-f.player.r)+Math.abs(e.c+a[0]-f.player.c))-(Math.abs(e.r+b[1]-f.player.r)+Math.abs(e.c+b[0]-f.player.c)));e.dir=choices[0]||options[0]}
    else if(!can(f,e,e.dir)||Math.random()<.25)e.dir=choices[rand(choices.length)]||options[0];
    move(e,e.dir)
  }
  function collect(){
    const f=state.floorData,p=f.player;
    f.cds=f.cds.filter(cd=>{if(same(cd,p)){state.score+=50;state.cdMod++;statusEl.textContent="💿 Antivirus CD collected — attack power +1.";return false}return true});
    f.heals=f.heals.filter(h=>{if(same(h,p)){state.health=Math.min(state.maxHealth,state.health+1);state.score+=25;statusEl.textContent="❤️ Health restored.";return false}return true});
    if(f.box&&same(f.box,p)&&!f.box.open){f.box.open=true;const power=powers[rand(powers.length)];state.power=power;state.powerUntil=performance.now()+12000;applyPower(power);state.score+=100;statusEl.textContent=power.emoji+" "+power.name+": "+power.desc}
    if(same(f.exit,p)&&f.exitOpen){if(state.floor>=MAX_FLOORS){state.running=false;statusEl.textContent="🏆 Gateway secured! You cleared all 10 floors.";return}state.floor++;state.score+=250;newFloor();statusEl.textContent="⬇️ Floor "+state.floor+" — new threat profile generated."}
    if(!f.cds.length)f.exitOpen=true;
  }
  function applyPower(p){
    if(p.kind==="heal")state.health=Math.min(state.maxHealth,state.health+2);
    if(p.kind==="sweep"){state.floorData.enemies.forEach(e=>{if(Math.abs(e.r-state.floorData.player.r)+Math.abs(e.c-state.floorData.player.c)<=3)e.hp=0});state.floorData.enemies=state.floorData.enemies.filter(e=>e.hp>0)}
    if(p.kind==="reveal")state.floorData.seen=true;
  }
  function attackEnemy(e){
    const f=state.floorData;if(!same(e,f.player))return false;
    if(state.power?.kind==="quarantine"){e.hp=0;state.power=null;statusEl.textContent="🚫 Malware quarantined!"}
    else if(state.cdMod>0){state.cdMod--;e.hp=0;state.score+=150;statusEl.textContent="💿 Antivirus attack destroyed "+e.kind+"!"}
    else return false;
    f.enemies=f.enemies.filter(x=>x.hp>0);return true
  }
  function hurt(){if(performance.now()<state.invuln)return; if(state.power?.kind==="shield"){state.power=null;state.invuln=1200;statusEl.textContent="🧱 Firewall blocked the hit.";return}state.health--;state.invuln=1200;state.floorData.player={...state.floorData.player,r:1,c:1,dir:[0,0],next:[0,0]};if(state.health<=0){state.lives--;state.health=state.maxHealth;if(state.lives<=0){state.running=false;state.gameOver=true;statusEl.textContent="💀 Gecko down. Start a new run."}else statusEl.textContent="⚠️ Health depleted — one life lost."}}
  function tick(){
    if(!state?.running||state.paused)return;const f=state.floorData,p=f.player;
    if(can(f,p,p.next))p.dir=p.next;const moved=move(p,p.dir);if(!moved)p.dir=[0,0];
    collect();
    for(const e of f.enemies){enemyStep(e);if(same(e,p)&&!attackEnemy(e))hurt()}
    if(f.enemies.length===0)f.exitOpen=true;
    updateHud();
  }
  function updateHud(){scoreEl.textContent=state?.score??0;livesEl.textContent=state?.lives??3;levelEl.textContent=state?.floor??1;const rem=state?Math.max(0,state.powerUntil-performance.now()):0;powerEl.textContent=state?.power?(state.power.emoji+" "+state.power.name+(rem?" "+(rem/1000).toFixed(1)+"s":"")):"—"}
  function drawEmoji(txt,x,y,size=23){ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=size+"px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif";ctx.fillText(txt,x*TILE+14,y*TILE+14)}
  function draw(){
    const f=state?.floorData;ctx.fillStyle="#06100a";ctx.fillRect(0,0,canvas.width,canvas.height);if(!f){ctx.fillStyle="#8de0b1";ctx.textAlign="center";ctx.font="bold 26px system-ui";ctx.fillText("🦎 mcGecko",canvas.width/2,canvas.height/2);return}
    for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(f.map[r][c]==="#"){ctx.fillStyle="#103b2a";ctx.fillRect(c*TILE,r*TILE,TILE,TILE);ctx.strokeStyle="#1b7f4b";ctx.strokeRect(c*TILE+1,r*TILE+1,TILE-2,TILE-2)}
    for(let r=1;r<H-1;r++)for(let c=1;c<W-1;c++)if(f.map[r][c]==="."){ctx.fillStyle="#f6f3d0";ctx.fillRect(c*TILE+12,r*TILE+12,4,4)}
    f.cds.forEach(x=>drawEmoji("💿",x.c,x.r,21));f.heals.forEach(x=>drawEmoji("❤️",x.c,x.r,20));
    if(f.box&&!f.box.open)drawEmoji("📦",f.box.c,f.box.r,23);
    drawEmoji(f.exitOpen?"🚪":"🔒",f.exit.c,f.exit.r,22);
    drawEmoji(state.power?.kind==="shield"?"🛡️":"🦎",f.player.c,f.player.r,24);
    const em={worm:"🪱",bug:"🐛",trojan:"🐴",spyware:"🕵️"};f.enemies.forEach(e=>drawEmoji(em[e.kind]||"🦠",e.c,e.r,22));
  }
  function loop(t){if(!state)return;if(t-last>95){tick();last=t}draw();updateHud();if(state.running)raf=requestAnimationFrame(loop)}
  window.addEventListener("keydown",e=>{if(!dirs[e.key])return;const tag=document.activeElement?.tagName;if(["INPUT","SELECT","TEXTAREA"].includes(tag))return;e.preventDefault();setDir(dirs[e.key])});
  startBtn.addEventListener("click",reset);
  pauseBtn.addEventListener("click",()=>{if(!state?.running)return;state.paused=!state.paused;pauseBtn.textContent=state.paused?"▶ Resume":"⏸ Pause";statusEl.textContent=state.paused?"Paused.":"Back in the Gateway!";if(!state.paused){last=performance.now();raf=requestAnimationFrame(loop)}});
  draw();
})();