// ═══════════════════════════════════════════════════════════
//  TRASH PATROL — 2D World Game Engine
// ═══════════════════════════════════════════════════════════

// ── KEYBOARD / TOUCH INPUT ──────────────────────────────────
const Keys = (() => {
  const state = { up: false, down: false, left: false, right: false, space: false };

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp'    || e.key === 'w') state.up    = true;
    if (e.key === 'ArrowDown'  || e.key === 's') state.down  = true;
    if (e.key === 'ArrowLeft'  || e.key === 'a') state.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd') state.right = true;
    if (e.key === ' ') { e.preventDefault(); World.tryPickup(); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp'    || e.key === 'w') state.up    = false;
    if (e.key === 'ArrowDown'  || e.key === 's') state.down  = false;
    if (e.key === 'ArrowLeft'  || e.key === 'a') state.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') state.right = false;
    if (e.key === ' ') state.space = false;
  });

  return {
    get: (k) => state[k],
    set: (k, v) => {
      state[k] = v;
      const btn = document.getElementById('btn-' + k);
      if (btn) btn.classList.toggle('pressed', v);
    },
    anyMove: () => state.up || state.down || state.left || state.right,
  };
})();

// ── GENDER / NAME SELECTION ─────────────────────────────────
let selectedGender = 'boy';

function selectGender(g) {
  selectedGender = g;
  document.getElementById('gb-boy').classList.toggle('active',  g === 'boy');
  document.getElementById('gb-girl').classList.toggle('active', g === 'girl');
}

function startGame() {
  const name = document.getElementById('player-name-input').value.trim();
  if (!name) {
    document.getElementById('name-err').textContent = 'Please enter your name!';
    return;
  }
  document.getElementById('name-err').textContent = '';
  World.init(name, selectedGender);
}

function restartGame() {
  document.querySelectorAll('.screen').forEach(s => { s.style.display = ''; s.classList.remove('active'); });
  const ns = document.getElementById('screen-name');
  ns.style.display = 'flex'; ns.classList.add('active');
  document.getElementById('player-name-input').value = '';
}

