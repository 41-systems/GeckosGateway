const T=THREE,R=Math.random,ri=(a,b)=>a+Math.floor(R()*(b-a+1)),pick=a=>a[ri(0,a.length-1)],S=2,N=27;
const $=id=>document.getElementById(id);
const renderer=new T.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.prepend(renderer.domElement);
const scene=new T.Scene(),cam=new T.PerspectiveCamera(62,innerWidth/innerHeight,.1,120);
scene.add(new T.AmbientLight(0x7790b0,.8));
const sun=new T.DirectionalLight(0xffffff,.5);sun.position.set(10,20,5);scene.add(sun);
const plight=new T.PointLight(0x7dffb0,1.3,20);scene.add(plight);
const world=new T.Group(),dummy=new T.Object3D(),K={},mc=$('mm').getContext('2d');
scene.add(world);
const sphere=new T.SphereGeometry(.5,14,10),box=new T.BoxGeometry(1,1,1),cone=new T.ConeGeometry(.12,.5,5),pbox=new T.BoxGeometry(.2,.2,.2);
const lam=c=>new T.MeshStandardMaterial({color:c,roughness:.6});

function mkGecko(){
  const g=new T.Group(),m=lam(0x4fdc6a),m2=lam(0x2e9f4a),eye=new T.MeshBasicMaterial({color:0xfff27a}),pup=new T.MeshBasicMaterial({color:0});
  const add=(geo,mat,x,y,z,sx,sy,sz,par)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);(par||g).add(o);return o};
  add(sphere,m,0,.45,0,.62,.36,.95);
  add(sphere,m,0,.5,.85,.42,.3,.5);
  [-1,1].forEach(s=>{add(sphere,eye,s*.22,.75,.95,.2,.2,.2);add(sphere,pup,s*.22,.8,1.04,.06,.12,.06)});
  const legs=[],tail=[];
  [-1,1].forEach(s=>[.4,-.4].forEach(z=>legs.push(add(box,m2,s*.55,.14,z,.18,.14,.5))));
  for(let i=0;i<7;i++){const k=1-i*.11;tail.push(add(sphere,m2,0,.3,-.85-i*.38,.4*k,.28*k,.5*k))}
  const tg=new T.Group();tg.position.set(0,.45,1.1);g.add(tg);
  const tongue=new T.Mesh(new T.CylinderGeometry(.07,.07,1,6),new T.MeshBasicMaterial({color:0xff6a9a}));
  tongue.rotation.x=Math.PI/2;tongue.visible=false;tg.add(tongue);
  return {g,legs,tail,tongue};
}
const gecko=mkGecko();scene.add(gecko.g);

const ET={
  worm:{c:0xffa23a,hp:3,sp:3.8,r:.6,d:6,geo:()=>new T.SphereGeometry(.6,10,8)},
  trojan:{c:0xd8a850,hp:9,sp:2,r:.95,d:12,geo:()=>new T.BoxGeometry(1.5,1.5,1.5)},
  ransom:{c:0xff3b3b,hp:5,sp:3,r:.8,d:10,geo:()=>new T.OctahedronGeometry(.95)},
  spy:{c:0xb36bff,hp:4,sp:2.6,r:.7,d:7,geo:()=>new T.IcosahedronGeometry(.75,1)},
  root:{c:0x7a8aa0,hp:6,sp:3.2,r:.8,d:9,geo:()=>new T.DodecahedronGeometry(.85)},
  boss:{c:0xff2d95,hp:90,sp:2.2,r:1.9,d:18,geo:()=>new T.IcosahedronGeometry(1.8,1)}
};
const PU=[
  {n:'Firewall',c:0xff7a2a,f:()=>p.shield+=2},
  {n:'Heuristics',c:0xffe14a,f:()=>p.dmg*=1.3},
  {n:'Real-Time Protection',c:0x4affc0,f:()=>p.regen+=.6},
  {n:'Signature Update',c:0x4aa8ff,f:()=>p.rate*=1.25},
  {n:'Sandbox',c:0xc27aff,f:()=>p.dcd*=.7},
  {n:'Quarantine',c:0x9fe8ff,f:()=>p.slow=1},
  {n:'Deep Scan',c:0xff6ad5,f:()=>p.range*=1.25},
  {n:'Cloud Backup',c:0xffffff,f:()=>{p.max+=25;p.hp+=25}},
  {n:'Hotfix',c:0x7aff7a,f:()=>p.hp=Math.min(p.max,p.hp+40)},
  {n:'Adblock',c:0xff4a4a,f:()=>p.ad=1},
  {n:'Decryptor',c:0xd2ff4a,f:()=>p.leech+=2},
  {n:'Overclock',c:0xffa23a,f:()=>p.sp*=1.15}
];

