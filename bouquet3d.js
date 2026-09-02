/* ══════════════════════════════════════════════════════════════
   BOUQUET 3D — procedural flowers rendered with Three.js
   Exposes window.Bouquet3D = { render(selectedIds, ribbonColor),
   toggleAutoRotate(), pause(), resume() }, wired from index.html's
   showResult(). Builds every flower head as real dimensional
   geometry (no photo textures — none of the 12 species have a 3D
   model or texture to source), so the look is a stylised, elegant
   rendering rather than a photoreal one.
════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const PALETTE = {
  parchment: cssVar('--color-parchment', '#F5F0EC'),
  canvas:    cssVar('--color-canvas',    '#EDECEA'),
  rose:      cssVar('--color-rose',      '#D9C5C0'),
  mauve:     cssVar('--color-mauve',     '#B89FA0'),
  sage:      cssVar('--color-sage',      '#C4C5AA'),
  stone:     cssVar('--color-stone',     '#A8A089'),
  bark:      cssVar('--color-bark',      '#2C2725'),
  muted:     cssVar('--color-muted',     '#8C7F7A'),
};
// The Bloom token set is a neutral backdrop palette — it has no botanical
// greens or saturated petal hues (same reason RIBBON_COLORS in index.html
// defines its own swatches). These two greens are the only colours here
// that aren't sourced from a token.
const STEM_GREEN = '#5E7350';
const LEAF_GREEN = '#6B8058';
const SPADIX_YELLOW = '#F4C542';

// Deterministic pseudo-random so the same bouquet always looks the same
// between renders instead of re-jittering.
function prand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ── SPECIES TABLE ───────────────────────────────────────────── */
const SPECIES = {
  sunflower:  {type:'sunflower', petal:'#F4C542', center:'#5C3E22', size:1.05},
  peony:      {type:'round', petal:'#EFB9C7', inner:'#F7D9E1', stamen:'#E8C468', layers:4, petals:7, curl:0.5, size:0.95},
  rose:       {type:'round', petal:'#C2415C', inner:'#DE7A93', stamen:null, layers:3, petals:6, curl:0.62, size:0.85},
  margarite:  {type:'daisy', petal:PALETTE.parchment, center:'#EFC94C', petals:13, size:0.8},
  'pink-alcatraz': {type:'trumpet', color:'#E7A9C0', size:1.0},
  ranunculus: {type:'round', petal:'#E8834B', inner:'#F2A868', stamen:'#8A5A2B', layers:4, petals:8, curl:0.58, size:0.85},
  sunies:     {type:'daisy', petal:'#F6D65C', center:'#8A6B2E', petals:11, size:0.65},
  dolar:      {type:'foliage', color:'#9FB39B', size:0.9},
  liry:       {type:'trumpet', color:PALETTE.parchment, size:1.1},
  alcatraz:   {type:'trumpet', color:PALETTE.parchment, size:1.0},
  anemone:    {type:'daisy', petal:PALETTE.parchment, center:PALETTE.bark, petals:9, size:0.75},
  'baby-hair':{type:'spray', color:'#FBF8F0', size:0.55},
};

/* ── GEOMETRY HELPERS ────────────────────────────────────────── */
// A petal starts as a flat plane and gets displaced into a tapered,
// gently cupped/curled blade — no external shape/texture needed.
function petalGeometry(width, length, curl, wSeg = 5, hSeg = 7) {
  const geo = new THREE.PlaneGeometry(width, length, wSeg, hSeg);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const t = y / length + 0.5; // 0 base .. 1 tip
    const taper = Math.pow(Math.sin(Math.PI * Math.min(Math.max(t, 0.001), 1)), 0.6);
    const nx = x * taper;
    const cup = curl * t * t * length * 0.55;
    const fold = -Math.pow((width ? nx / (width / 2) : 0), 2) * curl * length * 0.22;
    pos.setX(i, nx);
    pos.setZ(i, cup + fold);
  }
  geo.computeVertexNormals();
  geo.translate(0, length / 2, 0); // base at local origin, tip pointing +Y
  return geo;
}

function petalMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, side: THREE.DoubleSide, roughness: 0.55, metalness: 0,
    clearcoat: 0.12, clearcoatRoughness: 0.6, sheen: 0.35, sheenColor: 0xffffff,
  });
}

function bumpyCenter(radius, color, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const n = 1 + (prand(i * 3.7) - 0.5) * 0.14;
    pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
  }
  geo.computeVertexNormals();
  geo.scale(1, 0.62, 1);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.castShadow = true;
  return mesh;
}

// One pivot per petal: rotate around Y for placement, tilt around X to
// open/close the ring, then the petal mesh sits at the pivot's local origin
// with its base already at y=0 (see petalGeometry's translate above).
// `tilt` is the angle from vertical: 0 = petal tip points straight up (a
// closed bud), Math.PI/2 = petal points straight outward (a fully open,
// flat bloom).
function addPetalRing(group, { count, tilt, radius, width, length, curl, color, yOffset = 0, jitterSeed = 0 }) {
  const geo = petalGeometry(width, length, curl);
  const mat = petalMaterial(color);
  for (let i = 0; i < count; i++) {
    const pivot = new THREE.Object3D();
    const angle = (i / count) * Math.PI * 2 + prand(jitterSeed + i) * 0.15;
    pivot.rotation.y = angle;
    pivot.position.y = yOffset;
    const petal = new THREE.Mesh(geo, mat);
    petal.position.z = radius;
    petal.rotation.x = -tilt + (prand(jitterSeed + i * 2.2) - 0.5) * 0.12;
    petal.castShadow = true;
    pivot.add(petal);
    group.add(pivot);
  }
}

/* ── FLOWER HEAD BUILDERS ────────────────────────────────────── */
function buildRoundBloom(sp, seed) {
  const group = new THREE.Group();
  const layers = sp.layers, size = sp.size;
  for (let L = 0; L < layers; L++) {
    const t = L / Math.max(layers - 1, 1);
    const layerSize = size * (0.55 + t * 0.45);
    const count = Math.max(4, sp.petals - (layers - 1 - L));
    addPetalRing(group, {
      count,
      tilt: 0.12 + t * 1.35,
      radius: 0.03 + t * 0.05,
      width: layerSize * 0.34,
      length: layerSize * 0.58,
      curl: sp.curl - t * 0.12,
      color: L === layers - 1 ? sp.petal : (sp.inner || sp.petal),
      yOffset: (layers - L) * size * 0.03,
      jitterSeed: seed + L * 11,
    });
  }
  if (sp.stamen) {
    const stamens = bumpyCenter(size * 0.08, sp.stamen, 1);
    stamens.position.y = size * layers * 0.03 + size * 0.02;
    group.add(stamens);
  }
  return group;
}

function buildDaisyBloom(sp, seed) {
  const group = new THREE.Group();
  addPetalRing(group, {
    count: sp.petals, tilt: 1.48, radius: sp.size * 0.1,
    width: sp.size * 0.14, length: sp.size * 0.5, curl: 0.14,
    color: sp.petal, jitterSeed: seed,
  });
  const center = bumpyCenter(sp.size * 0.16, sp.center, 1);
  center.position.y = sp.size * 0.03;
  group.add(center);
  return group;
}

function buildSunflowerBloom(sp, seed) {
  const group = new THREE.Group();
  addPetalRing(group, {
    count: 21, tilt: 1.46, radius: sp.size * 0.16,
    width: sp.size * 0.1, length: sp.size * 0.62, curl: 0.16,
    color: sp.petal, jitterSeed: seed,
  });
  const center = bumpyCenter(sp.size * 0.24, sp.center, 2);
  center.position.y = sp.size * 0.04;
  group.add(center);
  return group;
}

