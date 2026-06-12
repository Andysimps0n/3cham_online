import { mediaPipeToR3F } from './mediaPipeCoordinates';

const LM = {
  LEFT_EYE: 33,
  RIGHT_EYE: 263,
  FOREHEAD: 10,
  CHIN: 152,
};

function hasRequiredLandmarks(landmarks) {
  return landmarks?.length > 0
    && landmarks[LM.LEFT_EYE]
    && landmarks[LM.RIGHT_EYE]
    && landmarks[LM.FOREHEAD]
    && landmarks[LM.CHIN];
}

/**
 * Uses the same thresholds as FaceDirectionArrow in FaceLandmarkViewer.
 * @returns {'left' | 'center' | 'right' | null}
 */
export function getFaceDirection(landmarks) {
  if (!hasRequiredLandmarks(landmarks)) return null;

  const leftEye = mediaPipeToR3F(landmarks[LM.LEFT_EYE]);
  const rightEye = mediaPipeToR3F(landmarks[LM.RIGHT_EYE]);
  const x = Math.floor(((leftEye.x + rightEye.x) / 2) * 100);

  if ((5 < x) && (x < 7)) return 'center';
  if (x <= 5) return 'left';
  if (x > 7) return 'right';
}

export const GAME_CUE_DIRECTIONS = ['left', 'center', 'right'];

export function pickRandomGameCue() {
  const index = Math.floor(Math.random() * GAME_CUE_DIRECTIONS.length);
  return GAME_CUE_DIRECTIONS[index];
}

/** Opposite-direction rule: survive by tilting away from the cued side. */
export function isSurvivalResponse(cue, currentDirection) {
  if (!currentDirection) return false;

  if (cue === 'left') return currentDirection === 'right'|| currentDirection === 'center';
  if (cue === 'right') return currentDirection === 'left'|| currentDirection === 'center';
  if (cue === 'center') return currentDirection === 'left' || currentDirection === 'right';

  return false;
}
