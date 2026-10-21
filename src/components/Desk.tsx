import { useEffect, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { interactionMachine } from '../lib/interaction';
import * as THREE from 'three';

/** Minted-style artwork extrusion: the alpha silhouette supplies the solid edge. */
export default function Desk({
  image,
  alt = 'My Berlin desk, with a laptop, plant, books, and e-bike',
  onReady,
  onError
}: {
  image: string;
  alt?: string;
  onReady?: () => void;
  onError?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const turn = useRef<(angle: number) => void>(() => {});
  const failRef = useRef<() => void>(() => {});
  const [snapshot, send] = useMachine(interactionMachine);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    send({ type: 'START' });
    let alive = true;
    let failed = false;
    const fail = () => {
      if (!alive || failed) return;
      failed = true;
      root.dataset.ready = 'false';
      send({ type: 'FAIL', message: 'The desk preview could not be started.' });
      onError?.();
    };
    failRef.current = fail;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      fail();
      return undefined;
    }
    try {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch {
      renderer.dispose();
      fail();
      return undefined;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.z = 4.5;
    const group = new THREE.Group();
    scene.add(group, new THREE.HemisphereLight(0xffffff, 0x796044, 2.5));
    const key = new THREE.DirectionalLight(0xffedcf, 3);
    key.position.set(-2, 3, 5);
    scene.add(key);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    root.append(canvas);
    let ready = false;
    let visible = true;
    let raf = 0;
    let velocity = 0;
    let previousX: number | null = null;
    let previousY = 0;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const textures: THREE.Texture[] = [];
    const render = () => {
      if (alive && !failed && visible && !document.hidden) {
        try {
          renderer.render(scene, camera);
        } catch {
          fail();
        }
      }
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; velocity = 0; };
    const coast = () => {
      raf = 0;
      if (!alive || failed || !visible || document.hidden || motion.matches) return;
      group.rotation.y += velocity;
      velocity *= 0.92;
      render();
      if (Math.abs(velocity) > 0.001) raf = requestAnimationFrame(coast);
    };
    turn.current = (angle) => { stop(); group.rotation.y += angle; render(); };
    const photo = new Image();
    photo.onload = () => {
      if (!alive || failed) return;
      try {
      const size = 160;
      const mask = document.createElement('canvas');
      mask.width = size;
      mask.height = size;
      const ctx = mask.getContext('2d');
      if (!ctx) {
        fail();
        return;
      }
      ctx.drawImage(photo, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size);
      const positions: number[] = [];
      const colors: number[] = [];
      const occupied = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && pixels.data[(y * size + x) * 4 + 3]! > 127;
      const point = (x: number, y: number, z: number) => [x / size * 2 - 1, 1 - y / size * 2, z];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (!occupied(x, y)) continue;
        const edges = [
          [x, y, x + 1, y, x, y - 1],
          [x + 1, y, x + 1, y + 1, x + 1, y],
          [x + 1, y + 1, x, y + 1, x, y + 1],
          [x, y + 1, x, y, x - 1, y],
        ];
        for (const [x1 = 0, y1 = 0, x2 = 0, y2 = 0, nx = 0, ny = 0] of edges) {
          if (occupied(nx, ny)) continue;
          const a = point(x1, y1, 0.055), b = point(x2, y2, 0.055);
          const c = point(x2, y2, -0.055), d = point(x1, y1, -0.055);
          positions.push(...a, ...b, ...d, ...b, ...c, ...d);
          const color = new THREE.Color().setRGB(pixels.data[(y * size + x) * 4]! / 255, pixels.data[(y * size + x) * 4 + 1]! / 255, pixels.data[(y * size + x) * 4 + 2]! / 255, THREE.SRGBColorSpace);
          for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b);
        }
      }
      const edge = new THREE.BufferGeometry();
      edge.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      edge.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      edge.computeVertexNormals();
      group.add(new THREE.Mesh(edge, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })));
      const texture = new THREE.Texture(photo);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      textures.push(texture);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.5, roughness: 0.85 }));
      face.position.z = 0.056;
      group.add(face);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const alpha = pixels.data[i + 3]!;
        pixels.data[i] = alpha; pixels.data[i + 1] = alpha; pixels.data[i + 2] = alpha; pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      const alphaMap = new THREE.CanvasTexture(mask);
      textures.push(alphaMap);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: 0xb39058, alphaMap, alphaTest: 0.5, metalness: 0.35, roughness: 0.65, side: THREE.BackSide }));
      back.position.z = -0.056;
      group.add(back);
      ready = true;
      root.dataset.ready = 'true';
      render();
      if (!failed) {
        send({ type: 'READY' });
        onReady?.();
      }
      } catch {
        fail();
      }
    };
    photo.onerror = fail;
    photo.src = image;
    const resize = new ResizeObserver(() => {
      try {
        renderer.setSize(root.clientWidth, root.clientHeight, false);
        camera.aspect = root.clientWidth / Math.max(1, root.clientHeight);
        camera.updateProjectionMatrix();
        render();
      } catch {
        fail();
      }
    });
    resize.observe(root);
    const observer = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; if (visible) render(); else stop(); });
    observer.observe(root);
    const visibility = () => { stop(); if (!document.hidden) render(); };
    const preference = () => { stop(); render(); };
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', preference);
    canvas.addEventListener('webglcontextlost', contextLost);
    const down = (event: PointerEvent) => {
      if (!ready || failed || event.button > 0) return;
      stop(); previousX = event.clientX; previousY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (previousX === null) return;
      velocity = (event.clientX - previousX) * 0.012;
      group.rotation.y += velocity;
      group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + (event.clientY - previousY) * 0.006, -0.5, 0.5);
      previousX = event.clientX; previousY = event.clientY;
      render();
    };
    const up = (event: PointerEvent) => {
      if (previousX === null) return;
      previousX = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.type === 'pointerup' && !motion.matches && !raf) raf = requestAnimationFrame(coast);
      else stop();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    return () => {
      alive = false; stop(); turn.current = () => {};
      photo.onload = null; photo.onerror = null; photo.src = '';
      resize.disconnect(); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', preference);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose(); canvas.remove();
      send({ type: 'CLOSE' });
    };
  }, [image, onError, onReady, send]);

  return <div className="desk-view" data-renderer-state={snapshot.value}>
    <div ref={host} className="desk-stage" data-scrollsheet-no-drag data-renderer-state={snapshot.value}><img src={image} alt={alt} onError={() => failRef.current()} /></div>
    <div className="model-controls" aria-label="Rotate the Berlin desk">
      <button type="button" disabled={!snapshot.matches('ready')} onClick={() => turn.current(-Math.PI / 4)}>Rotate desk left</button>
      <button type="button" disabled={!snapshot.matches('ready')} onClick={() => turn.current(Math.PI / 4)}>Rotate desk right</button>
    </div>
  </div>;
}
