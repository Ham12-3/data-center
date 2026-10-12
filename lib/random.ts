/**
 * Deterministic pseudo-random helpers. Using a hash of a stable key (rather than
 * Math.random) keeps the scene identical between renders and makes the pure
 * layout functions testable.
 */

/** FNV-1a 32-bit hash of a string. */
export function hashString(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable value in [0, 1) for a key and an optional sub-index. */
export function hash01(key: string, index = 0): number {
  // Mix the index in with a large odd constant, then finalise (murmur3 fmix32).
  let h = hashString(key) ^ Math.imul(index + 1, 0x9e3779b1);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
