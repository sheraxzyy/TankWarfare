/**
 * Small math / formatting helpers used across client systems.
 */
export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function shortestAngle(from, to) {
  let diff = (to - from) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return diff;
}

export function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

export function rotateToward(current, target, maxStep, snap = 0.01) {
  const diff = shortestAngle(current, target);
  if (Math.abs(diff) <= Math.max(maxStep, snap)) return target;
  return current + Math.sign(diff) * maxStep;
}

export function distanceSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function distance(x1, y1, x2, y2) {
  return Math.sqrt(distanceSq(x1, y1, x2, y2));
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

export function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function starsString(stars) {
  return `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}`;
}

/** Returns true if the 2D segments intersect (used for line-of-sight checks). */
export function segmentIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const minX = rx - rw / 2;
  const maxX = rx + rw / 2;
  const minY = ry - rh / 2;
  const maxY = ry + rh / 2;

  // Quick reject when both points are outside the same side.
  if ((x1 < minX && x2 < minX) || (x1 > maxX && x2 > maxX) || (y1 < minY && y2 < minY) || (y1 > maxY && y2 > maxY)) {
    return false;
  }

  // Liang-Barsky clipping.
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

export function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx - rw / 2 && x <= rx + rw / 2 && y >= ry - rh / 2 && y <= ry + rh / 2;
}
