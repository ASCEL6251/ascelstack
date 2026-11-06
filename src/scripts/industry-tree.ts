// Service trees: one procedural 3D tree per industry.
// Trunk = the industry, branches = service groups (one leaf per service),
// roots under a glass ground = the registrations and compliance it stands on.
import * as THREE from 'three';
import type { Industry } from '../data/industries';

const LAYER_COLOR = { build: '#94BCE3', grow: '#5980A6', run: '#1D2D3D' } as const;
const GROUND_Y = -1.15;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (g: number, a: number, b: number) => clamp01((g - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const backOut = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Growable {
  tubes: { geo: THREE.TubeGeometry; from: number; to: number }[];
  pops: { obj: THREE.Object3D; at: number; size: number }[];
  labels: { el: HTMLElement; anchor: THREE.Object3D; at: number }[];
  group: THREE.Group;
}

function tube(curve: THREE.Curve<THREE.Vector3>, r: number, mat: THREE.Material, segs = 48) {
  const geo = new THREE.TubeGeometry(curve, segs, r, 10, false);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, mat);
  return { geo, mesh };
}

function setTube(geo: THREE.TubeGeometry, p: number) {
  const total = geo.index ? geo.index.count : 0;
  geo.setDrawRange(0, Math.floor((total * p) / 6) * 6);
}

/** Points spread evenly on a sphere (Fibonacci lattice). */
function fib(n: number, r: number) {
  const pts: THREE.Vector3[] = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = g * i;
    pts.push(new THREE.Vector3(Math.cos(th) * rad * r, y * r * 0.8 + r * 0.15, Math.sin(th) * rad * r));
  }
  return pts;
}

function makeLabel(host: HTMLElement, name: string, count: number, kind: 'branch' | 'root', layer?: string) {
  const el = document.createElement('div');
  el.className = `tree-label tree-label--${kind}${layer ? ` is-${layer}` : ''}`;
  el.innerHTML = `<span class="tl-n"></span><span class="tl-c"></span>`;
  el.querySelector('.tl-n')!.textContent = name;
  el.querySelector('.tl-c')!.textContent = String(count);
  host.appendChild(el);
  return el;
}

function buildTree(ind: Industry, host: HTMLElement, seed: number): Growable {
  const group = new THREE.Group();
  const tubes: Growable['tubes'] = [];
  const pops: Growable['pops'] = [];
  const labels: Growable['labels'] = [];

  const barkMat = new THREE.MeshStandardMaterial({ color: '#1D2D3D', roughness: 0.55, metalness: 0.1 });
  const twigMat = new THREE.MeshStandardMaterial({ color: '#2E4560', roughness: 0.5, metalness: 0.1 });
  const rootMat = new THREE.MeshStandardMaterial({ color: '#5980A6', roughness: 0.4, metalness: 0.15, transparent: true, opacity: 0.85 });

  // Trunk
  const trunkTop = new THREE.Vector3(0.05, 0.35, 0);
  const trunk = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, GROUND_Y, 0),
    new THREE.Vector3(-0.05, -0.5, 0.02),
    trunkTop,
  ]);
  const t = tube(trunk, 0.075, barkMat, 40);
  group.add(t.mesh);
  tubes.push({ geo: t.geo, from: 0.0, to: 0.22 });

  // Branches
  const n = ind.branches.length;
  ind.branches.forEach((b, i) => {
    const a = (i / n) * Math.PI * 2 + seed;
    const y0 = -0.35 + (i / Math.max(1, n - 1)) * 0.65;
    const reach = 1.45 + (i % 2) * 0.25;
    const start = trunk.getPoint(clamp01((y0 - GROUND_Y) / (trunkTop.y - GROUND_Y)));
    const end = new THREE.Vector3(Math.cos(a) * reach, y0 + 1.15 + (i % 2) * 0.25, Math.sin(a) * reach);
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(Math.cos(a) * 0.55, y0 + 0.55, Math.sin(a) * 0.55),
      end,
    ]);
    const from = 0.18 + (i / n) * 0.3;
    const to = from + 0.22;
    const br = tube(curve, 0.034, twigMat, 36);
    group.add(br.mesh);
    tubes.push({ geo: br.geo, from, to });

    // Node at the branch tip, sized by service count
    const color = LAYER_COLOR[b.layer];
    const node = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.1 + b.count * 0.012, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2, flatShading: true }),
    );
    node.position.copy(end);
    group.add(node);
    pops.push({ obj: node, at: to, size: 1 });

    // One leaf per service, with a twig back to the node
    const leafGeo = new THREE.SphereGeometry(0.045, 12, 10);
    const leafMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: b.layer === 'run' ? 0.05 : 0.18,
    });
    const twigPts: number[] = [];
    fib(b.count, 0.34 + b.count * 0.012).forEach((p, k) => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(end).add(p);
      group.add(leaf);
      pops.push({ obj: leaf, at: to + 0.02 + k * 0.012, size: 1 });
      twigPts.push(end.x, end.y, end.z, leaf.position.x, leaf.position.y, leaf.position.z);
    });
    const twigGeo = new THREE.BufferGeometry();
    twigGeo.setAttribute('position', new THREE.Float32BufferAttribute(twigPts, 3));
    const twigs = new THREE.LineSegments(twigGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }));
    group.add(twigs);
    pops.push({ obj: twigs, at: to + 0.02, size: 1 });

    const anchor = new THREE.Object3D();
    anchor.position.copy(end).add(new THREE.Vector3(0, 0.45 + b.count * 0.012, 0));
    group.add(anchor);
    labels.push({ el: makeLabel(host, b.name, b.count, 'branch', b.layer), anchor, at: to + 0.05 });
  });

  // Roots, below the glass ground
  const m = ind.roots.length;
  ind.roots.forEach((r, j) => {
    const a = (j / m) * Math.PI * 2 + seed + 0.9;
    const depth = GROUND_Y - 0.75 - (j % 2) * 0.18;
    const end = new THREE.Vector3(Math.cos(a) * 1.25, depth, Math.sin(a) * 1.25);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, GROUND_Y + 0.02, 0),
      new THREE.Vector3(Math.cos(a) * 0.35, GROUND_Y - 0.4, Math.sin(a) * 0.35),
      end,
    ]);
    const from = 0.05 + j * 0.06;
    const rt = tube(curve, 0.028, rootMat, 32);
    group.add(rt.mesh);
    tubes.push({ geo: rt.geo, from, to: from + 0.2 });

    const node = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09 + r.count * 0.006, 0),
      new THREE.MeshStandardMaterial({ color: '#5980A6', roughness: 0.3, metalness: 0.3, flatShading: true }),
    );
    node.position.copy(end);
    group.add(node);
    pops.push({ obj: node, at: from + 0.2, size: 1 });

    // Root hairs: one per service in the compliance group
    const hairGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const hairMat = new THREE.MeshBasicMaterial({ color: '#94BCE3' });
    for (let k = 0; k < r.count; k++) {
      const p = curve.getPoint(0.35 + (k / r.count) * 0.6);
      const off = new THREE.Vector3(Math.sin(k * 2.4) * 0.09, Math.cos(k * 1.7) * 0.06, Math.cos(k * 2.4) * 0.09);
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.copy(p).add(off);
      group.add(hair);
      pops.push({ obj: hair, at: from + 0.1 + k * 0.008, size: 1 });
    }

    const anchor = new THREE.Object3D();
    anchor.position.copy(end).add(new THREE.Vector3(0, -0.3, 0));
    group.add(anchor);
    labels.push({ el: makeLabel(host, r.name, r.count, 'root'), anchor, at: from + 0.22 });
  });

  return { tubes, pops, labels, group };
}