function buildTrumpetBloom(sp, seed) {
  const group = new THREE.Group();
  const s = sp.size;
  const pts = [
    [0.015, 0], [0.05, 0.22 * s], [0.09, 0.5 * s],
    [0.17, 0.8 * s], [0.32, 1.0 * s], [0.36, 1.08 * s],
  ].map(([r, y]) => new THREE.Vector2(r * s, y));
  const geo = new THREE.LatheGeometry(pts, 22);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: sp.color, side: THREE.DoubleSide, roughness: 0.45, sheen: 0.3, sheenColor: 0xffffff,
  }));
  mesh.rotation.x = 0.55 + (prand(seed) - 0.5) * 0.2;
  mesh.castShadow = true;
  group.add(mesh);
  const spadix = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.5 * s, 8),
    new THREE.MeshStandardMaterial({ color: SPADIX_YELLOW, roughness: 0.7 })
  );
  spadix.position.copy(mesh.position);
  spadix.rotation.copy(mesh.rotation);
  spadix.translateY(0.75 * s);
  spadix.rotateX(-0.35);
  group.add(spadix);
  return group;
}

function leafGeometry(size) {
  return petalGeometry(size * 0.22, size * 0.55, 0.28, 3, 5);
}

function buildFoliageCluster(sp, seed) {
  const group = new THREE.Group();
  const geo = new THREE.CircleGeometry(sp.size * 0.11, 10);
  const mat = new THREE.MeshStandardMaterial({ color: sp.color, side: THREE.DoubleSide, roughness: 0.7 });
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const leaf = new THREE.Mesh(geo, mat);
    const side = i % 2 === 0 ? 1 : -1;
    leaf.position.set(side * sp.size * 0.13 * (0.3 + t), t * sp.size * 0.7, side * 0.01);
    leaf.rotation.set(Math.PI / 2 - 0.3, 0, side * 0.5 + (prand(seed + i) - 0.5) * 0.3);
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

function buildSpray(sp, seed) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: sp.color, roughness: 0.6 });
  const branches = 6;
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + prand(seed + i) * 0.6;
    const h = sp.size * (0.35 + prand(seed + i * 3) * 0.35);
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.01, h, 4),
      mat
    );
    twig.position.set(Math.cos(a) * sp.size * 0.1, h / 2, Math.sin(a) * sp.size * 0.1);
    twig.rotation.z = Math.cos(a) * 0.4;
    twig.rotation.x = -Math.sin(a) * 0.4;
    group.add(twig);
    const clusters = 2 + Math.floor(prand(seed + i * 5) * 3);
    for (let c = 0; c < clusters; c++) {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(sp.size * 0.05, 6, 6), mat);
      bud.position.set(
        Math.cos(a) * sp.size * 0.1 + (prand(seed + i + c) - 0.5) * sp.size * 0.12,
        h * (0.6 + c * 0.18),
        Math.sin(a) * sp.size * 0.1 + (prand(seed + i * 2 + c) - 0.5) * sp.size * 0.12
      );
      bud.castShadow = true;
      group.add(bud);
    }
  }
  return group;
}

function buildFlowerHead(id, seed) {
  const sp = SPECIES[id];
  if (!sp) return new THREE.Group();
  switch (sp.type) {
    case 'round':     return buildRoundBloom(sp, seed);
    case 'daisy':      return buildDaisyBloom(sp, seed);
    case 'sunflower':  return buildSunflowerBloom(sp, seed);
    case 'trumpet':    return buildTrumpetBloom(sp, seed);
    case 'foliage':    return buildFoliageCluster(sp, seed);
    case 'spray':      return buildSpray(sp, seed);
    default:           return new THREE.Group();
  }
}

/* ── WRAP + RIBBON ───────────────────────────────────────────── */
// Narrow gather point partway up (neckY / neckRadius) where the paper is
// cinched by the ribbon, flaring out further above it to cradle the blooms.
const WRAP_NECK_Y = 0.8;
const WRAP_NECK_R = 0.2;

