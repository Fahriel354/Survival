/* =========================================================
   ARENA SENJA — Survival Duel
   Game 2D top-down survival: 1 atau 2 pemain vs gelombang
   musuh AI, dengan level, timer, dan efek suara sintesis.
   ========================================================= */

// ---------- Canvas setup ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let W = 0, H = 0;

function resize(){
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  buildBackground();
}
window.addEventListener('resize', resize);

// ---------- Audio (synthesized, no external files) ----------
let actx = null;
let soundOn = true;
function ensureAudio(){ if(!actx){ actx = new (window.AudioContext||window.webkitAudioContext)(); } }
function tone(freq, dur, type='sine', vol=0.18, delay=0, glideTo=null){
  if(!soundOn || !actx) return;
  const t0 = actx.currentTime + delay;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if(glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0+dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0+0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(gain).connect(actx.destination);
  osc.start(t0); osc.stop(t0+dur+0.02);
}
function noiseBurst(dur=0.25, vol=0.22, delay=0){
  if(!soundOn || !actx) return;
  const t0 = actx.currentTime + delay;
  const bufferSize = actx.sampleRate * dur;
  const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * (1 - i/bufferSize); }
  const src = actx.createBufferSource();
  src.buffer = buffer;
  const gain = actx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0+dur);
  const filter = actx.createBiquadFilter();
  filter.type='lowpass'; filter.frequency.value = 1800;
  src.connect(filter).connect(gain).connect(actx.destination);
  src.start(t0);
}
const sfx = {
  shoot(){ tone(680,0.07,'square',0.06); },
  shootEnemy(){ tone(240,0.09,'sawtooth',0.05); },
  hitEnemy(){ tone(180,0.08,'triangle',0.12); },
  hitPlayer(){ tone(120,0.16,'sawtooth',0.16,0,70); },
  explode(){ noiseBurst(0.3,0.22); tone(90,0.2,'sine',0.1,0,40); },
  pickup(){ tone(520,0.09,'sine',0.14); tone(780,0.12,'sine',0.12,0.08); },
  levelUp(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.18,'triangle',0.15,i*0.09)); },
  gameOver(){ [400,340,280,220,160].forEach((f,i)=>tone(f,0.35,'sawtooth',0.1,i*0.14)); },
  waveStart(){ tone(200,0.12,'square',0.08); tone(300,0.12,'square',0.06,0.06); }
};

// ---------- Utility ----------
const rand = (a,b)=> a + Math.random()*(b-a);
const dist = (x1,y1,x2,y2)=> Math.hypot(x2-x1, y2-y1);
const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
const TAU = Math.PI*2;

// ---------- Background (static layer cached to offscreen canvas) ----------
let bgCanvas = document.createElement('canvas');
let bgCtx = bgCanvas.getContext('2d');
let hillsPath1 = [], hillsPath2 = [];

