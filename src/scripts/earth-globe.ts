// Photo-real Earth for the /projects bento card.
// Textures: three.js example planets (NASA Blue Marble derived), served from /globe/.
import * as THREE from 'three';

export interface Globe {
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export function createGlobe(canvas: HTMLCanvasElement, opts: { animate: boolean }): Globe | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.1);

  const loader = new THREE.TextureLoader();
  const tex = (url: string, srgb = false) => {
    const t = loader.load(url, () => renderOnce());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };

  // Tilt the axis and face Asia toward the viewer.
  const world = new THREE.Group();
  world.rotation.set(0.38, 0, -0.18);
  scene.add(world);

  const spin = new THREE.Group();
  spin.rotation.y = -3.05; // ~85°E (India) facing camera
  world.add(spin);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.MeshPhongMaterial({
      map: tex('/globe/earth_atmos_2048.jpg', true),
      specularMap: tex('/globe/earth_specular_2048.jpg'),
      normalMap: tex('/globe/earth_normal_2048.jpg'),
      normalScale: new THREE.Vector2(0.85, -0.85),
      specular: new THREE.Color(0x335577),
      shininess: 18,
    }),
  );
  spin.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.008, 96, 96),
    new THREE.MeshLambertMaterial({
      map: tex('/globe/earth_clouds_1024.png', true),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  spin.add(clouds);


  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-1.2, 1.4, 4);
  scene.add(sun);

  // Drag to turn; it eases back to the idle spin when released.
  let dragging = false;
  let lastX = 0;
  let velocity = 0;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    velocity = dx * 0.005;
    spin.rotation.y += velocity;
    if (!running) renderOnce();
  };
  const onUp = () => (dragging = false);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderOnce();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function renderOnce() {
    renderer.render(scene, camera);
  }

  let running = false;
  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!dragging) {
      velocity *= 0.92;
      spin.rotation.y += velocity + dt * 0.04;
    }
    clouds.rotation.y += dt * 0.012;
    renderOnce();
    raf = requestAnimationFrame(loop);
  };

  resize();

  return {
    start() {
      if (running || !opts.animate) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      this.stop();
      ro.disconnect();
      renderer.dispose();
    },
  };
}
