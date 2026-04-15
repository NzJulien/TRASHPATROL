// ═══════════════════════════════════════════════════════════
//  TRASH PATROL v2 — Full Game Engine
//  Features: Coins, Multi-carry, 5 Levels, Avatars, Store,
//            Lives system, Hazmat, Tools, Rarity system
// ═══════════════════════════════════════════════════════════

/* ── PERSISTENT STORAGE ─────────────────────────────────── */
const Save = (() => {
  const KEY = 'trashPatrol_v2';
  const defaults = {
    coins: 0,
    ownedAvatars: ['boy', 'girl'],
    equippedAvatar: 'boy',
    ownedTools: [],
    lives: 3,
    lastLifeLostTime: null,
    highScores: {},
    totalCoinsEarned: 0,
  };
  function load() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...defaults }; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }
  let _data = load();
  return {
    get: (k) => _data[k],
    set: (k, v) => { _data[k] = v; save(_data); },
    update: (k, fn) => { _data[k] = fn(_data[k]); save(_data); },
    all: () => _data,
  };
})();

/* ── LIFE REPLENISH TIMER ───────────────────────────────── */
const LivesSystem = (() => {
  const MAX_LIVES = 3;
  const REPLENISH_MS = 30 * 60 * 1000; // 30 min

  function getTimeUntilNext() {
    const last = Save.get('lastLifeLostTime');
    if (!last) return 0;
    const elapsed = Date.now() - last;
    const remaining = REPLENISH_MS - elapsed;
    return Math.max(0, remaining);
  }

  function tick() {
    const lives = Save.get('lives');
    if (lives >= MAX_LIVES) { Save.set('lastLifeLostTime', null); return; }
    const remaining = getTimeUntilNext();
    if (remaining <= 0 && lives < MAX_LIVES) {
      Save.set('lives', Math.min(MAX_LIVES, lives + 1));
      Save.set('lastLifeLostTime', lives + 1 < MAX_LIVES ? Date.now() : null);
    }
  }

  function loseLife() {
    const lives = Save.get('lives');
    if (lives <= 0) return false;
    Save.set('lives', lives - 1);
    if (!Save.get('lastLifeLostTime')) Save.set('lastLifeLostTime', Date.now());
    return true;
  }

  function addLife() {
    Save.set('lives', Math.min(MAX_LIVES, Save.get('lives') + 1));
  }

  function formatTime(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  setInterval(tick, 5000);

  return { getTimeUntilNext, loseLife, addLife, formatTime, MAX_LIVES, tick };
})();

/* ── AVATAR CATALOGUE ───────────────────────────────────── */
const AVATARS = [
  { id: 'boy',      name: 'Patrol Boy',    price: 0,    emoji: '👦🏾', free: true,  shirtColor: '#1565C0', pantsColor: '#37474F', superpower: null },
  { id: 'girl',     name: 'Patrol Girl',   price: 0,    emoji: '👧🏾', free: true,  shirtColor: '#C2185B', pantsColor: '#880E4F', superpower: null },
  { id: 'superman', name: 'Superman',      price: 500,  emoji: '🦸',  free: false, shirtColor: '#D32F2F', pantsColor: '#1565C0', cape: '#D32F2F',   superpower: 'speed', superpowerLabel: '⚡ 1.5x Speed' },
  { id: 'batman',   name: 'Batman',        price: 600,  emoji: '🦇',  free: false, shirtColor: '#212121', pantsColor: '#212121', cape: '#212121',   superpower: 'carry',  superpowerLabel: '🎒 +1 Carry' },
  { id: 'ironman',  name: 'Iron Man',      price: 800,  emoji: '🤖',  free: false, shirtColor: '#D32F2F', pantsColor: '#D32F2F', armor: '#D32F2F',  superpower: 'hazmat', superpowerLabel: '🛡 Built-in Hazmat' },
  { id: 'spiderman',name: 'Spider-Man',    price: 550,  emoji: '🕷',  free: false, shirtColor: '#D32F2F', pantsColor: '#1565C0', web: true,         superpower: 'magnet', superpowerLabel: '🕸 Auto-attract' },
  { id: 'panther',  name: 'Black Panther', price: 700,  emoji: '🐾',  free: false, shirtColor: '#311B92', pantsColor: '#1A237E', vibranium: true,   superpower: 'coin',  superpowerLabel: '🪙 2x Coins' },
  { id: 'flash',    name: 'The Flash',     price: 450,  emoji: '⚡',  free: false, shirtColor: '#F44336', pantsColor: '#B71C1C', lightning: true,   superpower: 'speed2', superpowerLabel: '⚡ 2x Speed' },
];

/* ── TOOL CATALOGUE ─────────────────────────────────────── */
const TOOLS = [
  { id: 'hazmat',   name: 'Hazmat Suit',     price: 400, emoji: '🥼', desc: 'Required for Level 3+. Protects from hazardous waste instant kill.', oneTime: false, consumable: false },
  { id: 'magnet',   name: 'Plastic Magnet',  price: 200, emoji: '🧲', desc: 'Auto-collects plastic within 80px radius. Lasts 1 level.', oneTime: false, consumable: true },
  { id: 'detector', name: 'Metal Detector',  price: 150, emoji: '📡', desc: 'Highlights all metal/recyclable items on screen.', oneTime: false, consumable: true },
  { id: 'grabber',  name: 'Claw Grabber',    price: 180, emoji: '🦾', desc: 'Extends pickup range to 120px.', oneTime: false, consumable: true },
  { id: 'bag',      name: 'Mega Bag',        price: 300, emoji: '🎒', desc: 'Carry 5 items at once instead of 3.', oneTime: false, consumable: true },
  { id: 'gloves',   name: 'Chemical Gloves', price: 250, emoji: '🧤', desc: 'Required for Level 4. Handle chemicals safely.', oneTime: false, consumable: false },
];

/* ── LEVEL CONFIGS ──────────────────────────────────────── */
const LEVELS = [
  {
    id: 1, name: 'Mbanga Streets',
    goal: 10, trashCount: 14,
    speed: 3.4, carryLimit: 3,
    organicWeight: 70, recycleWeight: 25, hazardousWeight: 5,
    noHazardousInstantKill: true,
    requiresTools: [],
    coinMultiplier: 1,
    desc: 'Clean up the main streets! Watch out for a few hazardous items.',
    bgSky: ['#0D47A1', '#1976D2', '#64B5F6'],
  },
  {
    id: 2, name: 'Market District',
    goal: 15, trashCount: 20,
    speed: 3.8, carryLimit: 3,
    organicWeight: 55, recycleWeight: 33, hazardousWeight: 12,
    noHazardousInstantKill: true,
    requiresTools: [],
    coinMultiplier: 1.2,
    desc: 'The market is messy! More recyclables and some hazardous waste.',
    bgSky: ['#1A237E', '#283593', '#5C6BC0'],
  },
  {
    id: 3, name: 'Industrial Zone',
    goal: 18, trashCount: 24,
    speed: 4.0, carryLimit: 3,
    organicWeight: 40, recycleWeight: 35, hazardousWeight: 25,
    noHazardousInstantKill: false,
    requiresTools: ['hazmat'],
    coinMultiplier: 1.5,
    desc: '⚠️ Hazardous waste kills instantly! You NEED a Hazmat Suit!',
    bgSky: ['#3E2723', '#4E342E', '#6D4C41'],
  },
  {
    id: 4, name: 'Chemical Plant',
    goal: 22, trashCount: 28,
    speed: 4.3, carryLimit: 3,
    organicWeight: 30, recycleWeight: 30, hazardousWeight: 40,
    noHazardousInstantKill: false,
    requiresTools: ['hazmat', 'gloves'],
    coinMultiplier: 2,
    desc: '☣️ Chemical plant! Needs Hazmat + Chemical Gloves. Big coins!',
    bgSky: ['#1B0000', '#4A0000', '#7B1FA2'],
  },
  {
    id: 5, name: 'Toxic Wasteland',
    goal: 25, trashCount: 32,
    speed: 4.6, carryLimit: 3,
    organicWeight: 20, recycleWeight: 28, hazardousWeight: 52,
    noHazardousInstantKill: false,
    requiresTools: ['hazmat', 'gloves'],
    coinMultiplier: 3,
    desc: '💀 The final challenge! Maximum hazardous waste. Max coins!',
    bgSky: ['#0D0D0D', '#1A0A0A', '#2D1B1B'],
  },
];

/* ── TRASH TYPES ────────────────────────────────────────── */
const TRASH_TYPES = {
  organic: [
    { emoji: '🍌', name: 'Banana peel',    bin: 'organic',   coins: 5,  fact: 'Compostable!', rarity: 'common' },
    { emoji: '🍖', name: 'Food scrap',     bin: 'organic',   coins: 5,  fact: 'Compostable food waste!', rarity: 'common' },
    { emoji: '🍂', name: 'Dead leaves',    bin: 'organic',   coins: 4,  fact: 'Great for composting!', rarity: 'common' },
    { emoji: '☕', name: 'Coffee grounds', bin: 'organic',   coins: 4,  fact: 'Organic compost!', rarity: 'common' },
    { emoji: '🥕', name: 'Veggie scraps',  bin: 'organic',   coins: 5,  fact: 'Kitchen compost!', rarity: 'common' },
    { emoji: '🌿', name: 'Garden waste',   bin: 'organic',   coins: 4,  fact: 'Green compost!', rarity: 'common' },
  ],
  recycle: [
    { emoji: '🧴', name: 'Plastic bottle', bin: 'recycle',   coins: 8,  fact: 'Recyclable plastic!', rarity: 'uncommon' },
    { emoji: '📰', name: 'Newspaper',      bin: 'recycle',   coins: 7,  fact: 'Paper is recyclable!', rarity: 'uncommon' },
    { emoji: '🥤', name: 'Plastic cup',    bin: 'recycle',   coins: 8,  fact: 'Recyclable plastic!', rarity: 'uncommon' },
    { emoji: '🧃', name: 'Juice carton',   bin: 'recycle',   coins: 8,  fact: 'Recyclable carton!', rarity: 'uncommon' },
    { emoji: '📦', name: 'Cardboard',      bin: 'recycle',   coins: 7,  fact: 'Recyclable cardboard!', rarity: 'uncommon' },
    { emoji: '🫙', name: 'Glass jar',      bin: 'recycle',   coins: 10, fact: '100% recyclable glass!', rarity: 'uncommon' },
    { emoji: '🥫', name: 'Tin can',        bin: 'recycle',   coins: 9,  fact: 'Metal is recyclable!', rarity: 'uncommon' },
  ],
  hazardous: [
    { emoji: '🔋', name: 'Battery',        bin: 'hazardous', coins: 20, fact: 'Hazardous — handle carefully!', rarity: 'rare', lethal: true },
    { emoji: '💊', name: 'Medicine pack',  bin: 'hazardous', coins: 18, fact: 'Hazardous waste!', rarity: 'rare', lethal: true },
    { emoji: '🧪', name: 'Chemical bottle',bin: 'hazardous', coins: 25, fact: 'Hazardous chemical!', rarity: 'rare', lethal: true },
    { emoji: '☢️', name: 'Radioactive',    bin: 'hazardous', coins: 30, fact: 'Extremely hazardous!', rarity: 'rare', lethal: true },
    { emoji: '🪣', name: 'Paint bucket',   bin: 'hazardous', coins: 22, fact: 'Chemical paint waste!', rarity: 'rare', lethal: true },
  ],
};

const BIN_CONFIG = [
  { type: 'organic',   color: '#2E7D32', glowColor: '#66BB6A', label: 'ORGANIC',   emoji: '🌿', hint: 'Food & plants' },
  { type: 'recycle',   color: '#1565C0', glowColor: '#42A5F5', label: 'RECYCLE',   emoji: '♻️', hint: 'Paper, plastic' },
  { type: 'hazardous', color: '#B71C1C', glowColor: '#EF5350', label: 'HAZARDOUS', emoji: '☣️', hint: 'Batteries, chem' },
];

/* ── INPUT ──────────────────────────────────────────────── */
const Keys = (() => {
  const state = { up: false, down: false, left: false, right: false };
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
  });
  return {
    get: (k) => state[k],
    set: (k, v) => {
      state[k] = v;
      const btn = document.getElementById('btn-' + k);
      if (btn) btn.classList.toggle('pressed', v);
    },
  };
})();