function buildBackground(){
  bgCanvas.width = W; bgCanvas.height = H;
  const g = bgCtx;
  // sky gradient
  const sky = g.createLinearGradient(0,0,0,H*0.72);
  sky.addColorStop(0, '#150b28');
  sky.addColorStop(0.45, '#3a1f4d');
  sky.addColorStop(0.8, '#c85a52');
  sky.addColorStop(1, '#ff7b54');
  g.fillStyle = sky;
  g.fillRect(0,0,W,H*0.72+40);

  // sun glow
  const sunX = W*0.78, sunY = H*0.42, sunR = Math.max(W,H)*0.22;
  const sunGrad = g.createRadialGradient(sunX,sunY,0,sunX,sunY,sunR);
  sunGrad.addColorStop(0,'rgba(255,209,102,0.9)');
  sunGrad.addColorStop(0.35,'rgba(255,166,110,0.35)');
  sunGrad.addColorStop(1,'rgba(255,166,110,0)');
  g.fillStyle = sunGrad;
  g.beginPath(); g.arc(sunX,sunY,sunR,0,TAU); g.fill();
  g.fillStyle = '#ffe9b8';
  g.beginPath(); g.arc(sunX,sunY,H*0.055,0,TAU); g.fill();

  // stars (top area)
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for(let i=0;i<70;i++){
    const sx = rand(0,W), sy = rand(0,H*0.32);
    const r = Math.random()<0.85 ? rand(0.4,1.1) : rand(1.2,1.8);
    g.globalAlpha = rand(0.3,0.9);
    g.beginPath(); g.arc(sx,sy,r,0,TAU); g.fill();
  }
  g.globalAlpha = 1;

  // far hills
  hillsPath1 = generateHill(H*0.62, H*0.09, 6);
  hillsPath2 = generateHill(H*0.7, H*0.13, 5);
  drawHill(g, hillsPath1, '#2a1c40');
  drawHill(g, hillsPath2, '#20142f');

  // ground
  const groundGrad = g.createLinearGradient(0,H*0.72,0,H);
  groundGrad.addColorStop(0,'#3a2a35');
  groundGrad.addColorStop(1,'#1b1420');
  g.fillStyle = groundGrad;
  g.fillRect(0,H*0.72,W,H*0.28);

  // ground texture speckles
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for(let i=0;i<140;i++){
    const gx = rand(0,W), gy = rand(H*0.74,H);
    g.beginPath(); g.ellipse(gx,gy, rand(3,10), rand(1,3), 0,0,TAU); g.fill();
  }
  g.fillStyle = 'rgba(255,180,140,0.05)';
  for(let i=0;i<40;i++){
    const gx = rand(0,W), gy = rand(H*0.72,H*0.8);
    g.beginPath(); g.ellipse(gx,gy, rand(20,60), rand(3,6), 0,0,TAU); g.fill();
  }

  // horizon glow line
  g.fillStyle = 'rgba(255,190,140,0.18)';
  g.fillRect(0,H*0.715,W,4);

  // scattered dead trees / rocks silhouettes
  g.fillStyle = '#180f22';
  for(let i=0;i<9;i++){
    const tx = rand(0,W), ty = H*0.72 + rand(0,H*0.22);
    const scale = rand(0.5,1.2);
    drawDeadTree(g, tx, ty, scale);
  }
}
function generateHill(baseY, amp, points){
  const pts = [];
  const step = W/(points-1);
  for(let i=0;i<points;i++){
    pts.push({x:i*step, y: baseY + rand(-amp,amp)});
  }
  return pts;
}
function drawHill(g, pts, color){
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0,H);
  g.lineTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++){
    const prev = pts[i-1], cur = pts[i];
    const midx = (prev.x+cur.x)/2;
    g.quadraticCurveTo(prev.x, prev.y, midx, (prev.y+cur.y)/2);
  }
  g.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  g.lineTo(W,H);
  g.closePath(); g.fill();
}
function drawDeadTree(g,x,y,s){
  g.save(); g.translate(x,y); g.scale(s,s);
  g.strokeStyle = '#180f22'; g.lineWidth = 3; g.lineCap='round';
  g.beginPath(); g.moveTo(0,0); g.lineTo(-2,-30); g.stroke();
  g.beginPath(); g.moveTo(-2,-30); g.lineTo(-14,-46); g.stroke();
  g.beginPath(); g.moveTo(-2,-30); g.lineTo(10,-42); g.stroke();
  g.beginPath(); g.moveTo(-2,-16); g.lineTo(12,-24); g.stroke();
  g.restore();
}

// ---------- Ambient dust particles (animated, drawn live each frame) ----------
let dust = [];
function initDust(){
  dust = [];
  for(let i=0;i<55;i++){
    dust.push({
      x:rand(0,W), y:rand(H*0.55,H), r:rand(0.6,2.2),
      vy:rand(-14,-4), vx:rand(-6,10), a:rand(0.08,0.4), drift:rand(0,TAU)
    });
  }
}
function updateDust(dt){
  for(const d of dust){
    d.drift += dt*0.6;
    d.x += (d.vx + Math.sin(d.drift)*6) * dt;
    d.y += d.vy * dt;
    if(d.y < H*0.5) { d.y = H; d.x = rand(0,W); }
    if(d.x < -10) d.x = W+10;
    if(d.x > W+10) d.x = -10;
  }
}
function drawDust(){
  for(const d of dust){
    ctx.fillStyle = `rgba(255,225,190,${d.a})`;
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,TAU); ctx.fill();
  }
}

