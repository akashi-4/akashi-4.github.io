/* The CV as a small Counter-Strike game, loaded on demand from the main menu ("New Game").
   Maps live in maps/*.js: cs_office_cv (default), where every CV section is a locked workstation
   your MacBook hacks, and de_dust2_cv (bonus), with the sections as panels on the walls. */
(() => {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
  const MAPS = ['cs_office_cv', 'de_dust2_cv'];
  const mapFile = { cs_office_cv: 'office', de_dust2_cv: 'dust' };
  const loadMap = name => import(new URL(`maps/${mapFile[name]}.js`, SCRIPT_URL).href);
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
    loaderServer.textContent = `${MAPS[0]} · 1/32 players`;
    say(0);
    showLoader();
    try {
      await wait(350); if (aborted) return; say(1);
      const [THREE, map] = await Promise.all([import(THREE_URL), loadMap(MAPS[0]), wait(400)]);
      if (aborted) return; say(2);
      await Promise.all([document.fonts.load('20px ArialPixel', 'AãÃé·—→').catch(() => {}), wait(300)]);
      if (aborted) return; say(3);
      await wait(300);
      if (aborted) return; say(4);
      const assets = await loadLocalAssets(THREE);
      game = createGame(THREE, assets, map);
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

  // Optional: textures extracted from your own CS 1.6 install into assets-local/ (git-ignored,
  // never published). They're only picked up when that folder is served, e.g. by the local dev server.
  async function loadLocalAssets(THREE) {
    if (location.protocol === 'file:') return null;
    try {
      const res = await fetch('assets-local/manifest.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const manifest = await res.json();
      const loader = new THREE.TextureLoader();
      const out = {};
      const loadSet = (set, into) => Promise.all(Object.entries(set).map(async ([key, t]) => {
        const tex = await loader.loadAsync('assets-local/' + t.file.split('/').map(encodeURIComponent).join('/'));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        into[key] = { tex, w: t.w, h: t.h };
      }));
      await loadSet(manifest.textures, out);
      // cs_office textures, by the role they play in maps/office.js
      if (manifest.office) {
        out.office = {};
        await loadSet(manifest.office, out.office).catch(e => { console.warn('office textures not loaded', e); out.office = null; });
      }
      // real CS 1.6 view-model hands (exported from your install), with where the held object sits
      if (manifest.hands) {
        const loadHand = async file => {
          const json = await (await fetch('assets-local/' + file, { cache: 'no-store' })).json();
          const dir = 'assets-local/' + file.slice(0, file.lastIndexOf('/') + 1);
          json.groups = await Promise.all(json.groups.map(async g => {
            const tex = await loader.loadAsync(dir + g.texture);
            tex.colorSpace = THREE.SRGBColorSpace;
            return { ...g, tex };
          }));
          return json;
        };
        const h = manifest.hands;
        out.hands = {
          laptop: await loadHand(h.laptop), spin: await loadHand(h.spin),
          laptopGrip: h.laptopGrip, spinTip: h.spinTip,
        };
      }
      // the MacBook view model animated in Blender (hands + laptop, clips laptop_idle / _walk / _enter)
      if (manifest.laptopModel) {
        try {
          const { GLTFLoader } = await import(THREE_URL.replace('build/three.module.js', 'examples/jsm/loaders/GLTFLoader.js'));
          out.laptopModel = await new GLTFLoader().loadAsync('assets-local/' + manifest.laptopModel);
        } catch (e) {
          console.warn('laptop model not loaded', e);
        }
      }
      return out;
    } catch (e) {
      return null;
    }
  }
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
  function createGame(THREE, assets = null, firstMap) {
    const V3 = THREE.Vector3;

    /* ------------------------------------------------------------ DOM */
    const el = document.createElement('div');
    el.className = 'game';
    el.hidden = true;
    el.innerHTML = `
      <div class="hud" id="hud">
        <canvas class="radar" width="300" height="300"></canvas>
        <div class="top-right"><span class="map-name" id="h-map"></span> · <span id="h-verb">hacked</span> <span id="h-read">0/10</span><br>TAB: files on your MacBook</div>
        <div class="cursor" aria-hidden="true"></div>
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
          <div class="hud-num" title="Objectives"><span id="h-count">0</span><span class="sep">|</span><span id="h-total">10</span><svg viewBox="0 0 12 19"><path d="M0 0v16l4-4 3 6 2.5-1.2-3-6H12z"/></svg></div>
        </div>
      </div>
      <div class="game-pause" id="g-pause" hidden>
        <h2 class="title" id="g-title"></h2>
        <nav class="main-menu" aria-label="Game menu">
          <a href="#" data-act="resume">Resume Game</a>
          <a href="#" data-act="files">MacBook files</a>
          <a href="#" data-act="map" id="g-map">Change map</a>
          <a href="#" data-act="contact">Contact</a>
          <a href="#" data-act="motd">Controls</a>
          <a href="#desktop" data-act="classic">Classic View</a>
          <div class="gap"></div>
          <a href="#top" data-act="quit">Quit</a>
        </nav>
      </div>
      <div class="enter-fx" id="g-fx" hidden></div>
      <div class="game-modal" id="g-modal" hidden>
        <div class="mac-frame">
          <div class="mac-bar" aria-hidden="true"><span id="g-mac-path"></span><span id="g-mac-clock"></span></div>
          <div class="game-modal-inner" id="g-modal-inner"></div>
        </div>
      </div>`;
    document.body.appendChild(el);

    const hud = {
      read: $('#h-read', el), chat: $('#h-chat', el), use: $('#h-use', el), center: $('#h-center', el),
      money: $('#h-money', el), delta: $('#h-delta', el), time: $('#h-time', el),
      count: $('#h-count', el), total: $('#h-total', el), map: $('#h-map', el), verb: $('#h-verb', el),
      cursor: $('.cursor', el), radar: $('.radar', el), root: $('#hud', el),
    };
    const pauseEl = $('#g-pause', el);
    const modalEl = $('#g-modal', el);
    const modalInner = $('#g-modal-inner', el);
    const macPath = $('#g-mac-path', el);
    const macClock = $('#g-mac-clock', el);
    const fxEl = $('#g-fx', el);

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
    let mapGroup = new THREE.Group();   // everything the current map built; cleared on a map change
    scene.add(mapGroup);
    let mapTextures = [];               // canvas textures the current map made, disposed with it
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
      mapTextures.push(t);
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
    /* ------------------------------------------------------ materials */
    const mat = (map, scale, extra = {}) => {
      const m = new THREE.MeshLambertMaterial({ map, ...extra });
      m.userData.scale = scale;
      return m;
    };
    // Local textures from your CS 1.6 install: GoldSrc maps 1 texel to 1 unit (~1 inch),
    // so a 128x240 wall texture covers 3.25 x 6.1 m.
    const UNIT = 0.0254;
    const real = a => { a.tex.anisotropy = maxAniso; return mat(a.tex, [a.w * UNIT, a.h * UNIT]); };

    /* ------------------------------------------------------- geometry */
    const colliders = [];   // AABBs the player collides with
    const solids = [];      // meshes bullets can hit

    // Give box faces UVs from world position so textures tile at a fixed size. With one material
    // per face (BoxGeometry: 4 vertices per face, +x -x +y -y +z -z), each face uses its own scale,
    // and faces whose material has no scale keep the whole image.
    function worldUV(geo, scale) {
      const faceScale = Array.isArray(scale) && typeof scale[0] === 'object' ? scale : null;
      const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const sc = faceScale ? faceScale[Math.floor(i / 4)].userData.scale : scale;
        if (!sc) continue;
        const [su, sv] = Array.isArray(sc) ? sc : [sc, sc];
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let u, v;
        if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
        uv.setXY(i, u / su, v / sv);
      }
      uv.needsUpdate = true;
    }
    function box(x1, x2, y1, y2, z1, z2, material, { collide = true, shoot = true, shadow = true } = {}) {
      const geo = new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1);
      geo.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      const scale = Array.isArray(material) ? material : material.userData.scale;
      if (scale) worldUV(geo, scale);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      mapGroup.add(mesh);
      if (collide) colliders.push(mesh.userData.collider = { minX: x1, maxX: x2, minY: y1, maxY: y2, minZ: z1, maxZ: z2 });
      if (shoot) solids.push(mesh);
      return mesh;
    }
    function decal(texture, w, h, pos, rotY) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.copy(pos); m.rotation.y = rotY; m.receiveShadow = true;
      mapGroup.add(m);
      return m;
    }

    /* ------------------------------------------------ files & progress */
    // Every CV section is a file you can pull onto the MacBook. `key` is what progress stores,
    // so it carries over between maps (dust's single Skills panel grants all six skill files).
    const SKILLS = [
      { id: 'frontend', heading: 'Frontend', host: 'frontend-dev-01' },
      { id: 'backend', heading: 'Backend', host: 'backend-dev-02' },
      { id: 'ai', heading: 'AI / ML', host: 'ml-lab-03' },
      { id: 'tools', heading: 'Tools & DevOps', host: 'devops-04' },
      { id: 'languages', heading: 'Languages', host: 'intl-desk-05' },
      { id: 'soft', heading: 'Soft skills', host: 'people-ops-06' },
    ];
    const FILES = [
      { key: 'about', section: 'about', heading: 'About', file: 'about.txt' },
      { key: 'career', section: 'career', heading: 'Career', file: 'career.log' },
      ...SKILLS.map(s => ({ key: 'skills:' + s.id, section: 'skills', category: s.id, heading: s.heading, file: `skills/${s.id}.dat` })),
      { key: 'work', section: 'work', heading: 'Work @ TUU', file: 'projects/work.md' },
      { key: 'personal', section: 'personal', heading: 'Personal & University', file: 'projects/personal.md' },
      { key: 'contact', section: 'contact', heading: 'Contact', file: 'contact.vcf' },
    ];
    const fileFor = key => FILES.find(f => f.key === key);
    const read = new Set();
    const isDone = d => d.keys.every(k => read.has(k));

    /* ------------------------------------------------------------ maps */
    let map = null;          // what the current map's build() returned, plus its name and terminals
    const panels = [];       // meshes you aim at to use a terminal (userData.panel = its def)
    const screens = [];      // defs with a live canvas screen, redrawn when their state changes
    let hackDef = null;      // the terminal being hacked right now
    const objectives = () => map.terminals.filter(d => !d.finale);
    const doneCount = () => objectives().filter(isDone).length;

    // Register something you can use. `hit` is the mesh the crosshair has to be on.
    function terminal(def, hit) {
      def.keys = def.keys || [def.id];
      hit.userData.panel = def;
      def.hit = hit;
      panels.push(hit);
      map.terminals.push(def);
      return def;
    }
    // A monitor screen drawn by the game: lock screen, intrusion, access granted, or a door keypad.
    function terminalScreen(def, w, h) {
      const W = 512, H = Math.round(512 * h / w);
      const [c, g] = makeCanvas(W, H);
      const t = toTexture(c, false);
      def.scr = { g, t, W, H, key: '' };
      def.keys = def.keys || [def.id];
      screens.push(def);
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    }
    const hhmm = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
    function drawTerminal(d) {
      const { g, t, W, H } = d.scr;
      const state = d.kind === 'keypad' ? (d.locked ? 'deny' : 'ok')
        : d.locked ? 'deny' : isDone(d) ? 'granted' : hackDef === d ? 'hacking' : 'locked';
      const tick = state === 'hacking' ? Math.floor(clock * 6) : state === 'locked' ? hhmm() : state === 'deny' ? doneCount() : '';
      const key = state + tick;
      if (key === d.scr.key) return;
      d.scr.key = key;
      const s = W / 512;
      g.setTransform(s, 0, 0, s, 0, 0);
      const w = 512, h = H / s;
      g.textBaseline = 'middle'; g.textAlign = 'center';
      if (state === 'locked') {
        // Windows 2000 "Computer Locked", like every desk in the real cs_office
        g.fillStyle = '#3a6ea5'; g.fillRect(0, 0, w, h);
        const bw = 420, bh = Math.min(250, h - 40), bx = (w - bw) / 2, by = (h - bh) / 2;
        g.fillStyle = '#d4d0c8'; g.fillRect(bx, by, bw, bh);
        g.fillStyle = '#fff'; g.fillRect(bx, by, bw, 2); g.fillRect(bx, by, 2, bh);
        g.fillStyle = '#404040'; g.fillRect(bx, by + bh - 2, bw, 2); g.fillRect(bx + bw - 2, by, 2, bh);
        const grd = g.createLinearGradient(bx, 0, bx + bw, 0);
        grd.addColorStop(0, '#0a246a'); grd.addColorStop(1, '#a6caf0');
        g.fillStyle = grd; g.fillRect(bx + 4, by + 4, bw - 8, 34);
        g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'bold 21px Tahoma, Arial, sans-serif';
        g.fillText('Computer Locked', bx + 14, by + 22);
        // padlock
        g.fillStyle = '#c8a200'; g.fillRect(bx + 26, by + 82, 44, 36);
        g.strokeStyle = '#6b6b6b'; g.lineWidth = 7; g.beginPath(); g.arc(bx + 48, by + 82, 14, Math.PI, 0); g.stroke();
        g.fillStyle = '#000'; g.font = '19px Tahoma, Arial, sans-serif';
        g.fillText('This computer is locked.', bx + 90, by + 70);
        g.font = 'bold 24px Tahoma, Arial, sans-serif'; g.fillText(d.host, bx + 90, by + 104);
        g.font = '19px Tahoma, Arial, sans-serif'; g.fillText('Password:', bx + 26, by + bh - 50);
        g.fillStyle = '#fff'; g.fillRect(bx + 130, by + bh - 66, bw - 156, 32);
        g.fillStyle = '#000'; g.font = '22px Tahoma, Arial, sans-serif'; g.fillText('●●●●●●●', bx + 138, by + bh - 50);
        g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = '18px Tahoma, Arial, sans-serif';
        g.fillText(tick, w - 12, h - 16);
      } else if (state === 'hacking') {
        g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
        g.textAlign = 'left'; g.font = '15px monospace'; g.fillStyle = 'rgba(120,200,120,.55)';
        for (let y = 14, i = tick * 7; y < h; y += 19, i += 3) {
          let line = '';
          for (let k = 0; k < 7; k++) line += ((i * 2654435761 + k * 40503 + y) >>> 0 & 0xffff).toString(16).padStart(4, '0') + ' ';
          g.fillText(line, 14, y);
        }
        if (tick % 2) {
          g.fillStyle = 'rgba(200,0,0,.85)'; g.fillRect(0, h / 2 - 40, w, 80);
          g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 36px Tahoma, Arial, sans-serif';
          g.fillText('INTRUSION DETECTED', w / 2, h / 2);
        }
      } else if (state === 'granted') {
        g.fillStyle = '#04120a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#5ef07a'; g.font = 'bold 44px Tahoma, Arial, sans-serif';
        g.fillText('ACCESS GRANTED', w / 2, h * 0.34);
        g.fillStyle = '#e8f0e8'; g.font = '30px Tahoma, Arial, sans-serif';
        g.fillText(d.heading, w / 2, h * 0.56);
        g.fillStyle = '#8fae94'; g.font = '20px monospace';
        g.fillText(`${d.file} → MacBook`, w / 2, h * 0.75);
      } else if (state === 'deny') {
        g.fillStyle = '#1c0404'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ff4a3d'; g.font = 'bold 42px Tahoma, Arial, sans-serif';
        g.fillText('ACCESS DENIED', w / 2, h * 0.3);
        g.fillStyle = '#f2dada'; g.font = '28px Tahoma, Arial, sans-serif';
        g.fillText(d.heading, w / 2, h * 0.53);
        const tot = objectives().length;
        g.fillStyle = '#d99'; g.font = '22px Tahoma, Arial, sans-serif';
        g.fillText(`${tick}/${tot} workstations hacked`, w / 2, h * 0.74);
      } else {
        g.fillStyle = '#04160a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#5ef07a'; g.font = 'bold 42px Tahoma, Arial, sans-serif';
        g.fillText('ACCESS OK', w / 2, h * 0.4);
        g.fillStyle = '#e8f0e8'; g.font = '26px Tahoma, Arial, sans-serif';
        g.fillText('Door unlocked', w / 2, h * 0.62);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, y, W, 1); }
      t.needsUpdate = true;
    }

    function disposeMap() {
      scene.remove(mapGroup);
      mapGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) for (const m of [].concat(o.material)) m.dispose();
      });
      for (const t of mapTextures) t.dispose();
      if (map && map.dispose) map.dispose();
    }
    function applyMap(mod) {
      if (map) disposeMap();
      mapGroup = new THREE.Group();
      scene.add(mapGroup);
      mapTextures = [];
      colliders.length = solids.length = panels.length = screens.length = 0;
      seed = 1337;
      map = { name: mod.name, terminals: [] };
      const ctx = {
        THREE, V3, maxAniso, assets, colliders, solids, SKILLS, FILES, fileFor,
        add: (...o) => mapGroup.add(...o), box, decal, mat, real, makeCanvas, toTexture, rnd, rr, speckle, blotches,
        terminal, screen: terminalScreen,
      };
      Object.assign(map, mod.build(ctx));
      mapGroup.updateMatrixWorld(true);
      const p = new V3();
      for (const d of map.terminals) if (!d.at) { d.hit.getWorldPosition(p); d.at = [p.x, p.y, p.z]; }
      scene.fog = map.fog || null;
      const L = map.vmLight;
      vmHemi.color.set(L.sky); vmHemi.groundColor.set(L.ground); vmHemi.intensity = L.hemi;
      vmSun.color.set(L.sun); vmSun.intensity = L.sunI;
      const s = map.spawn;
      P.pos.set(s.x, s.y, s.z); P.vel.set(0, 0, 0); P.yaw = s.yaw; P.pitch = 0;
      anim = null; lapInsp = null; hackDef = null; screenKey = '';
      if (map.unlock && doneCount() === objectives().length) map.unlock(true);
      hud.map.textContent = map.name;
      hud.verb.textContent = map.verb === 'hack' ? 'hacked' : 'read';
      $('#g-title', el).textContent = map.name;
      $('#g-map', el).textContent = 'Play ' + MAPS.find(n => n !== map.name);
      updateProgress();
    }
    function updateProgress() {
      const n = doneCount(), tot = objectives().length;
      hud.read.textContent = `${n}/${tot}`;
      hud.count.textContent = n;
      hud.total.textContent = tot;
    }
    let switching = false;
    async function switchMap(name) {
      if (switching) return;
      switching = true;
      centerMsg(`Loading ${name}...`, 30);
      try {
        const mod = await loadMap(name);
        applyMap(mod);
        centerMsg(name, 2);
        chat(`* Map changed to <span class="g">${name}</span>`);
      } catch (e) {
        console.error(e);
        centerMsg('Could not load ' + name, 3);
      } finally {
        switching = false;
      }
    }

    /* ----------------------------------------------------- view model */
    // The MacBook in your hands, drawn in its own pass so it never clips into walls.
    const vmScene = new THREE.Scene();
    const vmHemi = new THREE.HemisphereLight(0xd6e4f5, 0xa5824f, 1.3);   // each map sets its own mood
    vmScene.add(vmHemi);
    const vmSun = new THREE.DirectionalLight(0xfff0d0, 1.8);
    vmSun.position.set(-1, 2, 1);
    vmScene.add(vmSun);
    const vmRoot = new THREE.Group();
    vmScene.add(vmRoot);

    /* --------------------------------------------------------- laptop */
    // An open silver laptop held in one hand. The screen stays black until you're near a
    // panel; pressing E "enters" it. No logo on the lid.
    const LAP_W = 0.15, LAP_D = 0.105, BASE_T = 0.007, LID_H = 0.1, LID_T = 0.005;
    const lapRoot = new THREE.Group();   // posed every frame; its origin is the centre of the base
    const lapSpin = new THREE.Group();   // spins on a fingertip during inspect
    const lapBody = new THREE.Group();   // hinge at local z = 0
    const lidPivot = new THREE.Group();
    lapRoot.rotation.order = 'YXZ';
    lapRoot.add(lapSpin); lapSpin.add(lapBody); lapBody.add(lidPivot);
    lapBody.position.z = -LAP_D / 2;
    lidPivot.position.y = BASE_T;
    vmRoot.add(lapRoot);
    const lapHand = new THREE.Group();   // holding it from below
    const lapFinger = new THREE.Group(); // balancing it during inspect
    lapRoot.add(lapHand, lapFinger);
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512; screenCanvas.height = 340;
    const screenCtx = screenCanvas.getContext('2d');
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    {
      const alu = new THREE.MeshLambertMaterial({ color: 0xc4c8cf });
      const bezel = new THREE.MeshBasicMaterial({ color: 0x0b0b0c });
      const glove = new THREE.MeshLambertMaterial({ color: 0x1b1c1f });
      const sleeve = new THREE.MeshLambertMaterial({ color: 0x27304a });
      // keyboard deck
      const [kc, kg] = makeCanvas(256, 180);
      kg.fillStyle = '#c9cdd4'; kg.fillRect(0, 0, 256, 180);
      kg.fillStyle = '#26272a'; kg.fillRect(14, 10, 228, 92);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++) {
        kg.fillStyle = r === 5 && c > 3 && c < 10 ? '#3b3c40' : '#3f4044';
        if (r === 5 && c > 4 && c < 10) continue;
        kg.fillRect(17 + c * 16, 13 + r * 15, 14, 13);
      }
      kg.fillStyle = '#3b3c40'; kg.fillRect(17 + 5 * 16, 13 + 5 * 15, 5 * 16 - 2, 13);   // space bar
      kg.fillStyle = '#b7bbc3'; kg.fillRect(78, 112, 100, 60);                       // trackpad
      kg.strokeStyle = '#a3a7ae'; kg.strokeRect(78.5, 112.5, 99, 59);
      const deck = new THREE.Mesh(new THREE.PlaneGeometry(LAP_W * 0.96, LAP_D * 0.94),
        new THREE.MeshLambertMaterial({ map: toTexture(kc, false) }));
      deck.rotation.x = -Math.PI / 2; deck.position.set(0, BASE_T + 0.0004, LAP_D / 2);
      const base = new THREE.Mesh(new THREE.BoxGeometry(LAP_W, BASE_T, LAP_D), alu);
      base.position.set(0, BASE_T / 2, LAP_D / 2);
      lapBody.add(base, deck);
      // lid: aluminium back, black bezel, screen
      const lid = new THREE.Mesh(new THREE.BoxGeometry(LAP_W, LID_H, LID_T), alu);
      lid.position.set(0, LID_H / 2, -LID_T / 2);
      const bez = new THREE.Mesh(new THREE.PlaneGeometry(LAP_W * 0.985, LID_H * 0.98), bezel);
      bez.position.set(0, LID_H / 2, 0.0003);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(LAP_W * 0.9, LID_H * 0.86),
        new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
      scr.position.set(0, LID_H / 2 + 0.002, 0.0006);
      lidPivot.add(lid, bez, scr);
      // gloved hand grabbing the right edge like a clamp: palm underneath, glove wrapped
      // around the edge, thumb resting on the palm rest. Rounded shapes, no fingers.
      const blob = (grp, sx, sy, sz, x, y, z, ry = 0) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), glove);
        mesh.scale.set(sx, sy, sz); mesh.position.set(x, y, z); mesh.rotation.y = ry; grp.add(mesh); return mesh;
      };
      const EDGE = LAP_W / 2;
      blob(lapHand, 0.028, 0.013, 0.046, EDGE - 0.014, -0.011, 0.012);                 // palm under the base
      blob(lapHand, 0.011, 0.016, 0.042, EDGE + 0.004, -0.001, 0.008);                 // wrapped around the edge
      blob(lapHand, 0.009, 0.0055, 0.03, EDGE - 0.016, BASE_T + 0.004, 0.034, -0.35);  // thumb on top
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 14), glove);
      wrist.rotation.x = Math.PI / 2 - 0.5; wrist.position.set(EDGE - 0.002, -0.03, 0.058); lapHand.add(wrist);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.34, 10), sleeve);
      arm.rotation.x = Math.PI / 2 - 0.5; arm.position.set(EDGE, -0.1, 0.21); lapHand.add(arm);
      // inspect: a fist with one gloved finger up under the centre of the base
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0065, 0.04, 10), glove);
      finger.position.set(0, -0.02, 0); lapFinger.add(finger);
      blob(lapFinger, 0.024, 0.02, 0.026, 0.004, -0.05, 0.004);                        // fist
      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.34, 10), sleeve);
      arm2.rotation.x = 0.12; arm2.position.set(0.012, -0.23, 0.03); lapFinger.add(arm2);
      lapFinger.visible = false;
    }

    // What the laptop screen shows: black when idle, the target when you're close, and while you
    // jack in, a terminal cracking the workstation (or just connecting, if it's already yours).
    let screenKey = '';
    function drawScreen(mode, def, progress = 1, fresh = false) {
      if (mode === 'connect' && !def) return;   // keep showing the finished connection
      const key = mode + (def ? def.id : '') + (mode === 'connect' ? Math.floor(progress * 24) + fresh : '') + (map ? map.name : '');
      if (key === screenKey) return;
      screenKey = key;
      const g = screenCtx, W = 512, H = 340;
      const hack = map && map.verb === 'hack';
      if (mode === 'off') {
        g.fillStyle = '#050506'; g.fillRect(0, 0, W, H);
        const grd = g.createLinearGradient(0, 0, W, H);
        grd.addColorStop(0, 'rgba(255,255,255,.07)'); grd.addColorStop(.45, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = '#0d120c'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#4a5942'; g.fillRect(0, 0, W, 34);
        g.font = '20px ArialPixel, monospace'; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillStyle = '#fff'; g.fillText('recruiter@' + (map ? map.name : ''), 14, 18);
        if (mode === 'wake') {
          const open = !hack || isDone(def);
          g.fillStyle = '#c4b550'; g.font = '34px ArialPixel, monospace';
          g.fillText(hack ? def.host : def.heading, 24, 110);
          g.fillStyle = '#a0aa95'; g.font = '22px ArialPixel, monospace';
          g.fillText(hack ? (open ? def.heading + ' · yours' : 'locked · ' + def.heading) : def.title, 24, 156);
          g.fillStyle = '#dedfd6'; g.fillText(!hack ? '[E]  connect' : open ? '[E]  open ' + def.file : '[E]  hack', 24, 260);
        } else {
          const lines = hack && fresh
            ? [`$ ssh recruiter@${def.host}`, 'Password: ********', 'cracking hash...', 'ACCESS GRANTED', `$ scp ${def.file} ~/`, 'Download complete.']
            : hack ? [`$ ssh recruiter@${def.host}`, 'Key accepted.', `$ open ~/${def.file}`]
            : [`$ ssh ${def.id}.panel`, 'Connecting to', `  ${def.heading}...`, 'Handshake OK', 'Connected.'];
          const shown = Math.max(1, Math.ceil(progress * lines.length));
          const lh = lines.length > 5 ? 40 : 44;
          g.font = '24px ArialPixel, monospace';
          lines.slice(0, shown).forEach((t, i) => {
            const ok = /GRANTED|complete|Connected|accepted/.test(t);
            g.fillStyle = ok ? '#7fe07f' : (t.startsWith('$') ? '#c4b550' : '#dedfd6');
            g.fillText(t, 20, 70 + i * lh);
          });
          // the cracking line gets a progress bar while it's the last one shown
          if (hack && fresh && shown === 3) {
            const f = progress * lines.length - 2;
            g.strokeStyle = '#dedfd6'; g.strokeRect(250, 70 + 2 * lh - 10, 230, 20);
            g.fillStyle = '#7fe07f'; g.fillRect(253, 70 + 2 * lh - 7, 224 * Math.min(1, f), 14);
          }
          if (progress < 1) { g.fillStyle = '#dedfd6'; g.fillRect(20, 70 + shown * lh - 12, 12, 24); }
        }
        for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, W, 1); }
      }
      screenTex.needsUpdate = true;
    }
    drawScreen('off');

    // Poses (position/rotation of lapRoot, lid angle, spin), blended by the animations
    const HOLD = { x: 0.11, y: -0.19, z: -0.36, rx: 0.42, ry: -0.42, rz: 0.1, lid: -0.28, spin: 0 };
    const ENTER = d => ({ x: 0, y: -(BASE_T + LID_H / 2), z: -d + LAP_D / 2, rx: 0, ry: 0, rz: 0, lid: 0, spin: 0 });
    const BALANCE = { x: 0, y: -0.035, z: -0.4, rx: 0.2, ry: 0, rz: 0, lid: Math.PI / 2 - 0.03, spin: 0 };
    const lerpPose = (a, b, k) => {
      const o = {};
      for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k;
      return o;
    };
    const ease = k => k * k * (3 - 2 * k);
    const easeIn = k => k * k;
    const easeOut = k => 1 - (1 - k) * (1 - k);

    /* ------------------------------------- real CS hands (local assets only) */
    // When your own CS 1.6 view-model hands are available, the laptop sits in the C4 grip
    // and the inspect spin balances on the C4 "press button" finger.
    const realHands = assets && assets.hands ? assets.hands : null;
    let laptopHands = null, spinHand = null;
    const SPIN_SHIFT = new V3();
    function handMesh(json) {
      const grp = new THREE.Group();
      for (const g of json.groups) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(g.position, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.normal, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
        grp.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: g.tex, side: THREE.DoubleSide })));
      }
      return grp;
    }
    if (realHands) {
      // laptop: base where the C4 was, keyboard up, held by both gloves
      laptopHands = handMesh(realHands.laptop);
      vmRoot.add(laptopHands);
      const lg = realHands.laptopGrip;
      const basis = new THREE.Matrix4().makeBasis(new V3(...lg.x).normalize(), new V3(...lg.y).normalize(), new V3(...lg.z).normalize());
      const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(basis), 'YXZ');
      Object.assign(HOLD, { x: lg.pos[0], y: lg.pos[1], z: lg.pos[2], rx: e.x, ry: e.y, rz: e.z });
      // inspect: the pointing hand, moved so its fingertip is centred at eye level
      spinHand = handMesh(realHands.spin);
      spinHand.visible = false;
      vmRoot.add(spinHand);
      const tip = new V3(...realHands.spinTip), target = new V3(0, -0.03, -0.36);
      SPIN_SHIFT.copy(target).sub(tip);
      Object.assign(BALANCE, { x: target.x, y: target.y + 0.002, z: target.z, rx: 0.15, ry: 0, rz: 0 });
      lapHand.visible = false;
    }

    /* ----------------------------- MacBook view model from Blender (local assets only) */
    // Hands and laptop are one skinned model posed from the camera, so it sits at the view-model
    // origin. Clip times are set by hand each frame: idle/walk blend by speed (walk synced to the
    // footstep bob) and enter plays forwards into a panel and backwards on the way out.
    const lapGltf = assets && assets.laptopModel ? assets.laptopModel : null;
    let lapModel = null, lapMixer = null;
    const lapClips = {};
    if (lapGltf) {
      lapModel = lapGltf.scene;
      lapModel.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false;   // skinned: the bind-pose bounds don't follow the animation
        if (o.name === 'Screen') {
          screenTex.flipY = false;   // glTF UVs start top-left
          o.material = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
          return;
        }
        const m = o.material;      // plain Lambert like the rest of the view model (no env map here)
        o.material = new THREE.MeshLambertMaterial({
          map: m.map, color: m.color, transparent: m.transparent, opacity: m.opacity,
          alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite,
        });
      });
      lapModel.visible = false;
      vmRoot.add(lapModel);
      lapMixer = new THREE.AnimationMixer(lapModel);
      for (const clip of lapGltf.animations) {
        const action = lapMixer.clipAction(clip);
        action.play();
        action.setEffectiveWeight(0);
        lapClips[clip.name.replace('laptop_', '')] = { action, dur: clip.duration };
      }
      lapRoot.visible = false;
      if (laptopHands) laptopHands.visible = false;
    }
    const lapReady = !!(lapModel && lapClips.idle && lapClips.walk && lapClips.enter);
    const lapInspReady = lapReady && !!(lapClips.inspect && lapClips.inspect_in && lapClips.inspect_out);
    let lapInsp = null;          // F with the MacBook: { phase: 'in' | 'spin' | 'out', t, held }

    /* --------------------------------------------------------- player */
    const R = 0.4, STAND = 1.83, DUCK = 1.15, EYE_STAND = 1.63, EYE_DUCK = 0.98;
    const STEP = 0.46, GRAVITY = 20.3, JUMP = 6.8;
    const MAXSPEED = 6.35, WALK = 0.52, DUCKSPEED = 0.34;
    const ACCEL = 5, AIRACCEL = 10, AIRCAP = 0.76, FRICTION = 4, STOPSPEED = 2.54;
    const P = {   // the map puts you at its spawn
      pos: new V3(), vel: new V3(), yaw: 0, pitch: 0,
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

    /* ---------------------------------------------------------- click */
    const ray = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    function click() {
      Sound.click();
      hud.cursor.classList.add('down');
      setTimeout(() => hud.cursor.classList.remove('down'), 90);
      if (lookTarget) usePanel(lookTarget);
    }

    /* ------------------------------------------------------ animations */
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let anim = null;             // { type: 'enter' | 'exit' | 'inspect', t, dur, def, fresh }
    function startAnim(type, def) {
      const durs = { enter: lapReady ? lapClips.enter.dur : 1.15, exit: 0.6, inspect: 4.2 };
      anim = { type, t: 0, dur: reducedMotion ? Math.min(durs[type], 0.35) : durs[type], def };
    }
    function usePanel(def) {
      if ((anim && anim.type === 'enter') || lapInsp || def.locked) return;
      state = 'anim';
      hud.use.hidden = true;
      fxEl.hidden = false; fxEl.style.opacity = 0;
      Sound.use();
      startAnim('enter', def);
      anim.fresh = map.verb === 'hack' && !isDone(def);
      if (anim.fresh) hackDef = def;
    }
    function inspect() {
      if (anim) return;
      if (lapReady) {
        // throw it up onto the middle finger; it keeps spinning while F is held
        if (lapInspReady && !lapInsp) lapInsp = { phase: 'in', t: 0, held: true };
        return;
      }
      startAnim('inspect');
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
    const radarG = hud.radar.getContext('2d');
    function drawRadar() {
      const g = radarG, S = 300, R = map.radar, k = R.scale;
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, 7); g.clip();
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, S, S);
      g.translate(S / 2, S / 2); g.rotate(P.yaw); g.scale(k, k); g.translate(-P.pos.x, -P.pos.z);
      g.fillStyle = R.color;
      for (const [x, z, w, d] of R.areas) g.fillRect(x, z, w, d);
      const dot = R.dot || 1.8;
      for (const d of map.terminals) {
        g.fillStyle = d.locked ? 'rgba(230,60,50,.95)' : isDone(d) ? 'rgba(90,230,90,.95)' : 'rgba(255,190,40,.95)';
        g.fillRect(d.at[0] - dot / 2, d.at[2] - dot / 2, dot, dot);
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
      const hack = map.verb === 'hack';
      const w = document.createElement('div');
      w.className = 'cs-dialog window motd';
      w.style.maxWidth = '520px';
      w.innerHTML = `
        <div class="heading"><div class="wrapper"><div class="icon"></div><div class="text">Message of the Day</div></div>
          <a class="cs-btn close" href="#top" aria-label="Close"></a></div>
        <div class="content">
          <h2>Welcome to ${map.name}</h2>
          <p style="margin-top:8px">${map.motd}</p>
          <dl class="keys">
            <dt>W A S D</dt><dd>Move</dd>
            <dt>Mouse</dt><dd>Look</dd>
            <dt>Space</dt><dd>Jump</dd>
            <dt>C</dt><dd>Crouch (crouch-jump onto crates)</dd>
            <dt>Shift</dt><dd>Walk quietly</dd>
            <dt>E / click</dt><dd>${hack ? 'Hack a workstation' : 'Connect to a panel'}</dd>
            <dt>F</dt><dd>Inspect (hold to keep it spinning)</dd>
            <dt>Tab</dt><dd>Files on your MacBook</dd>
            <dt>Esc</dt><dd>Menu (change map, contact)</dd>
          </dl>
        </div>
        <div class="footer-btns"><a class="cs-btn" href="#top">OK</a></div>`;
      return w;
    }
    // Tab: what you've pulled onto the MacBook so far. Click a file to read it again.
    function buildFiles() {
      const have = FILES.filter(f => read.has(f.key)).length;
      const w = document.createElement('div');
      w.className = 'cs-dialog window files';
      w.style.maxWidth = '620px';
      const rows = FILES.map(f => {
        const got = read.has(f.key);
        const where = map.terminals.find(d => d.keys.includes(f.key));
        const hint = !where ? 'not on this map' : where.locked ? 'server room' : map.verb === 'hack' ? 'locked · ' + where.host : where.heading;
        return got
          ? `<li><button type="button" class="file-row" data-file="${f.key}"><span class="name">${f.file}</span><span class="what">${f.heading}</span></button></li>`
          : `<li><div class="file-row missing"><span class="name">???</span><span class="what">${hint}</span></div></li>`;
      }).join('');
      w.innerHTML = `
        <div class="heading"><div class="wrapper"><div class="icon"></div><div class="text">Files — recruiter's MacBook</div></div>
          <a class="cs-btn close" href="#top" aria-label="Close"></a></div>
        <div class="content">
          <p class="files-sum"><span class="accent">${have}/${FILES.length}</span> files downloaded · ${map.name}: ${doneCount()}/${objectives().length} ${map.verb === 'hack' ? 'hacked' : 'read'}</p>
          <ul class="file-list">${rows}</ul>
        </div>
        <div class="footer-btns"><a class="cs-btn" href="#top">OK</a></div>`;
      return w;
    }
    const sectionWin = {
      about: () => aboutWin || (aboutWin = buildAbout()),
      career: () => $('#career'),
      work: () => $('#projects'),
      personal: () => $('#personal'),
      skills: () => $('#skills'),
      contact: () => $('#contact'),
    };
    // A skill desk only holds its own category: hide the other blocks of the Skills window.
    function focusSkills(win, f) {
      const cat = f && f.category;
      win.classList.toggle('one-category', !!cat);
      for (const b of win.querySelectorAll('[data-category]')) b.classList.toggle('cat-hidden', !!cat && b.dataset.category !== cat);
      for (const i of win.querySelectorAll('.inset')) i.classList.toggle('cat-hidden', !!cat && !i.querySelector(`[data-category="${cat}"]`));
      const t = $('.heading .text', win);
      if (t) {
        if (t.dataset.orig == null) t.dataset.orig = t.textContent;
        t.textContent = cat ? `Skills — ${f.heading}` : t.dataset.orig;
      }
    }

    let state = 'off';        // off | playing | paused | modal
    let modal = null;         // { el, parent, next, viaLaptop, mac, back, kind, file }
    let motdShown = false;

    // opts.laptop: you jacked in (the exit animation plays on close); opts.mac: shown on the MacBook
    // screen; opts.back: 'files' returns to the file browser on close; opts.file: which CV file it is
    function openWindow(win, opts = {}) {
      const mac = !!(opts.laptop || opts.mac);
      modal = { el: win, parent: win.parentNode, next: win.nextSibling, viaLaptop: !!opts.laptop, mac, back: opts.back, kind: opts.kind, file: opts.file };
      if (mac) {
        win.classList.add('crt-in');
        win.addEventListener('animationend', () => win.classList.remove('crt-in'), { once: true });
      }
      if (opts.file && opts.file.section === 'skills') focusSkills(win, opts.file);
      modalEl.classList.toggle('mac', mac);
      macPath.textContent = opts.kind === 'files' ? 'recruiter@MacBook: ~/' : opts.file ? `recruiter@MacBook: ~/${opts.file.file}` : '';
      macClock.textContent = hhmm();
      modalInner.appendChild(win);
      modalInner.scrollTop = 0;
      modalEl.hidden = false;
      pauseEl.hidden = true;
      hud.root.hidden = true;
      state = 'modal';
      if (document.pointerLockElement) document.exitPointerLock();
      const first = win.querySelector('button.file-row, input, a, button');
      if (first) first.focus({ preventScroll: true });
    }
    function openPanel(def, viaLaptop = false) {
      if (!viaLaptop) Sound.use();
      const f = def.section === 'skills' && def.keys.length === 1 ? fileFor(def.keys[0]) : fileFor(def.section);
      openWindow(sectionWin[def.section](), { laptop: viaLaptop, file: f });
      if (hackDef === def) hackDef = null;
      if (isDone(def)) return;
      for (const k of def.keys) read.add(k);
      updateProgress();
      chat(`<span class="g">* Objective:</span> ${map.verb === 'hack' ? 'hacked ' + def.host : 'read ' + def.heading}`);
      addMoney(300);
      const n = doneCount(), tot = objectives().length;
      if (def.finale) setTimeout(() => centerMsg('Counter-Terrorists Win', 4), 400);
      else if (n === tot) {
        if (map.unlock) {
          map.unlock();
          setTimeout(() => { centerMsg('Server room unlocked', 4); chat('<span class="ct">Radio:</span> The server room is open. Get the contact details out.'); }, 400);
        } else setTimeout(() => centerMsg('Counter-Terrorists Win', 4), 400);
      }
    }
    function openFiles() {
      Sound.use();
      openWindow(buildFiles(), { mac: true, kind: 'files' });
    }
    function openFile(f, back = 'files') {
      openWindow(sectionWin[f.section](), { mac: true, file: f, back });
    }
    function restoreModal() {
      const win = modal.el;
      if (modal.file && modal.file.section === 'skills') focusSkills(win, null);
      if (modal.parent) modal.parent.insertBefore(win, modal.next);
      else win.remove();
      modal = null;
      modalEl.hidden = true;
      modalEl.classList.remove('mac');
      hud.root.hidden = false;
    }
    function closeModal(relock) {
      if (!modal || modal.closing) return;
      if (modal.back === 'files') { restoreModal(); openFiles(); return; }
      if (relock) lock();   // request it now, while we still have the click's user gesture
      if (!modal.viaLaptop) {
        restoreModal();
        if (!relock) showPause();
        return;
      }
      // leaving the computer: the window collapses like a CRT, then the laptop drops back down
      modal.closing = true;
      const win = modal.el;
      win.classList.add('crt-out');
      setTimeout(() => {
        win.classList.remove('crt-out');
        restoreModal();
        if (!relock) showPause();
        startAnim('exit');
      }, reducedMotion ? 10 : 220);
    }
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl) { closeModal(true); return; }
      const row = e.target.closest('button[data-file]');
      if (row) { Sound.use(); restoreModal(); openFile(fileFor(row.dataset.file)); return; }
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        e.preventDefault();
        closeModal(true);
      }
      else if (/^https?:/.test(href)) { e.preventDefault(); open(href, '_blank', 'noopener'); }
    });
    // arrow keys move between files in the browser
    modalEl.addEventListener('keydown', e => {
      if (!modal || modal.kind !== 'files' || !/^Arrow(Up|Down)$/.test(e.key)) return;
      const rows = [...modalEl.querySelectorAll('button.file-row')];
      if (!rows.length) return;
      e.preventDefault();
      const i = rows.indexOf(document.activeElement);
      rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length].focus();
    });

    function showPause() {
      state = 'paused';
      pauseEl.hidden = false;
      hud.use.hidden = true;
    }
    pauseEl.addEventListener('click', e => {
      const a = e.target.closest('a[data-act]');
      if (!a) return;
      e.preventDefault();
      const act = a.dataset.act;
      if (act === 'resume') lock();
      else if (act === 'files') openFiles();
      else if (act === 'contact') openFile(fileFor('contact'), null);
      else if (act === 'map') switchMap(MAPS.find(n => n !== map.name));
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
      } else if (state === 'anim') {
        // Esc during the "enter" animation: cancel it
        anim = null; hackDef = null; fxEl.hidden = true; screenKey = '';
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
        // Tab closes the file browser again (inside a CV window it moves focus as usual)
        else if (e.code === 'Tab' && modal && modal.kind === 'files') { e.preventDefault(); closeModal(true); }
        return;
      }
      if (state !== 'playing') return;
      if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat && !anim && !lapInsp) openFiles(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jumpQueued = true; }
      if (e.code === 'KeyE' && !e.repeat && lookTarget) usePanel(lookTarget);
      if (e.code === 'KeyF' && !e.repeat) inspect();
      keys[e.code] = true;
    });
    addEventListener('keyup', e => {
      keys[e.code] = false;
      if (e.code === 'KeyF' && lapInsp) lapInsp.held = false;
    });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (lapInsp) lapInsp.held = false; });

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
      vmRoot.position.copy(camera.position);
      vmRoot.quaternion.copy(camera.quaternion);

      // animations
      let k = 0;
      if (anim) {
        anim.t += dt;
        k = Math.min(1, anim.t / anim.dur);
        if (anim.type === 'enter') fxEl.style.opacity = Math.max(0, (k - 0.88) / 0.12);   // fade in on the last third of the zoom
        if (k >= 1) {
          const done = anim;
          anim = null;
          if (done.type === 'enter') {
            fxEl.style.opacity = 1;
            openPanel(done.def, true);
          } else if (done.type === 'exit') {
            fxEl.hidden = true;
          }
        }
      }
      if (anim && anim.type === 'exit') fxEl.style.opacity = 1 - k * 1.6;
      const bobX = Math.sin(bob * 1.4) * 0.008 * moveK;
      const bobY = -Math.abs(Math.cos(bob * 1.4)) * 0.01 * moveK + (P.onGround ? 0 : 0.01);

      lapRoot.visible = !lapReady;
      if (laptopHands) laptopHands.visible = !lapReady;
      if (lapModel) lapModel.visible = lapReady;
      if (spinHand) spinHand.visible = false;
      if (lapReady) {
        // enter takes over quickly from idle/walk; exit plays it backwards
        const A = anim ? anim.type : '';
        let e = 0, et = 0;
        if (A === 'enter') { e = Math.min(1, k / 0.08); et = k; }
        else if (A === 'exit') { e = Math.min(1, (1 - k) / 0.08); et = 1 - k; }
        else if (modal && modal.viaLaptop) { e = 1; et = 1; }
        const I = lapClips.idle, W = lapClips.walk, N = lapClips.enter;
        // F: throw it up onto the middle finger, spin while F is held, catch it and reopen it on release
        let iw = 0, wIn = 0, wSpin = 0, wOut = 0;
        if (lapInsp) {
          const s = lapInsp, Xi = lapClips.inspect_in, Xs = lapClips.inspect, Xo = lapClips.inspect_out;
          s.t += dt;
          if (s.phase === 'in' && s.t >= Xi.dur) {
            s.t -= Xi.dur;
            s.phase = s.held ? 'spin' : 'out';
          }
          if (s.phase === 'spin' && !s.held) {
            // let go on the next half turn of the loop, where the laptop lines up with the catch
            const half = Xs.dur / 2;
            if (s.releaseAt == null) s.releaseAt = Math.max(1, Math.ceil(s.t / half)) * half;
            if (s.t >= s.releaseAt) { s.phase = 'out'; s.spinT = s.releaseAt; s.t -= s.releaseAt; }
          }
          if (s.phase === 'out' && s.t >= Xo.dur) lapInsp = null;
          else if (s.phase === 'in') {
            Xi.action.time = Math.min(s.t, Xi.dur - 1e-4);
            iw = wIn = Math.min(1, s.t / 0.1);
          } else if (s.phase === 'spin') {
            Xs.action.time = s.t % Xs.dur;
            iw = wSpin = 1;
          } else {
            Xo.action.time = Math.min(s.t, Xo.dur - 1e-4);
            iw = Math.min(1, (Xo.dur - s.t) / 0.1);
            const f = s.spinT == null ? 1 : Math.min(1, s.t / 0.12);   // short blend out of the spin
            if (s.spinT != null) Xs.action.time = (s.spinT + s.t) % Xs.dur;
            wSpin = iw * (1 - f); wOut = iw * f;
          }
        }
        I.action.time = clock % I.dur;
        W.action.time = (bob * 1.4 / (Math.PI * 2)) % 1 * W.dur;   // same phase as the footstep bob
        N.action.time = Math.min(et, 0.9999) * N.dur;
        I.action.setEffectiveWeight((1 - iw) * (1 - e) * (1 - moveK));
        W.action.setEffectiveWeight((1 - iw) * (1 - e) * moveK);
        N.action.setEffectiveWeight((1 - iw) * e);
        if (lapInspReady) {
          lapClips.inspect_in.action.setEffectiveWeight(wIn);
          lapClips.inspect.action.setEffectiveWeight(wSpin);
          lapClips.inspect_out.action.setEffectiveWeight(wOut);
        }
        lapMixer.update(0);
        lapModel.position.set(0, (P.onGround ? 0 : 0.01), 0);
      } else {
        let pose = HOLD, hk = 1, spinning = false, holding = true;
        if (anim && anim.type === 'enter') {
          pose = k < 0.45 ? lerpPose(HOLD, ENTER(0.2), ease(k / 0.45)) : lerpPose(ENTER(0.2), ENTER(0.05), easeIn((k - 0.45) / 0.55));
          hk = 0; holding = k < 0.3;
        } else if (anim && anim.type === 'exit') {
          pose = lerpPose(ENTER(0.05), HOLD, ease(k)); hk = k; holding = k > 0.6;
        } else if (anim && anim.type === 'inspect') {
          if (k < 0.2) pose = lerpPose(HOLD, BALANCE, ease(k / 0.2));
          else if (k < 0.82) {
            const u = (k - 0.2) / 0.62;
            pose = { ...BALANCE, spin: easeOut(u) * Math.PI * 3, rz: Math.sin(anim.t * 5) * 0.025 * u, rx: BALANCE.rx + Math.sin(anim.t * 4) * 0.02 * u };
          } else pose = lerpPose(BALANCE, HOLD, ease((k - 0.82) / 0.18));
          spinning = k > 0.14 && k < 0.88;
          hk = 0.3;
        } else if (modal && modal.viaLaptop) {
          pose = ENTER(0.05); hk = 0; holding = false;
        }
        lapRoot.position.set(pose.x + bobX * hk, pose.y + bobY * hk, pose.z);
        lapRoot.rotation.set(pose.rx, pose.ry, pose.rz);
        lidPivot.rotation.x = pose.lid;
        lapSpin.rotation.y = pose.spin;
        if (realHands) {
          // the gloves drop out of view while the laptop is up at your face or spinning,
          // and the pointing hand rises for the spin
          let drop = 0, rise = 0;
          const A = anim ? anim.type : '';
          if (A === 'enter') drop = ease(Math.min(1, k / 0.4));
          else if (A === 'exit') drop = 1 - ease(k);
          else if (A === 'inspect') {
            const inOut = k < 0.2 ? ease(k / 0.2) : k > 0.82 ? 1 - ease((k - 0.82) / 0.18) : 1;
            drop = inOut; rise = inOut;
          } else if (modal && modal.viaLaptop) drop = 1;
          laptopHands.position.set(bobX, bobY - drop * 0.35, 0);
          laptopHands.visible = drop < 1;
          spinHand.visible = rise > 0;
          spinHand.position.set(SPIN_SHIFT.x, SPIN_SHIFT.y - (1 - rise) * 0.35, SPIN_SHIFT.z);
          lapFinger.visible = false;
        } else {
          lapHand.visible = holding && !spinning;
          lapFinger.visible = spinning;
        }
      }

      // what are we looking at?
      lookTarget = null;
      if (state === 'playing') {
        ray.setFromCamera(center.set(0, 0), camera);
        ray.far = 3.2;
        const hit = ray.intersectObjects([...panels, ...solids], false)[0];
        if (hit && hit.object.userData.panel) lookTarget = hit.object.userData.panel;
      }
      hud.use.hidden = !lookTarget;
      if (lookTarget) {
        const d = lookTarget;
        hud.use.innerHTML = map.verb !== 'hack' ? `Press <b>E</b> to connect to <b>${d.heading}</b>`
          : isDone(d) ? `Press <b>E</b> to open <b>${d.heading}</b>` : `Press <b>E</b> to hack <b>${d.host}</b>`;
      }
      if (map.update) map.update(dt, clock);
      for (const d of screens) drawTerminal(d);
      if (anim && anim.type === 'enter') drawScreen('connect', anim.def, Math.min(1, anim.t / (anim.dur * 0.7)), anim.fresh);
      else if (modal && modal.viaLaptop) drawScreen('connect', null, 1);
      else if (lookTarget && !(anim && anim.type === 'inspect') && !lapInsp) drawScreen('wake', lookTarget);
      else drawScreen('off');

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
          chat(map.hint);
        }, 300);
      } else {
        showPause();
      }
    }
    function exit(target) {
      if (modal) closeModalSilently();
      anim = null; hackDef = null; fxEl.hidden = true; screenKey = ''; drawScreen('off');
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

    mapTextures = [];   // the view model's own textures stay when maps change
    applyMap(firstMap);
    return { enter, exit };
  }
})();
