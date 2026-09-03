/* ══════════════════════════════════════════════════════════════
   BOUQUET 3D — procedural flowers rendered with Three.js
   Exposes window.Bouquet3D = { render(selectedIds, ribbonColor),
   toggleAutoRotate(), pause(), resume() }, wired from index.html's
   showResult(). Every flower head is built as real geometry — smooth,
   rounded "clay toy" petals (no photo textures, no external 3D
   models), so the look is a bright, glossy stylised rendering rather
   than a photoreal one.
════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const PALETTE = {
  parchment: cssVar('--color-parchment', '#F5F0EC'),
  rose:      cssVar('--color-rose',      '#D9C5C0'),
  bark:      cssVar('--color-bark',      '#2C2725'),
};
// The Bloom token set is a neutral backdrop palette — it has no bright
// saturated petal/foliage hues (same reason RIBBON_COLORS in index.html
// defines its own swatches). Everything below is a toy-bright "clay
// render" palette chosen to match that look, not sourced from tokens.
const STEM_GREEN = '#7FBF63';
const SPADIX_YELLOW = '#FFC93F';

// Deterministic pseudo-random so the same bouquet always looks the same
// between renders instead of re-jittering.
function prand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function smoothstep(x, a, b) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/* ── SPECIES TABLE ───────────────────────────────────────────────
   `form` picks the builder: 'daisy' (flat, big rounded petals + a
   bright disc centre), 'tulip' (closed, cupped petals, no visible
   centre), 'trumpet' (calla/lily funnel), 'foliage' (small rounded
   leaves) or 'bud' (a sprig of small rounded buds). */
const SPECIES = {
  sunflower:  {form:'daisy',  petal:'#FFC63A', center:'#B9631F', petals:8, size:1.05},
  peony:      {form:'tulip',  petal:'#FF8FAE', inner:'#FFB5C9', petals:6, size:0.95},
  rose:       {form:'tulip',  petal:'#FF5D73', inner:'#FF8797', petals:6, size:0.85},
  margarite:  {form:'daisy',  petal:'#FFFFFF', center:'#FFC93F', petals:7, size:0.8},
  'pink-alcatraz': {form:'trumpet', color:'#FF8FC6', size:1.0},
  ranunculus: {form:'tulip',  petal:'#FFA23F', inner:'#FFBE71', petals:7, size:0.85},
  sunies:     {form:'daisy',  petal:'#FFD93F', center:'#E8891A', petals:7, size:0.62},
  dolar:      {form:'foliage', color:'#8FCB6B', size:0.9},
  liry:       {form:'trumpet', color:'#FFF6EA', size:1.1},
  alcatraz:   {form:'trumpet', color:'#FFFFFF', size:1.0},
  anemone:    {form:'daisy',  petal:'#FFFFFF', center:PALETTE.bark, petals:7, size:0.75},
  'baby-hair':{form:'bud',    color:'#FFF6E8', size:0.55},
};

/* ── GEOMETRY HELPERS ────────────────────────────────────────── */
// A smooth, puffy "clay" petal: a sphere tapered to a point at its base
// (where it attaches) and left full and rounded toward the tip — no flat
// faces, no visible polygon edges.
function petalBlobGeometry(width, length, thickness) {
  const geo = new THREE.SphereGeometry(0.5, 16, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = smoothstep(y, -0.5, 0.05); // 0 at base .. 1 by a bit above centre
    const widthScale = 0.1 + 0.9 * t;
    pos.setXYZ(i, x * widthScale * width, (y + 0.5) * length, z * widthScale * thickness);
  }
  geo.computeVertexNormals();
  return geo;
}

function petalMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, side: THREE.DoubleSide, roughness: 0.3, metalness: 0,
    clearcoat: 0.35, clearcoatRoughness: 0.2,
  });
}

function smoothCenter(radius, color) {
  const geo = new THREE.SphereGeometry(radius, 20, 14);
  geo.scale(1, 0.6, 1);
  const mesh = new THREE.Mesh(geo, petalMaterial(color));
  return mesh;
}