export interface TreeScene {
  setGrow: (i: number, g: number) => void;
  dispose: () => void;
}

export function createTreeScene(canvas: HTMLCanvasElement, labelHost: HTMLElement, inds: Industry[]): TreeScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const target = new THREE.Vector3(0, -0.45, 0);

  scene.add(new THREE.HemisphereLight('#f6f9ff', '#8794a3', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 1.8);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#94BCE3', 1.4);
  rim.position.set(5, 1, -5);
  scene.add(rim);

  // Glass ground with survey rings — roots read through it.
  const ground = new THREE.Group();
  ground.position.y = GROUND_Y;
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.05, 96),
    new THREE.MeshStandardMaterial({ color: '#F2F2F3', transparent: true, opacity: 0.32, roughness: 0.2, depthWrite: false }),
  );
  ground.add(disc);
  [0.9, 1.75, 2.6].forEach((r, i) => {
    const pts = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2).getPoints(128).map((p) => new THREE.Vector3(p.x, 0.03, p.y));
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: '#5980A6', transparent: true, opacity: i === 2 ? 0.5 : 0.22 }),
    );
    ground.add(ring);
  });
  scene.add(ground);

  const world = new THREE.Group();
  scene.add(world);
  const trees = inds.map((ind, i) => {
    const t = buildTree(ind, labelHost, i * 1.3 + 0.3);
    t.group.visible = false;
    t.pops.forEach((p) => p.obj.scale.setScalar(0.0001));
    t.labels.forEach((l) => (l.el.style.opacity = '0'));
    world.add(t.group);
    return t;
  });
  const grow = inds.map(() => 0);

  const apply = (i: number) => {
    const g = grow[i];
    const t = trees[i];
    t.group.visible = g > 0.001;
    t.tubes.forEach((tb) => setTube(tb.geo, easeOut(seg(g, tb.from, tb.to))));
    t.pops.forEach((p) => {
      const s = backOut(seg(g, p.at, p.at + 0.08));
      p.obj.scale.setScalar(Math.max(0.0001, s * p.size));
    });
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = w / h < 0.9 ? 8.6 : 9.2;
    camera.position.set(0, 0.55, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  const v = new THREE.Vector3();
  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const time = clock.getElapsedTime();
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    world.rotation.y = time * 0.12 + pointer.sx * 0.35;
    world.rotation.x = pointer.sy * 0.05;
    ground.rotation.y = world.rotation.y;
    renderer.render(scene, camera);

    // Project labels onto the HTML overlay
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    trees.forEach((t, i) => {
      const g = grow[i];
      t.labels.forEach((l) => {
        const o = seg(g, l.at, l.at + 0.08);
        if (o <= 0) {
          l.el.style.opacity = '0';
          return;
        }
        l.anchor.getWorldPosition(v);
        v.project(camera);
        const behind = v.z > 1;
        l.el.style.opacity = behind ? '0' : String(o);
        l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      });
    });
  };
  tick();

  return {
    setGrow(i, g) {
      if (grow[i] === g) return;
      grow[i] = g;
      apply(i);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      renderer.dispose();
    },
  };
}