// ---------- Input ----------
const keys = {};
const trackedKeys = ['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','NumpadEnter','KeyP','KeyM','KeyR'];
window.addEventListener('keydown', e=>{
  if(trackedKeys.includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if(e.code === 'KeyP') togglePause();
  if(e.code === 'KeyM') toggleSound();
  if(e.code === 'KeyR' && state === 'over') restartGame();
});
window.addEventListener('keyup', e=>{ keys[e.code] = false; });

// ---------- Entities ----------
function makePlayer(id, x, y, color, glow){
  return {
    id, x, y, vx:0, vy:0, angle:0, radius:17,
    color, glow, health:100, maxHealth:100,
    speed:230, cooldown:0, fireRate:0.22, alive:true,
    score:0, hitFlash:0, walkPhase:0, moving:false, bulletDamage:13
  };
}
function makeEnemy(type, x, y, level){
  const base = {
    drone:  { r:17, hp: 26 + level*7,  spd: 58 + level*4.2, dmg:11, color:'#ef4565', glow:'#ff98a9' },
    shooter:{ r:15, hp: 17 + level*4.5, spd: 40 + level*2.2, dmg:8,  color:'#ff884d', glow:'#ffc79a' },
    sprinter:{r:12, hp: 12 + level*3.2, spd: 118 + level*6, dmg:7,  color:'#ff5d8f', glow:'#ffb3ce' },
  }[type];
  return {
    type, x, y, angle:0, radius:base.r,
    health:base.hp, maxHealth:base.hp, speed:base.spd, damage:base.dmg,
    color:base.color, glow:base.glow,
    cooldown: rand(0.3,1.2), fireCooldown: rand(0.5,1.6),
    walkPhase:Math.random()*TAU, hitFlash:0, preferredDist: type==='shooter'? 240:0
  };
}
function makeBullet(x,y,angle,speed,dmg,owner,color){
  return { x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, dmg, owner, color, radius: owner==='enemy'?4.5:4, life:2.2, trail:[] };
}
function makeParticle(x,y,color){
  const a = rand(0,TAU), spd = rand(40,220);
  return { x,y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, life:rand(0.3,0.7), maxLife:0.7, color, size:rand(2,5) };
}
function makePickup(x,y){
  return { x,y, bob:Math.random()*TAU, taken:false };
}

// ---------- Game state ----------
let state = 'menu'; // menu | playing | paused | levelup | over
let mode = 1; // 1 or 2 players
let players = [], enemies=[], bullets=[], enemyBullets=[], particles=[], pickups=[];
let level = 1, killsThisWave=0, killsNeededThisWave=0, waveEnemiesRemaining=0;
let elapsed = 0;
let shakeTime=0, shakeMag=0;
let arenaTop, arenaBottom, arenaLeft, arenaRight;
let lastTime = 0;
let waveTransitionTimer = 0;

function setArenaBounds(){
  arenaLeft = 40; arenaRight = W-40;
  arenaTop = H*0.16; arenaBottom = H - 60;
}

function newGame(selectedMode){
  mode = selectedMode;
  players = [];
  const cx = W/2;
  players.push(makePlayer(1, cx - (mode===2?80:0), H*0.55, getCSS('--p1'), getCSS('--p1-glow')));
  if(mode===2) players.push(makePlayer(2, cx + 80, H*0.55, getCSS('--p2'), getCSS('--p2-glow')));
  enemies=[]; bullets=[]; enemyBullets=[]; particles=[]; pickups=[];
  level = 1; elapsed = 0;
  document.getElementById('hudP2').style.display = mode===2 ? 'flex' : 'none';
  startWave();
  updateHudStatic();
  state = 'playing';
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('hint').classList.remove('hidden');
  showBanner('BERTAHAN HIDUP!');
  sfx.waveStart();
}
function getCSS(varName){ return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }

function startWave(){
  const count = clamp(4 + level*2, 4, 26);
  waveEnemiesRemaining = count;
  killsThisWave = 0;
  killsNeededThisWave = count;
  for(let i=0;i<count;i++){
    spawnEnemyDelayed(i*0.35);
  }
}
let spawnQueue = [];
function spawnEnemyDelayed(delay){
  spawnQueue.push({t:delay});
}
function updateSpawnQueue(dt){
  for(let i=spawnQueue.length-1;i>=0;i--){
    spawnQueue[i].t -= dt;
    if(spawnQueue[i].t <= 0){
      spawnOneEnemy();
      spawnQueue.splice(i,1);
    }
  }
}
function spawnOneEnemy(){
  let type = 'drone';
  const r = Math.random();
  if(level>=4 && r<0.25) type='sprinter';
  else if(level>=2 && r<0.55) type='shooter';
  // spawn at random edge outside arena
  const edge = Math.floor(rand(0,4));
  let x,y;
  if(edge===0){ x=rand(arenaLeft,arenaRight); y=arenaTop-40; }
  else if(edge===1){ x=rand(arenaLeft,arenaRight); y=arenaBottom+40; }
  else if(edge===2){ x=arenaLeft-40; y=rand(arenaTop,arenaBottom); }
  else { x=arenaRight+40; y=rand(arenaTop,arenaBottom); }
  enemies.push(makeEnemy(type,x,y,level));
}

function showBanner(text, sub){
  const b = document.getElementById('banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- HUD updates ----------
function updateHudStatic(){
  document.getElementById('levelLabel').textContent = 'LEVEL ' + level;
}
function updateHud(){
  const p1 = players.find(p=>p.id===1);
  if(p1){
    document.getElementById('hpFill1').style.width = Math.max(0,p1.health)+'%';
    document.getElementById('score1').textContent = p1.score;
  }
  if(mode===2){
    const p2 = players.find(p=>p.id===2);
    if(p2){
      document.getElementById('hpFill2').style.width = Math.max(0,p2.health)+'%';
      document.getElementById('score2').textContent = p2.score;
    }
  }
  const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
  const ss = String(Math.floor(elapsed%60)).padStart(2,'0');
  document.getElementById('timer').textContent = `${mm}:${ss}`;
  document.getElementById('levelLabel').textContent = 'LEVEL ' + level;
  const progress = killsNeededThisWave>0 ? (killsThisWave/killsNeededThisWave)*100 : 0;
  document.getElementById('waveFill').style.width = clamp(progress,0,100)+'%';
}

// ---------- Update loop ----------
function nearestAlivePlayer(x,y){
  let best=null, bd=Infinity;
  for(const p of players){
    if(!p.alive) continue;
    const d = dist(x,y,p.x,p.y);
    if(d<bd){bd=d; best=p;}
  }
  return best;
}

function updatePlayers(dt){
  for(const p of players){
    if(!p.alive) continue;
    let mvx=0, mvy=0;
    if(p.id===1){
      if(keys['KeyW']) mvy-=1;
      if(keys['KeyS']) mvy+=1;
      if(keys['KeyA']) mvx-=1;
      if(keys['KeyD']) mvx+=1;
    } else {
      if(keys['ArrowUp']) mvy-=1;
      if(keys['ArrowDown']) mvy+=1;
      if(keys['ArrowLeft']) mvx-=1;
      if(keys['ArrowRight']) mvx+=1;
    }
    const mag = Math.hypot(mvx,mvy);
    p.moving = mag>0.1;
    if(mag>0){ mvx/=mag; mvy/=mag; p.angle = Math.atan2(mvy,mvx); }
    p.x = clamp(p.x + mvx*p.speed*dt, arenaLeft+p.radius, arenaRight-p.radius);
    p.y = clamp(p.y + mvy*p.speed*dt, arenaTop+p.radius, arenaBottom-p.radius);
    if(p.moving) p.walkPhase += dt*9;

    // aim: auto-aim nearest enemy, fallback to facing direction
    let aimAngle = p.angle;
    let target = null, bd=Infinity;
    for(const e of enemies){
      const d = dist(p.x,p.y,e.x,e.y);
      if(d<bd){bd=d; target=e;}
    }
    if(target) aimAngle = Math.atan2(target.y-p.y, target.x-p.x);
    p.aimAngle = aimAngle;

    p.cooldown -= dt;
    const wantShoot = p.id===1 ? keys['Space'] : (keys['Enter']||keys['NumpadEnter']);
    if(wantShoot && p.cooldown<=0){
      p.cooldown = p.fireRate;
      const bx = p.x + Math.cos(aimAngle)*p.radius*1.3;
      const by = p.y + Math.sin(aimAngle)*p.radius*1.3;
      bullets.push(makeBullet(bx,by,aimAngle,560,p.bulletDamage,p.id,p.color));
      sfx.shoot();
    }
    if(p.hitFlash>0) p.hitFlash -= dt;
  }
}

function updateEnemies(dt){
  for(const e of enemies){
    const target = nearestAlivePlayer(e.x,e.y);
    if(!target){ continue; }
    const d = dist(e.x,e.y,target.x,target.y);
    const ang = Math.atan2(target.y-e.y, target.x-e.x);
    e.angle = ang;

    if(e.type==='shooter'){
      // keep preferred distance
      if(d > e.preferredDist+20){
        e.x += Math.cos(ang)*e.speed*dt; e.y += Math.sin(ang)*e.speed*dt;
      } else if(d < e.preferredDist-20){
        e.x -= Math.cos(ang)*e.speed*dt*0.8; e.y -= Math.sin(ang)*e.speed*dt*0.8;
      }
      e.fireCooldown -= dt;
      if(e.fireCooldown<=0 && d<520){
        e.fireCooldown = rand(1.1,1.8);
        enemyBullets.push(makeBullet(e.x,e.y,ang,320,e.damage,'enemy','#ff884d'));
        sfx.shootEnemy();
      }
    } else {
      e.x += Math.cos(ang)*e.speed*dt;
      e.y += Math.sin(ang)*e.speed*dt;
    }
    e.x = clamp(e.x, arenaLeft-30, arenaRight+30);
    e.y = clamp(e.y, arenaTop-30, arenaBottom+30);
    e.walkPhase += dt* (e.type==='sprinter'?14:8);

    // melee contact
    e.cooldown -= dt;
    if(d < e.radius+target.radius+4 && e.cooldown<=0){
      e.cooldown = 0.7;
      damagePlayer(target, e.damage);
    }
    if(e.hitFlash>0) e.hitFlash -= dt;
  }
}

function damagePlayer(p, dmg){
  p.health -= dmg;
  p.hitFlash = 0.25;
  sfx.hitPlayer();
  shakeTime = 0.18; shakeMag = 6;
  if(p.health<=0 && p.alive){
    p.alive = false; p.health = 0;
    for(let i=0;i<18;i++) particles.push(makeParticle(p.x,p.y,p.color));
    checkGameOver();
  }
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.trail.push({x:b.x,y:b.y});
    if(b.trail.length>5) b.trail.shift();
    b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
    let hit=false;
    for(const e of enemies){
      if(e.health<=0) continue;
      if(dist(b.x,b.y,e.x,e.y) < e.radius+b.radius){
        e.health -= b.dmg; e.hitFlash = 0.15; hit=true;
        sfx.hitEnemy();
        for(let k=0;k<4;k++) particles.push(makeParticle(b.x,b.y,e.color));
        break;
      }
    }
    if(hit || b.life<=0 || b.x<arenaLeft-60||b.x>arenaRight+60||b.y<arenaTop-60||b.y>arenaBottom+60){
      bullets.splice(i,1);
    }
  }
  for(let i=enemyBullets.length-1;i>=0;i--){
    const b = enemyBullets[i];
    b.trail.push({x:b.x,y:b.y});
    if(b.trail.length>5) b.trail.shift();
    b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
    let hit=false;
    for(const p of players){
      if(!p.alive) continue;
      if(dist(b.x,b.y,p.x,p.y) < p.radius+b.radius){
        damagePlayer(p,b.dmg); hit=true;
        break;
      }
    }
    if(hit || b.life<=0){ enemyBullets.splice(i,1); }
  }
}

function updateEnemyDeaths(){
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    if(e.health<=0){
      for(let k=0;k<14;k++) particles.push(makeParticle(e.x,e.y,e.color));
      sfx.explode();
      shakeTime = 0.12; shakeMag = 4;
      // award score to nearest player (approx killer) — split logic: nearest alive player at time of death
      const killer = nearestAlivePlayer(e.x,e.y);
      if(killer){
        const pts = e.type==='sprinter'?25:e.type==='shooter'?20:15;
        killer.score += pts;
      }
      if(Math.random()<0.12){ pickups.push(makePickup(e.x,e.y)); }
      enemies.splice(i,1);
      killsThisWave++;
    }
  }
}

function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const pk = pickups[i];
    pk.bob += dt*3;
    for(const p of players){
      if(!p.alive) continue;
      if(dist(pk.x,pk.y,p.x,p.y) < p.radius+16){
        p.health = clamp(p.health+25,0,p.maxHealth);
        sfx.pickup();
        pickups.splice(i,1);
        break;
      }
    }
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const pt = particles[i];
    pt.x += pt.vx*dt; pt.y += pt.vy*dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
    pt.life -= dt;
    if(pt.life<=0) particles.splice(i,1);
  }
}

