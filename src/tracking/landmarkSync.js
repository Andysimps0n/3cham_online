/**
 * Compact face landmark serialization for WebSocket sync.
 * Sends only the 4 orientation landmarks the 3D model needs (12 floats).
 */

/** Same indices as FaceLandmarkViewer / faceDirection.js */
export const ORIENTATION_LANDMARK_INDICES = [10, 33, 263, 152];
export const ORIENTATION_LANDMARK_FLOAT_COUNT = ORIENTATION_LANDMARK_INDICES.length * 3;

export function hasOrientationLandmarks(landmarks) {
  if (!landmarks?.length) return false;
  return ORIENTATION_LANDMARK_INDICES.every((index) => landmarks[index]);
}

export function serializeFaceLandmarks(landmarks) {
  if (!hasOrientationLandmarks(landmarks)) return null;

  const flat = new Array(ORIENTATION_LANDMARK_FLOAT_COUNT);
  ORIENTATION_LANDMARK_INDICES.forEach((index, pointIndex) => {
    const point = landmarks[index];
    flat[pointIndex * 3] = point.x;
    flat[pointIndex * 3 + 1] = point.y;
    flat[pointIndex * 3 + 2] = point.z;
  });
  return flat;
}

export function deserializeFaceLandmarks(flat) {
  if (!Array.isArray(flat) || flat.length === 0) {
    return null;
  }

  // Compact orientation packet (preferred for mobile)
  if (flat.length === ORIENTATION_LANDMARK_FLOAT_COUNT) {
    const landmarks = [];
    ORIENTATION_LANDMARK_INDICES.forEach((index, pointIndex) => {
      landmarks[index] = {
        x: flat[pointIndex * 3],
        y: flat[pointIndex * 3 + 1],
        z: flat[pointIndex * 3 + 2],
      };
    });
    return landmarks;
  }

  // Legacy full mesh packet
  if (flat.length % 3 !== 0) {
    return null;
  }

  const count = flat.length / 3;
  const landmarks = new Array(count);
  for (let i = 0; i < count; i += 1) {
    landmarks[i] = {
      x: flat[i * 3],
      y: flat[i * 3 + 1],
      z: flat[i * 3 + 2],
    };
  }
  return landmarks;
}

/** ~15 fps keeps bandwidth reasonable on mobile networks. */
export const PEER_LANDMARK_SEND_INTERVAL_MS = 66;

/** How long to keep showing the remote model after the last packet. */
export const PEER_LANDMARK_STALE_MS = 2000;
