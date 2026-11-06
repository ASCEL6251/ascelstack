// "How a business works" as a loop: six stations on a 3D ring.
// Scroll drives a pulse around the ring; the ring turns so the pulse stays in
// front, and each station it reaches switches from grey (done by hand) to the
// brand colour (run by the stack) and gets wired to the hub in the middle.
import * as THREE from 'three';

export interface OrbitStep {
  short: string;
  layer: 'build' | 'grow' | 'run';
}

export interface OrbitScene {
  /** s runs from 0 (first station) to steps.length (pulse back at the start). */
  setTarget(s: number): void;
  dispose(): void;
}

const LAYER_COLOR = { build: '#94BCE3', grow: '#5980A6', run: '#1D2D3D' } as const;
const MANUAL = new THREE.Color('#BFC2C6');
const TAU = Math.PI * 2;
const R = 2.55;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

function setTube(geo: THREE.BufferGeometry, p: number) {
  const total = geo.index ? geo.index.count : 0;
  geo.setDrawRange(0, Math.floor((total * clamp01(p)) / 6) * 6);
}

/** One small object per step, built from primitives so each reads differently. */
function stationShape(i: number, mat: THREE.Material) {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (i) {
    case 0: // a lead: a message bubble
      add(new THREE.SphereGeometry(0.26, 32, 20)).scale.set(1.15, 0.85, 0.8);
      add(new THREE.ConeGeometry(0.09, 0.16, 12), -0.16, -0.2, 0).rotation.z = 0.7;
      break;
    case 1: // a closed sale: a gem
      add(new THREE.OctahedronGeometry(0.3, 0)).scale.set(1, 1.25, 1);
      break;
    case 2: // an order: a parcel
      add(new THREE.BoxGeometry(0.44, 0.36, 0.44));
      add(new THREE.BoxGeometry(0.46, 0.05, 0.1), 0, 0.17, 0);
      break;
    case 3: // an invoice: a fanned stack of sheets
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.34, 0.03, 0.46), 0, -0.12 + k * 0.1, 0).rotation.y = k * 0.22;
      break;
    case 4: // support: a ring
      add(new THREE.TorusGeometry(0.22, 0.085, 16, 40));
      break;
    default: // numbers: rising bars
      [0.22, 0.38, 0.56].forEach((h, k) => add(new THREE.BoxGeometry(0.12, h, 0.12), -0.15 + k * 0.15, h / 2 - 0.28, 0));
  }
  return g;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(29,45,61,0.16)');
  grd.addColorStop(0.55, 'rgba(29,45,61,0.05)');
  grd.addColorStop(0.85, 'rgba(29,45,61,0)');
  grd.addColorStop(1, 'rgba(29,45,61,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createOrbitScene(
  canvas: HTMLCanvasElement,
  labelHost: HTMLElement,
  steps: OrbitStep[],
  onFrame: (s: number) => void,
): OrbitScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const N = steps.length;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const lookAt = new THREE.Vector3(0, -0.15, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d3de', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 1.8);
  key.position.set(3, 6, 5);
  scene.add(key);
  const pulseLight = new THREE.PointLight('#94BCE3', 6, 3.2, 2);
  scene.add(pulseLight);

  // Soft floor shadow under the whole ring.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2.7, R * 2.7),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.62;
  scene.add(floor);

  // Everything that turns lives in `ring`.
  const ring = new THREE.Group();
  scene.add(ring);

  const pointAt = (a: number, r = R, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

  // Track (full loop, faint) and progress (drawn as the pulse travels).
  const loop = new THREE.CatmullRomCurve3(
    Array.from({ length: 96 }, (_, k) => pointAt((k / 96) * TAU)),
    true,
  );
  const track = new THREE.Mesh(
    new THREE.TubeGeometry(loop, 240, 0.018, 8, true),
    new THREE.MeshStandardMaterial({ color: '#C7C7C9', roughness: 0.8 }),
  );
  ring.add(track);
  const progGeo = new THREE.TubeGeometry(loop, 240, 0.042, 10, true);
  const prog = new THREE.Mesh(progGeo, new THREE.MeshStandardMaterial({ color: '#5980A6', roughness: 0.35, metalness: 0.2 }));
  ring.add(prog);

  // Hub: three stacked discs that spin faster as more of the loop is automated.
  const hub = new THREE.Group();
  const discs = (['build', 'grow', 'run'] as const).map((l, k) => {
    const d = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62 - k * 0.04, 0.62 - k * 0.04, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: LAYER_COLOR[l], roughness: 0.45, metalness: 0.1 }),
    );
    d.position.y = 0.2 - k * 0.17;
    hub.add(d);
    return d;
  });
  ring.add(hub);

  // Stations.
  const stations = steps.map((st, i) => {
    const a = (i / N) * TAU;
    const mat = new THREE.MeshStandardMaterial({ color: MANUAL.clone(), roughness: 0.55, metalness: 0.05 });
    const brand = new THREE.Color(LAYER_COLOR[st.layer]);
    const holder = new THREE.Group();
    holder.position.copy(pointAt(a, R, 0.08));
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.44, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: '#FAFAFB', roughness: 0.6 }),
    );
    plinth.position.y = -0.3;
    holder.add(plinth);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.012, 8, 64),
      new THREE.MeshBasicMaterial({ color: brand, transparent: true, opacity: 0 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.26;
    holder.add(halo);
    const shape = stationShape(i, mat);
    holder.add(shape);
    ring.add(holder);

    // Spoke from the hub, drawn when the station is automated.
    const spokeCurve = new THREE.QuadraticBezierCurve3(
      pointAt(a, 0.62, 0.02),
      pointAt(a, R * 0.55, 0.32),
      pointAt(a, R - 0.42, -0.2),
    );
    const spokeGeo = new THREE.TubeGeometry(spokeCurve, 40, 0.014, 6, false);
    setTube(spokeGeo, 0);
    ring.add(new THREE.Mesh(spokeGeo, new THREE.MeshBasicMaterial({ color: '#94BCE3' })));

    const label = document.createElement('div');
    label.className = 'orbit-label';
    label.innerHTML = '<b></b><span></span>';
    label.querySelector('b')!.textContent = String(i + 1);
    label.querySelector('span')!.textContent = st.short;
    labelHost.appendChild(label);

    return { a, mat, brand, holder, shape, halo, spokeGeo, label };
  });

  // The pulse that travels the loop.
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#94BCE3', emissiveIntensity: 1.4 }),
  );
  ring.add(pulse);

  // Sizing.
  let w = 1;
  let h = 1;
  const resize = () => {
    const box = canvas.parentElement!.getBoundingClientRect();
    w = Math.max(1, box.width);
    h = Math.max(1, box.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = camera.aspect < 1.25 ? 10.4 / Math.max(camera.aspect, 0.7) : 9.8;
    camera.position.set(0, dist * 0.42, dist);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement!);
  resize();

  // Loop: ease the shown value toward the scroll target so motion stays smooth.
  let target = 0;
  let s = 0;
  let spin = 0;
  let raf = 0;
  let visible = false;
  let last = performance.now();
  const v = new THREE.Vector3();

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    s += (target - s) * (1 - Math.exp(-dt * 6));
    if (Math.abs(target - s) < 0.0005) s = target;

    const angle = (s / N) * TAU;
    ring.rotation.y = -angle;
    ring.rotation.x = Math.sin(now / 2600) * 0.025;

    pulse.position.copy(pointAt(angle, R, 0.02));
    pulse.scale.setScalar(1 + Math.sin(now / 180) * 0.12);
    pulse.getWorldPosition(v);
    pulseLight.position.copy(v).add(new THREE.Vector3(0, 0.5, 0));
    setTube(progGeo, s / N);

    let done = 0;
    stations.forEach((st, i) => {
      // 0 → 1 as the pulse arrives at this station.
      const k = smooth(clamp01((s - i + 0.25) / 0.45));
      done += k;
      st.mat.color.copy(MANUAL).lerp(st.brand, k);
      setTube(st.spokeGeo, k);
      (st.halo.material as THREE.MeshBasicMaterial).opacity = k * 0.9;

      // Distance (in steps) between the pulse and this station, around the loop.
      let d = Math.abs(s - i);
      d = Math.min(d, N - d);
      const focus = 1 - smooth(clamp01(d / 0.8));
      st.holder.scale.setScalar(1 + focus * 0.22);
      st.shape.position.y = focus * 0.22 + Math.sin(now / 900 + i) * 0.03;
      st.shape.rotation.y += dt * (0.25 + focus * 0.9);

      st.holder.getWorldPosition(v);
      v.y += 0.75 + focus * 0.25;
      const depth = v.z;
      v.project(camera);
      const el = st.label;
      el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      el.style.opacity = String(Math.max(0.12, Math.min(1, 0.35 + (depth + R) / (2 * R))));
      el.classList.toggle('is-on', focus > 0.5);
      el.classList.toggle('is-done', k > 0.5);
    });

    spin += dt * (0.15 + (done / N) * 1.1);
    discs.forEach((dk, k) => {
      dk.rotation.y = spin * (k % 2 ? -1 : 1) * (1 + k * 0.3);
      dk.position.y = 0.2 - k * 0.17 + Math.sin(now / 700 + k) * 0.015 * (done / N);
    });
    hub.rotation.y = angle; // keep the hub still while the ring turns

    renderer.render(scene, camera);
    onFrame(s);
  };

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });
  io.observe(canvas);

  return {
    setTarget(next) {
      target = Math.min(N, Math.max(0, next));
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stations.forEach((st) => st.label.remove());
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
