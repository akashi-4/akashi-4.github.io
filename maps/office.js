/* cs_office_cv: a small night-time office after cs_office. Every CV section is a locked
   workstation: reception (About), six cubicles (one per skill category), the meeting corner
   (Work, Personal), the boss's office (Career). Hack all ten and the server room opens (Contact).
   Local runs use the real cs_office textures (assets-local, never published); the public site
   gets simple painted stand-ins with the same layout. */
export const name = 'cs_office_cv';

const H = 3.25;                  // floor to ceiling (128 units, the height of the office wall texture)
const PI = Math.PI;
const FACE = { '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 };

export function build(ctx) {
  const { THREE, box, mat, makeCanvas, toTexture, rnd, rr, speckle, blotches, maxAniso, fileFor, SKILLS } = ctx;
  const O = ctx.assets && ctx.assets.office;
  const add = ctx.add;

  /* ------------------------------------------------------ materials */
  // tiled: textures repeat at their real CS size; image: the whole picture on one face
  const tiled = role => O && O[role] ? ctx.real(O[role]) : null;
  const image = role => {
    if (!O || !O[role]) return null;
    O[role].tex.anisotropy = maxAniso;
    return mat(O[role].tex, 0);
  };
  const flat = color => mat(null, 0, { color });
  const paint = (w, h, draw, scale) => { const [c, g] = makeCanvas(w, h); draw(g, w, h); return mat(toTexture(c, !!scale), scale || 0); };

  // painted stand-ins for the public site
  const fallback = {
    carpet: () => paint(128, 128, (g, w, h) => { g.fillStyle = '#5d626b'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 0.25, 0.12, 2); }, 1.2),
    wall: () => paint(128, 256, (g, w, h) => {
      g.fillStyle = '#b9b9b4'; g.fillRect(0, 0, w, h); blotches(g, w, h, 6, '255,255,255', 0.12);
      g.fillStyle = '#4b4f86'; g.fillRect(0, h - 36, w, 36); g.fillStyle = '#2f3258'; g.fillRect(0, h - 38, w, 3);
    }, [2.6, H]),
    bossWall: () => paint(128, 256, (g, w, h) => {
      g.fillStyle = '#b8c4b0'; g.fillRect(0, 0, w, h); blotches(g, w, h, 5, '255,255,255', 0.15);
      g.fillStyle = '#7a3f1c'; g.fillRect(0, h - 90, w, 90); g.fillStyle = '#5a2c12'; g.fillRect(0, h - 92, w, 4);
    }, [3.25, 4.06]),
    ceiling: () => paint(64, 64, (g, w, h) => { g.fillStyle = '#d9d7d0'; g.fillRect(0, 0, w, h); speckle(g, w, h, 600, 0.12, 0.05, 1.5); g.strokeStyle = '#9c9a93'; g.strokeRect(0.5, 0.5, w - 1, h - 1); }, 1.2),
    serverWall: () => paint(128, 128, (g, w, h) => { g.fillStyle = '#7d8286'; g.fillRect(0, 0, w, h); blotches(g, w, h, 10, '40,45,50', 0.2); speckle(g, w, h, 1500); }, 3),
    serverFloor: () => paint(64, 64, (g, w, h) => {
      g.fillStyle = '#5c5a4b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3e3d33'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    }, 1.6),
    desk: () => paint(64, 64, (g, w, h) => { g.fillStyle = '#8a5424'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(60,30,10,${rr(0.05, 0.2)})`; g.fillRect(0, y, w, 1); } }, 1.4),
  };
  const M = {
    carpet: tiled('carpet') || fallback.carpet(),
    wall: tiled('wall') || fallback.wall(),
    wallPillar: tiled('wallPillar') || tiled('wall') || fallback.wall(),
    bossWall: tiled('bossWall') || fallback.bossWall(),
    ceiling: tiled('ceiling') || fallback.ceiling(),
    serverWall: tiled('serverWall') || fallback.serverWall(),
    serverFloor: tiled('serverFloor') || fallback.serverFloor(),
    desk: tiled('desk') || fallback.desk(),
    beige: image('beige') || flat(0xcfc6ac),
    plastic: flat(0xcdc5ad),
    dark: flat(0x2a2c31),
    black: flat(0x111214),
    metal: flat(0x8e949b),
    fabric: flat(0x4f5872),
    fabricTrim: flat(0x7a7f88),
    chair: flat(0x26292f),
    wood: tiled('desk') || fallback.desk(),
    snow: tiled('snow') || flat(0xdfe6ee),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fb7d0, transparent: true, opacity: 0.16, depthWrite: false }),
    light: O && O.light ? new THREE.MeshBasicMaterial({ map: O.light.tex, toneMapped: false }) : new THREE.MeshBasicMaterial({ color: 0xf4f6f0 }),
  };
  M.light.userData.scale = 0;
  M.glass.userData.scale = 0;
  const pic = (role, fallbackColor) => image(role) || flat(fallbackColor);
  // a box with one picture on its front (+z unless said otherwise) and plain sides
  const fronted = (front, side, dir = '+z') => {
    const i = { '+x': 0, '-x': 1, '+z': 4, '-z': 5 }[dir];
    const m = [side, side, side, side, side, side];
    m[i] = front;
    return m;
  };

  // mesh helpers for props built in their own local frame (front = +z), then turned
  const mesh = (geo, material, x, y, z, parent) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = false;
    parent.add(m);
    return m;
  };
  const cube = (w, h, d, material, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z, parent);
  const group = (x, z, face = '+z', y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = FACE[face]; add(g); return g; };
  // make a finished prop solid: a collider from its bounds, and clicks land on it
  const solidify = (g, collide = true, shoot = true) => {
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    if (collide) ctx.colliders.push({ minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z });
    if (shoot) g.traverse(o => { if (o.isMesh) ctx.solids.push(o); });
  };
  const plane = (w, h, material, x, y, z, face, parent = null) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    m.rotation.y = FACE[face];
    (parent || { add }).add(m);
    return m;
  };
  // pictures, signs and posters hung on a wall, facing into the room
  const hang = (role, fallbackColor, w, h, x, y, z, face) => {
    const m = plane(w, h, image(role) || flat(fallbackColor), x, y, z, face);
    m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2;
    return m;
  };
  const labelTex = (lines, w = 512, h = 96, bg = '#1d1f24', fg = '#e8e6de') => {
    const [c, g] = makeCanvas(w, h);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8f8a78'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([text, size, color], i) => {
      g.fillStyle = color || fg; g.font = `${size}px Tahoma, Arial, sans-serif`;
      g.fillText(text, w / 2, h / (lines.length + 1) * (i + 1) + (lines.length > 1 ? (i ? 4 : -4) : 0));
    });
    const t = toTexture(c, false); t.anisotropy = maxAniso;
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  };

  /* ------------------------------------------------------------ props */
  const TOP = 0.76;   // desk height
  function desk(x, z, face, w = 1.6, d = 0.8, material = M.desk) {
    const g = group(x, z, face);
    cube(w, 0.04, d, material, 0, TOP - 0.04, 0, g);
    cube(0.04, TOP - 0.04, d - 0.06, material, -w / 2 + 0.03, 0, 0, g);
    cube(0.04, TOP - 0.04, d - 0.06, material, w / 2 - 0.03, 0, 0, g);
    cube(w - 0.1, 0.5, 0.03, material, 0, 0.2, -d / 2 + 0.05, g);    // modesty panel
    solidify(g);
    return g;
  }
  function chair(x, z, face) {
    const g = group(x, z, face);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), M.metal, 0, 0.22, 0, g);
    mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), M.chair, 0, 0.03, 0, g);
    cube(0.48, 0.08, 0.46, M.chair, 0, 0.42, 0, g);
    cube(0.46, 0.52, 0.06, M.chair, 0, 0.56, -0.24, g);
    solidify(g, false, false);
    ctx.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minY: 0, maxY: 0.5, minZ: z - 0.25, maxZ: z + 0.25 });
  }
  function pcTower(x, z, face) {
    const g = group(x, z, face);
    cube(0.2, 0.44, 0.44, fronted(pic('pcFront', 0xd8d0b8), M.beige), 0, 0, 0, g);
    solidify(g, false);
  }
  function keyboard(parent, x, z) {
    const top = image('keyboard') || flat(0xe0dccd);
    cube(0.44, 0.025, 0.15, [M.plastic, M.plastic, top, M.plastic, M.plastic, M.plastic], x, TOP, z, parent);
  }
  // A beige CRT on a desk. With a def it's a terminal: the game draws the lock screen and you hack it.
  function crt(x, z, face, def = null, y = TOP) {
    const g = group(x, z, face, y);
    cube(0.24, 0.03, 0.22, M.plastic, 0, 0, 0, g);                     // foot
    cube(0.44, 0.38, 0.4, M.beige, 0, 0.04, 0.02, g);                   // tube housing
    cube(0.34, 0.28, 0.2, M.beige, 0, 0.08, -0.26, g);                  // back
    if (def) {
      const scr = ctx.screen(def, 0.35, 0.27);
      scr.position.set(0, 0.235, 0.222); g.add(scr);
      const hit = mesh(new THREE.PlaneGeometry(0.7, 0.55), M.black, 0, 0.24, 0.26, g);
      hit.visible = false;
      ctx.terminal(def, hit);
    } else {
      plane(0.44, 0.38, pic('monitor', 0x223344), 0, 0.23, 0.221, '+z', g);
    }
    keyboard(g, 0, 0.36);
    solidify(g, false);
    return g;
  }
  function cabinet(x, z, face, h = 1.3) {
    const g = group(x, z, face);
    cube(0.48, h, 0.6, M.metal, 0, 0, 0, g);
    const drawers = Math.round(h / 0.33);
    for (let i = 0; i < drawers; i++) {
      cube(0.42, h / drawers - 0.04, 0.01, flat(0x9da3aa), 0, i * h / drawers + 0.02, 0.305, g);
      cube(0.14, 0.02, 0.02, M.dark, 0, (i + 0.7) * h / drawers, 0.315, g);
    }
    solidify(g);
  }
  function plant(x, z, s = 1) {
    const g = group(x, z);
    mesh(new THREE.CylinderGeometry(0.2 * s, 0.15 * s, 0.4 * s, 10), flat(0x6b4a2e), 0, 0.2 * s, 0, g);
    const leaf = flat(0x2f6b33);
    for (let i = 0; i < 6; i++) {
      const m = mesh(new THREE.ConeGeometry(0.12 * s, 0.9 * s, 5), leaf, Math.cos(i) * 0.08 * s, 0.75 * s, Math.sin(i) * 0.08 * s, g);
      m.rotation.set(Math.sin(i * 2.1) * 0.35, i, Math.cos(i * 1.7) * 0.35);
    }
    solidify(g);
  }
  function cardboard(x, z, s, y = 0) {
    const side = image('boxSide') || flat(0xa9824f), top = image('boxTop') || flat(0xb48d58);
    return box(x - s / 2, x + s / 2, y, y + s * 0.8, z - s / 2, z + s / 2, [side, side, top, top, side, side]);
  }
  function partition(x1, x2, z1, z2, h = 1.25) {
    box(x1, x2, 0, h, z1, z2, M.fabric);
    box(x1 - 0.01, x2 + 0.01, h, h + 0.03, z1 - 0.01, z2 + 0.01, M.fabricTrim, { collide: false });
  }
  // ceiling light panel plus (optionally) the light it gives
  const lights = [];
  function ceilingLight(x, z, intensity = 7, color = 0xfff3de, withLight = true) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.22), M.light);
    p.rotation.x = PI / 2; p.position.set(x, H - 0.005, z);
    add(p);
    if (!withLight) return null;
    const l = new THREE.PointLight(color, intensity, 11, 1.4);
    l.position.set(x, H - 0.35, z);
    add(l); lights.push(l);
    return l;
  }

  // walls: [x1, x2, z1, z2] with a material per side
  function wallBox(x1, x2, z1, z2, { px = M.wall, nx = M.wall, pz = M.wall, nz = M.wall } = {}, y1 = 0, y2 = H) {
    return box(x1, x2, y1, y2, z1, z2, [px, nx, M.ceiling, M.ceiling, pz, nz]);
  }

  /* ------------------------------------------------------------ shell */
  // main office x -11..3, boss's office x 3.2..11 z -8..0, server room x 3.2..11 z 0.2..8
  box(-11, 3, -0.1, 0, -8, 8, M.carpet, { collide: false });
  box(3, 11, -0.1, 0, -8, 0.2, M.carpet, { collide: false });
  box(3, 11, -0.1, 0, 0.2, 8, M.serverFloor, { collide: false });
  box(-11.2, 11.2, H, H + 0.12, -8.2, 8.2, M.ceiling);

  wallBox(-11.2, -11, -8, 8);                                              // west
  wallBox(-11.2, 3, 8, 8.2);                                               // south (lifts)
  wallBox(3, 11.2, 8, 8.2, { nz: M.serverWall });
  wallBox(11, 11.2, -8, 0, { nx: M.bossWall });                            // east
  wallBox(11, 11.2, 0, 8.2, { nx: M.serverWall });
  wallBox(3.2, 11, 0, 0.2, { nz: M.bossWall, pz: M.serverWall });          // boss | server
  // the inside wall, with the boss's door (z -1.6..-0.4) and the server room door (z 0.8..2)
  const DOOR_TOP = 2.2;
  wallBox(3, 3.2, -8, -1.6, { px: M.bossWall, nx: M.wallPillar });
  wallBox(3, 3.2, -0.4, 0, { px: M.bossWall });
  wallBox(3, 3.2, 0, 0.8, { px: M.serverWall });
  wallBox(3, 3.2, 2, 8, { px: M.serverWall });
  wallBox(3, 3.2, -1.6, -0.4, { px: M.bossWall }, DOOR_TOP, H);
  wallBox(3, 3.2, 0.8, 2, { px: M.serverWall }, DOOR_TOP, H);

  // north wall: windows onto the snow, with a sill and a band above
  wallBox(-11.2, 11.2, -8.2, -8, { pz: M.wall }, 0, 0.9);
  wallBox(-11.2, 11.2, -8.2, -8, { pz: M.wall }, 2.4, H);
  ctx.colliders.push({ minX: -11.2, maxX: 11.2, minY: 0, maxY: H, minZ: -8.2, maxZ: -8 });
  for (let x = -11; x <= 11.01; x += 1.375) box(x - 0.05, x + 0.05, 0.9, 2.4, -8.18, -8.02, M.metal, { collide: false });
  box(-11, 11, 0.9, 0.95, -8.25, -7.9, M.metal, { collide: false });        // sill
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(22, 1.5), M.glass);
  glass.position.set(0, 1.65, -8.1); add(glass);
  // the boss's side of the north wall is panelled too
  box(3.2, 11, 0.9, 0.95, -8, -7.99, M.metal, { collide: false });

  /* ---------------------------------------------------------- outside */
  {
    box(-40, 40, -0.4, -0.3, -60, -8.2, M.snow, { collide: false });
    const [c, g] = makeCanvas(4, 256);
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#05070d'); grd.addColorStop(0.48, '#141d30'); grd.addColorStop(0.52, '#1c2436'); grd.addColorStop(1, '#0b0f18');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    add(new THREE.Mesh(new THREE.SphereGeometry(150, 24, 16), new THREE.MeshBasicMaterial({ map: toTexture(c, false), side: THREE.BackSide, fog: false })));
    // a street lamp in the snow
    box(-2.05, -1.95, -0.3, 5, -16.05, -15.95, M.dark, { collide: false });
    box(-2.3, -1.7, 4.9, 5.05, -16.2, -15.8, M.dark, { collide: false });
    const lamp = new THREE.PointLight(0xffc98a, 14, 22, 1.3);
    lamp.position.set(-2, 4.7, -16);
    add(lamp);
    // dark office blocks across the street, a few windows still lit
    for (const [x, w, h] of [[-26, 14, 16], [-8, 12, 22], [10, 16, 13], [28, 12, 19]]) {
      const [bc, bg] = makeCanvas(64, 64);
      bg.fillStyle = '#10131a'; bg.fillRect(0, 0, 64, 64);
      for (let yy = 4; yy < 64; yy += 8) for (let xx = 3; xx < 64; xx += 8) {
        bg.fillStyle = rnd() < 0.12 ? '#c9b07a' : '#1a1f2a'; bg.fillRect(xx, yy, 4, 4);
      }
      const bm = new THREE.MeshBasicMaterial({ map: toTexture(bc, false) });
      bm.userData.scale = 0;
      box(x - w / 2, x + w / 2, -0.3, h, -52, -44, bm, { collide: false, shoot: false });
    }
  }
  // falling snow
  const SNOW = 1400;
  const snowPos = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW; i++) { snowPos[i * 3] = rr(-24, 24); snowPos[i * 3 + 1] = rr(-0.3, 14); snowPos[i * 3 + 2] = rr(-40, -8.6); }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xe8eef8, size: 0.07, transparent: true, opacity: 0.85 }));
  add(snow);

  /* ------------------------------------------------------ main office */
  const T = (key, host, extra = {}) => ({ ...fileFor(key), id: key, keys: [key], host, ...extra });

  // lifts and reception (you arrive here)
  hang('lift', 0x6f7680, 1.3, 2.3, -6.4, 1.15, 7.98, '-z');
  hang('lift', 0x6f7680, 1.3, 2.3, -3.6, 1.15, 7.98, '-z');
  hang('exit', 0xaa2020, 0.5, 0.25, -5, 2.75, 7.97, '-z');
  hang('clock', 0xeeeeee, 0.4, 0.4, -1.4, 2.4, 7.97, '-z');
  hang('companySign', 0x7a4a20, 1.8, 0.6, -10.97, 2.2, 4.7, '+x');
  // reception counter, its PC facing the lifts
  box(-10.2, -7.4, 0, 1.05, 4.3, 4.9, M.desk);
  box(-10.3, -7.3, 1.05, 1.1, 4.15, 5.1, M.desk);
  crt(-8.6, 4.5, '+z', T('about', 'reception-01'), 1.1);
  chair(-8.6, 3.6, '+z');
  plant(-10.5, 7.5, 1.1);
  plant(-0.6, 7.5, 1.1);

  // the cubicles: two rows of three, back to back along a spine at z = -2
  partition(-9.1, -2.3, -2.03, -1.97);
  for (const x of [-9.1, -6.87, -4.63, -2.4]) partition(x, x + 0.06, -2.95, -1.05);
  const pods = [[-7.95, -1], [-5.72, -1], [-3.49, -1], [-7.95, 1], [-5.72, 1], [-3.49, 1]];
  SKILLS.forEach((s, i) => {
    const [x, side] = pods[i];                 // side -1: north row, screens facing north; 1: south row
    const face = side < 0 ? '-z' : '+z';
    const dz = side * 0.42;
    desk(x, -2 + dz, face, 1.9, 0.78);
    crt(x + 0.25, -2 + side * 0.36, face, T('skills:' + s.id, s.host));
    pcTower(x - 0.7, -2 + side * 0.3, face);
    chair(x + 0.2, -2 + side * 1.2, face === '-z' ? '+z' : '-z');
    // nameplate on top of the spine
    const plate = plane(0.9, 0.17, labelTex([[s.host, 34, '#e8e6de'], [s.heading, 28, '#c4b550']], 512, 96), x, 1.36, -2 + side * 0.035, face);
    plate.material.side = THREE.FrontSide;
  });
  // filing cabinets and a printer corner by the windows
  for (const x of [-10.4, -9.9]) cabinet(x, -7.6, '+z');
  cabinet(-2.2, -7.6, '+z', 1.0);
  box(-3.9, -2.9, 0, 0.72, -7.9, -7.3, M.metal);
  box(-3.8, -3.0, 0.72, 1.0, -7.8, -7.4, fronted(flat(0x3a3d44), M.plastic, '+z'));
  plant(-6.2, -7.5);
  cardboard(-10.3, -3.6, 0.6); cardboard(-10.35, -3.5, 0.45, 0.48); cardboard(-9.7, -3.9, 0.5);
  hang('graph', 0xf4f1e0, 1.0, 1.0, -10.97, 1.7, -0.5, '+x');
  hang('chart', 0xf4f1e0, 1.1, 1.1, -10.97, 1.7, 1.2, '+x');

  // meeting corner: TV on the wall (Work), a laptop on the table (Personal), whiteboards
  box(-0.8, 1.9, 0, 0.74, -6.7, -5.3, M.desk);
  for (const [cx, cz, f] of [[-0.3, -7.2, '+z'], [0.6, -7.2, '+z'], [1.5, -7.2, '+z'], [-0.3, -4.8, '-z'], [0.6, -4.8, '-z']]) chair(cx, cz, f);
  {
    const g = group(2.93, -6.0, '-x', 1.75);
    cube(1.56, 0.94, 0.07, M.black, 0, -0.47, -0.035, g);
    const def = T('work', 'meeting-tv');
    const scr = ctx.screen(def, 1.42, 0.8);
    scr.position.set(0, 0, 0.004); g.add(scr);
    const hit = mesh(new THREE.PlaneGeometry(1.7, 1.1), M.black, 0, 0, 0.05, g);
    hit.visible = false;
    ctx.terminal(def, hit);
    solidify(g, false);
  }
  {
    const g = group(1.2, -5.45, '+z', 0.74);
    cube(0.36, 0.02, 0.25, M.metal, 0, 0, 0, g);
    const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.12); lid.rotation.x = -0.25; g.add(lid);
    cube(0.36, 0.24, 0.012, M.metal, 0, 0, 0, lid);
    const def = T('personal', 'meeting-laptop');
    const scr = ctx.screen(def, 0.32, 0.2);
    scr.position.set(0, 0.12, 0.0065); lid.add(scr);
    const hit = mesh(new THREE.PlaneGeometry(0.62, 0.45), M.black, 0, 0.14, 0.05, g);
    hit.visible = false;
    ctx.terminal(def, hit);
    solidify(g, false);
  }
  hang('whiteboard', 0xf2f2ee, 1.9, 1.15, 2.97, 1.55, -3.4, '-x');
  hang('corkboard', 0xa77a48, 1.1, 0.8, -1.8, 1.7, -7.97, '+z');

  // break corner by the server room: vending machines, water cooler
  {
    const g = group(2.55, 5.2, '-x');
    cube(0.9, 1.95, 0.8, fronted(pic('vending', 0x9a1f6e), M.dark), 0, 0, 0, g);
    solidify(g);
    const g2 = group(2.55, 6.3, '-x');
    cube(0.9, 1.95, 0.8, fronted(pic('vendingAlt', 0x333a44), M.dark), 0, 0, 0, g2);
    solidify(g2);
    const w = group(2.6, 7.4, '-x');
    cube(0.34, 0.95, 0.34, flat(0xe7e5df), 0, 0, 0, w);
    mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 12), new THREE.MeshLambertMaterial({ color: 0x7fb2e0, transparent: true, opacity: 0.75 }), 0, 1.16, 0, w);
    solidify(w);
  }
  // server room door, keypad and warning sign, from the main office side
  const doorMat = pic('doorMetal', 0x4b5a4e);
  const serverDoor = box(3.02, 3.18, 0, DOOR_TOP, 0.8, 2, [doorMat, doorMat, M.metal, M.metal, M.metal, M.metal]);
  const keypad = { id: '_keypad', kind: 'keypad', heading: 'SERVER ROOM', locked: true, keys: [] };
  {
    const k = ctx.screen(keypad, 0.24, 0.18);
    k.position.set(2.97, 1.4, 2.35); k.rotation.y = -PI / 2; add(k);
    box(2.95, 3.0, 1.29, 1.51, 2.21, 2.49, M.dark, { collide: false });
  }
  hang('serverSign', 0xb02020, 0.9, 0.45, 2.97, 1.95, 2.8, '-x');
  const doorLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  doorLamp.position.set(2.95, 2.4, 1.4); add(doorLamp);
  // the boss's door stands open; the President's sign beside it
  box(3.2, 4.25, 0, DOOR_TOP - 0.02, -0.46, -0.41, fronted(pic('doorWood', 0x7a4520), pic('doorWood', 0x7a4520), '+z'));
  hang('bossSign', 0x7a4a20, 0.66, 0.22, 2.97, 1.75, -2.0, '-x');

  // lights
  for (const [x, z] of [[-8.5, -5.2], [-3.5, -5.2], [0.3, -6], [-8.5, 0.6], [-3.5, 0.6], [-0.2, 1.5], [-8.5, 5.4], [-3.5, 5.4], [-0.2, 5.6]]) ceilingLight(x, z, 6);
  const flicker = lights[4];

  /* ---------------------------------------------------- boss's office */
  desk(7.9, -4.1, '-x', 2.3, 1.05, M.desk);
  crt(7.75, -4.35, '-x', T('career', 'president-pc'));
  {
    const g = group(9.2, -4.1, '-x');   // the big leather chair
    cube(0.7, 0.14, 0.62, M.black, 0, 0.4, 0, g);
    cube(0.7, 0.85, 0.14, M.black, 0, 0.5, -0.32, g);
    cube(0.12, 0.25, 0.6, M.black, -0.36, 0.5, 0, g);
    cube(0.12, 0.25, 0.6, M.black, 0.36, 0.5, 0, g);
    solidify(g);
  }
  chair(6.7, -4.6, '+x'); chair(6.7, -3.6, '+x');
  hang('diploma', 0x7a5a30, 1.1, 0.8, 10.97, 1.85, -4.1, '-x');
  hang('paintingBoss', 0x6a3a20, 1.3, 1.3, 7, 1.8, -0.02, '-z');
  hang('painting', 0xd0a030, 1.0, 1.0, 10.97, 1.8, -1.6, '-x');
  {
    const g = group(5.2, -7.45, '+z');   // couch under the window
    const cm = [pic('couch', 0x2d3a66), pic('couch', 0x2d3a66), pic('couchTop', 0x34437a), M.dark, pic('couch', 0x2d3a66), pic('couch', 0x2d3a66)];
    cube(2.1, 0.42, 0.8, cm, 0, 0, 0, g);
    cube(2.1, 0.45, 0.2, cm, 0, 0.42, -0.3, g);
    cube(0.2, 0.25, 0.8, cm, -0.95, 0.42, 0, g);
    cube(0.2, 0.25, 0.8, cm, 0.95, 0.42, 0, g);
    solidify(g);
  }
  cabinet(10.55, -7.5, '-x', 1.6);
  plant(10.4, -0.6, 1.2);
  ceilingLight(7.2, -4.1, 7, 0xffe2b8);
  ceilingLight(5, -1.6, 0, 0xffe2b8, false);

  /* ------------------------------------------------------ server room */
  const rackFront = pic('rack', 0x15171b), rackLights = pic('rackLights', 0x1c2024);
  const leds = [];
  for (const rz of [3.1, 5.6]) {
    for (let x = 4.6; x < 9.7; x += 0.62) {
      const front = rz < 4 ? '+z' : '-z';
      const g = group(x, rz, front);
      cube(0.6, 2.0, 0.95, fronted(rackFront, M.dark), 0, 0, 0, g);
      const p = plane(0.5, 0.25, rackLights, 0, 1.55, 0.477, '+z', g);
      p.material.polygonOffset = true; p.material.polygonOffsetFactor = -2;
      for (let i = 0; i < 4; i++) {
        const led = mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ color: rnd() < 0.3 ? 0xff5040 : 0x50ff70 }), -0.2 + i * 0.13, 0.4 + rnd() * 1.0, 0.48, g);
        led.userData.phase = rnd() * 10;
        leds.push(led);
      }
      solidify(g);
    }
  }
  // the console at the far end: Contact, sealed until everything else is hacked
  desk(10.35, 4.35, '-x', 1.4, 0.8, M.metal);
  const finale = T('contact', 'srv-core-01', { finale: true, locked: true });
  crt(10.3, 4.35, '-x', finale);
  hang('serverPanel', 0x33383f, 1.2, 0.72, 10.97, 1.8, 6.6, '-x');
  hang('worldMap', 0x2a4a6a, 1.6, 1.1, 10.97, 1.9, 2.2, '-x');
  hang('vent', 0x8a9098, 0.6, 1.2, 7.2, 2.3, 7.97, '-z');
  const red = new THREE.PointLight(0xff2a1a, 7, 10, 1.4);
  red.position.set(7, 2.9, 4.35); add(red);
  const blue = new THREE.PointLight(0x5a8cff, 3, 9, 1.4);
  blue.position.set(4.2, 2.9, 1.6); add(blue);
  for (const x of [4.5, 7, 9.5]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 10), new THREE.MeshBasicMaterial({ color: 0xff3b24 }));
    s.position.set(x, H - 0.06, 4.35); add(s);
  }

  /* ---------------------------------------------------- mood & state */
  add(new THREE.HemisphereLight(0xb8c6de, 0x3a332c, 0.75));

  let doorT = -1;   // -1 closed, 0..1 sliding open
  function unlock(instant = false) {
    finale.locked = false;
    keypad.locked = false;
    doorLamp.material.color.set(0x3cff5a);
    red.color.set(0xff6a40);
    serverDoor.userData.collider.maxY = -1;   // walk through while it slides
    doorT = instant ? 1 : 0;
  }
  function update(dt, t) {
    if (doorT >= 0 && doorT < 1) doorT = Math.min(1, doorT + dt / 1.4);
    if (doorT >= 0) serverDoor.position.z = 1.2 * doorT * doorT * (3 - 2 * doorT);
    // one tube on its way out
    flicker.intensity = Math.sin(t * 37) > 0.93 || Math.sin(t * 3.1) > 0.985 ? 1.2 : 6;
    red.intensity = finale.locked ? 5 + Math.sin(t * 4) * 3 : 4;
    for (const l of leds) l.visible = Math.sin(t * 3 + l.userData.phase * 7) > -0.3;
    const p = snowGeo.attributes.position;
    for (let i = 0; i < SNOW; i++) {
      let y = p.array[i * 3 + 1] - dt * 0.9;
      if (y < -0.3) y += 14.3;
      p.array[i * 3 + 1] = y;
      p.array[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.15;
    }
    p.needsUpdate = true;
  }

  return {
    spawn: { x: -5, y: 0, z: 6.6, yaw: 0 },
    fog: new THREE.Fog(0x0b111c, 30, 90),
    radar: { scale: 9, dot: 0.7, color: 'rgba(170,185,210,.32)', areas: [[-11, -8, 14, 16], [3.2, -8, 7.8, 8], [3.2, 0.2, 7.8, 7.8]] },
    vmLight: { sky: 0xdfe6f2, ground: 0x4a4038, hemi: 1.15, sun: 0xfff3de, sunI: 1.1 },
    verb: 'hack',
    motd: 'The office is empty tonight and every workstation is locked. Walk up to one, press E and let your <span class="accent">MacBook</span> crack it: whatever you pull off it stays on the MacBook (Tab). Hack all ten and the server room opens.',
    hint: '* Hack the workstations with your MacBook (E). Tab shows what you have.',
    unlock,
    update,
  };
}
