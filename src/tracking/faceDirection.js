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

  if ((-3 < x) && (x < 5)) return 'center';
  if (x <= -3) return 'left';
  if (x > 5 ) return 'right';
}

/**
 * Head pitch in degrees (floored) — same threshold style as getFaceDirection's `x`.
 *
 * Measures how much the face axis (chin → forehead) is tilted in the sagittal
 * plane (pitch), NOT raw forehead/chin separation (which changes when you lean
 * toward/away from the camera).
 *
 * Uses the eye line only to strip out yaw so looking left/right doesn't read as a nod.
 * Larger pitch → head up. Smaller pitch → head tilted down (nod).
 *
 * @returns {number | null}
 */
export function getHeadNodY(landmarks) {
  if (!hasRequiredLandmarks(landmarks)) return null;

  const leftEye = mediaPipeToR3F(landmarks[LM.LEFT_EYE]);
  const rightEye = mediaPipeToR3F(landmarks[LM.RIGHT_EYE]);
  const forehead = mediaPipeToR3F(landmarks[LM.FOREHEAD]);
  const chin = mediaPipeToR3F(landmarks[LM.CHIN]);

  const rightX = rightEye.x - leftEye.x;
  const rightY = rightEye.y - leftEye.y;
  const rightZ = rightEye.z - leftEye.z;
  const rightLen = Math.hypot(rightX, rightY, rightZ);
  if (rightLen < 1e-6) return null;

  // Face axis: chin → forehead
  let axisX = forehead.x - chin.x;
  let axisY = forehead.y - chin.y;
  let axisZ = forehead.z - chin.z;
  const axisLen = Math.hypot(axisX, axisY, axisZ);
  if (axisLen < 1e-6) return null;

  // Project face axis off the eye line — removes yaw so left/right turns don't
  // pollute the pitch reading.
  const alongRight = (axisX * rightX + axisY * rightY + axisZ * rightZ) / rightLen;
  axisX -= (alongRight / rightLen) * rightX;
  axisY -= (alongRight / rightLen) * rightY;
  axisZ -= (alongRight / rightLen) * rightZ;

  const sagittalLen = Math.hypot(axisX, axisZ);
  if (sagittalLen < 1e-6) return null;

  const pitchRadians = Math.atan2(axisY, sagittalLen);
  const pitchDeg = pitchRadians * (180 / Math.PI);

  return Math.floor(pitchDeg);
}

/**
 * Change in pitch vs your neutral baseline (negative = nodded down).
 * @returns {number | null}
 */
export function getHeadNodDelta(landmarks, baselinePitch) {
  const pitch = getHeadNodY(landmarks);
  if (pitch == null || baselinePitch == null) return null;
  return pitch - baselinePitch;
}

/**
 * How many degrees pitch must DROP below neutral to count as a nod.
 * Primary tuning knob — lower = easier nod (e.g. 2), higher = stricter (e.g. 6).
 */
export const NOD_DROP_DEGREES = 4;

/**
 * How many degrees pitch must RISE above neutral to count as looking up.
 * Used by the game stage machine between consecutive nods.
 */
export const NOD_RISE_DEGREES = 2;

/**
 * Minimum gap between registering nod 1 and nod 2 (ms).
 * Extra guard on top of the un-nod requirement below.
 */
export const NOD_COOLDOWN_MS = 700;

/**
 * True when pitch is below the nod threshold (actively nodding).
 * The game requires a frame where this is false before the next nod counts.
 */
export function isHeadNodding(nodState) {
  return nodState === 'down';
}

/** True when the player is looking left or right (not at center). */
export function isFaceSided(landmarks) {
  const dir = getFaceDirection(landmarks);
  return dir === 'left' || dir === 'right';
}

/**
 * Attacker nods only count while facing center.
 * Turning left/right changes pitch readings and can false-trigger or double-count nods.
 */
export function canAcceptNodInput(landmarks) {
  return getFaceDirection(landmarks) === 'center';
}

/** Absolute fallback when no baseline is calibrated yet */
export const NOD_PITCH_DOWN_MAX = 74;
export const NOD_PITCH_UP_MIN = 80;