let state='menu',floor=1,p,grid,rooms,enemies=[],pickups=[],shots=[],parts=[],exitM,exitPos,mouseDown=false;
const pm={};
const pmat=c=>pm[c]||(pm[c]=new T.MeshBasicMaterial({color:c}));
const solid=(x,z)=>{const r=grid[Math.round(z/S)];return !r||r[Math.round(x/S)]!==0};
const blocked=(x,z,r)=>solid(x-r,z-r)||solid(x+r,z-r)||solid(x-r,z+r)||solid(x+r,z+r);
function mv(o,dx,dz,r){if(!blocked(o.x+dx,o.z,r))o.x+=dx;if(!blocked(o.x,o.z+dz,r))o.z+=dz}

function gen(){
  grid=Array.from({length:N},()=>Array(N).fill(1));rooms=[];
  for(let k=0;k<80&&rooms.length<9;k++){
    const w=ri(3,6),h=ri(3,6),x=ri(1,N-w-1),y=ri(1,N-h-1);
    if(rooms.some(r=>x<r.x+r.w+1&&x+w+1>r.x&&y<r.y+r.h+1&&y+h+1>r.y))continue;
    rooms.push({x,y,w,h,cx:x+(w>>1),cy:y+(h>>1)});
  }
  rooms.forEach(r=>{for(let i=r.x;i<r.x+r.w;i++)for(let j=r.y;j<r.y+r.h;j++)grid[j][i]=0});
  for(let i=1;i<rooms.length;i++){
    const a=rooms[i-1],b=rooms[i];let x=a.cx,y=a.cy;
    while(x!==b.cx){grid[y][x]=0;x+=Math.sign(b.cx-x)}
    while(y!==b.cy){grid[y][x]=0;y+=Math.sign(b.cy-y)}
    grid[y][x]=0;
  }
}