// One pivot per petal: rotate around Y for placement, tilt around X to
// open/close the ring. `tilt` is the angle from vertical: 0 = petal tip
// points straight up (closed bud), ~1.4 = petal points outward (flat,
// open bloom). Petals don't cast/receive shadows on each other — at this
// scale that just muddies the bright, flat "clay" look.
function addPetalRing(group, { count, tilt, radius, width, length, thickness, color, yOffset = 0, jitterSeed = 0 }) {
  const geo = petalBlobGeometry(width, length, thickness);
  const mat = petalMaterial(color);
  for (let i = 0; i < count; i++) {
    const pivot = new THREE.Object3D();
    const angle = (i / count) * Math.PI * 2 + prand(jitterSeed + i) * 0.1;
    pivot.rotation.y = angle;
    pivot.position.y = yOffset;
    const petal = new THREE.Mesh(geo, mat);
    petal.position.z = radius;
    petal.rotation.x = -tilt + (prand(jitterSeed + i * 2.2) - 0.5) * 0.06;
    pivot.add(petal);
    group.add(pivot);
  }
}

/* ── FLOWER HEAD BUILDERS ────────────────────────────────────── */
function buildDaisyForm(sp, seed) {
  const group = new THREE.Group();
  addPetalRing(group, {
    count: sp.petals, tilt: 1.3, radius: sp.size * 0.1,
    width: sp.size * 0.42, length: sp.size * 0.56, thickness: sp.size * 0.18,
    color: sp.petal, jitterSeed: seed,
  });
  const center = smoothCenter(sp.size * 0.22, sp.center);
  center.position.y = sp.size * 0.06;
  group.add(center);
  return group;
}

function buildTulipForm(sp, seed) {
  const group = new THREE.Group();
  addPetalRing(group, {
    count: sp.petals, tilt: 0.34, radius: sp.size * 0.05,
    width: sp.size * 0.48, length: sp.size * 0.72, thickness: sp.size * 0.24,
    color: sp.petal, jitterSeed: seed,
  });
  addPetalRing(group, {
    count: Math.max(4, sp.petals - 2), tilt: 0.15, radius: sp.size * 0.02,
    width: sp.size * 0.34, length: sp.size * 0.5, thickness: sp.size * 0.2,
    color: sp.inner || sp.petal, jitterSeed: seed + 50,
  });
  return group;
}

function buildTrumpetForm(sp, seed) {
  const group = new THREE.Group();
  const s = sp.size;
  const pts = [
    [0.02, 0], [0.06, 0.22 * s], [0.11, 0.5 * s],
    [0.2, 0.8 * s], [0.34, 1.0 * s], [0.38, 1.06 * s],
  ].map(([r, y]) => new THREE.Vector2(r * s, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: sp.color, side: THREE.DoubleSide, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.2,
  }));
  mesh.rotation.x = 0.5 + (prand(seed) - 0.5) * 0.15;
  group.add(mesh);
  const spadix = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.025 * s, 0.4 * s, 4, 8),
    new THREE.MeshPhysicalMaterial({ color: SPADIX_YELLOW, roughness: 0.35, clearcoat: 0.3 })
  );
  spadix.position.copy(mesh.position);
  spadix.rotation.copy(mesh.rotation);
  spadix.translateY(0.7 * s);
  spadix.rotateX(-0.3);
  group.add(spadix);
  return group;
}

function buildFoliageForm(sp) {
  const group = new THREE.Group();
  const mat = petalMaterial(sp.color);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const leaf = new THREE.Mesh(petalBlobGeometry(sp.size * 0.32, sp.size * 0.32, sp.size * 0.14), mat);
    const side = i % 2 === 0 ? 1 : -1;
    leaf.position.set(side * sp.size * 0.16 * (0.3 + t), t * sp.size * 0.68, 0);
    leaf.rotation.z = side * (Math.PI / 2 - 0.35);
    group.add(leaf);
  }
  return group;
}

function buildBudForm(sp, seed) {
  const group = new THREE.Group();
  const petalMat = petalMaterial(sp.color);
  const stemMat = new THREE.MeshPhysicalMaterial({ color: STEM_GREEN, roughness: 0.4, clearcoat: 0.25 });
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const h = sp.size * (0.3 + t * 0.7);
    const side = i % 2 === 0 ? 1 : -1;
    const lean = side * sp.size * 0.14 * t;
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * sp.size, 0.014 * sp.size, h, 6), stemMat);
    twig.position.set(lean / 2, h / 2, 0);
    twig.rotation.z = -side * 0.18 * t;
    group.add(twig);
    const bud = new THREE.Mesh(petalBlobGeometry(sp.size * 0.26, sp.size * 0.34, sp.size * 0.26), petalMat);
    bud.position.set(lean, h, 0);
    bud.rotation.z = Math.PI + prand(seed + i) * 0.3;
    group.add(bud);
  }
  return group;
}

