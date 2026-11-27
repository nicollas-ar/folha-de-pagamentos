(()=>{
'use strict';
const $=id=>document.getElementById(id),cv=$('c3canvas'),status=$('c3status');
if(!cv||!status)return;
const ctx=cv.getContext('2d',{alpha:false});
if(!ctx){status.textContent='Canvas 2D indisponível.';return;}
const W=cv.width,H=cv.height,N=21,FOV=Math.PI/3,PROJ=W/(2*Math.tan(FOV/2)),keys=new Set();
const photos=['/images/fighter-monstro.svg','/images/fighter-monstro2.svg'];
const sprites=photos.map(src=>{const img=new Image();img.src=src;return img;});
const depths=new Float32Array(W);
let map=[],cells=[],player,chasers=[],orbs=[],gems=[],level=1,score=0,best=0,charge=100,shield=0,shieldCd=0,mode=1,fx=0,cool=0,wave=0,remaining=0,goal,phase='ready',last=0,clock=0,hudClock=0,captured=0,mouseWasLocked=false;
const storage='celso3d-best-'+(document.querySelector('.celso3d')?.dataset.user||'guest');
try{best=Number(localStorage.getItem(storage))||0;}catch(e){}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function open(x,z){return map[Math.floor(z)]?.[Math.floor(x)]===0;}
function free(x,z,r=.2){return open(x-r,z-r)&&open(x+r,z-r)&&open(x-r,z+r)&&open(x+r,z+r);}
function move(o,dx,dz){if(free(o.x+dx,o.z))o.x+=dx;if(free(o.x,o.z+dz))o.z+=dz;}
function generate(){
 map=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
 for(let z=4;z<18;z+=5)for(let x=4;x<18;x+=5){const w=2+Math.floor(Math.random()*2),h=2+Math.floor(Math.random()*2);for(let j=0;j<h;j++)for(let i=0;i<w;i++)map[z+j][x+i]=1+((x+z)%2);}
 cells=[];for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)if(!map[z][x])cells.push({x:x+.5,z:z+.5});
}
function shuffled(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function setup(){
 generate();player={x:1.5,z:1.5,a:0,vx:0,vz:0};charge=100;shield=shieldCd=cool=fx=0;wave=0;remaining=6+level*2;
 goal={x:19.5,z:19.5};
 const pool=shuffled(cells.filter(p=>dist(p,player)>4&&dist(p,goal)>1));
 gems=pool.slice(0,5).map(p=>({...p}));
 orbs=pool.slice(5,11+Math.min(level,5)).map(p=>({...p}));
 chasers=[{x:8.5,z:1.5,type:0,path:[],timer:0},{x:1.5,z:9.5,type:1,path:[],timer:0}];
}
function route(a,b){
 const sx=Math.floor(a.x),sz=Math.floor(a.z),gx=Math.floor(b.x),gz=Math.floor(b.z),start=sz*N+sx,end=gz*N+gx;
 const prev=new Int16Array(N*N);prev.fill(-1);prev[start]=start;
 const q=[start];for(let i=0;i<q.length;i++){const p=q[i];if(p===end)break;const x=p%N,z=Math.floor(p/N);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=nz*N+nx;if(open(nx,nz)&&prev[k]===-1){prev[k]=p;q.push(k);}}}
 if(prev[end]===-1)return [];const out=[];let p=end;while(p!==start){out.unshift({x:p%N+.5,z:Math.floor(p/N)+.5});p=prev[p];}return out;
}
function spawn(){const pool=cells.filter(p=>dist(p,player)>3&&dist(p,player)<10&&dist(p,goal)>1&&orbs.every(o=>dist(o,p)>1));if(pool.length){orbs.push({...pool[Math.floor(Math.random()*pool.length)]});remaining--;}}
function aura(){if(phase!=='play'||cool>0||charge<(mode===1?12:25))return;charge-=mode===1?12:25;cool=mode===1?.3:.8;fx=.22;const before=orbs.length;orbs=orbs.filter(o=>dist(o,player)>(mode===1?1.8:3));score+=(before-orbs.length)*35;status.textContent=before===orbs.length?'Pulso liberado.':'Entidades purificadas: '+(before-orbs.length);}
function lose(e){phase='lost';captured=e.type;keys.clear();player.vx=player.vz=0;status.textContent='Encontrado! Enter para tentar novamente.';if(document.pointerLockElement===cv)document.exitPointerLock?.();hud();}
function update(dt){
 const p=player;clock+=dt;
 p.a+=((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*2;
 const f=Number(keys.has('w')||keys.has('ArrowUp'))-Number(keys.has('s')||keys.has('ArrowDown')),r=Number(keys.has('d'))-Number(keys.has('a')),n=Math.max(1,Math.hypot(f,r)),speed=2.8;
 const dx=(Math.cos(p.a)*f-Math.sin(p.a)*r)*speed/n,dz=(Math.sin(p.a)*f+Math.cos(p.a)*r)*speed/n,k=1-Math.exp(-20*dt);
 p.vx+=(dx-p.vx)*k;p.vz+=(dz-p.vz)*k;move(p,p.vx*dt,p.vz*dt);
 charge=Math.min(100,charge+dt*12);cool=Math.max(0,cool-dt);fx=Math.max(0,fx-dt);shield=Math.max(0,shield-dt);shieldCd=Math.max(0,shieldCd-dt);
 wave+=dt;if(wave>=3&&remaining>0&&orbs.length<14){wave=0;spawn();}
 gems=gems.filter(g=>{if(dist(g,p)<.5){score+=67;charge=Math.min(100,charge+30);return false;}return true;});
 for(const e of chasers){e.timer-=dt;if(!e.path.length||e.timer<=0){if(!e.path.length||dist(e,e.path[0])<.12)e.path=route(e,p);e.timer=.35;}const t=e.path[0]||p,d=dist(e,t);if(d<.08){if(e.path.length){e.x=t.x;e.z=t.z;e.path.shift();}e.timer=0;}else{const step=Math.min(d,dt*Math.min((e.type===0?.72:.9)+level*.045,1.3));move(e,(t.x-e.x)*step/d,(t.z-e.z)*step/d);}if(dist(e,p)<.48&&shield===0){lose(e);return;}}
 if(!orbs.length&&!remaining&&!gems.length&&dist(p,goal)<.7){score+=200;level++;setup();status.textContent='Nova fase!';}
 if(score>best){best=score;try{localStorage.setItem(storage,String(best));}catch(e){}}
}
function ray(dx,dz){
 const p=player;let x=Math.floor(p.x),z=Math.floor(p.z),sx=dx<0?-1:1,sz=dz<0?-1:1;
 const ax=Math.abs(1/(dx||1e-9)),az=Math.abs(1/(dz||1e-9));let tx=(dx<0?p.x-x:x+1-p.x)*ax,tz=(dz<0?p.z-z:z+1-p.z)*az,t=0,side=0;
 for(let i=0;i<N*2;i++){if(tx<tz){t=tx;tx+=ax;x+=sx;side=0;}else{t=tz;tz+=az;z+=sz;side=1;}if(!open(x,z))break;}
 const u=side?p.x+t*dx:p.z+t*dz;return {t:Math.max(.04,t),side,u:u-Math.floor(u),type:map[z]?.[x]||1};
}
function render(){
 const p=player,ca=Math.cos(p.a),sa=Math.sin(p.a),plane=Math.tan(FOV/2);
 ctx.fillStyle='#13192d';ctx.fillRect(0,0,W,H/2);ctx.fillStyle='#26243b';ctx.fillRect(0,H/2,W,H/2);
 for(let y=H/2+8;y<H;y+=Math.max(4,Math.floor((y-H/2)/10))){ctx.fillStyle='rgba(100,140,170,.07)';ctx.fillRect(0,y,W,1);}
 for(let i=0;i<W;i+=2){const c=(2*(i+.5)/W-1)*plane,r=ray(ca-sa*c,sa+ca*c),h=PROJ*1.5/r.t,top=(H-h)/2;
 const light=clamp(1.2-r.t*.065,.16,.95)*(r.side?.78:1),seam=r.u<.045||r.u>.955?.65:1,base=r.type===2?[62,110,127]:[94,79,135];
 ctx.fillStyle='rgb('+base.map(v=>Math.round(v*light*seam)).join(',')+')';ctx.fillRect(i,top,2,h);ctx.fillStyle='rgba(125,195,220,.13)';ctx.fillRect(i,top+h*.34,2,Math.max(1,h*.015));depths[i]=r.t;if(i+1<W)depths[i+1]=r.t;}
 const objects=[...chasers.map(o=>({...o,kind:'face'})),...orbs.map(o=>({...o,kind:'orb'})),...gems.map(o=>({...o,kind:'gem'})),{...goal,kind:'exit'}].map(o=>{const dx=o.x-p.x,dz=o.z-p.z;return {...o,depth:dx*ca+dz*sa,side:-dx*sa+dz*ca};}).filter(o=>o.depth>.12).sort((a,b)=>b.depth-a.depth);
 for(const o of objects){
 const size=PROJ/o.depth,hh=size*(o.kind==='face'?1.45:o.kind==='exit'?1.4:.55),ww=hh*(o.kind==='face'?.72:o.kind==='exit'?.65:1),cx=W/2+PROJ*o.side/o.depth,bottom=H/2+size*.75,top=bottom-hh,left=cx-ww/2;
 const img=o.kind==='face'?sprites[o.type]:null;
 for(let i=Math.max(0,Math.floor(left));i<Math.min(W,Math.ceil(left+ww));i++){if(depths[i]<=o.depth)continue;const u=clamp((i-left)/ww,0,.9999);if(img&&img.complete&&img.naturalWidth){ctx.drawImage(img,Math.floor(u*img.naturalWidth),0,1,img.naturalHeight,i,top,1,hh);}else{const edge=Math.abs(u-.5)*2,shape=o.kind==='exit'?1:Math.sqrt(Math.max(0,1-edge*edge));ctx.fillStyle=o.kind==='gem'?'#95ffb2':o.kind==='exit'?(!orbs.length&&!gems.length&&!remaining?'#5cffb0':'#a64061'):o.kind==='face'?'#c2d9ec':'#ae72ff';ctx.fillRect(i,top+hh*(1-shape)/2,1,hh*shape);}}
 }
 // Small route map, kept independent of the rendering backend.
 const m=3.2,ox=W-N*m-9,oz=9;ctx.fillStyle='#090c19';ctx.fillRect(ox-3,oz-3,N*m+6,N*m+6);
 for(let z=0;z<N;z++)for(let x=0;x<N;x++)if(map[z][x]){ctx.fillStyle='#46536d';ctx.fillRect(ox+x*m,oz+z*m,m,m);}
 for(const g of gems){ctx.fillStyle='#73ff9f';ctx.fillRect(ox+g.x*m-1,oz+g.z*m-1,2,2);}
 for(const e of chasers){ctx.fillStyle='#ffb46e';ctx.fillRect(ox+e.x*m-1.5,oz+e.z*m-1.5,3,3);}
 ctx.fillStyle='#fff';ctx.fillRect(ox+p.x*m-2,oz+p.z*m-2,4,4);
 // Abstract aura device, without a realistic weapon.
 const bob=Math.sin(clock*9)*Math.min(3,Math.hypot(p.vx,p.vz));const by=H-24+bob;
 ctx.fillStyle='#263a55';ctx.beginPath();ctx.moveTo(W*.33,H);ctx.lineTo(W*.40,by-28);ctx.lineTo(W*.60,by-28);ctx.lineTo(W*.67,H);ctx.fill();
 ctx.fillStyle='#10233a';ctx.beginPath();ctx.arc(W/2,by-24,24,0,Math.PI*2);ctx.fill();ctx.fillStyle=fx>0?'#e7fff3':'#6cebd2';ctx.beginPath();ctx.arc(W/2,by-24,fx>0?17:12,0,Math.PI*2);ctx.fill();
 if(fx>0){ctx.strokeStyle='rgba(130,255,218,.6)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(W/2,H/2,(.22-fx)*W*1.4+8,0,Math.PI*2);ctx.stroke();}
 if(shield>0){ctx.strokeStyle='#5cefc8';ctx.lineWidth=5;ctx.strokeRect(2,2,W-4,H-4);}
 if(phase!=='play'){ctx.fillStyle='rgba(5,8,20,.80)';ctx.fillRect(0,0,W,H);if(phase==='lost'){const im=sprites[captured];if(im.complete&&im.naturalWidth){const h=H*.67,w=h*im.naturalWidth/im.naturalHeight;ctx.drawImage(im,(W-w)/2,8,w,h);}}
 ctx.textAlign='center';ctx.fillStyle='#e4fff4';ctx.font='bold 22px monospace';ctx.fillText(phase==='lost'?'VOCÊ FOI ENCONTRADO':phase==='pause'?'PAUSADO':'CELSO // AURA 67',W/2,phase==='lost'?H*.79:H*.44);ctx.font='12px monospace';ctx.fillText('ENTER OU CLIQUE EM JOGAR',W/2,phase==='lost'?H*.89:H*.56);}
}
function hud(){const pairs={c3score:'AURA '+score,c3level:'FASE '+level,c3charge:'PODER '+Math.floor(charge)+'%',c3orbs:'ENTIDADES '+orbs.length+' + '+remaining,c3best:'RECORDE '+best,c3energy:'ESCUDO '+(shieldCd>0?Math.ceil(shieldCd)+'s':'PRONTO'),c3gems:'CRISTAIS '+gems.length};for(const [id,v] of Object.entries(pairs)){const e=$(id);if(e&&e.textContent!==v)e.textContent=v;}}
function frame(t){try{const dt=Math.min(.05,Math.max(0,(t-last)/1000||0));last=t;if(phase==='play')update(dt);render();hudClock+=dt;if(hudClock>.1){hud();hudClock=0;}requestAnimationFrame(frame);}catch(e){phase='pause';status.textContent='Erro: '+e.message;}}
function begin(lock=false){if(phase!=='play'){if(phase!=='pause'){level=1;score=0;setup();}phase='play';keys.clear();status.textContent='WASD · mouse/setas · E ou clique: aura · Espaço: escudo';hud();}cv.focus();if(lock){try{const p=cv.requestPointerLock?.();p?.catch?.(()=>{});}catch(e){}}}
function pause(){if(phase==='play'){phase='pause';keys.clear();player.vx=player.vz=0;status.textContent='Pausado. Enter para continuar.';}}
$('c3start').addEventListener('click',()=>begin(true));
cv.addEventListener('click',()=>{if(phase!=='play')begin(true);else aura();});
document.addEventListener('mousemove',e=>{if(phase==='play'&&document.pointerLockElement===cv)player.a+=e.movementX*.0025;});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===cv)mouseWasLocked=true;else if(mouseWasLocked){mouseWasLocked=false;pause();}});
document.addEventListener('keydown',e=>{if(e.target.matches?.('input,textarea,select'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(k==='Enter'){e.preventDefault();if(!e.repeat)begin(false);return;}if(k==='Escape'){pause();return;}if(phase!=='play')return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','e','1','2'].includes(k))e.preventDefault();keys.add(k);if(k==='e'&&!e.repeat)aura();if(k==='1'||k==='2')mode=Number(k);if(k===' '&&!e.repeat&&shieldCd===0){shield=2.4;shieldCd=6;}});
document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
setup();hud();render();status.textContent='Pronto. Clique em Jogar ou pressione Enter.';requestAnimationFrame(frame);
})();