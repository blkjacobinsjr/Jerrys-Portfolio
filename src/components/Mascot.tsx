import { useEffect, useRef, useState } from 'react';
import { useSelector } from '@xstate/react';
import { frameOf, gazeFrom, mascotActor, type Gaze } from '../lib/mascot';
import { onVelocity } from '../lib/scroll';
import './Mascot.css';

interface Props {
  sprite: string;
  /** The neutral frame alone: painted first, swapped for the sprite once it has loaded. */
  still: string;
  size: number;
  label: string;
  /** Only one view should report scroll speed; the rest just render. */
  feelsScroll?: boolean;
  onPoke?: () => void;
}

const COLS = 4;
const FAST = 70;

export default function Mascot({ sprite, still, size, label, feelsScroll = false, onPoke }: Props) {
  const actor = mascotActor();
  const machineFrame = useSelector(actor, frameOf);
  const [spriteReady, setSpriteReady] = useState(false);
  const frame = spriteReady ? machineFrame : 5;

  useEffect(() => {
    const img = new Image();
    img.src = sprite;
    img.decode().then(() => setSpriteReady(true), () => setSpriteReady(true));
  }, [sprite]);

  const button = useRef<HTMLButtonElement>(null);
  const face = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = button.current;
    const head = face.current;
    if (!el || !head) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Track the pointer and an eased copy of it; the eased one plays catch-up
    // so the gaze glides instead of snapping.
    let target = { x: innerWidth / 2, y: innerHeight / 2 };
    const eased = { ...target };
    let gaze: Gaze = { x: 0, y: 0 };
    let lastSent = 0;
    let frameId = 0;
    let visible = false;

    const tick = (now: number) => {
      eased.x += (target.x - eased.x) * 0.14;
      eased.y += (target.y - eased.y) * 0.14;
      const box = el.getBoundingClientRect();
      const dx = eased.x - (box.left + box.width / 2);
      const dy = eased.y - (box.top + box.height / 2);
      const next = gazeFrom(dx, dy, gaze, Math.max(32, size * 0.8));
      if (next.x !== gaze.x || next.y !== gaze.y || now - lastSent > 500) {
        gaze = next;
        lastSent = now;
        actor.send({ type: 'LOOK', gaze });
      }
      if (!reduceMotion) {
        const nudge = Math.min(1, Math.hypot(dx, dy) / 400);
        const angle = Math.atan2(dy, dx);
        head.style.transform = `translate(${Math.cos(angle) * nudge * 2}px, ${Math.sin(angle) * nudge * 2}px)`;
      }
      const settled = Math.abs(target.x - eased.x) + Math.abs(target.y - eased.y) < 0.5;
      frameId = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      target = { x: event.clientX, y: event.clientY };
      if (visible && !frameId) frameId = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    io.observe(el);
    addEventListener('pointermove', onMove, { passive: true });

    const stopVelocity = feelsScroll
      ? onVelocity((v) => {
          if (Math.abs(v) > FAST) actor.send({ type: 'FAST_SCROLL' });
        })
      : undefined;

    return () => {
      io.disconnect();
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frameId);
      stopVelocity?.();
    };
  }, [actor, feelsScroll, size]);

  const col = frame % COLS;
  const row = Math.floor(frame / COLS);

  return (
    <button
      ref={button}
      type="button"
      className="mascot"
      aria-label={label}
      data-frame={frame}
      style={{ width: size, height: size }}
      onClick={() => {
        actor.send({ type: 'POKE' });
        onPoke?.();
      }}
    >
      <span
        ref={face}
        className="mascot-face"
        style={
          spriteReady
            ? { backgroundImage: `url(${sprite})`, backgroundPosition: `${(col * 100) / (COLS - 1)}% ${(row * 100) / (COLS - 1)}%` }
            : { backgroundImage: `url(${still})`, backgroundSize: '100% 100%' }
        }
      />
    </button>
  );
}