function buildFlowerHead(id, seed) {
  const sp = SPECIES[id];
  if (!sp) return new THREE.Group();
  switch (sp.form) {
    case 'daisy':   return buildDaisyForm(sp, seed);
    case 'tulip':   return buildTulipForm(sp, seed);
    case 'trumpet': return buildTrumpetForm(sp, seed);
    case 'foliage': return buildFoliageForm(sp);
    case 'bud':     return buildBudForm(sp, seed);
    default:        return new THREE.Group();
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
  const mat = new THREE.MeshPhysicalMaterial({ color: PALETTE.parchment, side: THREE.DoubleSide, roughness: 0.55, clearcoat: 0.15 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return { mesh, neckY: WRAP_NECK_Y };
}

function buildRibbonBow(color, neckY) {
  const group = new THREE.Group();
  const s = WRAP_NECK_R;
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s, s * 0.2, 12, 32), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = neckY;
  group.add(ring);
  [-1, 1].forEach(side => {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(s * 0.55, s * 0.18, 10, 24, Math.PI * 1.5), mat);
    loop.position.set(side * s * 0.55, neckY + s * 0.06, s * 0.85);
    loop.rotation.set(0.3, 0, side * 0.9);
    group.add(loop);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(s * 0.13, s * 0.85, 4, 8), mat);
    tail.position.set(side * s * 0.32, neckY - s * 0.65, s * 0.95);
    tail.rotation.set(0.2, 0, side * 0.15);
    group.add(tail);
  });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(s * 0.32, 14, 12), mat);
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
  const height = 1.15 + Math.cos(radiusNorm * Math.PI * 0.5) * spread * 0.75;
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
  mid.add(out.multiplyScalar(0.06)).add(new THREE.Vector3(0, 0.08, 0));
  const curve = new THREE.CatmullRomCurve3([origin, mid, target]);
  const geo = new THREE.TubeGeometry(curve, 12, radius, 8, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: STEM_GREEN, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.3 }));
  mesh.castShadow = true;
  return mesh;
}

function buildBouquetGroup(selectedIds, ribbonColor) {
  const group = new THREE.Group();
  const { mesh: wrapMesh, neckY } = buildWrap();
  group.add(wrapMesh);

  const ids = selectedIds.slice(0, MAX_3D_FLOWERS);
  const total = ids.length || 1;
  const spread = 0.36 + 0.11 * Math.sqrt(total);

  ids.forEach((id, i) => {
    const seed = i * 7.13 + id.length * 3.1;
    const slot = bouquetSlot(i, total, spread);
    const target = new THREE.Vector3(slot.x, slot.y, slot.z);
    const originJitter = new THREE.Vector3(
      (prand(seed) - 0.5) * 0.08, 0, (prand(seed + 1) - 0.5) * 0.08
    );
    const origin = new THREE.Vector3(0, neckY - 0.05, 0).add(originJitter);

    group.add(buildStem(origin, target, 0.02));

    const head = buildFlowerHead(id, seed);
    head.position.copy(target);
    const dir = new THREE.Vector3(slot.x, 0, slot.z).normalize();
    const tiltAmount = 0.15 + slot.outward * 0.4;
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
    renderer.toneMappingExposure = 1.1;
    this.container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    const hemi = new THREE.HemisphereLight(0xfffaf0, PALETTE.bark, 1.05);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfffaf0, 1.05);
    key.position.set(2.2, 3.2, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
    key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 10;
    key.shadow.radius = 6;
    key.shadow.bias = -0.002;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe8f0f4, 0.6);
    fill.position.set(-2.5, 1.5, -1.5);
    this.scene.add(fill);

    // A fixed, generously-sized ground plane — kept out of flowerGroup so
    // _frame()'s bounding-box fit measures only the bouquet, not this plane.
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.16 })
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
