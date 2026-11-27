(()=>{
const cv=document.getElementById('maze');if(!cv)return;
const ctx=cv.getContext('2d'),status=document.getElementById('maze-status'),start=document.getElementById('maze-start'),pause=document.getElementById('maze-pause'),csrf=document.getElementById('maze-csrf').value;
const map=[
'###############',
'#.............#',
'#.###.###.###.#',
'#o#.........#o#',
'#.#.##.##.#.#.#',
'#.............#',
'###.#.#.#.#.###',
'#...#.....#...#',
'#.#.#.###.#.#.#',
'#.............#',
'#.###.#.#.###.#',
'#o....#.#....o#',
'#.###.....###.#',
'#.............#',
'###############'];
const T=30,D={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},key=(x,y)=>x+','+y,open=(x,y)=>map[y]?.[x]!==undefined&&map[y][x]!=='#';
const monster=new Image();monster.src='/images/maze-ghost.svg';
let player,ghosts,dots,score=0,lives=3,level=1,power=0,immune=0,dir='left',want='left',playing=false,paused=false,busy=false,token='',last=0,acc=0,ga=0,frame=0,age=0;
function snap(p){p.rx=p.x;p.ry=p.y;return p;}
function resetActors(){player=snap({x:7,y:13});ghosts=[{x:7,y:7,c:'#ff628e',home:[7,7]},{x:1,y:1,c:'#ab8bff',home:[1,1]},{x:13,y:1,c:'#63dcff',home:[13,1]}].map(snap);dir=want='left';immune=1.8;acc=ga=0;}
function animate(p,dt,period){const distance=Math.hypot(p.x-p.rx,p.y-p.ry);if(distance<.00001){snap(p);return;}const step=Math.min(1,dt/(period*distance));p.rx+=(p.x-p.rx)*step;p.ry+=(p.y-p.ry)*step;}
function resetMap(){dots=new Map();map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.'||c==='o')dots.set(key(x,y),c);}));resetActors();}
function hud(){document.getElementById('maze-score').textContent=score;document.getElementById('maze-lives').textContent=lives;document.getElementById('maze-level').textContent=level;}
function draw(){ctx.fillStyle='#080c1a';ctx.fillRect(0,0,450,450);map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#'){ctx.fillStyle='#222950';ctx.fillRect(x*T+2,y*T+2,26,26);ctx.strokeStyle='#6465c9';ctx.strokeRect(x*T+3,y*T+3,24,24);}}));for(const [k,c] of dots){const [x,y]=k.split(',').map(Number);ctx.fillStyle=c==='o'?'#b5ff75':'#b9f1ff';ctx.beginPath();ctx.arc(x*T+15,y*T+15,c==='o'?6:2.7,0,Math.PI*2);ctx.fill();}
for(const g of ghosts){
 const gx=g.rx*T+15,gy=g.ry*T+15;
 ctx.save();ctx.shadowColor=power>0?'#63dcff':g.c;ctx.shadowBlur=6;
 ctx.fillStyle=power>0?'#416dbf':g.c;ctx.beginPath();ctx.arc(gx,gy,14,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 if(monster.complete&&monster.naturalWidth)ctx.drawImage(monster,gx-15,gy-16,30,32);
 else {ctx.fillStyle='#fff';ctx.fillRect(gx-7,gy-4,4,5);ctx.fillRect(gx+3,gy-4,4,5);}
 ctx.restore();
}
ctx.globalAlpha=immune>0&&Math.floor(immune*8)%2?.55:1;
const angle={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[dir];
const mouth=playing&&!paused&&Math.hypot(player.x-player.rx,player.y-player.ry)>.001?.12+.32*Math.abs(Math.sin(age*18)):.32;
ctx.fillStyle='#ffe23d';ctx.beginPath();ctx.moveTo(player.rx*T+15,player.ry*T+15);ctx.arc(player.rx*T+15,player.ry*T+15,12,angle+mouth,angle+Math.PI*2-mouth);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
if(paused){ctx.fillStyle='#000a';ctx.fillRect(0,0,450,450);ctx.fillStyle='#fff';ctx.font='bold 32px Arial';ctx.textAlign='center';ctx.fillText('PAUSA',225,225);}}
function move(p,d){const [dx,dy]=D[d];if(!open(p.x+dx,p.y+dy))return false;p.x+=dx;p.y+=dy;return true;}
function collision(){if(immune>0)return;for(const g of ghosts){if(Math.hypot(g.rx-player.rx,g.ry-player.ry)>.65)continue;if(power>0){score+=30;[g.x,g.y]=g.home;g.prev=null;snap(g);immune=.4;}else{lives--;if(lives<=0){finish();return;}resetActors();power=0;}break;}}
function distances(){
 const dist=new Map([[key(player.x,player.y),0]]),queue=[[player.x,player.y]];
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of Object.values(D)){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(open(nx,ny)&&!dist.has(k)){dist.set(k,dist.get(key(x,y))+1);queue.push([nx,ny]);}}}return dist;
}
function enemy(g,dist,reserved){
 const choices=Object.entries(D).map(([d,[dx,dy]])=>({d,x:g.x+dx,y:g.y+dy})).filter(p=>open(p.x,p.y));
 if(!choices.length)return;
 let options=choices.filter(p=>!reserved.has(key(p.x,p.y)));
 if(!options.length)return;
 const forward=options.filter(p=>key(p.x,p.y)!==g.prev);if(forward.length)options=forward;
 const value=p=>dist.get(key(p.x,p.y))??999;
 options.sort((a,b)=>power>0?value(b)-value(a):value(a)-value(b));
 const p=Math.random()<.12?options[Math.floor(Math.random()*options.length)]:options[0];
 g.prev=key(g.x,g.y);move(g,p.d);
}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(body)});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Sessão expirada. Atualize a página.');const d=await r.json();if(!r.ok)throw Error(d.error||'Erro ao salvar');return d;}
async function finish(){if(!playing)return;playing=false;busy=true;cancelAnimationFrame(frame);hud();draw();status.textContent='Salvando '+score+' pontos…';try{const d=await post('/labirinto/score',{token,score});const list=document.getElementById('maze-ranking');list.replaceChildren();for(const row of d.ranking){const li=document.createElement('li');li.textContent=row.name+(row.me?' (você)':'')+' — '+row.score+' pts';list.append(li);}status.textContent='Fim de jogo! Recorde: '+d.best;}catch(e){status.textContent=e.message;}finally{busy=false;start.disabled=false;start.textContent='Jogar novamente';}}
function tick(t){if(!playing)return;const dt=Math.min(.05,Math.max(0,(t-last)/1000));last=t;if(!paused){age+=dt;acc+=dt;ga+=dt;power=Math.max(0,power-dt);immune=Math.max(0,immune-dt);
animate(player,dt,.15);for(const g of ghosts)animate(g,dt,Math.max(.16,.36-(level-1)*.025));
if(acc>=.15){acc-=.15;snap(player);if(move(player,want))dir=want;else move(player,dir);const k=key(player.x,player.y),c=dots.get(k);if(c){score+=c==='o'?50:10;dots.delete(k);if(c==='o')power=7;}collision();if(!playing)return;if(!dots.size){score+=100;level++;power=0;resetMap();}}
if(ga>=Math.max(.16,.36-(level-1)*.025)){ga-=Math.max(.16,.36-(level-1)*.025);const dist=distances(),reserved=new Set(ghosts.map(g=>key(g.x,g.y)));for(const g of ghosts){snap(g);reserved.delete(key(g.x,g.y));enemy(g,dist,reserved);reserved.add(key(g.x,g.y));}}collision();if(!playing)return;hud();draw();if(age>=600){finish();return;}}
frame=requestAnimationFrame(tick);}
async function begin(){if(playing||busy)return;busy=true;start.disabled=true;try{const d=await post('/labirinto/start',{});token=d.token;score=0;lives=3;level=1;power=0;age=acc=ga=0;paused=false;pause.textContent='Pausar';resetMap();hud();playing=true;last=performance.now();status.textContent='FARM DE AURA ATIVADO';frame=requestAnimationFrame(tick);}catch(e){status.textContent=e.message;start.disabled=false;}finally{busy=false;}}
function toggle(){if(!playing)return;paused=!paused;pause.textContent=paused?'Continuar':'Pausar';draw();}
start.onclick=begin;pause.onclick=toggle;document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>want=b.dataset.dir));
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(d&&playing){e.preventDefault();want=d;}if(e.key==='Escape')toggle();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!paused)toggle();});
let touch;cv.addEventListener('pointerdown',e=>{touch=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',e=>{if(!touch)return;const dx=e.clientX-touch[0],dy=e.clientY-touch[1];if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;want=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');touch=[e.clientX,e.clientY];});cv.addEventListener('pointerup',()=>touch=null);cv.addEventListener('pointercancel',()=>touch=null);
resetMap();draw();monster.onload=()=>{if(!playing)draw();};
})();