function spawn(type,x,z){
  const d=ET[type],f=1+floor*.12,g=new T.Group();
  const mat=new T.MeshStandardMaterial({color:d.c,emissive:d.c,emissiveIntensity:.35,flatShading:true,transparent:true,opacity:type==='root'?.4:1});
  const core=new T.Mesh(d.geo(),mat);g.add(core);
  const n=type==='boss'?26:9;
  for(let i=0;i<n;i++){
    const v=new T.Vector3(R()-.5,R()-.5,R()-.5).normalize(),s=new T.Mesh(cone,mat);
    s.position.copy(v).multiplyScalar(d.r*.95);s.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v);
    if(type==='boss')s.scale.setScalar(3);core.add(s);
  }
  g.position.set(x,d.r+.2,z);world.add(g);
  const hp=d.hp*(type==='boss'?1:f);
  enemies.push({type,g,core,mat,x,z,hp,max:hp,r:d.r,sp:d.sp,dmg:d.d*(1+floor*.05),t:R()*5,cd:1+R()*2,cd2:5,st:0,kx:0,kz:0,flash:0,slow:0,dx:0,dz:0});
}
function mkPickup(pu,x,z){
  const m=new T.Mesh(new T.OctahedronGeometry(.4),new T.MeshStandardMaterial({color:pu.c,emissive:pu.c,emissiveIntensity:.8}));
  m.position.set(x,1,z);world.add(m);pickups.push({m,x,z,pu});
}
function build(){
  while(world.children.length)world.remove(world.children[0]);
  enemies=[];pickups=[];shots=[];parts=[];
  gen();
  const h=R(),wc=new T.Color().setHSL(h,.5,.38),fc=new T.Color().setHSL((h+.5)%1,.35,.2);
  scene.background=new T.Color().setHSL(h,.6,.05);scene.fog=new T.Fog(scene.background,16,44);
  const cells=[],walls=[];
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    if(grid[j][i]===0){cells.push([i,j]);continue}
    let adj=false;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const r=grid[j+b];if(r&&r[i+a]===0)adj=true}
    if(adj)walls.push([i,j]);
  }
  const fm=new T.InstancedMesh(new T.BoxGeometry(S,.2,S),new T.MeshStandardMaterial({roughness:.9}),cells.length);
  cells.forEach(([i,j],k)=>{dummy.position.set(i*S,-.1,j*S);dummy.updateMatrix();fm.setMatrixAt(k,dummy.matrix);fm.setColorAt(k,fc.clone().offsetHSL(0,0,R()*.06))});
  const wm=new T.InstancedMesh(new T.BoxGeometry(S,3,S),new T.MeshStandardMaterial({roughness:.7}),walls.length);
  walls.forEach(([i,j],k)=>{dummy.position.set(i*S,1.5,j*S);dummy.updateMatrix();wm.setMatrixAt(k,dummy.matrix);wm.setColorAt(k,wc.clone().offsetHSL(0,0,R()*.08))});
  world.add(fm,wm);
  const a=rooms[0],b=rooms[rooms.length-1];
  p.x=a.cx*S;p.z=a.cy*S;
  exitPos={x:b.cx*S,z:b.cy*S};
  exitM=new T.Mesh(new T.TorusGeometry(1,.14,8,28),new T.MeshBasicMaterial({color:0x553333}));
  exitM.position.set(exitPos.x,1.2,exitPos.z);world.add(exitM);
  exitM.visible=floor<10;
  const pool=['worm','trojan'];
  if(floor>1)pool.push('ransom','ransom');
  if(floor>2)pool.push('spy');
  if(floor>3)pool.push('root');
  const others=rooms.slice(1);
  if(floor===10){spawn('boss',b.cx*S,b.cy*S)}
  const cnt=floor===10?5:3+Math.floor(floor*1.3);
  for(let k=0;k<cnt;k++){const r=pick(others);spawn(pick(pool),ri(r.x,r.x+r.w-1)*S,ri(r.y,r.y+r.h-1)*S)}
  for(let k=0;k<2;k++){const r=pick(others);mkPickup(pick(PU),ri(r.x,r.x+r.w-1)*S,ri(r.y,r.y+r.h-1)*S)}
  p.yaw=Math.atan2(rooms[1].cx-a.cx,rooms[1].cy-a.cy);
}