function checkWaveClear(){
  if(state!=='playing') return;
  if(enemies.length===0 && spawnQueue.length===0){
    state = 'levelup';
    waveTransitionTimer = 1.8;
    level++;
    for(const p of players){ if(p.alive) p.health = clamp(p.health+15,0,p.maxHealth); }
    showBanner('LEVEL ' + level, '');
    sfx.levelUp();
  }
}

function checkGameOver(){
  const anyAlive = players.some(p=>p.alive);
  if(!anyAlive){
    state = 'over';
    sfx.gameOver();
    setTimeout(showGameOverScreen, 700);
  }
}

function showGameOverScreen(){
  const totalScore = players.reduce((s,p)=>s+p.score,0);
  document.getElementById('statTime').textContent = document.getElementById('timer').textContent;
  document.getElementById('statLevel').textContent = level;
  document.getElementById('statScore').textContent = totalScore;
  document.getElementById('overScreen').classList.remove('hidden');
}

// ---------- Rendering ----------
function drawArenaFloorEdge(){
  ctx.save();
  ctx.strokeStyle = 'rgba(255,209,102,0.18)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10,8]);
  ctx.strokeRect(arenaLeft, arenaTop, arenaRight-arenaLeft, arenaBottom-arenaTop);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlayer(p){
  if(!p.alive){
    ctx.save();
    ctx.globalAlpha = 0.25;
  }
  ctx.save();
  ctx.translate(p.x,p.y);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0,p.radius*0.85,p.radius*0.9,p.radius*0.35,0,0,TAU); ctx.fill();

  // legs (walk cycle)
  const legSwing = p.moving ? Math.sin(p.walkPhase)*7 : 0;
  ctx.strokeStyle = shadeColor(p.color,-40);
  ctx.lineWidth = 5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,6); ctx.lineTo(-4+legSwing, 16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,6); ctx.lineTo(4-legSwing, 16); ctx.stroke();

  // body glow ring
  ctx.shadowColor = p.glow; ctx.shadowBlur = p.hitFlash>0 ? 26 : 14;
  ctx.fillStyle = p.hitFlash>0 ? '#ffffff' : p.color;
  ctx.beginPath(); ctx.arc(0,0,p.radius,0,TAU); ctx.fill();
  ctx.shadowBlur = 0;

  // inner core
  ctx.fillStyle = shadeColor(p.color,25);
  ctx.beginPath(); ctx.arc(0,0,p.radius*0.5,0,TAU); ctx.fill();

  // gun arm pointing at aim angle
  ctx.rotate(p.aimAngle||0);
  ctx.fillStyle = shadeColor(p.color,-20);
  ctx.fillRect(p.radius*0.2, -3, p.radius*1.3, 6);
  ctx.fillStyle = '#20141c';
  ctx.fillRect(p.radius*1.3, -4, 8, 8);

  ctx.restore();
  if(!p.alive) ctx.restore();

  // player id label above head
  ctx.save();
  ctx.font = "600 11px Rajdhani, sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('P'+p.id, p.x, p.y - p.radius - 10);
  ctx.restore();
}