function buildWrap() {
  const pts = [
    new THREE.Vector2(0.01, 0), new THREE.Vector2(0.1, 0.35),
    new THREE.Vector2(WRAP_NECK_R, WRAP_NECK_Y), new THREE.Vector2(0.24, 0.98),
    new THREE.Vector2(0.42, 1.25), new THREE.Vector2(0.5, 1.4),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.parchment, side: THREE.DoubleSide, roughness: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return { mesh, neckY: WRAP_NECK_Y };
}

function buildRibbonBow(color, neckY) {
  const group = new THREE.Group();
  const s = WRAP_NECK_R;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s, s * 0.2, 10, 32), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = neckY;
  group.add(ring);
  [-1, 1].forEach(side => {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(s * 0.55, s * 0.16, 8, 20, Math.PI * 1.5), mat);
    loop.position.set(side * s * 0.55, neckY + s * 0.06, s * 0.85);
    loop.rotation.set(0.3, 0, side * 0.9);
    group.add(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, s * 1.1, 0.02), mat);
    tail.position.set(side * s * 0.32, neckY - s * 0.65, s * 0.95);
    tail.rotation.set(0.2, 0, side * 0.15);
    group.add(tail);
  });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 12, 10), mat);
  knot.scale.set(1, 0.7, 0.8);
  knot.position.set(0, neckY + s * 0.06, s * 0.9);
  group.add(knot);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return group;
}

/* ── BOUQUET ARRANGEMENT ─────────────────────────────────────── */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_3D_FLOWERS = 30; // caps geometry cost; the flat ticket image still shows every flower

function bouquetSlot(i, total, spread) {
  const angle = i * GOLDEN_ANGLE;
  const radiusNorm = total === 1 ? 0 : Math.sqrt((i + 0.5) / total);
  const radius = radiusNorm * spread;
  const height = 1.15 + Math.cos(radiusNorm * Math.PI * 0.5) * spread * 0.9;
  return {
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius,
    outward: radiusNorm,
  };
}

function buildStem(origin, target, radius) {
  const mid = origin.clone().lerp(target, 0.55);
  const out = new THREE.Vector3(target.x, 0, target.z).normalize();
  mid.add(out.multiplyScalar(0.08)).add(new THREE.Vector3(0, 0.1, 0));
  const curve = new THREE.CatmullRomCurve3([origin, mid, target]);
  const geo = new THREE.TubeGeometry(curve, 10, radius, 6, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: STEM_GREEN, roughness: 0.65 }));
  mesh.castShadow = true;
  return mesh;
}

function buildBouquetGroup(selectedIds, ribbonColor) {
  const group = new THREE.Group();
  const { mesh: wrapMesh, neckY } = buildWrap();
  group.add(wrapMesh);

  const ids = selectedIds.slice(0, MAX_3D_FLOWERS);
  const total = ids.length || 1;
  const spread = 0.5 + 0.15 * Math.sqrt(total);

  ids.forEach((id, i) => {
    const seed = i * 7.13 + id.length * 3.1;
    const slot = bouquetSlot(i, total, spread);
    const target = new THREE.Vector3(slot.x, slot.y, slot.z);
    const originJitter = new THREE.Vector3(
      (prand(seed) - 0.5) * 0.12, 0, (prand(seed + 1) - 0.5) * 0.12
    );
    const origin = new THREE.Vector3(0, neckY - 0.05, 0).add(originJitter);

    group.add(buildStem(origin, target, 0.014));

    // Occasional leaf on the stem, skipped for species that are already
    // foliage/spray shapes.
    if (SPECIES[id] && !['foliage', 'spray'].includes(SPECIES[id].type) && prand(seed + 2) > 0.4) {
      const leaf = new THREE.Mesh(leafGeometry(SPECIES[id].size || 1), new THREE.MeshStandardMaterial({ color: LEAF_GREEN, side: THREE.DoubleSide, roughness: 0.65 }));
      const leafPt = origin.clone().lerp(target, 0.4 + prand(seed + 3) * 0.2);
      leaf.position.copy(leafPt);
      leaf.rotation.set(-Math.PI / 2 + 0.4, prand(seed + 4) * Math.PI * 2, 0);
      leaf.castShadow = true;
      group.add(leaf);
    }

    const head = buildFlowerHead(id, seed);
    head.position.copy(target);
    const dir = new THREE.Vector3(slot.x, 0, slot.z).normalize();
    const tiltAmount = 0.25 + slot.outward * 0.5;
    const headUp = new THREE.Vector3(0, 1, 0).lerp(dir, tiltAmount).normalize();
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), headUp);
    head.rotateOnWorldAxis(headUp, prand(seed + 5) * Math.PI * 2);
    group.add(head);
  });

  group.add(buildRibbonBow(ribbonColor || PALETTE.rose, neckY));

  return group;
}

