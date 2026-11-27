(()=>{
const cv=document.getElementById('fighters');if(!cv)return;
const c=cv.getContext('2d'),status=document.getElementById('fighter-status'),start=document.getElementById('fighter-start');
const imgs=['monstro','monstro2'].map(n=>{const i=new Image();i.src='/images/fighter-'+n+'.svg';return i;});
let a,b,balls=[],sparks=[],time=60,playing=false,last=0,wins=0,frame=0;
const held=new Set(),ground=330,clamp=(n,l,h)=>Math.max(l,Math.min(h,n));
function actor(x,color){return{x,y:ground,vy:0,hp:100,energy:100,cd:0,shield:false,color,face:1};}
function reset(){a=actor(160,'#a4ff69');b=actor(640,'#ff79a8');b.face=-1;balls=[];sparks=[];time=60;}
function burst(x,y,color){for(let i=0;i<12;i++)sparks.push({x,y,vx:(Math.random()-.5)*210,vy:(Math.random()-.5)*180,t:.45,color});}
function pulse(p){if(p.cd>0||p.energy<15)return;p.cd=.65;p.energy-=15;balls.push({x:p.x+p.face*48,y:p.y-65,v:p.face*360,owner:p,t:2,color:p.color});burst(p.x+p.face*40,p.y-65,p.color);}
function jump(p){if(p.y>=ground-.1)p.vy=-440;}
function update(p,dt,axis){p.cd=Math.max(0,p.cd-dt);p.energy=Math.min(100,p.energy+dt*(p.shield?1:16));p.x=clamp(p.x+axis*210*dt,50,750);p.vy+=950*dt;p.y=Math.min(ground,p.y+p.vy*dt);if(p.y===ground)p.vy=0;}
function draw(){const bg=c.createLinearGradient(0,0,0,420);bg.addColorStop(0,'#10102c');bg.addColorStop(1,'#351a4e');c.fillStyle=bg;c.fillRect(0,0,800,420);c.fillStyle='#131a30';for(let x=0;x<800;x+=58){const h=60+(x*37%140);c.fillRect(x,ground-h,48,h);c.fillStyle='#a3a9ff44';for(let y=ground-h+12;y<ground-10;y+=24)c.fillRect(x+8,y,8,8);c.fillStyle='#131a30';}
c.fillStyle='#090d19';c.fillRect(0,ground,800,90);c.strokeStyle='#9c74ff';c.beginPath();c.moveTo(0,ground);c.lineTo(800,ground);c.stroke();
for(let i=0;i<2;i++){const p=[a,b][i];c.save();c.shadowColor=p.color;c.shadowBlur=18;c.fillStyle=p.color;c.beginPath();c.ellipse(p.x,ground+5,44,8,0,0,Math.PI*2);c.fill();if(p.shield){c.strokeStyle=p.color;c.lineWidth=3;c.beginPath();c.ellipse(p.x,p.y-65,57,79,0,0,Math.PI*2);c.stroke();}const im=imgs[i];if(im.complete&&im.naturalWidth)c.drawImage(im,p.x-49,p.y-137,98,137);else{c.fillRect(p.x-35,p.y-100,70,100);}c.restore();}
for(const q of balls){c.shadowColor=q.color;c.shadowBlur=15;c.fillStyle=q.color;c.beginPath();c.arc(q.x,q.y,12,0,Math.PI*2);c.fill();}c.shadowBlur=0;
for(const p of sparks){c.globalAlpha=Math.max(0,p.t/.45);c.fillStyle=p.color;c.fillRect(p.x,p.y,5,5);}c.globalAlpha=1;
if(!playing){c.fillStyle='#080b1b66';c.fillRect(0,0,800,420);c.fillStyle='#fff';c.font='900 34px Arial';c.textAlign='center';c.fillText(time===60?'AURA FIGHTERS 67':'FIM DO DUELO',400,80);}}
function hud(){document.getElementById('fighter-one').value=a.hp;document.getElementById('fighter-two').value=b.hp;document.getElementById('fighter-energy').textContent='Aura '+Math.floor(a.energy)+'%';document.getElementById('fighter-timer').textContent=Math.ceil(time);}
function end(){playing=false;held.clear();start.disabled=false;start.textContent='Jogar novamente';const win=a.hp>b.hp;if(win){wins++;document.getElementById('fighter-wins').textContent=wins;}status.textContent=win?'Vitória! +67 AURA':a.hp===b.hp?'Empate!':'Monstro 2 venceu. Boa partida!';draw();}
function tick(t){if(!playing)return;const dt=Math.min(.04,Math.max(0,(t-last)/1000));last=t;time=Math.max(0,time-dt);a.face=a.x<=b.x?1:-1;b.face=-a.face;a.shield=held.has('shield');b.shield=b.hp<40&&Math.random()<.3;
update(a,dt,Number(held.has('right'))-Number(held.has('left')));const distance=Math.abs(a.x-b.x);update(b,dt,distance>290?b.face:distance<130?-b.face:0);if(held.has('jump'))jump(a);if(held.has('pulse'))pulse(a);if(Math.random()<dt*.7)pulse(b);if(Math.random()<dt*.5)jump(b);
for(const q of balls){q.x+=q.v*dt;q.t-=dt;const p=q.owner===a?b:a;if(Math.abs(q.x-p.x)<46&&Math.abs(q.y-(p.y-65))<62){p.hp=Math.max(0,p.hp-(p.shield?2:10));burst(q.x,q.y,q.color);q.t=0;}}
balls=balls.filter(q=>q.t>0&&q.x>0&&q.x<800);for(const p of sparks){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}sparks=sparks.filter(p=>p.t>0);hud();draw();if(!time||!a.hp||!b.hp){end();return;}frame=requestAnimationFrame(tick);}
const keys={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',w:'jump',j:'pulse',k:'shield'};
document.addEventListener('keydown',e=>{if(!playing||e.target.matches('input,textarea,select'))return;const k=keys[e.key];if(k){e.preventDefault();held.add(k);}});document.addEventListener('keyup',e=>held.delete(keys[e.key]));window.addEventListener('blur',()=>held.clear());
document.querySelectorAll('[data-act]').forEach(el=>{el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);held.add(el.dataset.act);});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>held.delete(el.dataset.act));});
start.addEventListener('click',()=>{if(playing)return;reset();held.clear();playing=true;start.disabled=true;last=performance.now();status.textContent='Duelo iniciado!';frame=requestAnimationFrame(tick);});reset();hud();draw();imgs.forEach(i=>i.onload=()=>{if(!playing)draw();});
})();