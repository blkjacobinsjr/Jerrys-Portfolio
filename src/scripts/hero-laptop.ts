/**
 * E3 hero (preview, ?zoom=laptop): the page opens on the v3 screensaver full-bleed; scrolling pulls back as a
 * real 3D laptop spins onto the desk and lands on the pose solved (solvePnP, f = 2500 desk px) from the drawn
 * laptop's screen corners, then hands off to the illustration. No glTF: the laptop is ~40 lines of rounded
 * extrusions, so the only extra bytes are three.js (already a dependency) and the 1920 screen texture.
 * Renders only while the scrolled progress is inside the pin and still moving. CSS owns every fade.
 */
import {
  CanvasTexture, Color, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, Shape, SRGBColorSpace, TextureLoader,
  Vector3, WebGLRenderer,
} from 'three';

const F = 2500, CX = 596, CY = 561, SRC_W = 1192;
// solvePnP (OpenCV camera: y down, z forward) of the lid frame; converted to three's camera frame below.
const R_CV = [[0.78743, -0.13114, 0.6023], [-0.35078, -0.8988, 0.2629], [0.50687, -0.41829, -0.75374]];
const T_CV = [-0.49354, -1.07664, 12.97494];
const HINGE = (105 * Math.PI) / 180;
const SPIN = -Math.PI * 2;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t: number, s = 1.4) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

function rounded(w: number, h: number, r: number, depth: number, y0 = 0) {
  const s = new Shape();
  const x = -w / 2;
  s.moveTo(x + r, y0);
  s.lineTo(x + w - r, y0);
  s.quadraticCurveTo(x + w, y0, x + w, y0 + r);
  s.lineTo(x + w, y0 + h - r);
  s.quadraticCurveTo(x + w, y0 + h, x + w - r, y0 + h);
  s.lineTo(x + r, y0 + h);
  s.quadraticCurveTo(x, y0 + h, x, y0 + h - r);
  s.lineTo(x, y0 + r);
  s.quadraticCurveTo(x, y0, x + r, y0);
  return new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 6 });
}

