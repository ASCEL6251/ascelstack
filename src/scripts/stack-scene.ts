// The Layered A in 3D. Three strata, extruded from the logo's SVG paths.
// Exposes the meshes so a scroll timeline can drive them.
import * as THREE from 'three';

const PATHS: { pts: [number, number][][]; color: string }[] = [
  { color: '#94BCE3', pts: [[[50, 6], [66, 38], [34, 38]]] },
  {
    color: '#5980A6',
    pts: [[[32, 42], [68, 42], [70, 46], [80, 66], [60, 66], [50, 46], [40, 66], [20, 66], [30, 46]]],
  },
  {
    color: '#1D2D3D',
    pts: [
      [[18, 70], [38, 70], [26, 94], [6, 94]],
      [[82, 70], [62, 70], [74, 94], [94, 94]],
    ],
  },
];

const S = 0.045; // svg unit -> world unit

export interface Stack {
  group: THREE.Group;
  layers: THREE.Group[];
  materials: THREE.MeshStandardMaterial[];
  edges: THREE.LineBasicMaterial[];
  state: { mx: number; my: number; offsetX: number; offsetY: number; scale: number };
  dispose: () => void;
}

export function createStack(canvas: HTMLCanvasElement): Stack | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
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
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0.4, 15);

  // Light: cool key from upper left, soft fill, rim from behind.
  scene.add(new THREE.HemisphereLight('#f5f8ff', '#9aa6b3', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 1.8);
  key.position.set(-5, 8, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.radius = 8;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#94BCE3', 1.6);
  rim.position.set(6, 2, -6);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ color: '#1D2D3D', opacity: 0.12 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.4;
  ground.receiveShadow = true;
  scene.add(ground);

  const group = new THREE.Group();
  scene.add(group);

  const materials: THREE.MeshStandardMaterial[] = [];
  const edges: THREE.LineBasicMaterial[] = [];
  const layers: THREE.Group[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  PATHS.forEach((layer) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: layer.color,
      roughness: 0.42,
      metalness: 0.08,
      transparent: true,
      depthWrite: true,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: '#F2F2F3', transparent: true, opacity: 0.18 });
    materials.push(mat);
    edges.push(edgeMat);

    layer.pts.forEach((poly) => {
      const shape = new THREE.Shape();
      poly.forEach(([x, y], i) => {
        const px = (x - 50) * S;
        const py = (50 - y) * S;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.7,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.03,
        bevelSegments: 3,
      });
      geo.translate(0, 0, -0.35);
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);

      const eg = new THREE.EdgesGeometry(geo, 30);
      geometries.push(eg);
      g.add(new THREE.LineSegments(eg, edgeMat));
    });

    group.add(g);
    layers.push(g);
  });

  const state = { mx: 0, my: 0, offsetX: 0, offsetY: 0, scale: 1 };
  const pointer = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  // Wrapper for pointer tilt so the scroll timeline can own `group` rotation.
  const tilt = new THREE.Group();
  scene.remove(group);
  tilt.add(group);
  scene.add(tilt);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the mark a comfortable size on narrow screens.
    camera.position.z = w / h < 0.8 ? 21 : 15;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  let raf = 0;
  const clock = new THREE.Clock();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();
    state.mx += (pointer.x - state.mx) * 0.05;
    state.my += (pointer.y - state.my) * 0.05;
    tilt.rotation.y = state.mx * 0.18;
    tilt.rotation.x = state.my * 0.08;
    tilt.position.set(state.offsetX, state.offsetY + Math.sin(t * 0.8) * 0.06, 0);
    tilt.scale.setScalar(state.scale);
    renderer.render(scene, camera);
  };
  tick();

  return {
    group,
    layers,
    materials,
    edges,
    state,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
