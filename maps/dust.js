/* de_dust2_cv: the original Dust2-style yard, corridor and A site, with the six CV panels on the walls.
   Built by game.js through build(ctx); see the office map for the other one. */
export const name = 'de_dust2_cv';

export function build(ctx) {
  const { THREE, V3, box, mat, makeCanvas, toTexture, rnd, rr, speckle, blotches, maxAniso, assets } = ctx;

  /* ------------------------------------------------------- textures */
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
  const M = {
    plaster: mat(tex.plaster, 5),
    cap: mat(tex.cap, 1.5),
    sand: mat(tex.sand, 3.2),
    tiles: mat(tex.tiles, 2.4),
    crate: mat(tex.crate, 0),
    crateSmall: null,
    door: mat(tex.door, 0),
    wood: mat(tex.wood, 1),
    barrel: mat(tex.barrel, 0),
  };

  // Local only: skin the map with the real Dust textures from your CS 1.6 install.
  // GoldSrc maps 1 texel to 1 unit (~1 inch), so a 128x240 wall texture covers 3.25 x 6.1 m.
  if (assets) {
    const faces = (side, top) => {   // BoxGeometry face order: +x, -x, +y, -y, +z, -z
      side.tex.anisotropy = top.tex.anisotropy = maxAniso;
      const sm = mat(side.tex, 0), tm = mat(top.tex, 0);
      return [sm, sm, tm, tm, sm, sm];
    };
    if (assets.wall) M.plaster = ctx.real(assets.wall);
    if (assets.trim) M.cap = ctx.real(assets.trim);
    if (assets.sand) M.sand = ctx.real(assets.sand);
    if (assets.concrete) M.tiles = ctx.real(assets.concrete);
    if (assets.crateSide && assets.crateTop) M.crate = faces(assets.crateSide, assets.crateTop);
    if (assets.smallSide && assets.smallTop) M.crateSmall = faces(assets.smallSide, assets.smallTop);
  }

  /* ------------------------------------------------------- geometry */
  function wall(x1, x2, z1, z2, h) {
    box(x1, x2, 0, h, z1, z2, M.plaster);
    box(x1 - 0.08, x2 + 0.08, h, h + 0.22, z1 - 0.08, z2 + 0.08, M.cap, { collide: false });
    // darker dirt line at the base of the wall
    box(x1 - 0.03, x2 + 0.03, 0, 0.35, z1 - 0.03, z2 + 0.03, M.cap, { collide: false, shoot: false, shadow: false });
  }
  function crate(x, z, size, y = 0) {
    const h = size / 2;
    return box(x - h, x + h, y, y + size, z - h, z + h, size < 1 && M.crateSmall ? M.crateSmall : M.crate);
  }
  function barrel(x, z) {
    const geo = new THREE.CylinderGeometry(0.33, 0.33, 1.0, 14);
    const mesh = new THREE.Mesh(geo, M.barrel);
    mesh.position.set(x, 0.5, z);
    mesh.castShadow = mesh.receiveShadow = true;
    ctx.add(mesh); ctx.solids.push(mesh);
    ctx.colliders.push({ minX: x - 0.33, maxX: x + 0.33, minY: 0, maxY: 1, minZ: z - 0.33, maxZ: z + 0.33 });
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
  ctx.decal(paintTexture(256, 256, g => {
    g.fillStyle = 'rgba(35,22,12,.88)';
    g.font = 'bold 230px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('A', 128, 140);
  }), 2.6, 2.6, new V3(17.93, 3.2, -22), -Math.PI / 2);
  ctx.decal(paintTexture(512, 256, g => {
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
    ctx.add(sky);
  }

  // Lighting: warm low sun + sky fill
  ctx.add(new THREE.HemisphereLight(0xd6e4f5, 0xa5824f, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.position.set(-16, 34, 14);
  sun.target.position.set(6, 0, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 110 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  ctx.add(sun, sun.target);

  /* --------------------------------------------------------- panels */
  const S = ctx.SKILLS.map(s => 'skills:' + s.id);   // the one Skills panel here covers every skill desk
  const panelDefs = [
    { id: 'about', section: 'about', title: 'About', heading: 'João Furukawa', lines: ['Junior Software Developer @ TUU', 'M.Sc. AI · University of Coimbra', 'Full-stack · LLM tools · RAG'], at: [-5.96, 1.9, 16], face: '+x' },
    { id: 'career', section: 'career', title: 'Career', heading: 'Experience & Education', lines: ['Intern → Junior Dev @ TUU', '08/2025 — present', 'M.Sc. AI · B.Sc. Informatics Eng.'], at: [5.96, 1.9, 16], face: '-x' },
    { id: 'skills', section: 'skills', keys: S, title: 'Options — Skills', heading: 'Skills', lines: ['JS / TS · React · Node.js', 'Python · SQL · Java · C', 'RAG · PyTorch · Docker · Azure'], at: [-2.96, 1.9, -3], face: '+x' },
    { id: 'work', section: 'work', title: 'Projects — Work @ TUU', heading: 'Work @ TUU', lines: ['AI assistant in Microsoft Teams', 'Internal platforms & automation', 'Company website & design system'], at: [3, 1.9, -25.96], face: '+z' },
    { id: 'personal', section: 'personal', title: 'Projects — Personal & Uni', heading: 'Personal & University', lines: ['FutSabado · Googol · DEIChain', 'Mario AI · ArtBench · Potrivia'], at: [17.96, 1.9, -13.5], face: '-x' },
    { id: 'contact', section: 'contact', title: 'Contact', heading: 'Get in touch', lines: ['Email · GitHub · LinkedIn', 'Download CV (PDF)'], at: [12.5, 2.8, -25.96], face: '+z' },
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
    grp.add(frame, screen);
    ctx.add(grp);
    ctx.solids.push(frame);
    ctx.terminal(def, screen);
  }

  return {
    spawn: { x: 0, y: 0, z: 18.5, yaw: 0 },
    fog: new THREE.Fog(0xdcc9a0, 45, 150),
    radar: { scale: 5.5, color: 'rgba(210,190,140,.35)', areas: [[-6, 10, 12, 12], [-3, -10, 6, 19], [-4, -26, 22, 16]] },
    vmLight: { sky: 0xd6e4f5, ground: 0xa5824f, hemi: 1.3, sun: 0xfff0d0, sunI: 1.8 },
    shadows: true,
    verb: 'connect to',
    motd: 'Find the six panels on the walls, walk up to one and press E to jack your <span class="accent">MacBook</span> into it.',
    hint: '* Find the panels and jack into them (E)',
  };
}
