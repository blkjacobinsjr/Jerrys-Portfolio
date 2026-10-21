/**
 * A damped pendulum, one step at a time. Angles in radians, time in seconds.
 * Used by the keyring: each piece swings around its own hanging point.
 */
export interface Swing {
  angle: number;
  velocity: number;
}

export interface SwingConfig {
  /** Restoring strength; higher swings faster. */
  stiffness: number;
  /** Energy lost per second; higher settles sooner. */
  damping: number;
  /** Largest angle either way, so a hard flick never spins a charm over the top. */
  limit: number;
}

export const SWING: SwingConfig = { stiffness: 26, damping: 2.2, limit: 1.1 };

/** Longest step we integrate in one go; a backgrounded tab must not explode the motion. */
export const MAX_DT = 1 / 30;

export const still: Swing = { angle: 0, velocity: 0 };

/** Advance one frame (semi-implicit Euler), applying `torque` for `dt` seconds. */
export function step(swing: Swing, torque: number, dt: number, config: SwingConfig = SWING): Swing {
  const t = Math.min(Math.max(dt, 0), MAX_DT);
  const accel = -config.stiffness * Math.sin(swing.angle) - config.damping * swing.velocity + torque;
  const velocity = swing.velocity + accel * t;
  const angle = swing.angle + velocity * t;
  if (Math.abs(angle) > config.limit) return { angle: Math.sign(angle) * config.limit, velocity: 0 };
  return { angle, velocity };
}

export function atRest(swing: Swing, epsilon = 1e-3): boolean {
  return Math.abs(swing.angle) < epsilon && Math.abs(swing.velocity) < epsilon;
}
