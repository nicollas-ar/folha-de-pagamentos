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
const monster=new Image();monster.src='/images/aura-monster.svg';
let player,ghosts,dots,score=0,lives=3,level=1,power=0,immune=0,dir='left',want='left',playing=false,paused=false,busy=false,token='',last=0,acc=0,ga=0,frame=0,age=0;
function resetActors(){player={x:7,y:13};ghosts=[{x:7,y:7,c:'#ff628e'},{x:1,y:1,c:'#ab8bff'},{x:13,y:1,c:'#63dcff'}];dir=want='left';immune=1.8;}
function resetMap(){dots=new Map();map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.'||c==='o')dots.set(key(x,y),c);}));resetActors();}
function hud(){document.getElementById('maze-score').textContent=score;document.getElementById('maze-lives').textContent=lives;document.getElementById('maze-level').textContent=level;}
function draw(){ctx.fillStyle='#080c1a';ctx.fillRect(0,0,450,450);map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#'){ctx.fillStyle='#222950';ctx.fillRect(x*T+2,y*T+2,26,26);ctx.strokeStyle='#6465c9';ctx.strokeRect(x*T+3,y*T+3,24,24);}}));for(const [k,c] of dots){const [x,y]=k.split(',').map(Number);ctx.fillStyle=c==='o'?'#b5ff75':'#b9f1ff';ctx.beginPath();ctx.arc(x*T+15,y*T+15,c==='o'?6:2.7,0,Math.PI*2);ctx.fill();}
for(const g of ghosts){ctx.fillStyle=power>0?'#416dbf':g.c;ctx.beginPath();ctx.roundRect(g.x*T+4,g.y*T+4,22,23,[11,11,3,3]);ctx.fill();ctx.fillStyle='white';ctx.fillRect(g.x*T+9,g.y*T+11,4,5);ctx.fillRect(g.x*T+17,g.y*T+11,4,5);}
ctx.globalAlpha=immune>0&&Math.floor(immune*8)%2?.55:1;if(monster.complete&&monster.naturalWidth)ctx.drawImage(monster,player.x*T-3,player.y*T-3,36,36);else{ctx.fillStyle='#a4ff69';ctx.beginPath();ctx.arc(player.x*T+15,player.y*T+15,12,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
if(paused){ctx.fillStyle='#000a';ctx.fillRect(0,0,450,450);ctx.fillStyle='#fff';ctx.font='bold 32px Arial';ctx.textAlign='center';ctx.fillText('PAUSA',225,225);}}
function move(p,d){const [dx,dy]=D[d];if(!open(p.x+dx,p.y+dy))return false;p.x+=dx;p.y+=dy;return true;}
function collision(){if(immune>0)return;for(const g of ghosts){if(g.x!==player.x||g.y!==player.y)continue;if(power>0){score+=30;g.x=7;g.y=7;immune=.4;}else{lives--;if(lives<=0){finish();return;}resetActors();power=0;}break;}}
function enemy(g){let options=Object.keys(D).filter(d=>{const [x,y]=D[d];return open(g.x+x,g.y+y);});if(!options.length)return;if(Math.random()<.28){move(g,options[Math.floor(Math.random()*options.length)]);return;}options.sort((a,b)=>{const dist=d=>Math.abs(g.x+D[d][0]-player.x)+Math.abs(g.y+D[d][1]-player.y);return power>0?dist(b)-dist(a):dist(a)-dist(b);});move(g,options[0]);}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(body)});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Sessão expirada. Atualize a página.');const d=await r.json();if(!r.ok)throw Error(d.error||'Erro ao salvar');return d;}
async function finish(){if(!playing)return;playing=false;busy=true;cancelAnimationFrame(frame);hud();draw();status.textContent='Salvando '+score+' pontos…';try{const d=await post('/labirinto/score',{token,score});const list=document.getElementById('maze-ranking');list.replaceChildren();for(const row of d.ranking){const li=document.createElement('li');li.textContent=row.name+(row.me?' (você)':'')+' — '+row.score+' pts';list.append(li);}status.textContent='Fim de jogo! Recorde: '+d.best;}catch(e){status.textContent=e.message;}finally{busy=false;start.disabled=false;start.textContent='Jogar novamente';}}
function tick(t){if(!playing)return;const dt=Math.min(.05,Math.max(0,(t-last)/1000));last=t;if(!paused){age+=dt;acc+=dt;ga+=dt;power=Math.max(0,power-dt);immune=Math.max(0,immune-dt);
if(acc>=.15){acc-=.15;if(move(player,want))dir=want;else move(player,dir);const k=key(player.x,player.y),c=dots.get(k);if(c){score+=c==='o'?50:10;dots.delete(k);if(c==='o')power=7;}collision();if(!playing)return;if(!dots.size){score+=100;level++;power=0;resetMap();}}
if(ga>=Math.max(.16,.36-(level-1)*.025)){ga=0;ghosts.forEach(enemy);collision();if(!playing)return;}hud();draw();if(age>=600){finish();return;}}
frame=requestAnimationFrame(tick);}
async function begin(){if(playing||busy)return;busy=true;start.disabled=true;try{const d=await post('/labirinto/start',{});token=d.token;score=0;lives=3;level=1;power=0;age=acc=ga=0;paused=false;pause.textContent='Pausar';resetMap();hud();playing=true;last=performance.now();status.textContent='FARM DE AURA ATIVADO';frame=requestAnimationFrame(tick);}catch(e){status.textContent=e.message;start.disabled=false;}finally{busy=false;}}
function toggle(){if(!playing)return;paused=!paused;pause.textContent=paused?'Continuar':'Pausar';draw();}
start.onclick=begin;pause.onclick=toggle;document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>want=b.dataset.dir));
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(d&&playing){e.preventDefault();want=d;}if(e.key==='Escape')toggle();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!paused)toggle();});
let touch;cv.addEventListener('pointerdown',e=>{touch=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',e=>{if(!touch)return;const dx=e.clientX-touch[0],dy=e.clientY-touch[1];if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;want=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');touch=[e.clientX,e.clientY];});cv.addEventListener('pointerup',()=>touch=null);cv.addEventListener('pointercancel',()=>touch=null);
resetMap();draw();monster.onload=()=>{if(!playing)draw();};
})();