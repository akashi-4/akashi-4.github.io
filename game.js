/* de_dust2_cv — a small walkable Dust2-style map for the CV page.
   Loaded on demand from the main menu ("New Game"). Walk up to a wall panel
   and press E to open the matching CV window. */
(() => {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  const $ = (s, r = document) => r.querySelector(s);

  const link = document.getElementById('new-game');
  if (!link) return;

  // Needs a mouse + keyboard and WebGL. Phones keep the scrolling page.
  const canPlay = (() => {
    if (!matchMedia('(any-pointer: fine)').matches) return false;
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  })();
  if (!canPlay) { link.remove(); return; }
  link.hidden = false;

  const root = document.documentElement;
  const loaderEl = $('#loader');
  const loaderStatus = $('#loader-status');
  const loaderBars = $('#loader-bars');
  const loaderServer = $('.server', loaderEl);

  let game = null;
  let starting = false;
  let aborted = false;

  const wait = ms => new Promise(r => setTimeout(r, ms));
  function showLoader() { loaderEl.classList.remove('fade'); root.classList.add('loading'); }
  function hideLoader() {
    loaderEl.classList.add('fade');
    setTimeout(() => root.classList.remove('loading'), 250);
  }
  function abortStart() {
    if (!starting) return;
    aborted = true;
    hideLoader();
  }
  $('#loader-cancel').addEventListener('click', abortStart);
  addEventListener('keydown', e => { if (e.key === 'Escape') abortStart(); });

  async function start() {
    if (starting) return;
    Sound.init();
    if (game) { game.enter(); return; }
    starting = true;
    aborted = false;
    const steps = [
      'Connecting to joao-furukawa.cv:27015...',
      'Retrieving server info...',
      'Parsing game info...',
      'Verifying and downloading resources...',
      'Precaching resources...',
      'Spawning player...',
    ];
    const say = i => {
      loaderStatus.textContent = steps[i];
      loaderBars.style.width = Math.round((i + 1) / steps.length * 100) + '%';
    };
    loaderServer.textContent = 'de_dust2_cv · 1/32 players';
    say(0);
    showLoader();
    try {
      await wait(350); if (aborted) return; say(1);
      const [THREE] = await Promise.all([import(THREE_URL), wait(400)]);
      if (aborted) return; say(2);
      await Promise.all([document.fonts.load('20px ArialPixel', 'AãÃé·—→').catch(() => {}), wait(300)]);
      if (aborted) return; say(3);
      await wait(300);
      if (aborted) return; say(4);
      game = createGame(THREE);
      await wait(300);
      if (aborted) return; say(5);
      await wait(300);
      if (aborted) return;
      hideLoader();
      game.enter();
    } catch (err) {
      console.error(err);
      loaderStatus.textContent = 'Could not connect to server. Try the classic page.';
      await wait(1800);
      hideLoader();
    } finally {
      starting = false;
    }
  }
  link.addEventListener('click', e => { e.preventDefault(); start(); });
  if (new URLSearchParams(location.search).has('play')) {
    addEventListener('load', () => setTimeout(start, root.classList.contains('loading') ? 3200 : 0));
  }

  /* ---------------------------------------------------------------- sound */
  // Everything is synthesised with WebAudio, no audio files.
  const Sound = {
    ctx: null, master: null, noise: null,
    init() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.3;
          this.master.connect(this.ctx.destination);
          const len = this.ctx.sampleRate;
          this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noise.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    burst({ dur, type = 'lowpass', freq = 1000, freqEnd, q = 1, gain = 0.5, rate = 1 }) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noise; src.playbackRate.value = rate;
      const f = c.createBiquadFilter();
      f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
      if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random() * 0.5); src.stop(t + dur);
    },
    tone({ dur, freq, freqEnd, type = 'sine', gain = 0.4, delay = 0 }) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur);
    },
    click() {
      this.burst({ dur: 0.025, type: 'highpass', freq: 2500, gain: 0.35 });
      this.tone({ dur: 0.015, freq: 1900, type: 'square', gain: 0.05 });
    },
    step() { this.burst({ dur: 0.07, type: 'bandpass', freq: 700 + Math.random() * 400, q: 0.8, gain: 0.25, rate: 0.8 + Math.random() * 0.4 }); },
    land() { this.burst({ dur: 0.1, type: 'lowpass', freq: 500, gain: 0.35 }); },
    use() { this.tone({ dur: 0.06, freq: 520, type: 'square', gain: 0.06 }); this.tone({ dur: 0.08, freq: 780, type: 'square', gain: 0.06, delay: 0.06 }); },
  };

  /* ================================================================= game */
  function createGame(THREE) {
    const V3 = THREE.Vector3;

    /* ------------------------------------------------------------ DOM */
    const el = document.createElement('div');
    el.className = 'game';
    el.hidden = true;
    el.innerHTML = `
      <div class="hud" id="hud">
        <canvas class="radar" width="300" height="300"></canvas>
        <div class="top-right">de_dust2_cv · panels read <span id="h-read">0/6</span><br>hold TAB for scores</div>
        <svg class="cursor" viewBox="0 0 12 19" aria-hidden="true"><path d="M.5.5v15l3.5-3.5 3 6 2-1-3-6h5z"/></svg>
        <div class="chat" id="h-chat"></div>
        <div class="use-hint" id="h-use" hidden></div>
        <div class="center-msg" id="h-center" hidden></div>
        <div class="money"><span class="delta" id="h-delta">+ $300</span><span>$ <span id="h-money">800</span></span></div>
        <div class="hud-row">
          <div class="hud-group">
            <div class="hud-num"><svg viewBox="0 0 10 10"><path d="M3.5 0h3v3.5H10v3H6.5V10h-3V6.5H0v-3h3.5z"/></svg>100</div>
            <div class="hud-num"><svg viewBox="0 0 10 10"><path d="M5 0l4.5 1.6v3.2C9.5 7.4 7.6 9.2 5 10 2.4 9.2.5 7.4.5 4.8V1.6z"/></svg>100</div>
          </div>
          <div class="hud-num" id="h-time-wrap"><svg viewBox="0 0 10 10"><path d="M5 0a5 5 0 110 10A5 5 0 015 0zm0 1.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2zM4.4 2.4h1.2v2.4l1.8 1.1-.6 1-2.4-1.4z"/></svg><span id="h-time">1:55</span></div>
          <div class="hud-num" title="Panels read"><span id="h-count">0</span><span class="sep">|</span><span>6</span><svg viewBox="0 0 12 19"><path d="M0 0v16l4-4 3 6 2.5-1.2-3-6H12z"/></svg></div>
        </div>
        <div class="scoreboard" id="h-score" hidden></div>
      </div>
      <div class="game-pause" id="g-pause" hidden>
        <h2 class="title">de_dust2_cv</h2>
        <nav class="main-menu" aria-label="Game menu">
          <a href="#" data-act="resume">Resume Game</a>
          <a href="#" data-act="motd">Controls</a>
          <a href="#desktop" data-act="classic">Classic View</a>
          <div class="gap"></div>
          <a href="#top" data-act="quit">Quit</a>
        </nav>
      </div>
      <div class="game-modal" id="g-modal" hidden><div class="game-modal-inner" id="g-modal-inner"></div></div>`;
    document.body.appendChild(el);

    const hud = {
      read: $('#h-read', el), chat: $('#h-chat', el), use: $('#h-use', el), center: $('#h-center', el),
      money: $('#h-money', el), delta: $('#h-delta', el), time: $('#h-time', el),
      count: $('#h-count', el), score: $('#h-score', el),
      cursor: $('.cursor', el), radar: $('.radar', el), root: $('#hud', el),
    };
    const pauseEl = $('#g-pause', el);
    const modalEl = $('#g-modal', el);
    const modalInner = $('#g-modal-inner', el);

    /* ------------------------------------------------------- renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;
    el.prepend(renderer.domElement);
    const canvas = renderer.domElement;
    const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xdcc9a0, 45, 150);
    const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 400);
    camera.rotation.order = 'YXZ';

    /* ------------------------------------------------------- textures */
    // Seeded random so the map looks the same on every visit.
    let seed = 1337;
    const rnd = () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const rr = (a, b) => a + rnd() * (b - a);

    function makeCanvas(w, h = w) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return [c, c.getContext('2d')];
    }
    function toTexture(c, repeat = true) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }
    function speckle(g, w, h, n, dark = 0.12, light = 0.08, size = 2) {
      for (let i = 0; i < n; i++) {
        const d = rnd() < 0.6;
        g.fillStyle = d ? `rgba(40,25,10,${rr(0.02, dark)})` : `rgba(255,245,220,${rr(0.02, light)})`;
        const s = rr(1, size);
        g.fillRect(rr(0, w), rr(0, h), s, s);
      }
    }
    function blotches(g, w, h, n, color, alpha) {
      for (let i = 0; i < n; i++) {
        const x = rr(0, w), y = rr(0, h), r = rr(w * 0.08, w * 0.3);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(${color},${rr(alpha * 0.4, alpha)})`);
        grd.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = grd;
        // draw wrapped so the texture still tiles
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
          g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
        }
      }
    }
    function bricks(g, x0, y0, w, h, bw, bh) {
      g.save();
      g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      g.fillStyle = '#8c6a42'; g.fillRect(x0, y0, w, h);
      for (let row = 0, y = y0; y < y0 + h; row++, y += bh) {
        for (let x = x0 - (row % 2 ? bw / 2 : 0); x < x0 + w; x += bw) {
          const s = rr(-12, 12);
          g.fillStyle = `rgb(${176 + s},${134 + s},${88 + s})`;
          g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        }
      }
      g.restore();
      g.strokeStyle = 'rgba(90,60,30,.55)'; g.lineWidth = 2;
      g.strokeRect(x0, y0, w, h);
    }

    const tex = {};
    { // plaster wall with a few patches of exposed brick (512px covers 5m, so repeats are rare)
      const [c, g] = makeCanvas(512);
      g.fillStyle = '#d5bb8d'; g.fillRect(0, 0, 512, 512);
      blotches(g, 512, 512, 22, '150,110,60', 0.16);
      blotches(g, 512, 512, 14, '250,235,200', 0.2);
      // water stains running down
      for (let i = 0; i < 7; i++) {
        const x = rr(0, 512), w = rr(10, 40), grd = g.createLinearGradient(0, 0, 0, 512);
        grd.addColorStop(0, 'rgba(120,85,45,0)'); grd.addColorStop(rr(0.4, 0.9), 'rgba(120,85,45,.12)'); grd.addColorStop(1, 'rgba(120,85,45,0)');
        g.fillStyle = grd; g.fillRect(x, 0, w, 512);
      }
      bricks(g, 40, 330, 92, 46, 24, 11.5);
      bricks(g, 330, 70, 64, 34, 24, 11.5);
      bricks(g, 380, 420, 48, 23, 24, 11.5);
      speckle(g, 512, 512, 9000, 0.12, 0.08, 2.5);
      g.strokeStyle = 'rgba(80,55,30,.3)'; g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        let x = rr(0, 512), y = rr(0, 512);
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x += rr(-16, 16); y += rr(5, 16); g.lineTo(x, y); }
        g.stroke();
      }
      tex.plaster = toTexture(c);
    }
    { // wall cap / trim
      const [c, g] = makeCanvas(128);
      g.fillStyle = '#b39868'; g.fillRect(0, 0, 128, 128);
      blotches(g, 128, 128, 6, '110,80,40', 0.2);
      speckle(g, 128, 128, 900);
      tex.cap = toTexture(c);
    }
    { // sandy ground
      const [c, g] = makeCanvas(256);
      g.fillStyle = '#c4a26b'; g.fillRect(0, 0, 256, 256);
      blotches(g, 256, 256, 18, '140,100,55', 0.2);
      blotches(g, 256, 256, 12, '240,220,180', 0.18);
      speckle(g, 256, 256, 5000, 0.18, 0.1, 2.5);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(${rr(110, 150)},${rr(85, 110)},${rr(55, 70)},.7)`;
        g.beginPath(); g.ellipse(rr(0, 256), rr(0, 256), rr(1, 3.5), rr(1, 2.5), rr(0, 3), 0, 7); g.fill();
      }
      tex.sand = toTexture(c);
    }
    { // stone tiles (A site)
      const [c, g] = makeCanvas(256);
      g.fillStyle = '#8d7751'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        const s = rr(-14, 14);
        g.fillStyle = `rgb(${188 + s},${165 + s},${124 + s})`;
        g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
      }
      blotches(g, 256, 256, 10, '120,90,50', 0.18);
      speckle(g, 256, 256, 3000);
      g.strokeStyle = 'rgba(90,65,35,.4)';
      for (let i = 0; i < 4; i++) { g.beginPath(); let x = rr(0, 256), y = rr(0, 256); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rr(-16, 16); y += rr(-16, 16); g.lineTo(x, y); } g.stroke(); }
      tex.tiles = toTexture(c);
    }
    { // wooden crate
      const [c, g] = makeCanvas(128);
      g.fillStyle = '#9a6a36'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 16) {
        const s = rr(-10, 10);
        g.fillStyle = `rgb(${150 + s},${102 + s},${52 + s})`; g.fillRect(0, y + 1, 128, 14);
        g.fillStyle = 'rgba(60,35,10,.5)'; g.fillRect(0, y, 128, 1);
      }
      speckle(g, 128, 128, 700, 0.2, 0.06);
      g.strokeStyle = '#6a4219'; g.lineWidth = 12; g.strokeRect(6, 6, 116, 116);
      g.strokeStyle = 'rgba(200,150,90,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
      g.strokeStyle = '#7c4f22'; g.lineWidth = 12;
      g.beginPath(); g.moveTo(12, 116); g.lineTo(116, 12); g.stroke();
      g.fillStyle = '#3a2a1a';
      for (const [x, y] of [[6, 6], [122, 6], [6, 122], [122, 122], [64, 6], [64, 122], [6, 64], [122, 64]]) g.fillRect(x - 1.5, y - 1.5, 3, 3);
      tex.crate = toTexture(c, false);
    }
    { // big wooden doors
      const [c, g] = makeCanvas(128, 256);
      for (let x = 0; x < 128; x += 21) {
        const s = rr(-12, 12);
        g.fillStyle = `rgb(${118 + s},${80 + s},${46 + s})`; g.fillRect(x, 0, 21, 256);
        g.fillStyle = 'rgba(40,25,10,.6)'; g.fillRect(x, 0, 2, 256);
      }
      speckle(g, 128, 256, 1400, 0.22, 0.05);
      for (const y of [40, 210]) {
        g.fillStyle = '#4b3524'; g.fillRect(0, y, 128, 16);
        g.fillStyle = '#2a2018';
        for (let x = 8; x < 128; x += 20) g.fillRect(x, y + 6, 4, 4);
      }
      tex.door = toTexture(c, false);
    }
    { // dark wood beams / panel frames
      const [c, g] = makeCanvas(64);
      g.fillStyle = '#5b3f25'; g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 3) { g.fillStyle = `rgba(30,18,8,${rr(0.05, 0.25)})`; g.fillRect(0, y, 64, 1); }
      tex.wood = toTexture(c);
    }
    { // rusty barrel
      const [c, g] = makeCanvas(128);
      g.fillStyle = '#4d6a78'; g.fillRect(0, 0, 128, 128);
      blotches(g, 128, 128, 8, '140,80,40', 0.5);
      for (const y of [20, 64, 108]) { g.fillStyle = 'rgba(20,30,35,.6)'; g.fillRect(0, y - 3, 128, 6); g.fillStyle = 'rgba(200,210,220,.2)'; g.fillRect(0, y - 3, 128, 1); }
      speckle(g, 128, 128, 700, 0.25, 0.08);
      tex.barrel = toTexture(c);
    }
    function paintTexture(w, h, draw) {
      const [c, g] = makeCanvas(w, h);
      draw(g);
      // weather the paint a bit
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rr(0.2, 0.9)})`; g.fillRect(rr(0, w), rr(0, h), rr(1, 4), rr(1, 4)); }
      return toTexture(c, false);
    }

    /* ------------------------------------------------------ materials */
    const mat = (map, scale, extra = {}) => {
      const m = new THREE.MeshLambertMaterial({ map, ...extra });
      m.userData.scale = scale;
      return m;
    };
    const M = {
      plaster: mat(tex.plaster, 5),
      cap: mat(tex.cap, 1.5),
      sand: mat(tex.sand, 3.2),
      tiles: mat(tex.tiles, 2.4),
      crate: mat(tex.crate, 0),
      door: mat(tex.door, 0),
      wood: mat(tex.wood, 1),
      barrel: mat(tex.barrel, 0),
    };

    /* ------------------------------------------------------- geometry */
    const colliders = [];   // AABBs the player collides with
    const solids = [];      // meshes bullets can hit

    // Give box faces UVs from world position so textures tile at a fixed size.
    function worldUV(geo, scale) {
      const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let u, v;
        if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
        uv.setXY(i, u / scale, v / scale);
      }
      uv.needsUpdate = true;
    }
    function box(x1, x2, y1, y2, z1, z2, material, { collide = true, shoot = true, shadow = true } = {}) {
      const geo = new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1);
      geo.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      if (material.userData.scale) worldUV(geo, material.userData.scale);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      scene.add(mesh);
      if (collide) colliders.push({ minX: x1, maxX: x2, minY: y1, maxY: y2, minZ: z1, maxZ: z2 });
      if (shoot) solids.push(mesh);
      return mesh;
    }
    function wall(x1, x2, z1, z2, h) {
      box(x1, x2, 0, h, z1, z2, M.plaster);
      box(x1 - 0.08, x2 + 0.08, h, h + 0.22, z1 - 0.08, z2 + 0.08, M.cap, { collide: false });
      // darker dirt line at the base of the wall
      box(x1 - 0.03, x2 + 0.03, 0, 0.35, z1 - 0.03, z2 + 0.03, M.cap, { collide: false, shoot: false, shadow: false });
    }
    function crate(x, z, size, y = 0) {
      const h = size / 2;
      return box(x - h, x + h, y, y + size, z - h, z + h, M.crate);
    }
    function barrel(x, z) {
      const geo = new THREE.CylinderGeometry(0.33, 0.33, 1.0, 14);
      const mesh = new THREE.Mesh(geo, M.barrel);
      mesh.position.set(x, 0.5, z);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh); solids.push(mesh);
      colliders.push({ minX: x - 0.33, maxX: x + 0.33, minY: 0, maxY: 1, minZ: z - 0.33, maxZ: z + 0.33 });
    }
    function decal(texture, w, h, pos, rotY) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.copy(pos); m.rotation.y = rotY; m.receiveShadow = true;
      scene.add(m);
      return m;
    }

    /* ------------------------------------------------------------ map */
    // Floor
    box(-9, 21, -1, 0, -29, 25, M.sand, { collide: false });
    box(-4, 18, 0, 0.02, -26, -10, M.tiles, { collide: false, shadow: false });

    // Spawn yard (x -6..6, z 10..22)
    wall(-7, 7, 22, 23, 6);
    wall(-7, -6, 9, 22, 6);
    wall(6, 7, 9, 22, 6);
    wall(-7, -2, 9, 10, 6.4);
    wall(2, 7, 9, 10, 6.4);
    box(-2, 2, 3.4, 6.4, 9, 10, M.plaster);                          // lintel over the doors
    box(-2.1, 2.1, 3.22, 3.4, 8.9, 10.1, M.wood, { collide: false }); // beam
    box(-2.4, 2.4, 6.4, 6.62, 8.92, 10.08, M.cap, { collide: false });
    // The doors, swung open
    box(-2.02, -1.92, 0, 3.2, 7.05, 9, M.door);
    box(1.92, 2.02, 0, 3.2, 7.05, 9, M.door);
    barrel(4.9, 20.9); barrel(4.2, 21.3); barrel(5.2, 20.1);
    crate(-4.8, 20.8, 1.2); crate(-3.7, 21.2, 0.9);

    // Long corridor (x -3..3, z -10..9)
    wall(-4, -3, -10, 9, 6);
    wall(3, 4, -9, 9, 6);
    crate(2.3, 1.6, 1.2); crate(2.35, 1.65, 1.2, 1.2);
    crate(2.4, 2.9, 0.9);
    box(-3, 3, 4.2, 6, -10, -9, M.plaster);                           // arch into the site
    box(-3.1, 3.1, 4.02, 4.2, -10.1, -8.9, M.wood, { collide: false });

    // A site (x -4..18, z -26..-10)
    wall(-5, -4, -27, -10, 7);
    wall(-5, 19, -27, -26, 7);
    wall(18, 19, -27, -9, 7);
    wall(4, 19, -10, -9, 7);
    // raised platform + steps
    box(9, 18, 0, 0.9, -26, -17, M.tiles);
    box(11, 16, 0, 0.45, -17, -16, M.tiles);
    // crates
    crate(0.6, -19.4, 1.2); crate(1.8, -19.4, 1.2); crate(1.2, -19.4, 1.2, 1.2);
    crate(16.2, -19.2, 1.5, 0.9);
    crate(17, -24.9, 1.2, 0.9);
    crate(8.6, -10.7, 1.2);
    crate(-3.2, -24.9, 1.2);
    // wooden beams sticking out of the walls
    for (const x of [0, 5, 10, 15]) box(x, x + 0.25, 5.2, 5.45, -26, -25.3, M.wood, { collide: false });

    // painted "A" on the platform wall, direction sign in the corridor
    decal(paintTexture(256, 256, g => {
      g.fillStyle = 'rgba(35,22,12,.88)';
      g.font = 'bold 230px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('A', 128, 140);
    }), 2.6, 2.6, new V3(17.93, 3.2, -22), -Math.PI / 2);
    decal(paintTexture(512, 256, g => {
      g.fillStyle = 'rgba(35,22,12,.88)';
      g.font = 'bold 170px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('A →', 256, 140);
    }), 2.4, 1.2, new V3(0, 5.1, -8.93), 0);

    // Sky
    {
      const [c, g] = makeCanvas(4, 256);
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#4f84c9'); grd.addColorStop(0.42, '#8fb7e2');
      grd.addColorStop(0.5, '#e7d9bc'); grd.addColorStop(1, '#cdb58a');
      g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
      const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16),
        new THREE.MeshBasicMaterial({ map: toTexture(c, false), side: THREE.BackSide, fog: false }));
      scene.add(sky);
    }

    // Lighting: warm low sun + sky fill
    scene.add(new THREE.HemisphereLight(0xd6e4f5, 0xa5824f, 1.35));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
    sun.position.set(-16, 34, 14);
    sun.target.position.set(6, 0, -3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 110 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    /* --------------------------------------------------------- panels */
    const read = new Set();
    const panels = [];
    const panelDefs = [
      { id: 'about', title: 'About', heading: 'João Furukawa', lines: ['Junior Software Developer @ TUU', 'M.Sc. AI · University of Coimbra', 'Full-stack · LLM tools · RAG'], at: [-5.96, 1.9, 16], face: '+x' },
      { id: 'career', title: 'Career', heading: 'Experience & Education', lines: ['Intern → Junior Dev @ TUU', '08/2025 — present', 'M.Sc. AI · B.Sc. Informatics Eng.'], at: [5.96, 1.9, 16], face: '-x' },
      { id: 'skills', title: 'Options — Skills', heading: 'Skills', lines: ['JS / TS · React · Node.js', 'Python · SQL · Java · C', 'RAG · PyTorch · Docker · Azure'], at: [-2.96, 1.9, -3], face: '+x' },
      { id: 'work', title: 'Projects — Work @ TUU', heading: 'Work @ TUU', lines: ['AI assistant in Microsoft Teams', 'Internal platforms & automation', 'Company website & design system'], at: [3, 1.9, -25.96], face: '+z' },
      { id: 'personal', title: 'Projects — Personal & Uni', heading: 'Personal & University', lines: ['FutSabado · Googol · DEIChain', 'Mario AI · ArtBench · Potrivia'], at: [17.96, 1.9, -13.5], face: '-x' },
      { id: 'contact', title: 'Contact', heading: 'Get in touch', lines: ['Email · GitHub · LinkedIn', 'Download CV (PDF)'], at: [12.5, 2.8, -25.96], face: '+z' },
    ];
    const faceRot = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };

    function panelTexture(def) {
      // drawn at 2x so the text stays sharp when you walk right up to a panel
      const W = 512, H = 340;
      const [c, g] = makeCanvas(W * 2, H * 2);
      g.scale(2, 2);
      const bevel = (x, y, w, h, light, dark) => {
        g.fillStyle = light; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
        g.fillStyle = dark; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
      };
      g.fillStyle = '#4a5942'; g.fillRect(0, 0, W, H);
      bevel(0, 0, W, H, '#8c9284', '#292c21');
      g.font = '20px ArialPixel, Arial'; g.fillStyle = '#fff'; g.textBaseline = 'middle';
      g.fillText(def.title, 16, 24);
      bevel(W - 36, 12, 24, 24, '#8c9284', '#292c21');
      g.strokeStyle = '#8c9284'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W - 30, 18); g.lineTo(W - 18, 30); g.moveTo(W - 18, 18); g.lineTo(W - 30, 30); g.stroke();
      g.fillStyle = '#3e4637'; g.fillRect(14, 46, W - 28, 232);
      bevel(14, 46, W - 28, 232, '#292c21', '#8c9284');
      g.font = '32px ArialPixel, Arial'; g.fillStyle = '#c4b550';
      g.fillText(def.heading, 30, 84);
      g.font = '23px ArialPixel, Arial'; g.fillStyle = '#dedfd6';
      def.lines.forEach((t, i) => g.fillText(t, 30, 136 + i * 38));
      g.fillStyle = '#4a5942'; g.fillRect(W - 176, 290, 160, 34);
      bevel(W - 176, 290, 160, 34, '#8c9284', '#292c21');
      g.font = '20px ArialPixel, Arial'; g.fillStyle = '#fff';
      g.fillText('[E]  Open', W - 158, 308);
      const t = toTexture(c, false);
      t.anisotropy = maxAniso;
      return t;
    }
    for (const def of panelDefs) {
      const grp = new THREE.Group();
      grp.position.set(...def.at);
      grp.rotation.y = faceRot[def.face];
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.86, 1.96, 0.08), M.wood);
      frame.position.z = 0.04; frame.castShadow = true; frame.receiveShadow = true;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.727),
        new THREE.MeshBasicMaterial({ map: panelTexture(def), toneMapped: false }));
      screen.position.z = 0.085;
      screen.userData.panel = def;
      grp.add(frame, screen);
      scene.add(grp);
      solids.push(frame);
      panels.push(screen);
    }

    /* ----------------------------------------------------- view model */
    // A computer mouse in a fingerless glove (like the hero illustration), drawn in its
    // own pass so it never clips into walls.
    const vmScene = new THREE.Scene();
    vmScene.add(new THREE.HemisphereLight(0xd6e4f5, 0xa5824f, 1.3));
    const vmSun = new THREE.DirectionalLight(0xfff0d0, 1.8);
    vmSun.position.set(-1, 2, 1);
    vmScene.add(vmSun);
    const vmRoot = new THREE.Group();
    const vm = new THREE.Group();
    vmRoot.add(vm); vmScene.add(vmRoot);
    const pressParts = [];   // left button + index finger, pushed down on click
    {
      const shell = new THREE.MeshLambertMaterial({ color: 0x6b6e75 });
      const buttonMat = new THREE.MeshLambertMaterial({ color: 0x55585e });
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e1f22 });
      const cableMat = new THREE.MeshLambertMaterial({ color: 0x151517 });
      const glove = new THREE.MeshLambertMaterial({ color: 0x1b1c1f });
      const skin = new THREE.MeshLambertMaterial({ color: 0xd49a78 });
      const sleeve = new THREE.MeshLambertMaterial({ color: 0x27304a });
      const box = (w, h, d, m, x, y, z, rx = 0) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z); mesh.rotation.x = rx; vm.add(mesh); return mesh;
      };
      // rounded body
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shell);
      body.scale.set(0.032, 0.02, 0.054); vm.add(body);
      // two buttons with a split between them, and the scroll wheel
      const left = box(0.0295, 0.005, 0.046, buttonMat, -0.0155, 0.0165, -0.028, -0.32);
      box(0.0295, 0.005, 0.046, buttonMat, 0.0155, 0.0165, -0.028, -0.32);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.005, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.0215, -0.03); vm.add(wheel);
      // cable curling away from the front
      const cable = new THREE.CatmullRomCurve3([
        new V3(0, 0.004, -0.054), new V3(0.004, 0.0, -0.09), new V3(0.02, -0.03, -0.13),
        new V3(0.05, -0.09, -0.12), new V3(0.07, -0.16, -0.06)]);
      vm.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 24, 0.0022, 6), cableMat));
      // hand: palm over the back, thumb on the side, fingerless glove on two fingers
      box(0.046, 0.016, 0.036, glove, 0.002, 0.021, 0.042, 0.2);    // palm on the back hump
      box(0.011, 0.012, 0.03, glove, -0.035, 0.002, 0.012, 0.1);    // thumb along the side
      box(0.01, 0.011, 0.016, skin, -0.036, 0.002, -0.01, 0.1);
      const indexGlove = box(0.009, 0.008, 0.02, glove, -0.019, 0.024, 0.014, -0.15);
      const indexTip = box(0.008, 0.007, 0.02, skin, -0.019, 0.022, -0.006, -0.3);
      box(0.009, 0.008, 0.02, glove, 0.019, 0.024, 0.014, -0.15);
      box(0.008, 0.007, 0.02, skin, 0.019, 0.022, -0.006, -0.3);
      box(0.01, 0.011, 0.03, glove, 0.035, 0.006, 0.02, 0.05);      // ring + little finger
      pressParts.push(left, indexGlove, indexTip);
      pressParts.forEach(p => { p.userData.y = p.position.y; });
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.34, 10), sleeve);
      arm.rotation.x = Math.PI / 2 - 0.3; arm.position.set(0.012, -0.03, 0.2); vm.add(arm);
    }
    vm.rotation.order = 'YXZ';
    const VM_BASE = new V3(0.12, -0.12, -0.27);

    /* --------------------------------------------------------- player */
    const R = 0.4, STAND = 1.83, DUCK = 1.15, EYE_STAND = 1.63, EYE_DUCK = 0.98;
    const STEP = 0.46, GRAVITY = 20.3, JUMP = 6.8;
    const MAXSPEED = 6.35, WALK = 0.52, DUCKSPEED = 0.34;
    const ACCEL = 5, AIRACCEL = 10, AIRCAP = 0.76, FRICTION = 4, STOPSPEED = 2.54;
    const SPAWN = { x: 0, y: 0, z: 18.5, yaw: 0 };
    const P = {
      pos: new V3(SPAWN.x, SPAWN.y, SPAWN.z), vel: new V3(), yaw: SPAWN.yaw, pitch: 0,
      h: STAND, eye: EYE_STAND, ducked: false, onGround: true, punch: 0,
    };

    function overlaps(b, x, y, z, h) {
      return x + R > b.minX && x - R < b.maxX && z + R > b.minZ && z - R < b.maxZ && y + h > b.minY && y < b.maxY;
    }
    function blocked(x, y, z, h) {
      if (y < -0.001) return true;
      for (const b of colliders) if (overlaps(b, x, y, z, h)) return true;
      return false;
    }
    function moveAxis(axis, d) {
      if (!d) return;
      const p = P.pos;
      p[axis] += d;
      for (const b of colliders) {
        if (!overlaps(b, p.x, p.y, p.z, P.h)) continue;
        if (P.onGround && b.maxY - p.y <= STEP && !blocked(p.x, b.maxY, p.z, P.h)) { p.y = b.maxY; continue; }
        if (axis === 'x') p.x = d > 0 ? b.minX - R - 1e-4 : b.maxX + R + 1e-4;
        else p.z = d > 0 ? b.minZ - R - 1e-4 : b.maxZ + R + 1e-4;
        P.vel[axis] = 0;
      }
    }

    const keys = {};
    let jumpQueued = false;
    const wish = new V3();

    function physics(dt) {
      // duck / unduck (ducking in the air pulls the legs up, so crouch-jumps reach higher)
      // (C, not Ctrl: Ctrl+W would close the browser tab)
      const wantDuck = !!keys.KeyC;
      if (wantDuck && !P.ducked) {
        P.ducked = true;
        if (!P.onGround) P.pos.y += STAND - DUCK;
        P.h = DUCK;
      } else if (!wantDuck && P.ducked) {
        if (P.onGround && !blocked(P.pos.x, P.pos.y, P.pos.z, STAND)) { P.ducked = false; P.h = STAND; }
        else if (!P.onGround) {
          const y = Math.max(0, P.pos.y - (STAND - DUCK));
          if (!blocked(P.pos.x, y, P.pos.z, STAND)) { P.pos.y = y; P.ducked = false; P.h = STAND; }
        }
      }

      // wish direction
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
      const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      wish.set(fx * f + rx * s, 0, fz * f + rz * s);
      const wl = wish.length();
      if (wl > 0) wish.divideScalar(wl);
      let wishspeed = wl > 0 ? MAXSPEED : 0;
      if (keys.ShiftLeft || keys.ShiftRight) wishspeed *= WALK;
      if (P.ducked && P.onGround) wishspeed *= DUCKSPEED;

      const v = P.vel;
      if (P.onGround && jumpQueued) {
        v.y = JUMP; P.onGround = false;
      }
      jumpQueued = false;

      if (P.onGround) {
        const speed = Math.hypot(v.x, v.z);
        if (speed > 0.001) {
          const drop = Math.max(speed, STOPSPEED) * FRICTION * dt;
          const k = Math.max(speed - drop, 0) / speed;
          v.x *= k; v.z *= k;
        } else { v.x = v.z = 0; }
        const cur = v.x * wish.x + v.z * wish.z;
        const add = wishspeed - cur;
        if (add > 0) {
          const a = Math.min(ACCEL * dt * wishspeed, add);
          v.x += a * wish.x; v.z += a * wish.z;
        }
      } else if (wishspeed > 0) {
        // air control with the classic 30 unit cap (air strafing works)
        const cur = v.x * wish.x + v.z * wish.z;
        const add = Math.min(wishspeed, AIRCAP) - cur;
        if (add > 0) {
          const a = Math.min(AIRACCEL * dt * wishspeed, add);
          v.x += a * wish.x; v.z += a * wish.z;
        }
      }

      moveAxis('x', v.x * dt);
      moveAxis('z', v.z * dt);

      const wasOnGround = P.onGround;
      const fallSpeed = v.y;
      v.y -= GRAVITY * dt;
      P.pos.y += v.y * dt;
      P.onGround = false;
      if (P.pos.y <= 0) { P.pos.y = 0; if (v.y < 0) v.y = 0; P.onGround = true; }
      for (const b of colliders) {
        if (!overlaps(b, P.pos.x, P.pos.y, P.pos.z, P.h)) continue;
        if (v.y <= 0) { P.pos.y = b.maxY; v.y = 0; P.onGround = true; }
        else { P.pos.y = b.minY - P.h; v.y = 0; }
      }
      if (P.onGround && !wasOnGround && fallSpeed < -4) Sound.land();
    }

    /* ---------------------------------------------------------- mouse */
    const ray = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    let press = 0;
    function click() {
      press = 1;
      Sound.click();
      hud.cursor.classList.add('down');
      setTimeout(() => hud.cursor.classList.remove('down'), 90);
      if (lookTarget) openPanel(lookTarget);
    }

    /* ------------------------------------------------------------ HUD */
    let money = 800;
    let roundLeft = 115;
    function chat(html) {
      const p = document.createElement('p');
      p.innerHTML = html;
      hud.chat.appendChild(p);
      while (hud.chat.children.length > 5) hud.chat.firstChild.remove();
      setTimeout(() => p.classList.add('old'), 7000);
      setTimeout(() => p.remove(), 7700);
    }
    let centerTimer = 0;
    function centerMsg(text, secs = 3) {
      hud.center.textContent = text; hud.center.hidden = false;
      clearTimeout(centerTimer);
      centerTimer = setTimeout(() => { hud.center.hidden = true; }, secs * 1000);
    }
    function addMoney(n) {
      money = Math.min(16000, money + n);
      hud.money.textContent = money;
      hud.delta.textContent = '+ $' + n;
      hud.delta.classList.add('show');
      setTimeout(() => hud.delta.classList.remove('show'), 1800);
    }
    function renderScoreboard() {
      const rows = panelDefs.map(d =>
        `<tr class="${read.has(d.id) ? 'done' : 'todo'}"><td>${d.heading}</td><td>${read.has(d.id) ? 'read' : '—'}</td></tr>`).join('');
      hud.score.innerHTML = `
        <header><span>Counter-Strike · de_dust2_cv</span><span>${read.size}/${panelDefs.length} read</span></header>
        <table>
          <thead><tr><th>Counter-Terrorists</th><th>Score</th><th>Deaths</th><th>Latency</th></tr></thead>
          <tbody><tr><td>Recruiter (you)</td><td>${read.size}</td><td>0</td><td>5</td></tr>
          <tr><td>João Furukawa</td><td>∞</td><td>0</td><td>1</td></tr></tbody>
        </table>
        <table style="margin-top:12px"><thead><tr><th>Objectives</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    const radarG = hud.radar.getContext('2d');
    const areas = [[-6, 10, 12, 12], [-3, -10, 6, 19], [-4, -26, 22, 16]];
    function drawRadar() {
      const g = radarG, S = 300, k = 5.5;
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, 7); g.clip();
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, S, S);
      g.translate(S / 2, S / 2); g.rotate(P.yaw); g.scale(k, k); g.translate(-P.pos.x, -P.pos.z);
      g.fillStyle = 'rgba(210,190,140,.35)';
      for (const [x, z, w, d] of areas) g.fillRect(x, z, w, d);
      for (const s of panels) {
        const d = s.userData.panel;
        g.fillStyle = read.has(d.id) ? 'rgba(90,230,90,.95)' : 'rgba(255,190,40,.95)';
        g.fillRect(d.at[0] - 0.9, d.at[2] - 0.9, 1.8, 1.8);
      }
      g.restore();
      g.strokeStyle = 'rgba(255,168,0,.5)'; g.lineWidth = 3;
      g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, 7); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(S / 2, S / 2 - 10); g.lineTo(S / 2 - 7, S / 2 + 8); g.lineTo(S / 2 + 7, S / 2 + 8); g.closePath(); g.fill();
    }

    /* ------------------------------------------------ windows / modal */
    let aboutWin = null;
    function buildAbout() {
      const bio = $('.menu-screen .bio')?.textContent.trim() ?? '';
      const w = document.createElement('div');
      w.className = 'cs-dialog window';
      w.style.maxWidth = '520px';
      w.innerHTML = `
        <div class="heading"><div class="wrapper"><div class="icon"></div><div class="text">About</div></div>
          <a class="cs-btn close" href="#top" aria-label="Close"></a></div>
        <div class="content">
          <h2>João Tirloni Furukawa</h2>
          <p class="accent">Junior Software Developer · Coimbra, Portugal</p>
          <p style="margin-top:10px"></p>
        </div>
        <div class="footer-btns"><a class="cs-btn" href="Joao-Furukawa-CV.pdf" download>CV (PDF)</a> <a class="cs-btn" href="#top">OK</a></div>`;
      $('.content p:last-child', w).textContent = bio;
      return w;
    }
    function buildMotd() {
      const w = document.createElement('div');
      w.className = 'cs-dialog window motd';
      w.style.maxWidth = '520px';
      w.innerHTML = `
        <div class="heading"><div class="wrapper"><div class="icon"></div><div class="text">Message of the Day</div></div>
          <a class="cs-btn close" href="#top" aria-label="Close"></a></div>
        <div class="content">
          <h2>Welcome to de_dust2_cv</h2>
          <p style="margin-top:8px">Find the six panels on the walls, walk up to one and <span class="accent">click</span> it (or press <span class="accent">E</span>) to open it.</p>
          <dl class="keys">
            <dt>W A S D</dt><dd>Move</dd>
            <dt>Mouse</dt><dd>Look · click a panel to open it</dd>
            <dt>Space</dt><dd>Jump</dd>
            <dt>C</dt><dd>Crouch (crouch-jump onto crates)</dd>
            <dt>Shift</dt><dd>Walk quietly</dd>
            <dt>E</dt><dd>Open panel (same as click)</dd>
            <dt>Tab</dt><dd>Scoreboard</dd>
            <dt>Esc</dt><dd>Menu</dd>
          </dl>
        </div>
        <div class="footer-btns"><a class="cs-btn" href="#top">OK</a></div>`;
      return w;
    }
    const windowFor = {
      about: () => aboutWin || (aboutWin = buildAbout()),
      career: () => $('#career'),
      work: () => $('#projects'),
      personal: () => $('#personal'),
      skills: () => $('#skills'),
      contact: () => $('#contact'),
    };

    let state = 'off';        // off | playing | paused | modal
    let modal = null;         // { el, parent, next }
    let motdShown = false;

    function openWindow(win) {
      modal = { el: win, parent: win.parentNode, next: win.nextSibling };
      modalInner.appendChild(win);
      modalEl.hidden = false;
      pauseEl.hidden = true;
      hud.root.hidden = true;
      state = 'modal';
      if (document.pointerLockElement) document.exitPointerLock();
      const first = win.querySelector('input, a, button');
      if (first) first.focus({ preventScroll: true });
    }
    function openPanel(def) {
      Sound.use();
      openWindow(windowFor[def.id]());
      if (!read.has(def.id)) {
        read.add(def.id);
        hud.read.textContent = `${read.size}/${panelDefs.length}`;
        hud.count.textContent = read.size;
        chat(`<span class="g">* Objective:</span> read ${def.heading}`);
        addMoney(300);
        if (read.size === panelDefs.length) setTimeout(() => centerMsg('Counter-Terrorists Win', 4), 400);
      }
    }
    function closeModal(relock) {
      if (!modal) return;
      if (modal.parent) modal.parent.insertBefore(modal.el, modal.next);
      else modal.el.remove();
      modal = null;
      modalEl.hidden = true;
      hud.root.hidden = false;
      if (relock) lock(); else showPause();
    }
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl) { closeModal(true); return; }
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) { e.preventDefault(); closeModal(true); }
      else if (/^https?:/.test(href)) { e.preventDefault(); open(href, '_blank', 'noopener'); }
    });

    function showPause() {
      state = 'paused';
      pauseEl.hidden = false;
      hud.use.hidden = true;
      hud.score.hidden = true;
    }
    pauseEl.addEventListener('click', e => {
      const a = e.target.closest('a[data-act]');
      if (!a) return;
      e.preventDefault();
      const act = a.dataset.act;
      if (act === 'resume') lock();
      else if (act === 'motd') openWindow(buildMotd());
      else if (act === 'classic') exit('#desktop');
      else if (act === 'quit') exit('#top');
    });

    function lock() {
      Sound.init();   // a click is a user gesture, so audio can start
      pauseEl.hidden = true;
      try {
        const p = canvas.requestPointerLock({ unadjustedMovement: true });
        if (p && p.catch) p.catch(() => {
          try { canvas.requestPointerLock(); } catch (e) { showPause(); }
        });
      } catch (e) { showPause(); }
    }
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        state = 'playing';
        pauseEl.hidden = true;
        for (const k in keys) keys[k] = false;
      } else if (state === 'playing') {
        showPause();
      }
    });
    document.addEventListener('pointerlockerror', () => { if (state !== 'modal' && state !== 'off') showPause(); });
    canvas.addEventListener('click', () => { if (state === 'paused') lock(); });

    /* ---------------------------------------------------------- input */
    let clock = 0;
    let lookTarget = null;
    document.addEventListener('mousemove', e => {
      if (state !== 'playing') return;
      const sens = 0.0022;
      P.yaw -= e.movementX * sens;
      P.pitch -= e.movementY * sens;
      P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch));
    });
    document.addEventListener('mousedown', e => {
      if (state === 'playing' && e.button === 0) click();
    });
    addEventListener('keydown', e => {
      if (state === 'off') return;
      if (state === 'modal') {
        if (e.key === 'Escape') { e.preventDefault(); closeModal(false); }
        return;
      }
      if (state !== 'playing') return;
      if (e.code === 'Tab') { e.preventDefault(); renderScoreboard(); hud.score.hidden = false; return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jumpQueued = true; }
      if (e.code === 'KeyE' && !e.repeat && lookTarget) openPanel(lookTarget);
      keys[e.code] = true;
    });
    addEventListener('keyup', e => {
      keys[e.code] = false;
      if (e.code === 'Tab') hud.score.hidden = true;
    });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    /* ---------------------------------------------------------- frame */
    let last = 0, bob = 0, stepDist = 0;
    const eyePos = new V3();
    function resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    addEventListener('resize', () => { if (state !== 'off') resize(); });

    function frame(t) {
      const now = t / 1000;
      const dt = Math.min(0.05, last ? now - last : 0.016);
      last = now;
      clock = now;

      if (state === 'playing') {
        const n = Math.ceil(dt / 0.008);
        for (let i = 0; i < n; i++) physics(dt / n);
        roundLeft -= dt;
        if (roundLeft <= 0) { roundLeft = 115; centerMsg('Round Draw'); }
      }

      // camera
      P.eye += ((P.ducked ? EYE_DUCK : EYE_STAND) - P.eye) * Math.min(1, dt * 14);
      if (P.ducked && !P.onGround) P.eye = EYE_DUCK;
      P.punch *= Math.max(0, 1 - dt * 9);
      eyePos.set(P.pos.x, P.pos.y + P.eye, P.pos.z);
      camera.position.copy(eyePos);
      camera.rotation.set(P.pitch + P.punch, P.yaw, 0);

      // footsteps & view-model bob
      const speed = Math.hypot(P.vel.x, P.vel.z);
      if (state === 'playing' && P.onGround && speed > 0.5) {
        bob += dt * speed;
        if (speed > 3.9) { stepDist += speed * dt; if (stepDist > 1.7) { stepDist = 0; Sound.step(); } }
      }
      const moveK = P.onGround ? Math.min(1, speed / MAXSPEED) : 0;
      press *= Math.max(0, 1 - dt * 14);
      pressParts.forEach(p => { p.position.y = p.userData.y - press * 0.0035; });
      vmRoot.position.copy(camera.position);
      vmRoot.quaternion.copy(camera.quaternion);
      vm.position.set(
        VM_BASE.x + Math.sin(bob * 1.4) * 0.008 * moveK,
        VM_BASE.y - Math.abs(Math.cos(bob * 1.4)) * 0.01 * moveK + (P.onGround ? 0 : 0.01),
        VM_BASE.z - press * 0.006);
      vm.rotation.set(0.55 - press * 0.03, -0.25, 0.05);

      // what are we looking at?
      lookTarget = null;
      if (state === 'playing') {
        ray.setFromCamera(center.set(0, 0), camera);
        ray.far = 3.2;
        const hit = ray.intersectObjects([...panels, ...solids], false)[0];
        if (hit && hit.object.userData.panel) lookTarget = hit.object.userData.panel;
      }
      hud.use.hidden = !lookTarget;
      if (lookTarget) hud.use.innerHTML = `Click or press <b>E</b> to open <b>${lookTarget.heading}</b>`;

      // HUD
      hud.cursor.classList.toggle('over', !!lookTarget);
      const secs = Math.max(0, Math.ceil(roundLeft));
      hud.time.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      drawRadar();

      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(vmScene, camera);
    }

    /* ----------------------------------------------------- enter/exit */
    function enter() {
      root.classList.add('in-game');
      el.hidden = false;
      resize();
      last = 0;
      renderer.setAnimationLoop(frame);
      if (!motdShown) {
        motdShown = true;
        openWindow(buildMotd());
        setTimeout(() => {
          chat('<span class="ct">Recruiter</span> is joining the Counter-Terrorist force');
          chat('* Find the panels and press E to read them');
        }, 300);
      } else {
        showPause();
      }
    }
    function exit(target) {
      if (modal) closeModalSilently();
      state = 'off';
      if (document.pointerLockElement) document.exitPointerLock();
      renderer.setAnimationLoop(null);
      el.hidden = true;
      pauseEl.hidden = true;
      root.classList.remove('in-game');
      const t = target && document.querySelector(target);
      if (t) t.scrollIntoView();
    }
    function closeModalSilently() {
      if (modal.parent) modal.parent.insertBefore(modal.el, modal.next); else modal.el.remove();
      modal = null; modalEl.hidden = true; hud.root.hidden = false;
    }

    return { enter, exit };
  }
})();