function shadeColor(hex,percent){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const num = parseInt(hex,16);
  let r=(num>>16), g=(num>>8 & 0x00FF), b=(num & 0x0000FF);
  r = clamp(r + (percent/100)*255,0,255);
  g = clamp(g + (percent/100)*255,0,255);
  b = clamp(b + (percent/100)*255,0,255);
  return `rgb(${r|0},${g|0},${b|0})`;
}

function drawEnemy(e){
  ctx.save();
  ctx.translate(e.x,e.y);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0,e.radius*0.8,e.radius*0.85,e.radius*0.3,0,0,TAU); ctx.fill();

  // legs / treads
  const swing = Math.sin(e.walkPhase)*5;
  ctx.strokeStyle = shadeColor(e.color,-45);
  ctx.lineWidth = 4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-3,5); ctx.lineTo(-3+swing,13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3,5); ctx.lineTo(3-swing,13); ctx.stroke();

  ctx.rotate(e.angle);
  ctx.shadowColor = e.glow; ctx.shadowBlur = e.hitFlash>0 ? 22 : 10;
  ctx.fillStyle = e.hitFlash>0 ? '#ffffff' : e.color;

  if(e.type==='sprinter'){
    // diamond body
    ctx.beginPath();
    ctx.moveTo(e.radius,0); ctx.lineTo(0,e.radius*0.8); ctx.lineTo(-e.radius,0); ctx.lineTo(0,-e.radius*0.8);
    ctx.closePath(); ctx.fill();
  } else if(e.type==='shooter'){
    // hexagon-ish
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = i/6*TAU;
      const px = Math.cos(a)*e.radius, py = Math.sin(a)*e.radius;
      i===0? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0,0,e.radius,0,TAU); ctx.fill();
  }
  ctx.shadowBlur=0;

  // glowing eye/core toward facing dir
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(e.radius*0.35,0,2.6,0,TAU); ctx.fill();

  // antenna
  ctx.strokeStyle = shadeColor(e.color,10);
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,-e.radius*0.9); ctx.lineTo(0,-e.radius*1.4); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0,-e.radius*1.4,2,0,TAU); ctx.fill();

  ctx.restore();

  // tiny health bar
  const w = e.radius*2;
  ctx.save();
  ctx.translate(e.x - w/2, e.y - e.radius - 10);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0,0,w,4);
  ctx.fillStyle = e.color; ctx.fillRect(0,0,w*clamp(e.health/e.maxHealth,0,1),4);
  ctx.restore();

  if(e.hitFlash>0) e.hitFlash -= 0;
}