function toast(s,c){const t=$('toast');t.textContent=s;t.style.color='#'+c.toString(16).padStart(6,'0');t.style.opacity=1;clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.opacity=0,1800)}
function chipUp(pu){
  p.have[pu.n]=(p.have[pu.n]||0)+1;
  $('chips').innerHTML=Object.entries(p.have).map(([n,c])=>{const u=PU.find(q=>q.n===n),col='#'+u.c.toString(16).padStart(6,'0');return `<span class="chip" style="color:${col}">${n}${c>1?' x'+c:''}</span>`}).join('');
}
function burst(x,y,z,c,n){
  for(let i=0;i<n;i++){
    const m=new T.Mesh(pbox,pmat(c));m.position.set(x,y,z);world.add(m);
    parts.push({m,vx:(R()-.5)*8,vy:R()*6,vz:(R()-.5)*8,life:.7});
  }
}
function hurt(d){
  if(p.inv>0||state!=='play')return;
  if(p.shield>0){p.shield--;p.inv=.6;return}
  p.hp-=d;p.inv=.9;
  if(p.hp<=0)finish(false);
}
function shoot(e,nx,nz,d,sp=9){
  const m=new T.Mesh(sphere,new T.MeshBasicMaterial({color:ET[e.type].c}));m.scale.setScalar(.45);
  m.position.set(e.x,1,e.z);world.add(m);
  shots.push({m,x:e.x,z:e.z,vx:nx*sp,vz:nz*sp,life:4,d});
}
function kill(e){
  world.remove(e.g);enemies.splice(enemies.indexOf(e),1);
  burst(e.x,1,e.z,ET[e.type].c,e.type==='boss'?60:14);
  p.hp=Math.min(p.max,p.hp+p.leech);
  if(R()<.14&&e.type!=='boss')mkPickup(pick(PU),e.x,e.z);
  if(e.type==='boss')finish(true);
}
function hit(e,d){
  e.hp-=d;e.flash=.12;
  const dx=e.x-p.x,dz=e.z-p.z,l=Math.hypot(dx,dz)||1,k=e.type==='boss'?1:7;
  e.kx=dx/l*k;e.kz=dz/l*k;
  if(p.slow)e.slow=1.6;
  if(e.hp<=0)kill(e);
}
function finish(win){
  state=win?'win':'dead';
  if(document.pointerLockElement)document.exitPointerLock();
  $('t').textContent=win?'SYSTEM CLEAN':'INFECTED';
  $('sub').textContent=win?'zero-day purged. all 10 floors.':'terminated on floor '+floor;
  $('go').textContent=win?'REBOOT':'RETRY';
  $('ov').style.display='flex';
}
function newGame(){
  p={x:0,z:0,yaw:0,hp:100,max:100,sp:6.5,dmg:1,rate:1,range:3.2,shield:0,regen:0,dcd:1,dash:0,dcool:0,atk:0,inv:0,slow:0,ad:0,leech:0,have:{},dx:0,dz:0,tg:0};
  floor=1;$('chips').innerHTML='';build();state='play';$('ov').style.display='none';
}

function lash(){
  p.atk=.45/p.rate;p.tg=.18;
  const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);
  for(const e of enemies.slice()){
    const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
    if(d<p.range+e.r&&(d<1.6||(dx*fx+dz*fz)/d>.25))hit(e,p.dmg);
  }
  shots=shots.filter(s=>{
    const dx=s.x-p.x,dz=s.z-p.z;
    if(Math.hypot(dx,dz)<p.range&&(dx*fx+dz*fz)>0){world.remove(s.m);return false}
    return true;
  });
}

