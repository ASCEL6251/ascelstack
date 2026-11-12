// Three rounded slabs (Build · Grow · Run) for the /projects hero.
// Same light and material language as stack-scene.ts so the two read as one family.
import * as THREE from 'three';

export interface Slabs {
  group: THREE.Group;
  layers: THREE.Mesh[];
  state: { spread: number; spin: number; scale: number };
  dispose: () => void;
}

const COLORS = ['#1D2D3D', '#5980A6', '#94BCE3']; // bottom → top: Build, Grow, Run

function roundedSlab(w: number, d: number, r: number, h: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 10,
  });
  // Extrude runs along Z; lay it flat so thickness is vertical.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  return geo;
}

export function createSlabs(canvas: HTMLCanvasElement): Slabs | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(7.5, 6.2, 7.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#f5f8ff', '#9aa6b3', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 1.8);
  key.position.set(-4, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 8;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#94BCE3', 1.4);
  rim.position.set(5, 2, -6);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ color: '#1D2D3D', opacity: 0.12 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.1;
  ground.receiveShadow = true;
  scene.add(ground);

  const group = new THREE.Group();
  scene.add(group);

  const geo = roundedSlab(2.2, 2.2, 0.35, 0.32);
  const edgeGeo = new THREE.EdgesGeometry(geo, 30);
  const mats: THREE.Material[] = [];
  const layers = COLORS.map((color, i) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08 });
    const edge = new THREE.LineBasicMaterial({ color: '#F2F2F3', transparent: true, opacity: 0.2 });
    mats.push(mat, edge);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.add(new THREE.LineSegments(edgeGeo, edge));
    m.position.y = (i - 1) * 0.42;
    group.add(m);
    return m;
  });

  const state = { spread: 0, spin: 0, scale: 1 };
  const pointer = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  let raf = 0;
  let mx = 0;
  let my = 0;
  const clock = new THREE.Clock();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();
    mx += (pointer.x - mx) * 0.05;
    my += (pointer.y - my) * 0.05;
    layers.forEach((m, i) => {
      // Gap opens with `spread`; each slab breathes a little out of phase.
      m.position.y = (i - 1) * (0.42 + state.spread * 0.75) + Math.sin(t * 1.1 + i) * 0.03;
      m.rotation.y = state.spin * (i - 1) * 0.35;
    });
    group.rotation.y = t * 0.12 + mx * 0.25;
    group.rotation.x = my * 0.06;
    group.scale.setScalar(state.scale);
    renderer.render(scene, camera);
  };
  tick();

  return {
    group,
    layers,
    state,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      geo.dispose();
      edgeGeo.dispose();
      mats.forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
