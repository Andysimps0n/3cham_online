/**
 * MediaPipe face landmark coordinate space → React Three Fiber (Three.js) space.
 *
 * MediaPipe outputs normalized image-space landmarks:
 *   x: 0 (left) → 1 (right)
 *   y: 0 (top)  → 1 (bottom)
 *   z: relative depth vs. head center; same unit scale as x (face-width relative)
 *
 * Three.js / R3F uses Y-up:
 *   +X right, +Y up, +Z toward the viewer
 */

export const XY_SCALE = 2;
export const Z_SCALE = 2;

export function mediaPipeToR3F(landmark, xyScale = XY_SCALE, zScale = Z_SCALE) {
  return {
    x: (landmark.x - 0.5) * xyScale,
    y: -(landmark.y - 0.5) * xyScale,
    z: -landmark.z * zScale,
  };
}