function update(dt,t){
  const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);
  if(K.ArrowLeft||K.KeyQ)p.yaw+=2.4*dt;
  if(K.ArrowRight||K.KeyE)p.yaw-=2.4*dt;
  const ix=(K.KeyD?1:0)-(K.KeyA?1:0),iz=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0);
  let vx=fx*iz+rx*ix,vz=fz*iz+rz*ix;const vl=Math.hypot(vx,vz);
  if(vl>0){vx/=vl;vz/=vl}
  p.dcool-=dt;p.atk-=dt;p.inv-=dt;
  if((K.ShiftLeft||K.ShiftRight)&&p.dcool<=0&&p.dash<=0){p.dash=.18;p.dcool=1.6*p.dcd;p.dx=vl>0?vx:fx;p.dz=vl>0?vz:fz;p.inv=Math.max(p.inv,.3)}
  let sp=p.sp;
  if(p.dash>0){p.dash-=dt;vx=p.dx;vz=p.dz;sp=20}
  mv(p,vx*sp*dt,vz*sp*dt,.5);
  if((mouseDown||K.Space)&&p.atk<=0)lash();
  p.hp=Math.min(p.max,p.hp+p.regen*dt);
  p.tg-=dt;

  const g=gecko.g,mvg=vl>0||p.dash>0?1:0;
  g.position.set(p.x,0,p.z);g.rotation.y=p.yaw;
  g.visible=p.inv<=0||Math.floor(t*20)%2===0;
  gecko.tail.forEach((s,i)=>s.position.x=Math.sin(t*(mvg?9:3)-i*.7)*.1*(i+1)*.6);
  gecko.legs.forEach((l,i)=>l.position.z=(i%2?-.4:.4)+Math.sin(t*12+i*2)*.12*mvg);
  gecko.tongue.visible=p.tg>0;
  if(p.tg>0){const L=Math.max(.1,p.range*Math.sin((1-p.tg/.18)*Math.PI));gecko.tongue.scale.y=L;gecko.tongue.position.z=L/2}
  plight.position.set(p.x,3,p.z);

  for(const e of enemies.slice()){
    const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||1,nx=dx/d,nz=dz/d;
    const sl=e.slow>0?.4:1,sp=e.sp*sl;
    e.slow-=dt;e.flash-=dt;e.t+=dt;
    let ux=0,uz=0;
    switch(e.type){
      case 'worm':{const w=Math.sin(e.t*4)*.8;ux=(nx-nz*w)*sp;uz=(nz+nx*w)*sp;break}
      case 'trojan':ux=nx*sp;uz=nz*sp;break;
      case 'ransom':
        if(e.st===0){ux=nx*sp;uz=nz*sp;e.cd-=dt;if(e.cd<=0&&d<10){e.st=1;e.cd=.7;e.dx=nx;e.dz=nz}}
        else if(e.st===1){e.cd-=dt;e.mat.emissiveIntensity=1.4;if(e.cd<=0){e.st=2;e.cd=.6}}
        else{ux=e.dx*15;uz=e.dz*15;e.cd-=dt;if(e.cd<=0){e.st=0;e.cd=2+R()*1.5;e.mat.emissiveIntensity=.35}}
        break;
      case 'spy':{
        const k=d<7?-1:d>11?1:0;ux=nx*sp*k-nz*sp*.5;uz=nz*sp*k+nx*sp*.5;
        e.cd-=dt;if(e.cd<=0&&d<16){e.cd=1.6;shoot(e,nx,nz,8)}
        break}
      case 'root':{
        ux=nx*sp;uz=nz*sp;e.cd-=dt;
        e.mat.opacity=.25+.2*Math.sin(e.t*5);
        if(e.cd<=0){
          e.cd=3;const a=R()*6.28,tx=p.x+Math.cos(a)*4,tz=p.z+Math.sin(a)*4;
          if(!blocked(tx,tz,e.r)){burst(e.x,1,e.z,0x7a8aa0,6);e.x=tx;e.z=tz}
        }
        break}
      case 'boss':
        ux=nx*sp;uz=nz*sp;e.cd-=dt;e.cd2-=dt;
        if(e.cd<=0){e.cd=2.5;const o=R()*6.28;for(let i=0;i<14;i++){const a=o+i*Math.PI*2/14;shoot(e,Math.cos(a),Math.sin(a),10,7)}}
        if(e.cd2<=0){e.cd2=7;if(enemies.length<14)for(let i=0;i<2;i++)spawn('worm',e.x+(i?2.5:-2.5),e.z)}
        break;
    }
    mv(e,(ux+e.kx)*dt,(uz+e.kz)*dt,e.r*.7);
    e.kx*=1-Math.min(1,8*dt);e.kz*=1-Math.min(1,8*dt);
    e.g.position.set(e.x,e.r+.2+Math.sin(e.t*3)*.15,e.z);
    e.core.rotation.y+=dt*1.5;e.core.rotation.x+=dt*.7;
    if(e.type!=='ransom'||e.st!==1)e.mat.emissiveIntensity=e.flash>0?1.5:.35;
    if(d<e.r+.55)hurt(e.dmg);
  }
  for(const s of shots.slice()){
    s.x+=s.vx*dt;s.z+=s.vz*dt;s.life-=dt;s.m.position.set(s.x,1,s.z);
    const d=Math.hypot(s.x-p.x,s.z-p.z);
    let dead=s.life<=0||solid(s.x,s.z);
    if(!dead&&p.ad&&d<2.6)dead=true;
    if(!dead&&d<.7){hurt(s.d);dead=true}
    if(dead){world.remove(s.m);shots.splice(shots.indexOf(s),1)}
  }
  for(const q of pickups.slice()){
    q.m.rotation.y+=dt*2;q.m.position.y=1+Math.sin(t*3+q.x)*.2;
    if(Math.hypot(q.x-p.x,q.z-p.z)<1.3){q.pu.f();chipUp(q.pu);toast(q.pu.n,q.pu.c);world.remove(q.m);pickups.splice(pickups.indexOf(q),1)}
  }
  for(const q of parts.slice()){
    q.life-=dt;q.vy-=14*dt;q.m.position.x+=q.vx*dt;q.m.position.y=Math.max(.1,q.m.position.y+q.vy*dt);q.m.position.z+=q.vz*dt;
    if(q.life<=0){world.remove(q.m);parts.splice(parts.indexOf(q),1)}
  }
  const open=enemies.length===0&&floor<10;
  exitM.material.color.setHex(open?0x3dff8a:0x553333);
  exitM.rotation.y+=dt;
  if(open&&Math.hypot(exitPos.x-p.x,exitPos.z-p.z)<1.5){floor++;build();toast('FLOOR '+floor,0x3dff8a)}

  cam.position.set(p.x-fx*6.5,7.2,p.z-fz*6.5);
  cam.lookAt(p.x+fx*2,.4,p.z+fz*2);
  $('hp').style.width=Math.max(0,p.hp/p.max*100)+'%';
  $('sh').style.width=Math.min(100,p.shield*20)+'%';
  $('info').textContent='FLOOR '+floor+'/10   THREATS '+enemies.length;
  drawMap();
}
function drawMap(){
  mc.clearRect(0,0,108,108);
  mc.fillStyle='rgba(8,16,12,.7)';mc.fillRect(0,0,108,108);
  mc.fillStyle='rgba(180,255,210,.18)';
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(grid[j][i]===0)mc.fillRect(i*4,j*4,4,4);
  if(enemies.length===0&&floor<10){mc.fillStyle='#3dff8a';mc.fillRect(exitPos.x/S*4-1,exitPos.z/S*4-1,6,6)}
  mc.fillStyle='#ff4a4a';enemies.forEach(e=>mc.fillRect(e.x/S*4,e.z/S*4,4,4));
  mc.fillStyle='#fff';mc.fillRect(p.x/S*4,p.z/S*4,4,4);
}

const clock=new T.Clock();
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;
  if(state==='play')update(dt,t);
  else if(p&&state!=='pause'){enemies.forEach(e=>{e.core.rotation.y+=dt})}
  renderer.render(scene,cam);
}
scene.background=new T.Color(0x05090a);
cam.position.set(0,10,10);cam.lookAt(0,0,0);
$('go').onclick=()=>{
  if(state==='pause'){state='play';$('ov').style.display='none'}else newGame();
  try{renderer.domElement.requestPointerLock()}catch(e){}
};
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&state==='play'){state='pause';$('t').textContent='PAUSED';$('sub').textContent='';$('go').textContent='RESUME';$('ov').style.display='flex'}
});
addEventListener('mousemove',e=>{if(document.pointerLockElement&&state==='play')p.yaw-=e.movementX*.003});
addEventListener('mousedown',()=>{mouseDown=true;if(state==='play'&&!document.pointerLockElement)try{renderer.domElement.requestPointerLock()}catch(e){}});
addEventListener('mouseup',()=>mouseDown=false);
addEventListener('keydown',e=>{K[e.code]=true;if(e.code==='Space')e.preventDefault()});
addEventListener('keyup',e=>K[e.code]=false);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()});
loop();