function disposeObject(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m.dispose());
    }
  });
}

/* ── SCENE ────────────────────────────────────────────────────── */
class BouquetScene {
  constructor(container) {
    this.container = container;
    this.ready = false;
    this.unsupported = false;
    this.flowerGroup = null;
    this._pendingRetries = 0;
  }

  _init() {
    if (this.ready || this.unsupported || !this.container) return;
    if (this.container.clientWidth < 4 || this.container.clientHeight < 4) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      this.unsupported = true;
      this.container.closest('#bouquet3d-wrap')?.style.setProperty('display', 'none');
      return;
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    const hemi = new THREE.HemisphereLight(0xfff6ea, PALETTE.bark, 0.85);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff6e8, 1.25);
    key.position.set(2.2, 3.2, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
    key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 10;
    key.shadow.radius = 6;
    key.shadow.bias = -0.002;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8ee, 0.7);
    fill.position.set(-2.5, 1.5, -1.5);
    this.scene.add(fill);

    // A fixed, generously-sized ground plane — kept out of flowerGroup so
    // _frame()'s bounding-box fit measures only the bouquet, not this plane.
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.2 })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.02;
    shadowMesh.receiveShadow = true;
    this.scene.add(shadowMesh);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.9;
    this.controls.maxPolarAngle = 1.85;
    this.controls.autoRotateSpeed = 1.1;

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.container);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(); else if (this._shouldRun) this.resume();
    });

    this.ready = true;
    this._resize();
    this._animate();
  }

  _resize() {
    if (!this.ready) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w < 4 || h < 4) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.flowerGroup) this._frame(this.flowerGroup);
  }

  _frame(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const fitHeight = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const fitWidth = fitHeight / this.camera.aspect;
    const distance = 1.4 * Math.max(fitHeight, fitWidth);
    const dir = new THREE.Vector3(0.45, 0.22, 1).normalize();
    this.camera.position.copy(center).add(dir.multiplyScalar(distance));
    this.camera.near = distance / 100;
    this.camera.far = distance * 50;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.minDistance = distance * 0.55;
    this.controls.maxDistance = distance * 1.9;
    this.controls.update();
  }

  _animate() {
    this._shouldRun = true;
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  pause() { this._shouldRun = false; this.renderer?.setAnimationLoop(null); }
  resume() { if (this.ready && !this._shouldRun) this._animate(); }

  toggleAutoRotate() {
    if (!this.controls) return false;
    this.controls.autoRotate = !this.controls.autoRotate;
    return this.controls.autoRotate;
  }

  render(selectedIds, ribbonColor) {
    if (!selectedIds || !selectedIds.length || this.unsupported) return;
    this._init();
    if (!this.ready) {
      // container still unlaid-out (e.g. screen just became visible) — retry
      // for a bit, then give up so a permanently-hidden/broken container
      // can't spin requestAnimationFrame forever.
      if (this._pendingRetries++ > 60) return;
      requestAnimationFrame(() => this.render(selectedIds, ribbonColor));
      return;
    }
    this._pendingRetries = 0;
    if (this.flowerGroup) {
      this.scene.remove(this.flowerGroup);
      disposeObject(this.flowerGroup);
    }
    this.flowerGroup = buildBouquetGroup(selectedIds, ribbonColor);
    this.scene.add(this.flowerGroup);
    this._frame(this.flowerGroup);
    this.resume();
  }
}

const container = document.getElementById('bouquet3d-canvas');
window.Bouquet3D = new BouquetScene(container);