/* ── PARTICLES ──────────────────────────────────────────── */
const Particles = (() => {
  const list = [];
  function spawn(x, y, color, text, big = false) {
    list.push({ x, y, vx: (Math.random()-0.5)*3, vy: -3.5-Math.random()*2.5, life: 70, maxLife: 70, color, text, big });
  }
  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.08 * dt; p.life -= dt;
      if (p.life <= 0) list.splice(i, 1);
    }
  }
  function draw(ctx, camX) {
    list.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${p.big ? 22 : 15}px Nunito, sans-serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillText(p.text, p.x - camX, p.y);
      ctx.restore();
    });
  }
  return { spawn, update, draw };
})();

/* ── GLOBAL STATE ───────────────────────────────────────── */
let selectedGender = 'boy';
let selectedAvatar = Save.get('equippedAvatar') || 'boy';
let playerNameGlobal = '';

function selectGender(g) {
  selectedGender = g;
  selectedAvatar = g;
  document.getElementById('gb-boy').classList.toggle('active', g === 'boy');
  document.getElementById('gb-girl').classList.toggle('active', g === 'girl');
  updateAvatarSelection(g);
}

function updateAvatarSelection(id) {
  selectedAvatar = id;
  Save.set('equippedAvatar', id);
  document.querySelectorAll('.avatar-card').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

function startGame() {
  const name = document.getElementById('player-name-input').value.trim();
  if (!name) { document.getElementById('name-err').textContent = 'Please enter your name!'; return; }
  const lives = Save.get('lives');
  if (lives <= 0) { showNoLivesModal(); return; }
  document.getElementById('name-err').textContent = '';
  playerNameGlobal = name;
  openLevelSelect();
}

function openLevelSelect() {
  renderLevelSelect();
  gotoScreen('screen-levelselect');
}

function renderLevelSelect() {
  const wrap = document.getElementById('level-grid');
  if (!wrap) return;
  wrap.innerHTML = '';
  const ownedTools = Save.get('ownedTools') || [];
  LEVELS.forEach(lv => {
    const locked = lv.requiresTools.some(t => !ownedTools.includes(t));
    const best = (Save.get('highScores') || {})[lv.id] || 0;
    const card = document.createElement('div');
    card.className = 'level-card' + (locked ? ' locked' : '');
    card.innerHTML = `
      <div class="lv-num">LV ${lv.id}</div>
      <div class="lv-name">${lv.name}</div>
      <div class="lv-desc">${lv.desc}</div>
      ${lv.requiresTools.length ? `<div class="lv-req">Needs: ${lv.requiresTools.map(t => {
        const tool = TOOLS.find(x => x.id === t);
        return tool ? `${tool.emoji} ${tool.name}` : t;
      }).join(', ')}</div>` : ''}
      <div class="lv-reward">🪙 ${Math.round(lv.coinMultiplier * 100)}% Coins</div>
      ${best ? `<div class="lv-best">Best: 🪙 ${best}</div>` : ''}
      ${locked ? '<div class="lv-locked">🔒 Buy required tools</div>' : ''}
    `;
    if (!locked) card.onclick = () => World.init(playerNameGlobal, selectedAvatar, lv.id);
    wrap.appendChild(card);
  });
}

function openStore() {
  renderStore();
  gotoScreen('screen-store');
}

function renderStore() {
  const coins = Save.get('coins');
  document.getElementById('store-coins').textContent = coins;

  const owned = Save.get('ownedAvatars') || ['boy', 'girl'];
  const ownedTools = Save.get('ownedTools') || [];
  const equipped = Save.get('equippedAvatar');

  const avatarGrid = document.getElementById('store-avatars');
  avatarGrid.innerHTML = '';
  AVATARS.forEach(av => {
    const isOwned = owned.includes(av.id);
    const isEquipped = equipped === av.id;
    const div = document.createElement('div');
    div.className = 'store-item avatar-store-card' + (isEquipped ? ' equipped' : '') + (isOwned ? ' owned' : '');
    div.innerHTML = `
      <div class="si-emoji">${av.emoji}</div>
      <div class="si-name">${av.name}</div>
      ${av.superpower ? `<div class="si-power">${av.superpowerLabel}</div>` : ''}
      <div class="si-price">${av.free ? 'FREE' : `🪙 ${av.price}`}</div>
      <button class="si-btn" onclick="storeAvatarAction('${av.id}')">
        ${isEquipped ? '✓ Equipped' : isOwned ? 'Equip' : `Buy 🪙${av.price}`}
      </button>
    `;
    avatarGrid.appendChild(div);
  });

  const toolsGrid = document.getElementById('store-tools');
  toolsGrid.innerHTML = '';
  TOOLS.forEach(tool => {
    const isOwned = ownedTools.includes(tool.id);
    const div = document.createElement('div');
    div.className = 'store-item' + (isOwned ? ' owned' : '');
    div.innerHTML = `
      <div class="si-emoji">${tool.emoji}</div>
      <div class="si-name">${tool.name}</div>
      <div class="si-desc">${tool.desc}</div>
      <div class="si-price">🪙 ${tool.price}</div>
      <button class="si-btn" onclick="storeToolAction('${tool.id}')" ${isOwned ? 'disabled' : ''}>
        ${isOwned ? '✓ Owned' : `Buy 🪙${tool.price}`}
      </button>
    `;
    toolsGrid.appendChild(div);
  });
}

function storeAvatarAction(id) {
  const av = AVATARS.find(a => a.id === id);
  const owned = Save.get('ownedAvatars');
  if (owned.includes(id)) {
    Save.set('equippedAvatar', id);
    selectedAvatar = id;
    renderStore();
    renderNameScreenAvatars();
    return;
  }
  const coins = Save.get('coins');
  if (coins < av.price) { showStoreMsg('Not enough coins! 🪙', '#F44336'); return; }
  Save.set('coins', coins - av.price);
  Save.update('ownedAvatars', arr => [...arr, id]);
  Save.set('equippedAvatar', id);
  selectedAvatar = id;
  showStoreMsg(`${av.emoji} ${av.name} unlocked!`, '#4CAF50');
  renderStore();
  renderNameScreenAvatars();
}

function storeToolAction(id) {
  const tool = TOOLS.find(t => t.id === id);
  const coins = Save.get('coins');
  if (coins < tool.price) { showStoreMsg('Not enough coins! 🪙', '#F44336'); return; }
  Save.set('coins', coins - tool.price);
  Save.update('ownedTools', arr => [...arr, id]);
  showStoreMsg(`${tool.emoji} ${tool.name} purchased!`, '#4CAF50');
  renderStore();
}

function showStoreMsg(msg, color) {
  let el = document.getElementById('store-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.opacity = 1;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = 0; }, 2500);
}

function showNoLivesModal() {
  const modal = document.getElementById('no-lives-modal');
  if (!modal) return;
  const timeLeft = LivesSystem.getTimeUntilNext();
  document.getElementById('lives-timer').textContent = timeLeft > 0 ? LivesSystem.formatTime(timeLeft) : '0:00';
  modal.classList.add('active');
  // Update timer
  const interval = setInterval(() => {
    const t = LivesSystem.getTimeUntilNext();
    const el = document.getElementById('lives-timer');
    if (el) el.textContent = t > 0 ? LivesSystem.formatTime(t) : '0:00';
    if (t <= 0) clearInterval(interval);
  }, 1000);
}

function closeNoLivesModal() {
  document.getElementById('no-lives-modal')?.classList.remove('active');
}

function watchAdForLife() {
  // Simulate ad
  closeNoLivesModal();
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Nunito,sans-serif;gap:20px;';
  overlay.innerHTML = `
    <div style="font-size:40px;">📺</div>
    <div style="font-size:20px;font-weight:800;">Watching Ad...</div>
    <div id="ad-countdown" style="font-size:48px;color:#F9A825;font-weight:900;">5</div>
    <div style="font-size:13px;opacity:0.5;">Please wait</div>
  `;
  document.body.appendChild(overlay);
  let count = 5;
  const t = setInterval(() => {
    count--;
    const el = document.getElementById('ad-countdown');
    if (el) el.textContent = count;
    if (count <= 0) {
      clearInterval(t);
      LivesSystem.addLife();
      document.body.removeChild(overlay);
      updateNameScreenLives();
      // Now start game
      if (playerNameGlobal) openLevelSelect();
    }
  }, 1000);
}

function gotoScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.style.display = ''; s.classList.remove('active'); });
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add('active'); }
}

