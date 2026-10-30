import { ACESFilmicToneMapping, AmbientLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Raycaster, Scene, SphereGeometry, Vector2, WebGLRenderer } from 'three';

export function createManaScene(canvas: HTMLCanvasElement, onReady: () => void, onUnavailable: () => void, onGreenOrbClick: () => void) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, .1, 100);
  scene.add(new AmbientLight(0xffffff, 1.2));
  const keyLight = new PointLight(0xffffff, 60);
  keyLight.position.set(4, 5, 8);
  scene.add(keyLight);
  const fillLight = new PointLight(0x9ec4ff, 30);
  fillLight.position.set(-6, -3, 4);
  scene.add(fillLight);
  const ring = new Group();
  scene.add(ring);
  const geometry = new SphereGeometry(1.1, 48, 32);
  let greenOrb: Mesh | null = null;
  const materials = [0xf2e8c0, 0x3f8fd6, 0x3a3740, 0xe0553a, 0x43a263].map((color, index) => {
    const material = new MeshStandardMaterial({ color, roughness: .35, metalness: .2, emissive: color, emissiveIntensity: index === 2 ? .06 : .22 });
    const orb = new Mesh(geometry, material);
    const angle = index / 5 * Math.PI * 2 + Math.PI / 2;
    orb.position.set(Math.cos(angle) * 3, Math.sin(angle) * 3, 0);
    ring.add(orb);
    if (index === 4) greenOrb = orb;
    return material;
  });
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let disposed = false;
  let lost = false;
  let startedAt: number | undefined;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const render = () => {
    if (disposed || lost) return;
    renderer.render(scene, camera);
    onReady();
  };
  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    camera.position.z = Math.max(4.5 / tangent, 4.5 / (tangent * camera.aspect));
    camera.updateProjectionMatrix();
    render();
  };
  const animate = (time: number) => {
    startedAt ??= time;
    ring.rotation.z = (time - startedAt) / 9000;
    render();
  };
  const updateMotion = () => {
    renderer.setAnimationLoop(null);
    if (disposed || lost || document.hidden) return;
    if (motion.matches) { ring.rotation.z = 0; render(); }
    else renderer.setAnimationLoop(animate);
  };
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    renderer.setAnimationLoop(null);
    onUnavailable();
  };
  const onRestored = () => { lost = false; resize(); updateMotion(); };
  const pointsAtGreenOrb = (event: PointerEvent | MouseEvent) => {
    const bounds = canvas.getBoundingClientRect();
    pointer.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height * 2 - 1),
    );
    raycaster.setFromCamera(pointer, camera);
    return greenOrb !== null && raycaster.intersectObject(greenOrb, false).length > 0;
  };
  const onPointerMove = (event: PointerEvent) => { canvas.style.cursor = pointsAtGreenOrb(event) ? 'pointer' : 'default'; };
  const onClick = (event: MouseEvent) => { if (pointsAtGreenOrb(event)) onGreenOrbClick(); };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  motion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('click', onClick);
  resize();
  updateMotion();

  return () => {
    disposed = true;
    observer.disconnect();
    motion.removeEventListener('change', updateMotion);
    document.removeEventListener('visibilitychange', updateMotion);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('click', onClick);
    renderer.setAnimationLoop(null);
    geometry.dispose();
    materials.forEach(material => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