// ── WORLD ───────────────────────────────────────────────────
const World = (() => {

  // canvas
  let canvas, ctx, W, H;

  // game state
  let playerName = 'Player';
  let gender = 'boy';
  let score = 0;
  let lives = 3;
  let collected = 0;
  const GOAL = 15;
  let gameRunning = false;
  let popupTimer = 0;

  // world scroll
  const WORLD_W = 3200;
  const WORLD_H = 600;
  let camX = 0;

  // player
  const player = {
    x: 200, y: 320,
    w: 36, h: 52,
    vx: 0, vy: 0,
    speed: 3.2,
    onGround: false,
    facing: 1,   // 1=right, -1=left
    walkFrame: 0,
    walkTimer: 0,
    animState: 'idle', // idle | walk | jump
    invincible: 0,     // frames of invincibility after hit
  };

  // LAYERS for parallax
  // Buildings & structures painted procedurally

  // ROAD DEFINITION
  // Road runs at y=340 to y=420 (ground surface y=340)
  const GROUND_Y = 350;
  const ROAD_TOP = 330;
  const ROAD_BOT = 420;

  // SIDEWALK lanes
  const LANE_TOP = 240;   // top pavement
  const LANE_BOT = 420;   // bottom pavement

  // Trash items scattered in the world
  const TRASH_TYPES = [
    { emoji: '🍌', name: 'Banana peel',    bin: 'organic',   fact: 'Organic waste!' },
    { emoji: '🧴', name: 'Plastic bottle', bin: 'recycle',   fact: 'Recyclable!' },
    { emoji: '📰', name: 'Newspaper',      bin: 'recycle',   fact: 'Paper is recyclable!' },
    { emoji: '🔋', name: 'Battery',        bin: 'hazardous', fact: 'Hazardous waste!' },
    { emoji: '🍖', name: 'Food scrap',     bin: 'organic',   fact: 'Compostable!' },
    { emoji: '🥤', name: 'Plastic cup',    bin: 'recycle',   fact: 'Recyclable plastic!' },
    { emoji: '🧃', name: 'Juice carton',   bin: 'recycle',   fact: 'Recyclable carton!' },
    { emoji: '💊', name: 'Medicine pack',  bin: 'hazardous', fact: 'Hazardous waste!' },
    { emoji: '📦', name: 'Cardboard',      bin: 'recycle',   fact: 'Recyclable!' },
    { emoji: '🍂', name: 'Dead leaves',    bin: 'organic',   fact: 'Organic compost!' },
    { emoji: '🫙', name: 'Glass jar',      bin: 'recycle',   fact: '100% recyclable glass!' },
    { emoji: '☕', name: 'Coffee grounds', bin: 'organic',   fact: 'Great for composting!' },
  ];

  let trashItems = [];
  let bins = [];
  let buildings = [];
  let trees = [];
  let clouds = [];

  // ── INIT ────────────────────────────────────────────────────
  function init(name, g) {
    playerName = name;
    gender = g;
    score = 0; lives = 3; collected = 0;
    gameRunning = true;
    camX = 0;

    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    buildWorld();
    updateHUD();
    gotoScreen('screen-game');
    requestAnimationFrame(loop);
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    player.y = GROUND_Y - player.h;
  }

  function gotoScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.style.display = ''; s.classList.remove('active'); });
    const el = document.getElementById(id);
    el.style.display = 'flex'; el.classList.add('active');
  }

  // ── BUILD WORLD ─────────────────────────────────────────────
  function buildWorld() {
    trashItems = [];
    bins = [];
    buildings = [];
    trees = [];
    clouds = [];

    // Scatter 20 trash items across the world
    const positions = [];
    for (let i = 0; i < 20; i++) {
      let x, y, tries = 0;
      do {
        x = 300 + Math.random() * (WORLD_W - 600);
        // Randomly on road or top sidewalk
        y = Math.random() < 0.5
          ? ROAD_TOP + 20 + Math.random() * 40   // road lane
          : LANE_TOP + 10 + Math.random() * 40;  // top pavement
        tries++;
      } while (positions.some(p => Math.abs(p.x - x) < 80) && tries < 30);
      positions.push({ x, y });
      const t = TRASH_TYPES[Math.floor(Math.random() * TRASH_TYPES.length)];
      trashItems.push({ x, y, w: 32, h: 32, ...t, collected: false, bounce: Math.random() * Math.PI * 2 });
    }

    // 3 colored bins at end of world
    const binColors = [
      { color: '#2E7D32', label: '🌿 Organic',   type: 'organic' },
      { color: '#1565C0', label: '♻️ Recycle',   type: 'recycle' },
      { color: '#B71C1C', label: '☣️ Hazardous', type: 'hazardous' },
    ];
    binColors.forEach((b, i) => {
      bins.push({ x: WORLD_W - 500 + i * 140, y: ROAD_TOP - 60, w: 80, h: 80, ...b });
    });

    // Buildings along road
    const buildingColors = ['#455A64','#37474F','#546E7A','#4E342E','#3E2723','#263238'];
    const windowColors   = ['#FFF9C4','#B3E5FC','#FFCCBC'];
    for (let x = 0; x < WORLD_W; x += 120 + Math.random() * 80) {
      const bh = 80 + Math.random() * 120;
      buildings.push({
        x, y: ROAD_TOP - bh,
        w: 80 + Math.random() * 60,
        h: bh,
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
        wColor: windowColors[Math.floor(Math.random() * windowColors.length)],
        windows: Math.floor(Math.random() * 4) + 2,
      });
    }

    // Trees on top pavement
    for (let x = 150; x < WORLD_W - 100; x += 160 + Math.random() * 80) {
      trees.push({ x, y: ROAD_TOP - 10 });
    }

    // Clouds
    for (let i = 0; i < 12; i++) {
      clouds.push({
        x: Math.random() * WORLD_W,
        y: 20 + Math.random() * 80,
        w: 80 + Math.random() * 80,
        speed: 0.2 + Math.random() * 0.3,
      });
    }

    // player start
    player.x = 200;
    player.y = GROUND_Y - player.h;
    player.vx = 0; player.vy = 0;
    player.facing = 1;
    player.walkFrame = 0;
    player.invincible = 0;
  }

  // ── MAIN LOOP ───────────────────────────────────────────────
  let lastTime = 0;
  function loop(ts) {
    if (!gameRunning) return;
    const dt = Math.min((ts - lastTime) / 16.67, 3);
    lastTime = ts;

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ── UPDATE ──────────────────────────────────────────────────
  function update(dt) {
    // Move player
    let moving = false;
    if (Keys.get('left'))  { player.vx = -player.speed; player.facing = -1; moving = true; }
    else if (Keys.get('right')) { player.vx = player.speed; player.facing = 1; moving = true; }
    else player.vx = 0;

    if (Keys.get('up'))   { player.vy = -player.speed * 0.8; moving = true; }
    else if (Keys.get('down')) { player.vy = player.speed * 0.8; moving = true; }
    else player.vy = 0;

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Clamp to world
    player.x = Math.max(20, Math.min(WORLD_W - player.w - 20, player.x));

    // Clamp vertical to road + top pavement
    const yMin = LANE_TOP - 10;
    const yMax = ROAD_BOT - player.h;
    player.y = Math.max(yMin, Math.min(yMax, player.y));

    // Walk animation
    if (moving) {
      player.walkTimer += dt;
      if (player.walkTimer > 8) { player.walkFrame = (player.walkFrame + 1) % 4; player.walkTimer = 0; }
      player.animState = 'walk';
    } else {
      player.animState = 'idle';
      player.walkFrame = 0;
    }

    // Camera follow
    const targetCam = player.x - W / 3;
    camX += (targetCam - camX) * 0.1 * dt;
    camX = Math.max(0, Math.min(WORLD_W - W, camX));

    // Clouds drift
    clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > WORLD_W + 100) c.x = -100;
    });

    // Trash bounce animation
    trashItems.forEach(t => { if (!t.collected) t.bounce += 0.05 * dt; });

    // Proximity check — show nearby trash indicator
    const near = getNearbyTrash();
    if (near) {
      showPopup(`${near.emoji} ${near.name} — Press PICK UP!`);
    }

    // Invincibility countdown
    if (player.invincible > 0) player.invincible -= dt;

    // Popup timer
    if (popupTimer > 0) { popupTimer -= dt; if (popupTimer <= 0) hidePopup(); }
  }

  // ── PICKUP ──────────────────────────────────────────────────
  function tryPickup() {
    console.log("It's working")
    const near = getNearbyTrash();
    if (!near) {
      showPopup('No trash nearby! Walk closer.', 1500);
      return;
    }
    near.collected = true;
    collected++;
    score += 10;
    showPopup(`✅ Picked up ${near.emoji} ${near.name}! (${near.fact})`, 2000);
    updateHUD();

    if (collected >= GOAL) {
      setTimeout(() => {
        gameRunning = false;
        document.getElementById('win-msg').textContent =
          `Amazing, ${playerName}! You collected ${collected} pieces of trash and scored ${score} points! Mbanga is clean again!`;
        document.getElementById('win-score').textContent = score;
        gotoScreen('screen-win');
      }, 600);
    }
  }

  function getNearbyTrash() {
    return trashItems.find(t => {
      if (t.collected) return false;
      const dx = (player.x + player.w / 2) - (t.x + t.w / 2);
      const dy = (player.y + player.h / 2) - (t.y + t.h / 2);
      return Math.sqrt(dx * dx + dy * dy) < 60;
    });
  }

  // ── POPUP ───────────────────────────────────────────────────
  function showPopup(msg, duration = 1200) {
    const el = document.getElementById('pickup-popup');
    el.textContent = msg;
    el.classList.add('show');
    popupTimer = duration / 16.67;
  }
  function hidePopup() {
    document.getElementById('pickup-popup').classList.remove('show');
  }

  // ── HUD ─────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('hud-name').textContent = playerName;
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-collected').textContent = collected + '/' + GOAL;
    document.getElementById('hud-lives').textContent = '❤️'.repeat(lives);
  }

  // ── RENDER ──────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-camX, 0);

    drawSky();
    drawClouds();
    drawBuildings();
    drawTrees();
    drawRoad();
    drawBins();
    drawTrash();
    drawPlayer();
    drawProgressFlag();

    ctx.restore();
    drawDistanceBar();
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    grad.addColorStop(0, '#1565C0');
    grad.addColorStop(1, '#64B5F6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, ROAD_TOP);
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, 20, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.2, c.y - 12, c.w * 0.3, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - c.w * 0.2, c.y - 8, c.w * 0.25, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBuildings() {
    buildings.forEach(b => {
      // body
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // roof
      ctx.fillStyle = shadeColor(b.color, -20);
      ctx.fillRect(b.x, b.y, b.w, 8);
      // windows
      ctx.fillStyle = b.wColor;
      const cols = 2, rows = Math.floor(b.h / 30);
      const wx = 10, wy = 14, ww = (b.w - wx * (cols + 1)) / cols, wh = 12;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const winX = b.x + wx + c * (ww + wx);
          const winY = b.y + 12 + r * 30;
          if (winY + wh < b.y + b.h - 4) {
            ctx.fillRect(winX, winY, ww, wh);
          }
        }
      }
    });
  }

  function drawTrees() {
    trees.forEach(t => {
      // trunk
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(t.x - 5, t.y - 30, 10, 40);
      // foliage
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 50, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#388E3C';
      ctx.beginPath();
      ctx.arc(t.x - 10, t.y - 40, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(t.x + 10, t.y - 42, 18, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRoad() {
    // Grass top
    const grassGrad = ctx.createLinearGradient(0, ROAD_TOP - 80, 0, ROAD_TOP);
    grassGrad.addColorStop(0, '#558B2F');
    grassGrad.addColorStop(1, '#8BC34A');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, ROAD_TOP - 80, WORLD_W, 80);

    // Top pavement/sidewalk
    ctx.fillStyle = '#BDBDBD';
    ctx.fillRect(0, ROAD_TOP - 8, WORLD_W, 18);

    // Road surface
    ctx.fillStyle = '#546E7A';
    ctx.fillRect(0, ROAD_TOP + 10, WORLD_W, ROAD_BOT - ROAD_TOP - 10);

    // Road markings - dashed center line
    ctx.strokeStyle = '#F9A825';
    ctx.lineWidth = 4;
    ctx.setLineDash([40, 30]);
    ctx.beginPath();
    const midY = (ROAD_TOP + ROAD_BOT) / 2;
    ctx.moveTo(0, midY);
    ctx.lineTo(WORLD_W, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Kerb lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ROAD_TOP + 10); ctx.lineTo(WORLD_W, ROAD_TOP + 10);
    ctx.moveTo(0, ROAD_BOT - 2); ctx.lineTo(WORLD_W, ROAD_BOT - 2);
    ctx.stroke();

    // Bottom pavement
    ctx.fillStyle = '#BDBDBD';
    ctx.fillRect(0, ROAD_BOT, WORLD_W, 80);

    // Pavement tiles
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, ROAD_TOP - 8); ctx.lineTo(x, ROAD_TOP + 10);
      ctx.moveTo(x, ROAD_BOT); ctx.lineTo(x, ROAD_BOT + 80);
      ctx.stroke();
    }

    // Dirt/ground below
    const groundGrad = ctx.createLinearGradient(0, ROAD_BOT + 80, 0, H);
    groundGrad.addColorStop(0, '#795548');
    groundGrad.addColorStop(1, '#4E342E');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, ROAD_BOT + 80, WORLD_W, H);
  }

  function drawBins() {
    bins.forEach(b => {
      const bx = b.x, by = b.y, bw = b.w, bh = b.h;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, by + bh + 6, bw / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = b.color;
      roundRect(ctx, bx + 6, by + 12, bw - 12, bh - 12, 6);
      ctx.fill();

      // Lid
      ctx.fillStyle = shadeColor(b.color, -30);
      roundRect(ctx, bx, by, bw, 14, 4);
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(bx + 6, by + 26, bw - 12, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, bx + bw / 2, by + 42);

      // Gleam
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx + 10, by + 14, 8, bh - 18);
    });
  }

  function drawTrash() {
    trashItems.forEach(t => {
      if (t.collected) return;
      const bounce = Math.sin(t.bounce) * 3;

      // Glow if nearby
      const dx = (player.x + player.w / 2) - (t.x + t.w / 2);
      const dy = (player.y + player.h / 2) - (t.y + t.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 60) {
        ctx.save();
        ctx.shadowColor = '#F9A825';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(249,168,37,0.2)';
        ctx.beginPath();
        ctx.arc(t.x + t.w / 2, t.y + t.h / 2 + bounce, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(t.x + t.w / 2, t.y + t.h + 4, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Emoji
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.emoji, t.x + t.w / 2, t.y + t.h / 2 + bounce + 10);
    });
  }

  function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const pw = player.w;
    const ph = player.h;
    const cx = px + pw / 2;
    const frame = player.walkFrame;
    const facing = player.facing;

    // Invincibility flicker
    if (player.invincible > 0 && Math.floor(player.invincible) % 4 < 2) return;

    ctx.save();
    if (facing === -1) {
      ctx.scale(-1, 1);
      // flip around character center
      ctx.translate(-(cx * 2), 0);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, py + ph + 4, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Name tag above
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const nameW = playerName.length * 7 + 14;
    roundRect(ctx, cx - nameW / 2, py - 22, nameW, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#F9A825';
    ctx.font = 'bold 10px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(playerName, cx, py - 9);

    // Character body
    const skinColor  = '#D4895A';
    const shirtColor = gender === 'boy' ? '#1565C0' : '#C2185B';
    const pantsColor = gender === 'boy' ? '#37474F' : '#880E4F';
    const hairColor  = '#3E2723';
    const shoeColor  = '#212121';

    // Legs (animated walk)
    const legSwing = player.animState === 'walk' ? Math.sin(frame * Math.PI / 2) * 8 : 0;
    ctx.fillStyle = pantsColor;
    // left leg
    ctx.save();
    ctx.translate(cx - 6, py + ph - 18);
    ctx.rotate((legSwing * Math.PI) / 180);
    roundRect(ctx, -5, 0, 10, 20, 3);
    ctx.fill();
    ctx.fillStyle = shoeColor;
    ctx.fillRect(-6, 18, 12, 5);
    ctx.restore();
    // right leg
    ctx.fillStyle = pantsColor;
    ctx.save();
    ctx.translate(cx + 6, py + ph - 18);
    ctx.rotate((-legSwing * Math.PI) / 180);
    roundRect(ctx, -5, 0, 10, 20, 3);
    ctx.fill();
    ctx.fillStyle = shoeColor;
    ctx.fillRect(-6, 18, 12, 5);
    ctx.restore();

    // Body / shirt
    ctx.fillStyle = shirtColor;
    roundRect(ctx, cx - 10, py + 14, 20, 22, 4);
    ctx.fill();

    // Arms (animated)
    const armSwing = player.animState === 'walk' ? Math.sin(frame * Math.PI / 2) * 10 : 0;
    // left arm (holds trash bag when has items)
    ctx.fillStyle = shirtColor;
    ctx.save();
    ctx.translate(cx - 12, py + 16);
    ctx.rotate((-armSwing * Math.PI) / 180);
    roundRect(ctx, -4, 0, 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(-1, 17, 5, 0, Math.PI * 2); ctx.fill();
    // trash bag if collected > 0
    if (collected > 0) {
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath(); ctx.arc(-1, 24, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(collected, -1, 27);
    }
    ctx.restore();
    // right arm
    ctx.fillStyle = shirtColor;
    ctx.save();
    ctx.translate(cx + 12, py + 16);
    ctx.rotate((armSwing * Math.PI) / 180);
    roundRect(ctx, -4, 0, 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(1, 17, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(cx, py + 8, 12, 0, Math.PI * 2); ctx.fill();

    // Hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(cx, py + 4, 12, Math.PI, 0);
    ctx.fill();
    if (gender === 'girl') {
      // Pigtails
      ctx.beginPath(); ctx.arc(cx - 13, py + 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 13, py + 8, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 4, py + 8, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, py + 8, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(cx - 3.5, py + 8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4.5, py + 8, 2, 0, Math.PI * 2); ctx.fill();

    // Mouth smile
    ctx.strokeStyle = '#7B3F00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, py + 10, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  }

  function drawProgressFlag() {
    // Finish flag at end
    const fx = WORLD_W - 80;
    ctx.fillStyle = '#795548';
    ctx.fillRect(fx, ROAD_TOP - 120, 6, 120);
    ctx.fillStyle = collected >= GOAL ? '#F9A825' : '#EF5350';
    ctx.beginPath();
    ctx.moveTo(fx + 6, ROAD_TOP - 120);
    ctx.lineTo(fx + 50, ROAD_TOP - 100);
    ctx.lineTo(fx + 6, ROAD_TOP - 80);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(collected >= GOAL ? 'DONE!' : 'GOAL', fx + 28, ROAD_TOP - 96);
  }

  function drawDistanceBar() {
    // Mini map / progress bar at top right (screen space)
    const bx = W - 140, by = 48, bw = 120, bh = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, bx - 4, by - 4, bw + 8, bh + 8, 4);
    ctx.fill();
    ctx.fillStyle = '#37474F';
    ctx.fillRect(bx, by, bw, bh);
    const prog = player.x / WORLD_W;
    ctx.fillStyle = '#F9A825';
    ctx.fillRect(bx, by, bw * prog, bh);
    ctx.fillStyle = '#fff';
    ctx.font = '9px Nunito, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Progress', bx, by - 6);
  }

  // ── UTILS ──────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function shadeColor(hex, amt) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  return { init, tryPickup };
})();