function restartGame() {
  selectedAvatar = Save.get('equippedAvatar') || 'boy';
  playerNameGlobal = '';
  gotoScreen('screen-name');
  renderNameScreenAvatars();
  updateNameScreenLives();
  document.getElementById('player-name-input').value = '';
}

function updateNameScreenLives() {
  const lives = Save.get('lives');
  const el = document.getElementById('name-lives-display');
  if (!el) return;
  el.innerHTML = '❤️'.repeat(Math.max(0,lives)) + '🖤'.repeat(Math.max(0,3-lives));
  const timeEl = document.getElementById('name-lives-timer');
  if (timeEl) {
    const t = LivesSystem.getTimeUntilNext();
    timeEl.textContent = lives < 3 && t > 0 ? `+❤️ in ${LivesSystem.formatTime(t)}` : '';
  }
}

function renderNameScreenAvatars() {
  const wrap = document.getElementById('avatar-selector');
  if (!wrap) return;
  const owned = Save.get('ownedAvatars') || ['boy','girl'];
  const equipped = Save.get('equippedAvatar') || 'boy';
  wrap.innerHTML = '';
  AVATARS.forEach(av => {
    const isOwned = owned.includes(av.id);
    const card = document.createElement('div');
    card.className = 'avatar-card' + (equipped === av.id ? ' active' : '') + (!isOwned ? ' locked' : '');
    card.dataset.id = av.id;
    card.innerHTML = `<span class="av-emoji">${av.emoji}</span><span class="av-name">${av.name}</span>${!isOwned ? `<span class="av-price">🪙${av.price}</span>` : ''}`;
    if (isOwned) card.onclick = () => { updateAvatarSelection(av.id); };
    else card.onclick = () => { openStore(); };
    wrap.appendChild(card);
  });
  selectedAvatar = equipped;
}