function drawBullet(b){
  ctx.save();
  for(let i=0;i<b.trail.length;i++){
    const t = b.trail[i];
    ctx.globalAlpha = (i+1)/b.trail.length*0.35;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(t.x,t.y,b.radius*0.6,0,TAU); ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.shadowColor = b.color; ctx.shadowBlur = 10;
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(b.x,b.y,b.radius,0,TAU); ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
}

function drawParticle(pt){
  ctx.save();
  ctx.globalAlpha = clamp(pt.life/pt.maxLife,0,1);
  ctx.fillStyle = pt.color;
  ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.size,0,TAU); ctx.fill();
  ctx.restore();
}

function drawPickup(pk){
  const bobY = Math.sin(pk.bob)*5;
  ctx.save();
  ctx.translate(pk.x, pk.y+bobY);
  ctx.shadowColor = '#7CFF9E'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#7CFF9E';
  ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#0c3d1c'; ctx.lineWidth = 3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(0,5); ctx.stroke();
  ctx.restore();
}

// ---------- Main loop ----------
function loop(ts){
  requestAnimationFrame(loop);
  if(!lastTime) lastTime = ts;
  let dt = (ts-lastTime)/1000;
  lastTime = ts;
  dt = Math.min(dt, 0.033); // clamp for tab-switch jumps

  updateDust(dt);

  if(state==='playing'){
    elapsed += dt;
    updateSpawnQueue(dt);
    updatePlayers(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateEnemyDeaths();
    updatePickups(dt);
    updateParticles(dt);
    checkWaveClear();
    updateHud();
  } else if(state==='levelup'){
    updateParticles(dt);
    waveTransitionTimer -= dt;
    if(waveTransitionTimer<=0){
      state = 'playing';
      updateHudStatic();
      startWave();
      sfx.waveStart();
    }
    updateHud();
  }

  if(shakeTime>0) shakeTime -= dt;

  render();
}

function render(){
  ctx.save();
  if(shakeTime>0){
    const mag = shakeMag * (shakeTime/0.18);
    ctx.translate(rand(-mag,mag), rand(-mag,mag));
  }
  ctx.drawImage(bgCanvas,0,0,W,H);
  drawDust();
  if(state!=='menu'){
    drawArenaFloorEdge();
    for(const pk of pickups) drawPickup(pk);
    for(const e of enemies) drawEnemy(e);
    for(const p of players) drawPlayer(p);
    for(const b of bullets) drawBullet(b);
    for(const b of enemyBullets) drawBullet(b);
    for(const pt of particles) drawParticle(pt);
  }
  ctx.restore();
}

// ---------- UI wiring ----------
let selectedMode = 1;
document.querySelectorAll('.mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = parseInt(btn.dataset.mode,10);
    document.getElementById('p2legend').style.opacity = selectedMode===2 ? '1':'0.35';
  });
});