function keyboard() {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b9bcc2';
  g.fillRect(0, 0, 768, 256);
  g.fillStyle = '#1d1f23';
  const cols = 14, rows = 5, kw = 768 / cols, kh = 256 / rows;
  for (let r = 0; r < rows; r++)
    for (let i = 0; i < cols; i++) g.fillRect(i * kw + 4, r * kh + 4, kw - 8, kh - 8);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function heroLaptop() {
  const root = document.documentElement;
  if (root.dataset.heroZoom !== 'laptop') return;
  const desk = document.querySelector<HTMLImageElement>('[data-hero-art] > picture img');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-laptop]');
  if (!desk || !canvas) return;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0xd9c7a8, 2.2));
  const sun = new DirectionalLight(0xfff3e0, 2.4);
  sun.position.set(-3, 5, 6);
  scene.add(sun);

  const alu = new MeshStandardMaterial({ color: new Color('#c8cacf'), metalness: 0.55, roughness: 0.38 });
  const laptop = new Group();
  const lid = new Mesh(rounded(1.74, 1.14, 0.06, 0.022, -0.03), alu);
  lid.position.z = -0.03;
  laptop.add(lid);
  const bezel = new Mesh(new PlaneGeometry(1.7, 1.08), new MeshBasicMaterial({ color: 0x0b0b0c }));
  bezel.position.set(0, 0.55, 0.0005);
  laptop.add(bezel);
  const screenMat = new MeshBasicMaterial({ color: 0x111111, toneMapped: false });
  const screen = new Mesh(new PlaneGeometry(1.6, 1.0), screenMat);
  screen.position.set(0, 0.55, 0.001);
  laptop.add(screen);
  new TextureLoader().load('/hero-screen-v3.webp', (t) => {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    screenMat.map = t;
    screenMat.color.set(0xffffff);
    screenMat.needsUpdate = true;
    // The attribute shows the canvas, and the first frame is drawn in the same task, before the next paint, so the
    // overlay never hands off to an empty canvas.
    root.dataset.hero3d = 'ready';
    draw(progress());
    wake(true);
  });
  const base = new Group();
  base.rotation.x = HINGE;
  const slab = new Mesh(rounded(1.74, 1.04, 0.06, 0.04, 0), alu);
  base.add(slab);
  const keys = new Mesh(new PlaneGeometry(1.5, 0.48), new MeshBasicMaterial({ map: keyboard() }));
  keys.rotation.y = Math.PI;
  keys.rotation.z = Math.PI;
  keys.position.set(0, 0.34, -0.009);
  base.add(keys);
  const pad = new Mesh(new PlaneGeometry(0.62, 0.34), new MeshStandardMaterial({ color: '#b5b8be', metalness: 0.4, roughness: 0.5 }));
  pad.rotation.y = Math.PI;
  pad.position.set(0, 0.8, -0.009);
  base.add(pad);
  laptop.add(base);
  scene.add(laptop);

  // Landing pose in three's camera frame: flip y and z of the OpenCV pose.
  const land = new Matrix4().set(
    R_CV[0][0], R_CV[0][1], R_CV[0][2], T_CV[0],
    -R_CV[1][0], -R_CV[1][1], -R_CV[1][2], -T_CV[1],
    -R_CV[2][0], -R_CV[2][1], -R_CV[2][2], -T_CV[2],
    0, 0, 0, 1,
  );
  const landPos = new Vector3(), landQ = new Quaternion(), sc = new Vector3();
  land.decompose(landPos, landQ, sc);
  // Rotation from "facing the camera" to the landing pose, as axis-angle so it can overshoot and settle.
  const inv = landQ.clone().invert();
  const angle = 2 * Math.acos(Math.min(1, Math.abs(inv.w)));
  const sgn = inv.w < 0 ? -1 : 1;
  const sinH = Math.sqrt(1 - inv.w * inv.w) || 1;
  const axis = new Vector3(inv.x * sgn, inv.y * sgn, inv.z * sgn).divideScalar(sinH).normalize();
  const Y = new Vector3(0, 1, 0);
  const qa = new Quaternion(), qs = new Quaternion();

  const camera = new PerspectiveCamera();
  let vw = 0, vh = 0, fv = 1, cxv = 0, cyv = 0;
  const startPos = new Vector3();
  const size = () => {
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    renderer.setSize(vw, vh, false);
  };
  // The desk moves a little before the sticky hero pins, so the camera follows its rect every drawn frame (a read only).
  const layout = () => {
    // The canvas is display:none until data-hero3d, so its size is (re)read here, not only on resize.
    if (canvas.clientWidth !== vw || canvas.clientHeight !== vh) size();
    // Desk position in the canvas's own pixels (the canvas is sticky in the pin, not fixed).
    const r = desk.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const s = r.width / SRC_W;
    fv = F * s;
    cxv = r.left - c.left + CX * s;
    cyv = r.top - c.top + CY * s;
    const n = 0.1, far = 200;
    camera.projectionMatrix.makePerspective((-cxv / fv) * n, ((vw - cxv) / fv) * n, (cyv / fv) * n, (-(vh - cyv) / fv) * n, n, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // Start: screen (1.6 x 1.0) square to the camera and just covering the viewport, centred on it.
    const d = Math.min((1.6 * fv) / vw, fv / vh) * 0.985;
    startPos.set(((vw / 2 - cxv) / fv) * d, (-(vh / 2 - cyv) / fv) * d, -d).sub(new Vector3(0, 0.55, 0));
  };

  let cur = -1, target = 0, raf = 0;
  const progress = () => clamp(scrollY / (innerHeight * 0.9));
  const draw = (p: number) => {
    layout();
    const e = inOut(clamp(p / 0.86));
    const q = clamp((p - 0.04) / 0.82);
    // Lerp inverse depth and the projected position, so the apparent size changes evenly with scroll.
    const iz = 1 / -startPos.z + (1 / -landPos.z - 1 / -startPos.z) * e;
    const z = -1 / iz;
    const px = startPos.x / -startPos.z + (landPos.x / -landPos.z - startPos.x / -startPos.z) * e;
    const py = startPos.y / -startPos.z + (landPos.y / -landPos.z - startPos.y / -startPos.z) * e;
    laptop.position.set(px * -z, py * -z, z);
    qa.setFromAxisAngle(axis, angle * (1 - backOut(q)));
    // The spin waits until the screen has pulled back, so the lid's back never fills the viewport.
    qs.setFromAxisAngle(Y, SPIN * (1 - inOut(clamp((p - 0.14) / 0.66))));
    laptop.quaternion.copy(landQ).multiply(qa).multiply(qs);
    renderer.render(scene, camera);
  };
  const frame = () => {
    raf = 0;
    target = progress();
    cur = cur < 0 ? target : cur + (target - cur) * 0.2;
    if (Math.abs(target - cur) < 0.0005) cur = target;
    if (cur < 1) draw(cur);
    if (cur !== target) raf = requestAnimationFrame(frame);
  };
  function wake(force = false) {
    if (force) cur = -1;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  size();
  addEventListener('scroll', () => wake(), { passive: true });
  addEventListener('resize', () => {
    size();
    wake(true);
  });
  canvas.addEventListener('webglcontextlost', () => delete root.dataset.hero3d);
}