/* ── WORLD ──────────────────────────────────────────────── */
const World = (() => {
  let canvas, ctx, W, H;
  let playerName = 'Player', currentAvatar = null;
  let sessionCoins = 0, lives = 3, collected = 0, sorted = 0, mistakes = 0;
  let currentLevel = null;
  let gameRunning = false, popupTimer = 0;
  const WORLD_W = 3600;
  let camX = 0;
  const GROUND_Y = 350, ROAD_TOP = 330, ROAD_BOT = 420, LANE_TOP = 230;

  let heldItems = [];  // multi-carry
  let activeTools = {};

  const player = {
    x: 200, y: 320, w: 36, h: 52,
    vx: 0, vy: 0, speed: 3.4,
    facing: 1, walkFrame: 0, walkTimer: 0,
    animState: 'idle', invincible: 0,
  };

  let trashItems = [], bins = [], buildings = [], trees = [], clouds = [];
  let screenShake = 0;
  let binFlash = {};
  let lastTime = 0;

  function init(name, avatarId, levelId) {
    playerName = name;
    currentAvatar = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
    currentLevel = LEVELS.find(l => l.id === levelId) || LEVELS[0];

    sessionCoins = 0; collected = 0; sorted = 0; mistakes = 0;
    lives = Save.get('lives');
    gameRunning = true; camX = 0; heldItems = [];
    activeTools = {};

    // Load active tools from saved
    const ownedTools = Save.get('ownedTools') || [];
    ownedTools.forEach(t => { activeTools[t] = true; });

    // Apply avatar superpower
    player.speed = currentLevel.speed;
    if (currentAvatar.superpower === 'speed') player.speed *= 1.5;
    if (currentAvatar.superpower === 'speed2') player.speed *= 2;

    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Show the screen FIRST so the canvas has real dimensions,
    // then resize + start the loop on the very next frame.
    gotoScreen('screen-game');
    window.addEventListener('resize', resize);
    buildWorld();
    updateHUD();
    requestAnimationFrame(() => {
      resize();
      requestAnimationFrame(loop);
    });
  }

  function getCarryLimit() {
    let base = currentLevel?.carryLimit || 3;
    if (currentAvatar?.superpower === 'carry') base += 1;
    if (activeTools['bag']) base = 5;
    return base;
  }

  function getPickupRange() {
    if (activeTools['grabber']) return 120;
    if (currentAvatar?.superpower === 'magnet') return 90;
    return 65;
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    player.y = GROUND_Y - player.h;
  }

  function weightedTrashPick(lv) {
    const roll = Math.random() * 100;
    let cat;
    if (roll < lv.organicWeight) cat = 'organic';
    else if (roll < lv.organicWeight + lv.recycleWeight) cat = 'recycle';
    else cat = 'hazardous';
    const list = TRASH_TYPES[cat];
    return list[Math.floor(Math.random() * list.length)];
  }

  function buildWorld() {
    trashItems = []; bins = []; buildings = []; trees = []; clouds = [];
    const lv = currentLevel;

    const positions = [];
    for (let i = 0; i < lv.trashCount; i++) {
      let x, y, tries = 0;
      do {
        x = 300 + Math.random() * (WORLD_W - 1200);
        y = Math.random() < 0.5
          ? ROAD_TOP + 20 + Math.random() * 40
          : LANE_TOP + 10 + Math.random() * 40;
        tries++;
      } while (positions.some(p => Math.abs(p.x - x) < 90) && tries < 40);
      positions.push({ x, y });
      const t = weightedTrashPick(lv);
      trashItems.push({ x, y, w: 34, h: 34, ...t, collected: false, bounce: Math.random() * Math.PI * 2 });
    }

    const binZoneX = WORLD_W - 620;
    BIN_CONFIG.forEach((b, i) => {
      bins.push({ x: binZoneX + i * 185, y: ROAD_TOP - 85, w: 92, h: 92, ...b, count: 0 });
    });
    binFlash = { organic: 0, recycle: 0, hazardous: 0 };

    const buildingColors = ['#455A64','#37474F','#546E7A','#4E342E','#3E2723','#263238','#1A237E','#4A148C'];
    const windowColors   = ['#FFF9C4','#B3E5FC','#FFCCBC','#F8BBD0'];
    for (let x = 0; x < WORLD_W; x += 100 + Math.random() * 80) {
      const bh = 70 + Math.random() * 140;
      buildings.push({ x, y: ROAD_TOP - bh, w: 75 + Math.random() * 65, h: bh,
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
        wColor: windowColors[Math.floor(Math.random() * windowColors.length)],
        accentColor: `hsl(${Math.random()*360},60%,60%)` });
    }
    for (let x = 150; x < WORLD_W - 100; x += 150 + Math.random() * 80) trees.push({ x, y: ROAD_TOP - 10 });
    for (let i = 0; i < 14; i++) clouds.push({ x: Math.random() * WORLD_W, y: 20 + Math.random() * 90, w: 70 + Math.random() * 90, speed: 0.15 + Math.random() * 0.25 });

    player.x = 200; player.y = GROUND_Y - player.h;
    player.vx = 0; player.vy = 0; player.facing = 1;
    player.walkFrame = 0; player.invincible = 0;
  }

  function loop(ts) {
    if (!gameRunning) return;
    const dt = Math.min((ts - lastTime) / 16.67, 3);
    lastTime = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    let moving = false;
    if (Keys.get('left'))       { player.vx = -player.speed; player.facing = -1; moving = true; }
    else if (Keys.get('right')) { player.vx =  player.speed; player.facing =  1; moving = true; }
    else player.vx = 0;
    if (Keys.get('up'))         { player.vy = -player.speed * 0.8; moving = true; }
    else if (Keys.get('down'))  { player.vy =  player.speed * 0.8; moving = true; }
    else player.vy = 0;

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(20, Math.min(WORLD_W - player.w - 20, player.x));
    player.y = Math.max(LANE_TOP - 10, Math.min(ROAD_BOT - player.h, player.y));

    if (moving) {
      player.walkTimer += dt;
      if (player.walkTimer > 8) { player.walkFrame = (player.walkFrame + 1) % 4; player.walkTimer = 0; }
      player.animState = 'walk';
    } else { player.animState = 'idle'; player.walkFrame = 0; }

    const targetCam = player.x - W / 3;
    camX += (targetCam - camX) * 0.1 * dt;
    camX = Math.max(0, Math.min(WORLD_W - W, camX));

    clouds.forEach(c => { c.x += c.speed * dt; if (c.x > WORLD_W + 100) c.x = -100; });
    trashItems.forEach(t => { if (!t.collected) t.bounce += 0.06 * dt; });

    if (screenShake > 0) screenShake -= dt;
    Object.keys(binFlash).forEach(k => { if (binFlash[k] > 0) binFlash[k] -= dt; });

    // Magnet auto-attract for Spider-Man
    if (currentAvatar?.superpower === 'magnet') {
      trashItems.forEach(t => {
        if (t.collected || t.lethal) return;
        const dx = (player.x + player.w/2) - (t.x + t.w/2);
        const dy = (player.y + player.h/2) - (t.y + t.h/2);
        if (Math.sqrt(dx*dx+dy*dy) < 90 && heldItems.length < getCarryLimit()) {
          // Auto-attract
          t.x += dx * 0.04 * dt;
          t.y += dy * 0.04 * dt;
        }
      });
    }

    // Proximity hint
    if (heldItems.length < getCarryLimit()) {
      const near = getNearbyTrash();
      if (near) showPopup(`${near.emoji} ${near.name} — Press PICK UP! ${near.rarity === 'rare' ? '💰' : ''}`, 0);
    } else {
      showPopup(`Carrying ${heldItems.length} items — find a bin!`, 0);
    }
    if (heldItems.length > 0) {
      const nearBin = getNearbyBin();
      if (nearBin) showPopup(`Drop into ${nearBin.emoji} ${nearBin.label} bin — Press PICK UP!`, 0);
    }

    if (player.invincible > 0) player.invincible -= dt;
    if (popupTimer > 0) { popupTimer -= dt; if (popupTimer <= 0) hidePopup(); }

    Particles.update(dt);
  }

  function tryPickup() {
    if (!gameRunning) return;
    const nearBin = getNearbyBin();
    if (nearBin && heldItems.length > 0) {
      // Drop matching items into this bin
      let deposited = false;
      let wrongItem = null;
      const toDeposit = heldItems.filter(item => item.bin === nearBin.type);
      const wrongItems = heldItems.filter(item => item.bin !== nearBin.type);

      if (toDeposit.length > 0) {
        toDeposit.forEach(item => {
          let coins = item.coins;
          if (currentLevel) coins = Math.round(coins * currentLevel.coinMultiplier);
          if (currentAvatar?.superpower === 'coin') coins *= 2;
          sessionCoins += coins;
          sorted++;
          collected++;
          nearBin.count++;
          binFlash[nearBin.type] = 25;
          Particles.spawn(player.x + player.w/2, player.y, '#F9A825', `+${coins}🪙`, true);
          deposited = true;
        });
        heldItems = wrongItems;
        if (wrongItems.length === 0 && deposited) {
          showPopup(`✅ Sorted! 🪙 +${toDeposit.reduce((s,i) => s + Math.round(i.coins*(currentLevel?.coinMultiplier||1)), 0)} coins!`, 2000);
        } else if (wrongItems.length > 0) {
          showPopup(`✅ Deposited ${toDeposit.length} items! ${wrongItems.length} still held.`, 2000);
        }
      } else {
        // All wrong — penalty
        if (player.invincible > 0) return;
        handleWrongDrop(nearBin, heldItems[0]);
        return;
      }

      updateHUD();
      if (collected >= currentLevel.goal) setTimeout(winGame, 600);
      return;
    }

    // Pick up trash
    if (heldItems.length < getCarryLimit()) {
      const near = getNearbyTrash();
      if (!near) { showPopup('No trash nearby! Walk closer.', 1500); return; }

      // Check if hazardous and no protection
      if (near.lethal && !currentLevel.noHazardousInstantKill) {
        const hasHazmat = activeTools['hazmat'] || currentAvatar?.superpower === 'hazmat';
        if (!hasHazmat) {
          // Instant death!
          screenShake = 20;
          Particles.spawn(player.x + player.w/2, player.y, '#F44336', '💀 INSTANT KILL!', true);
          showPopup('☣️ HAZARDOUS! No Hazmat Suit — you lost a life!', 2500);
          handleLifeLoss();
          return;
        }
      }

      near.collected = true;
      heldItems.push(near);
      Particles.spawn(near.x + near.w/2, near.y, '#F9A825', '📦 Picked up!');
      showPopup(`Picked up ${near.emoji} ${near.name} (${near.rarity})! ${heldItems.length}/${getCarryLimit()} held.`, 1500);
      updateHUD();
    } else {
      showPopup(`Can't carry more! Deposit at a bin first.`, 1500);
    }
  }

  function handleWrongDrop(nearBin, item) {
    lives = Math.max(0, lives - 0.5); // Half life penalty!
    mistakes++;
    screenShake = 12;
    player.invincible = 45;
    Particles.spawn(player.x + player.w/2, player.y, '#F44336', '-½❤️ Wrong!', true);
    const correctBin = bins.find(b => b.type === item.bin);
    showPopup(`❌ Wrong bin! ${item.emoji} goes in ${item.bin.toUpperCase()} ${correctBin?.emoji || ''} bin. Lost ½ life!`, 3000);
    // Return items to world
    heldItems.forEach((it, idx) => {
      it.collected = false;
      it.x = player.x + idx * 40;
      it.y = player.y;
    });
    heldItems = [];
    updateHUD();
    if (lives <= 0) {
      setTimeout(() => { gameRunning = false; gotoScreen('screen-over'); }, 900);
    }
  }

  function handleLifeLoss() {
    lives = Math.max(0, lives - 1);
    heldItems.forEach(it => { it.collected = false; it.x = player.x; it.y = player.y; });
    heldItems = [];
    player.invincible = 80;
    screenShake = 18;
    updateHUD();
    if (lives <= 0) setTimeout(() => { gameRunning = false; gotoScreen('screen-over'); }, 900);
  }

  function winGame() {
    gameRunning = false;
    Save.set('coins', Save.get('coins') + sessionCoins);
    Save.update('totalCoinsEarned', n => (n||0) + sessionCoins);
    const hs = Save.get('highScores') || {};
    if (!hs[currentLevel.id] || sessionCoins > hs[currentLevel.id]) {
      hs[currentLevel.id] = sessionCoins;
      Save.set('highScores', hs);
    }
    // Win screen
    const accuracy = sorted + mistakes > 0 ? Math.round((sorted / (sorted + mistakes)) * 100) : 100;
    document.getElementById('win-msg').textContent =
      `Great work, ${playerName}! Level ${currentLevel.id}: ${currentLevel.name} completed!`;
    document.getElementById('win-score').textContent = `🪙 ${sessionCoins}`;
    document.getElementById('win-sorted').textContent = sorted;
    document.getElementById('win-mistakes').textContent = mistakes;
    document.getElementById('win-accuracy').textContent = accuracy + '%';
    document.getElementById('win-total-coins').textContent = Save.get('coins');
    // Show next level if available
    const nextLvEl = document.getElementById('btn-next-level');
    if (nextLvEl) {
      const nextLv = LEVELS.find(l => l.id === currentLevel.id + 1);
      if (nextLv) {
        nextLvEl.style.display = '';
        nextLvEl.onclick = () => { World.init(playerName, Save.get('equippedAvatar'), nextLv.id); };
        nextLvEl.textContent = `Next: Level ${nextLv.id} →`;
      } else {
        nextLvEl.style.display = 'none';
      }
    }
    gotoScreen('screen-win');
  }

  function getNearbyTrash() {
    const range = getPickupRange();
    return trashItems.find(t => {
      if (t.collected) return false;
      const dx = (player.x + player.w/2) - (t.x + t.w/2);
      const dy = (player.y + player.h/2) - (t.y + t.h/2);
      return Math.sqrt(dx*dx + dy*dy) < range;
    });
  }

  function getNearbyBin() {
    return bins.find(b => {
      const dx = (player.x + player.w/2) - (b.x + b.w/2);
      const dy = (player.y + player.h/2) - (b.y + b.h/2);
      return Math.sqrt(dx*dx + dy*dy) < 90;
    });
  }

  function showPopup(msg, duration = 1200) {
    const el = document.getElementById('pickup-popup');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (duration > 0) popupTimer = duration / 16.67;
    else popupTimer = 60;
  }
  function hidePopup() {
    document.getElementById('pickup-popup')?.classList.remove('show');
  }

  function updateHUD() {
    document.getElementById('hud-name').textContent = playerName;
    const lv = currentLevel;
    document.getElementById('hud-score').textContent = sessionCoins;
    document.getElementById('hud-collected').textContent = `${collected}/${lv?.goal||15}`;
    document.getElementById('hud-lives').textContent = '❤️'.repeat(Math.max(0,Math.floor(lives))) + (lives % 1 >= 0.5 ? '💛' : '') + '🖤'.repeat(Math.max(0, 3 - Math.ceil(lives)));
    document.getElementById('hud-level').textContent = `LV${lv?.id||1}`;

    const holdEl = document.getElementById('hud-held');
    if (holdEl) holdEl.textContent = heldItems.length > 0 ? `Holding: ${heldItems.map(i => i.emoji).join('')} (${heldItems.length}/${getCarryLimit()})` : '';
  }

  /* ── RENDER ─────────────────────────────────────────────── */
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (screenShake > 0) {
      const s = Math.min(screenShake, 7);
      ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
    }
    ctx.save();
    ctx.translate(-camX, 0);
    drawSky();
    drawClouds();
    drawBuildings();
    drawTrees();
    drawRoad();
    drawBinZoneMarker();
    drawBins();
    drawTrash();
    drawPlayer();
    drawProgressFlag();
    ctx.restore();
    Particles.draw(ctx, camX);
    drawDistanceBar();
    drawHeldItemHint();
    ctx.restore();
  }

  function drawSky() {
    const lv = currentLevel;
    const colors = lv?.bgSky || ['#0D47A1','#1976D2','#64B5F6'];
    const grad = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, ROAD_TOP);

    // Sun/moon based on level
    const sunX = 400, sunY = 80;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = lv?.id >= 4 ? '#FF6F00' : '#FFF9C4';
    ctx.beginPath(); ctx.arc(sunX, sunY, 65, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = lv?.id >= 4 ? '#FF8F00' : '#FFEE58';
    ctx.beginPath(); ctx.arc(sunX, sunY, 38, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawClouds() {
    clouds.forEach(c => {
      ctx.save(); ctx.globalAlpha = 0.75;
      ctx.fillStyle = currentLevel?.id >= 4 ? '#4a0000' : '#fff';
      [[0,0,c.w*0.4],[c.w*0.25,-c.w*0.12,c.w*0.32],[-c.w*0.2,-c.w*0.08,c.w*0.28],[c.w*0.5,0,c.w*0.28]].forEach(([dx,dy,r]) => {
        ctx.beginPath(); ctx.arc(c.x+dx, c.y+dy, r, 0, Math.PI*2); ctx.fill();
      });
      ctx.restore();
    });
  }

  function drawBuildings() {
    buildings.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.accentColor;
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillStyle = b.wColor;
      const cols = 2, ww = (b.w - 30)/cols, wh = 10;
      const rows = Math.floor((b.h-20)/28);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = b.x + 10 + c*(ww+10);
          const wy = b.y + 14 + r*28;
          if (wy+wh < b.y+b.h-6) ctx.fillRect(wx, wy, ww, wh);
        }
      }
      ctx.fillStyle = shadeColor(b.color, -40);
      ctx.fillRect(b.x+b.w/2-7, b.y+b.h-20, 14, 20);
    });
  }

  function drawTrees() {
    trees.forEach(t => {
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(t.x-5, t.y-28, 10, 38);
      [[0,-52,30,'#1B5E20'],[-12,-42,22,'#2E7D32'],[12,-44,20,'#2E7D32'],[0,-60,18,'#388E3C']].forEach(([dx,dy,r,c]) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(t.x+dx, t.y+dy, r, 0, Math.PI*2); ctx.fill();
      });
    });
  }

  function drawRoad() {
    const grassGrad = ctx.createLinearGradient(0, ROAD_TOP-80, 0, ROAD_TOP);
    grassGrad.addColorStop(0, '#33691E'); grassGrad.addColorStop(1, '#7CB342');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, ROAD_TOP-80, WORLD_W, 80);

    for (let x = 60; x < WORLD_W; x += 90 + ((x*7)%40)) {
      ctx.fillStyle = x%180<90 ? '#FFEB3B' : '#FF80AB';
      ctx.beginPath(); ctx.arc(x, ROAD_TOP-20+(x%3)*8, 3, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = '#CFD8DC';
    ctx.fillRect(0, ROAD_TOP-8, WORLD_W, 18);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_W; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, ROAD_TOP-8); ctx.lineTo(x, ROAD_TOP+10); ctx.stroke();
    }

    ctx.fillStyle = '#455A64';
    ctx.fillRect(0, ROAD_TOP+10, WORLD_W, ROAD_BOT-ROAD_TOP-10);
    ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 3; ctx.setLineDash([40,28]);
    ctx.beginPath(); ctx.moveTo(0, (ROAD_TOP+ROAD_BOT)/2); ctx.lineTo(WORLD_W, (ROAD_TOP+ROAD_BOT)/2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0,ROAD_TOP+10); ctx.lineTo(WORLD_W,ROAD_TOP+10);
    ctx.moveTo(0,ROAD_BOT-2); ctx.lineTo(WORLD_W,ROAD_BOT-2);
    ctx.stroke();
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, ROAD_BOT, WORLD_W, 80);
  }

  function drawBinZoneMarker() {
    const zoneX = WORLD_W - 700;
    ctx.fillStyle = 'rgba(249,168,37,0.06)';
    ctx.fillRect(zoneX, 0, 800, H);
    ctx.strokeStyle = 'rgba(249,168,37,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([12,8]);
    ctx.beginPath(); ctx.moveTo(zoneX, 0); ctx.lineTo(zoneX, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(249,168,37,0.7)';
    ctx.font = 'bold 13px Nunito, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('🗑️ SORTING ZONE →', zoneX+10, 40);
  }

  function drawBins() {
    bins.forEach(b => {
      const bx = b.x, by = b.y, bw = b.w, bh = b.h;
      const isFlashing = binFlash[b.type] > 0;
      const flashAlpha = isFlashing ? Math.sin(binFlash[b.type]*0.5)*0.5+0.5 : 0;
      const matchingHeld = heldItems.some(i => i.bin === b.type);
      const isNear = getNearbyBin()?.type === b.type;

      if (matchingHeld) {
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(Date.now()/250)*0.2;
        ctx.fillStyle = b.glowColor;
        ctx.beginPath(); ctx.ellipse(bx+bw/2, by+bh+10, bw*0.7, 18, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(Date.now()/200)*0.3;
        ctx.strokeStyle = b.glowColor; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.rect(bx-8, by-8, bw+16, bh+16); ctx.stroke();
        ctx.restore();
      }
      if (isFlashing) {
        ctx.save(); ctx.globalAlpha = flashAlpha*0.6;
        ctx.fillStyle = b.glowColor; ctx.fillRect(bx-5, by-5, bw+10, bh+10);
        ctx.restore();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(bx+bw/2, by+bh+8, bw*0.5, 10, 0, 0, Math.PI*2); ctx.fill();

      // Body
      ctx.fillStyle = b.color;
      roundRect(ctx, bx+5, by+14, bw-10, bh-14, 8); ctx.fill();
      ctx.fillStyle = shadeColor(b.color, 25);
      roundRect(ctx, bx+8, by+16, (bw-16)/2, bh-20, 6); ctx.fill();
      ctx.fillStyle = shadeColor(b.color, -40);
      roundRect(ctx, bx-2, by, bw+4, 16, 5); ctx.fill();
      ctx.fillStyle = shadeColor(b.color, -20);
      roundRect(ctx, bx+2, by+3, bw-4, 8, 3); ctx.fill();

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx+5, by+28, bw-10, 34);
      ctx.font = '20px serif'; ctx.textAlign = 'center';
      ctx.fillText(b.emoji, bx+bw/2, by+26);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Nunito, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.label, bx+bw/2, by+42);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '8px Nunito, sans-serif';
      ctx.fillText(b.hint, bx+bw/2, by+55);

      if (b.count > 0) {
        ctx.fillStyle = '#F9A825';
        ctx.beginPath(); ctx.arc(bx+bw-10, by+10, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 9px Nunito, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(b.count, bx+bw-10, by+13);
      }

      if (isNear && heldItems.length > 0) {
        ctx.fillStyle = '#F9A825'; ctx.font = '22px serif'; ctx.textAlign = 'center';
        ctx.fillText('⬇', bx+bw/2, by-12+Math.sin(Date.now()/300)*4);
      }
    });
  }

  function drawTrash() {
    trashItems.forEach(t => {
      if (t.collected) return;
      const bounce = Math.sin(t.bounce) * 3.5;
      const dx = (player.x+player.w/2)-(t.x+t.w/2);
      const dy = (player.y+player.h/2)-(t.y+t.h/2);
      const dist = Math.sqrt(dx*dx+dy*dy);
      const near = dist < getPickupRange() && heldItems.length < getCarryLimit();

      if (near) {
        ctx.save(); ctx.globalAlpha = 0.5+Math.sin(Date.now()/200)*0.3;
        ctx.strokeStyle = t.rarity === 'rare' ? '#FF6F00' : '#F9A825'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(t.x+t.w/2, t.y+t.h/2+bounce, 26, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // Rarity glow for hazardous
      if (t.rarity === 'rare') {
        ctx.save(); ctx.globalAlpha = 0.2+Math.sin(Date.now()/400)*0.15;
        ctx.fillStyle = '#F44336';
        ctx.beginPath(); ctx.arc(t.x+t.w/2, t.y+t.h/2+bounce, 20, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // Color dot
      const dotColor = t.bin === 'organic' ? '#4CAF50' : t.bin === 'recycle' ? '#2196F3' : '#F44336';
      ctx.fillStyle = dotColor;
      ctx.beginPath(); ctx.arc(t.x+t.w/2, t.y+t.h+8, 4, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(t.x+t.w/2, t.y+t.h+4, 13, 4, 0, 0, Math.PI*2); ctx.fill();

      ctx.font = '26px serif'; ctx.textAlign = 'center';
      ctx.fillText(t.emoji, t.x+t.w/2, t.y+t.h/2+bounce+10);

      // Coin value badge
      if (near) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        roundRect(ctx, t.x+t.w/2-20, t.y-18, 40, 15, 4); ctx.fill();
        ctx.fillStyle = '#F9A825'; ctx.font = 'bold 9px Nunito, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`🪙 ${t.coins}`, t.x+t.w/2, t.y-7);
      }
    });
  }

  function drawPlayer() {
    const av = currentAvatar;
    const px = player.x, py = player.y, pw = player.w, ph = player.h;
    const cx = px + pw/2;
    const frame = player.walkFrame;
    const facing = player.facing;
    if (player.invincible > 0 && Math.floor(player.invincible) % 4 < 2) return;

    ctx.save();
    if (facing === -1) { ctx.scale(-1,1); ctx.translate(-(cx*2), 0); }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, py+ph+4, 17, 5, 0, 0, Math.PI*2); ctx.fill();

    // Name tag
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const nameW = playerName.length*7+16;
    roundRect(ctx, cx-nameW/2, py-24, nameW, 18, 5); ctx.fill();
    ctx.fillStyle = '#F9A825'; ctx.font = 'bold 10px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(playerName, cx, py-10);

    const skin  = '#D4895A';
    const shirt = av?.shirtColor || '#1565C0';
    const pants = av?.pantsColor || '#37474F';
    const hair  = '#3E2723';
    const shoe  = '#212121';
    const isGirl = av?.id === 'girl';
    const legSwing = player.animState === 'walk' ? Math.sin(frame*Math.PI/2)*9 : 0;
    const armSwing = player.animState === 'walk' ? Math.sin(frame*Math.PI/2)*12 : 0;

    // Cape for super heroes
    if (av?.cape) {
      ctx.fillStyle = av.cape;
      ctx.beginPath();
      ctx.moveTo(cx-10, py+14);
      ctx.quadraticCurveTo(cx-20, py+ph-5, cx-5+Math.sin(Date.now()/300)*4, py+ph+2);
      ctx.lineTo(cx, py+14);
      ctx.fill();
    }

    // Legs
    [[-6, legSwing], [6, -legSwing]].forEach(([ox, ang]) => {
      ctx.save();
      ctx.translate(cx+ox, py+ph-18);
      ctx.rotate((ang*Math.PI)/180);
      ctx.fillStyle = pants;
      roundRect(ctx, -5, 0, 10, 20, 3); ctx.fill();
      ctx.fillStyle = shoe;
      ctx.fillRect(-6, 18, 12, 5);
      ctx.restore();
    });

    // Body (armor for Iron Man / heroes)
    if (av?.armor) {
      ctx.fillStyle = av.armor;
      roundRect(ctx, cx-12, py+13, 24, 24, 4); ctx.fill();
      ctx.fillStyle = '#FFC107';
      ctx.fillRect(cx-3, py+16, 6, 10);
      ctx.beginPath(); ctx.arc(cx, py+23, 4, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = shirt;
      roundRect(ctx, cx-11, py+14, 22, 22, 4); ctx.fill();
      ctx.fillStyle = shadeColor(shirt, -20);
      ctx.fillRect(cx+2, py+17, 6, 6);
    }

    // Arms + held items
    [[-12, -armSwing, -1], [12, armSwing, 1]].forEach(([ox, ang, side]) => {
      ctx.save();
      ctx.translate(cx+ox, py+16);
      ctx.rotate((ang*Math.PI)/180);
      ctx.fillStyle = av?.armor ? av.armor : shirt;
      roundRect(ctx, -4, 0, 8, 16, 3); ctx.fill();
      ctx.fillStyle = av?.armor ? av.armor : skin;
      ctx.beginPath(); ctx.arc(side<0?-1:1, 17, 5, 0, Math.PI*2); ctx.fill();
      if (side < 0 && heldItems[0]) {
        ctx.font = '12px serif'; ctx.textAlign = 'center';
        ctx.fillText(heldItems[0].emoji, 0, 28);
      }
      if (side > 0 && heldItems[1]) {
        ctx.font = '12px serif'; ctx.textAlign = 'center';
        ctx.fillText(heldItems[1].emoji, 0, 28);
      }
      ctx.restore();
    });

    // Head
    ctx.fillStyle = av?.armor ? av.armor : skin;
    ctx.beginPath(); ctx.arc(cx, py+8, 12, 0, Math.PI*2); ctx.fill();

    if (!av?.armor) {
      // Hair
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(cx, py+4, 12, Math.PI, 0); ctx.fill();
      if (isGirl) {
        ctx.beginPath(); ctx.arc(cx-13, py+8, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+13, py+8, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#E91E63';
        ctx.beginPath(); ctx.arc(cx-13, py+8, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+13, py+8, 3, 0, Math.PI*2); ctx.fill();
      }
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx-4, py+8, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+4, py+8, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(cx-3.5, py+8, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+4.5, py+8, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx-2.5, py+7, 0.8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+5.5, py+7, 0.8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#7B3F00'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, py+10, 4, 0.2, Math.PI-0.2); ctx.stroke();
    } else {
      // Iron man visor
      ctx.fillStyle = '#FFC107'; ctx.fillRect(cx-10, py+5, 20, 7);
      ctx.fillStyle = '#FF8F00'; ctx.fillRect(cx-8, py+6, 16, 5);
    }

    // Extra items on back (3rd+)
    if (heldItems.length > 2) {
      ctx.font = '11px serif'; ctx.textAlign = 'center';
      ctx.fillText(heldItems.slice(2).map(i=>i.emoji).join(''), cx, py-30);
    }

    ctx.restore();
  }

  function drawProgressFlag() {
    const fx = WORLD_W - 100;
    ctx.fillStyle = '#5D4037'; ctx.fillRect(fx, ROAD_TOP-130, 7, 130);
    ctx.fillStyle = collected >= currentLevel?.goal ? '#F9A825' : '#EF5350';
    ctx.beginPath();
    ctx.moveTo(fx+7, ROAD_TOP-130); ctx.lineTo(fx+55, ROAD_TOP-108); ctx.lineTo(fx+7, ROAD_TOP-86);
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(collected >= currentLevel?.goal ? 'DONE!' : `${collected}/${currentLevel?.goal}`, fx+32, ROAD_TOP-104);
  }

  function drawDistanceBar() {
    const bx = W-145, by = 50, bw = 125, bh = 9;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, bx-5, by-14, bw+10, bh+22, 5); ctx.fill();
    ctx.fillStyle = '#263238'; ctx.fillRect(bx, by, bw, bh);
    const prog = player.x / WORLD_W;
    const barGrad = ctx.createLinearGradient(bx, 0, bx+bw, 0);
    barGrad.addColorStop(0, '#F9A825'); barGrad.addColorStop(1, '#FF6F00');
    ctx.fillStyle = barGrad; ctx.fillRect(bx, by, bw*prog, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '9px Nunito, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Progress', bx, by-3);
  }

  function drawHeldItemHint() {
    if (heldItems.length === 0) return;
    const lx = 10, ly = H - 125;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, lx, ly, 200, 110, 8); ctx.fill();
    ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 1.5;
    roundRect(ctx, lx, ly, 200, 110, 8); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Nunito, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`Carrying ${heldItems.length}/${getCarryLimit()}:`, lx+10, ly+18);
    heldItems.forEach((item, idx) => {
      ctx.font = '10px Nunito, sans-serif';
      const dotColor = item.bin === 'organic' ? '#4CAF50' : item.bin === 'recycle' ? '#2196F3' : '#F44336';
      ctx.fillStyle = dotColor;
      ctx.beginPath(); ctx.arc(lx+16, ly+34+idx*22, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(`${item.emoji} ${item.name} → ${item.bin.toUpperCase()} 🪙${item.coins}`, lx+26, ly+37+idx*22);
    });
  }

  /* ── UTILS ──────────────────────────────────────────────── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }
  function shadeColor(hex, amt) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0,Math.min(255,(num>>16)+amt));
    const g = Math.max(0,Math.min(255,((num>>8)&0xff)+amt));
    const b = Math.max(0,Math.min(255,(num&0xff)+amt));
    return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
  }

  return { init, tryPickup };
})();

/* ── DOM READY ──────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  renderNameScreenAvatars();
  updateNameScreenLives();
  // Periodic life timer update
  setInterval(updateNameScreenLives, 5000);
  LivesSystem.tick();
});