/** @deprecated Use NOD_DROP_DEGREES + baseline — kept for log compatibility */
export const NOD_PITCH_THRESHOLD = NOD_PITCH_DOWN_MAX;

/**
 * Head nod state.
 *
 * Prefer passing `baselinePitch` (your neutral face at rest). Nod is detected when
 * pitch drops NOD_DROP_DEGREES below that baseline — tuners then map directly to
 * "how far must I nod" instead of fighting absolute pitch numbers that drift.
 *
 * @param {object[] | null} landmarks
 * @param {number | null} [baselinePitch] floored neutral pitch from start of turn / Test Cam
 * @returns {'up' | 'center' | 'down' | null}
 */
export function getHeadNodState(landmarks, baselinePitch = null) {
  const pitch = getHeadNodY(landmarks);
  if (pitch == null) return null;

  if (baselinePitch != null) {
    const delta = pitch - baselinePitch;
    if (delta <= -NOD_DROP_DEGREES) return 'down';
    if (delta >= NOD_RISE_DEGREES) return 'up';
    return 'center';
  }

  // Absolute bands until baseline is ready (first ~0.5s of Test Cam / turn)
  if (pitch > NOD_PITCH_UP_MIN) return 'up';
  if (pitch <= NOD_PITCH_DOWN_MAX) return 'down';
  return 'center';
}

/**
 * Debug helper: log pitch + state every frame while tuning thresholds.
 */
export function logHeadTilt(landmarks, extra = {}) {
  const pitch = getHeadNodY(landmarks);
  const baseline = extra.baseline ?? null;
  const delta = baseline != null ? getHeadNodDelta(landmarks, baseline) : null;
  const state = getHeadNodState(landmarks, baseline);
  if (pitch == null) return;
  console.log('[head-nod]', {
    pitch,
    baseline,
    delta,
    state,
    dropDegrees: NOD_DROP_DEGREES,
    riseDegrees: NOD_RISE_DEGREES,
    ...extra,
  });
}

export const GAME_CUE_DIRECTIONS = ['left', 'center', 'right'];

/** Side-only attacks for defender practice (yellow left/right borders). */
export const PRACTICE_DEFENDER_CUES = ['left', 'right'];

function randomInt(max) {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleInPlace(values) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function pickRandomGameCue() {
  return GAME_CUE_DIRECTIONS[randomInt(GAME_CUE_DIRECTIONS.length)];
}

/**
 * Shuffled bag of left/right — each side appears once before the bag refills,
 * so attacks alternate sides with no back-to-back repeats.
 */
export function createPracticeDefenderCuePicker() {
  let bag = [];

  return function pickPracticeDefenderCue() {
    if (bag.length === 0) {
      bag = shuffleInPlace([...PRACTICE_DEFENDER_CUES]);
    }
    return bag.pop();
  };
}

/**
 * Stricter dodge rules for solo defender practice: you must turn to the
 * opposite side. Resting at center no longer auto-dodges a left/right attack.
 */
export function isPracticeDefenderSurvival(cue, currentDirection) {
  if (!currentDirection) return false;

  if (cue === 'left') return currentDirection === 'right';
  if (cue === 'right') return currentDirection === 'left';

  return false;
}

/** Opposite-direction rule: survive by tilting away from the cued side. */
export function isSurvivalResponse(cue, currentDirection) {
  if (!currentDirection) return false;

  if (cue === 'left') return currentDirection === 'right'|| currentDirection === 'center';
  if (cue === 'right') return currentDirection === 'left'|| currentDirection === 'center';
  if (cue === 'center') return currentDirection === 'left' || currentDirection === 'right';

  return false;
}

/** Lose when your head matches the attack direction (mirror of isSurvivalResponse). */
export function isHitResponse(cue, currentDirection) {
  if (!currentDirection) return false;

  if (cue === 'left') return currentDirection === 'left';
  if (cue === 'right') return currentDirection === 'right';
  if (cue === 'center') return currentDirection === 'center';

  return false;
}