document.getElementById('startBtn').addEventListener('click', ()=>{
  ensureAudio();
  document.getElementById('startScreen').classList.add('hidden');
  setArenaBounds();
  initDust();
  newGame(selectedMode);
});

document.getElementById('soundToggleBtn').addEventListener('click', function(){
  soundOn = !soundOn;
  this.textContent = soundOn ? '🔊 Suara: ON' : '🔇 Suara: OFF';
});

function toggleSound(){
  soundOn = !soundOn;
  document.getElementById('soundToggleBtn').textContent = soundOn ? '🔊 Suara: ON' : '🔇 Suara: OFF';
}

function togglePause(){
  if(state==='playing'){
    state='paused';
    document.getElementById('pauseScreen').classList.remove('hidden');
  } else if(state==='paused'){
    state='playing';
    document.getElementById('pauseScreen').classList.add('hidden');
  }
}
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('quitBtn').addEventListener('click', ()=>{
  document.getElementById('pauseScreen').classList.add('hidden');
  goToMenu();
});

document.getElementById('retryBtn').addEventListener('click', restartGame);
document.getElementById('menuBtn').addEventListener('click', ()=>{
  document.getElementById('overScreen').classList.add('hidden');
  goToMenu();
});

function restartGame(){
  document.getElementById('overScreen').classList.add('hidden');
  setArenaBounds();
  newGame(mode);
}
function goToMenu(){
  state='menu';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('hint').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
}

// ---------- Init ----------
resize();
setArenaBounds();
initDust();
lastTime = 0;
requestAnimationFrame(loop);
