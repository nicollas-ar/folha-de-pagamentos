(() => {
const canvas=document.getElementById('race-canvas'); if(!canvas)return;
const ctx=canvas.getContext('2d'), scoreEl=document.getElementById('race-score'), bestEl=document.getElementById('race-best'), status=document.getElementById('race-status'), start=document.getElementById('race-start');
const csrf=document.getElementById('race-csrf').value;
let lane=1, playerX=180, tilt=0, roadOffset=0, cars=[], elapsed=0, spawn=0, last=0, playing=false, busy=false, token='', frame=0;
const x=l=>60+l*120;
let overtakes=0, particles=[], roadTravel=0, speed=150, countdown=0, paused=false, pointer=null;
const ui=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=value;};
function burst(cx,y,color){for(let i=0;i<10;i++)particles.push({x:cx,y,vx:(Math.random()-.5)*100,vy:40+Math.random()*100,life:.45,color});}
function car(cx,y,color,player=false){
 ctx.save();ctx.translate(cx,y);ctx.shadowColor=color;ctx.shadowBlur=player?15:3;
 ctx.fillStyle='#080b12';for(const xx of [-26,18])for(const yy of [12,52]){ctx.fillRect(xx,yy,8,17);}
 const body=ctx.createLinearGradient(-24,0,24,0);body.addColorStop(0,color);body.addColorStop(.45,'#dfeaff');body.addColorStop(.53,color);body.addColorStop(1,color);
 ctx.fillStyle=body;ctx.beginPath();ctx.roundRect(-23,0,46,76,10);ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle='#142238';ctx.beginPath();ctx.roundRect(-17,12,34,19,5);ctx.fill();ctx.beginPath();ctx.roundRect(-16,47,32,12,4);ctx.fill();
 ctx.fillStyle='#e8ffff';ctx.fillRect(-18,3,9,5);ctx.fillRect(9,3,9,5);ctx.fillStyle='#ff3959';ctx.fillRect(-18,68,9,4);ctx.fillRect(9,68,9,4);
 if(player){ctx.fillStyle='#111b25';ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.fillText('67',0,44);ctx.fillStyle='#101823';ctx.fillRect(-24,63,48,5);}
 ctx.restore();
}
function draw(){
 const bg=ctx.createLinearGradient(0,0,360,520);bg.addColorStop(0,'#111a2b');bg.addColorStop(1,'#070d17');ctx.fillStyle=bg;ctx.fillRect(0,0,360,520);
 ctx.fillStyle='#242c3c';ctx.fillRect(12,0,336,520);
 for(let i=-1;i<15;i++){let y=i*40+roadTravel%40;ctx.fillStyle=i%2?'#eff8ff':'#f14c75';ctx.fillRect(5,y,7,20);ctx.fillRect(348,y,7,20);}
 ctx.fillStyle='#8cfaff';ctx.fillRect(12,0,2,520);ctx.fillRect(346,0,2,520);
 ctx.strokeStyle='#8291aa';ctx.lineWidth=2;ctx.setLineDash([24,26]);ctx.lineDashOffset=-roadOffset;
 for(const xx of [120,240]){ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,520);ctx.stroke();}ctx.setLineDash([]);
 for(const c of cars)car(x(c.lane),c.y,c.color);
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,6);}ctx.globalAlpha=1;
 ctx.save();ctx.translate(playerX,463);ctx.rotate(tilt);car(0,-38,'#a4ff69',true);ctx.restore();
 if(countdown>0||paused){ctx.fillStyle='#050911aa';ctx.fillRect(0,0,360,520);ctx.fillStyle='#eaffff';ctx.font='900 56px Arial';ctx.textAlign='center';ctx.fillText(paused?'PAUSA':Math.ceil(countdown),180,250);}
}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(body)});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Sessão expirada. Recarregue a página.');const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao salvar.');return d;}
function ranking(rows){const list=document.getElementById('race-ranking');list.replaceChildren();for(const row of rows){const li=document.createElement('li'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=row.name+(row.me?' (você)':'');strong.textContent=row.score+' pts';li.append(span,strong);list.append(li);}}
async function finish(){playing=false;paused=false;ui('race-pause','Pausar');cancelAnimationFrame(frame);busy=true;start.disabled=true;const points=Math.floor(elapsed*10);status.textContent='Fim da corrida! Salvando '+points+' pontos…';try{const d=await post('/corrida/score',{token,score:points});bestEl.textContent=d.best;ranking(d.ranking);status.textContent='Pontuação salva! +'+points+' aura.';}catch(e){status.textContent=e.message;}finally{busy=false;start.disabled=false;start.textContent='Jogar novamente';}}
function tick(t){
 if(!playing)return;const dt=Math.max(0,Math.min((t-last)/1000,.05));last=t;
 if(paused){frame=requestAnimationFrame(tick);return;}
 if(countdown>0){countdown=Math.max(0,countdown-dt);draw();frame=requestAnimationFrame(tick);return;}
 elapsed+=dt;spawn+=dt;speed=Math.min(440,150+elapsed*4);
 const delta=x(lane)-playerX;playerX+=delta*(1-Math.exp(-12*dt));tilt+=(Math.max(-.17,Math.min(.17,delta*.002))-tilt)*(1-Math.exp(-10*dt));roadTravel+=speed*dt;roadOffset=roadTravel%50;
 if(spawn>Math.max(.76,1.4-elapsed*.011)){
  spawn=0;const lanes=[0,1,2].sort(()=>Math.random()-.5);const count=elapsed>25&&Math.random()<.28?2:1;
  for(let i=0;i<count;i++)cars.push({lane:lanes[i],y:-80,color:['#ff637f','#b6a0ff','#ffd36b','#60c9ff'][Math.floor(Math.random()*4)],passed:false});
 }
 for(const c of cars){c.y+=speed*dt;if(!c.passed&&c.y>501){c.passed=true;overtakes++;burst(x(c.lane),500,'#a4ff69');}}
 cars=cars.filter(c=>c.y<540);
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}particles=particles.filter(p=>p.life>0);
 scoreEl.textContent=Math.floor(elapsed*10);ui('race-speed',Math.round(60+speed*.24)+' km/h');ui('race-passed',overtakes);draw();
 if(elapsed>=600||cars.some(c=>Math.abs(x(c.lane)-playerX)<42&&c.y+70>430&&c.y<495)){finish();return;}
 frame=requestAnimationFrame(tick);
}
async function begin(){if(playing||busy)return;busy=true;start.disabled=true;try{const d=await post('/corrida/start',{});token=d.token;lane=1;playerX=180;tilt=0;roadOffset=0;roadTravel=0;cars=[];particles=[];overtakes=0;elapsed=0;spawn=0;countdown=3;paused=false;ui('race-passed',0);ui('race-speed','0 km/h');ui('race-pause','Pausar');scoreEl.textContent='0';playing=true;status.textContent='Desvie dos carros!';last=performance.now();frame=requestAnimationFrame(tick);}catch(e){status.textContent=e.message;start.disabled=false;}finally{busy=false;}}
function move(d){if(playing&&!paused){lane=Math.max(0,Math.min(2,lane+d));}}
document.getElementById('race-left').addEventListener('click',()=>move(-1));document.getElementById('race-right').addEventListener('click',()=>move(1));start.addEventListener('click',begin);
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea,button'))return;if(['ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();if(e.key===' ')begin();else move(e.key==='ArrowLeft'?-1:1);}});
function togglePause(){if(!playing)return;paused=!paused;ui('race-pause',paused?'Continuar':'Pausar');status.textContent=paused?'Corrida pausada.':'Desvie dos carros!';draw();}
document.getElementById('race-pause')?.addEventListener('click',togglePause);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!paused)togglePause();});
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'&&!e.repeat)togglePause();});
canvas.addEventListener('pointerdown',e=>{if(!playing||paused)return;const r=canvas.getBoundingClientRect();const target=Math.max(0,Math.min(2,Math.floor((e.clientX-r.left)/r.width*3)));lane=target;});draw();
})();