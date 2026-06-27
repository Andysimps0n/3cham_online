import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canAcceptNodInput,
  getFaceDirection,
  getHeadNodDelta,
  getHeadNodState,
  getHeadNodY,
  isHeadNodding,
  logHeadTilt,
  NOD_COOLDOWN_MS,
} from '../tracking/faceDirection';

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------
// These thresholds are deliberately named and grouped so they are easy to tune
// for different cameras / seating positions.

const ROLE_REVEAL_MS = 3000; // how long the "you are Attacker/Defender" screen shows
const RESULT_DISPLAY_MS = 2500; // how long the success / dodge effect stays up

// Nod uses baseline-relative pitch — tune NOD_DROP_DEGREES in faceDirection.js.
const BASELINE_SAMPLE_COUNT = 12;

// Left/right must be held steadily for this long before we "commit" the choice.
// This stops a flicker through left-on-the-way-to-right from being registered.
const DIRECTION_HOLD_MS = 350;

// Attacker action stages within a single turn.
const STAGE = {
  WAIT_DOWN_1: 'waitDown1',
  WAIT_DOWN_2: 'waitDown2',
  CHOOSE: 'choose',
};

/**
 * Drives the Attack-Defend game on the client.
 *
 * The SERVER is authoritative: this hook never decides roles or scores. It only
 * (a) reflects the server's snapshots into React state for the UI, and
 * (b) watches the local camera and reports what *this* player did.
 */
export function useAttackDefendGame({
  landmarksRef,
  userId,
  isActive,
  sendGameEvent,
  onNod1,
  onNod2,
  onAttackScored,
  onRoleSwap,
  onGameOver,
}) {
  // ---- UI state (drives rendering) ----
  const [phase, setPhase] = useState('idle'); // idle | roleReveal | attackerTurn | defenderTurn | resolving | gameOver
  const [attackerId, setAttackerId] = useState(null);
  const [defenderId, setDefenderId] = useState(null);
  const [scores, setScores] = useState({});
  const [winScore, setWinScore] = useState(5);
  const [winnerId, setWinnerId] = useState(null);
  const [nodCount, setNodCount] = useState(0); // my own nods this turn (0..2)
  const [peerNodCount, setPeerNodCount] = useState(0); // opponent winding up
  const [actionLocked, setActionLocked] = useState(false); // I committed, now waiting
  const [lastResult, setLastResult] = useState(null); // { outcome, attackerDirection, defenderDirection }

  // ---- Refs the camera loop reads every frame (no re-render) ----
  const phaseRef = useRef('idle');
  const userIdRef = useRef(userId);
  const rolesRef = useRef({ attackerId: null, defenderId: null });
  const nodStageRef = useRef(STAGE.WAIT_DOWN_1);
  const baselinePitchRef = useRef(null);
  const baselineSamplesRef = useRef([]);
  const dirHoldRef = useRef({ direction: null, since: 0 });
  const lastNodRegisteredAtRef = useRef(0);
  const hasUnNoddedRef = useRef(true);
  const committedRef = useRef(false);
  const timeoutsRef = useRef([]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const setPhaseSafe = useCallback((next) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const applyRoles = useCallback((nextAttackerId, nextDefenderId) => {
    rolesRef.current = { attackerId: nextAttackerId, defenderId: nextDefenderId };
    setAttackerId(nextAttackerId);
    setDefenderId(nextDefenderId);
  }, []);

  const schedule = useCallback((ms, fn) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // Reset all per-turn detection state so a fresh turn starts clean.
  const resetTurnDetection = useCallback(() => {
    nodStageRef.current = STAGE.WAIT_DOWN_1;
    baselinePitchRef.current = null;
    baselineSamplesRef.current = [];
    dirHoldRef.current = { direction: null, since: 0 };
    lastNodRegisteredAtRef.current = 0;
    hasUnNoddedRef.current = true;
    committedRef.current = false;
  }, []);

  const beginAttackerTurn = useCallback(() => {
    resetTurnDetection();
    setNodCount(0);
    setPeerNodCount(0);
    setActionLocked(false);
    setPhaseSafe('attackerTurn');
  }, [resetTurnDetection, setPhaseSafe]);

  const enterDefenderTurn = useCallback(() => {
    resetTurnDetection();
    setActionLocked(false);
    setPhaseSafe('defenderTurn');
  }, [resetTurnDetection, setPhaseSafe]);

  const handleResult = useCallback((message) => {
    // Apply the post-outcome roles immediately so the labels flip right away
    // (spec: "Keep role labels updated immediately whenever roles change").
    applyRoles(message.attackerId, message.defenderId);
    setActionLocked(false);
    setLastResult({
      outcome: message.outcome,
      attackerDirection: message.attackerDirection,
      defenderDirection: message.defenderDirection,
    });
    setPhaseSafe('resolving');

    if (message.outcome === 'attackerScored') {
      onAttackScored?.();
    } else {
      onRoleSwap?.();
    }

    schedule(RESULT_DISPLAY_MS, () => {
      if (message.winnerId) {
        setWinnerId(message.winnerId);
        setPhaseSafe('gameOver');
        onGameOver?.();
      } else {
        beginAttackerTurn();
      }
    });
  }, [applyRoles, setPhaseSafe, onAttackScored, onRoleSwap, onGameOver, schedule, beginAttackerTurn]);

  // Single entry point for every server "game:*" message.
  const handleGameEvent = useCallback((message) => {
    switch (message.type) {
      case 'game:start': {
        clearTimers();
        applyRoles(message.attackerId, message.defenderId);
        setScores(message.scores || {});
        setWinScore(message.winScore || 5);
        setWinnerId(null);
        setLastResult(null);
        setNodCount(0);
        setPeerNodCount(0);
        setActionLocked(false);
        resetTurnDetection();
        setPhaseSafe('roleReveal');
        schedule(ROLE_REVEAL_MS, () => beginAttackerTurn());
        break;
      }
      case 'game:defenderTurn': {
        applyRoles(message.attackerId, message.defenderId);
        setScores(message.scores || {});
        enterDefenderTurn();
        break;
      }
      case 'game:result': {
        setScores(message.scores || {});
        handleResult(message);
        break;
      }
      case 'game:nod': {
        setPeerNodCount(message.count || 0);
        break;
      }
      default:
        break;
    }
  }, [
    clearTimers,
    applyRoles,
    resetTurnDetection,
    setPhaseSafe,
    schedule,
    beginAttackerTurn,
    enterDefenderTurn,
    handleResult,
  ]);

  const stopGame = useCallback(() => {
    clearTimers();
    resetTurnDetection();
    setPhaseSafe('idle');
    setAttackerId(null);
    setDefenderId(null);
    rolesRef.current = { attackerId: null, defenderId: null };
    setScores({});
    setWinnerId(null);
    setNodCount(0);
    setPeerNodCount(0);
    setActionLocked(false);
    setLastResult(null);
  }, [clearTimers, resetTurnDetection, setPhaseSafe]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // ---- The camera loop: reads the face every frame, reports actions ----
  useEffect(() => {
    if (!isActive || !landmarksRef) return undefined;

    let rafId;

    const fireNod = (count) => {
      setNodCount(count);
      if (count === 1) onNod1?.();
      else if (count === 2) onNod2?.();
      sendGameEvent?.({ type: 'game:nod', count });
    };

    // Returns the steadily-held 'left' | 'right', or null if not committed yet.
    const detectHeldDirection = (landmarks) => {
      const dir = getFaceDirection(landmarks);
      const hold = dirHoldRef.current;

      if (dir === 'left' || dir === 'right') {
        if (hold.direction === dir) {
          if (performance.now() - hold.since >= DIRECTION_HOLD_MS) {
            return dir;
          }
        } else {
          dirHoldRef.current = { direction: dir, since: performance.now() };
        }
      } else {
        dirHoldRef.current = { direction: null, since: 0 };
      }
      return null;
    };

    const runAttackerFrame = (landmarks) => {
      const pitch = getHeadNodY(landmarks);
      if (pitch == null) return;

      if (baselinePitchRef.current == null) {
        baselineSamplesRef.current.push(pitch);
        if (baselineSamplesRef.current.length < BASELINE_SAMPLE_COUNT) return;
        const sum = baselineSamplesRef.current.reduce((a, b) => a + b, 0);
        baselinePitchRef.current = Math.floor(sum / baselineSamplesRef.current.length);
      }

      const baseline = baselinePitchRef.current;
      const nodState = getHeadNodState(landmarks, baseline);
      if (nodState == null) return;

      const isDown = isHeadNodding(nodState);
      if (!isDown && canAcceptNodInput(landmarks)) {
        hasUnNoddedRef.current = true;
      }

      const canRegisterNod = () =>
        canAcceptNodInput(landmarks)
        && hasUnNoddedRef.current
        && (lastNodRegisteredAtRef.current === 0
          || performance.now() - lastNodRegisteredAtRef.current >= NOD_COOLDOWN_MS);

      logHeadTilt(landmarks, {
        stage: nodStageRef.current,
        baseline,
        isDown,
        hasUnNodded: hasUnNoddedRef.current,
      });

      switch (nodStageRef.current) {
        case STAGE.WAIT_DOWN_1:
          if (isDown && canRegisterNod()) {
            fireNod(1);
            hasUnNoddedRef.current = false;
            lastNodRegisteredAtRef.current = performance.now();
            nodStageRef.current = STAGE.WAIT_DOWN_2;
          }
          break;
        case STAGE.WAIT_DOWN_2:
          if (isDown && canRegisterNod()) {
            fireNod(2);
            hasUnNoddedRef.current = false;
            lastNodRegisteredAtRef.current = performance.now();
            nodStageRef.current = STAGE.CHOOSE;
          }
          break;
        case STAGE.CHOOSE: {
          const chosen = detectHeldDirection(landmarks);
          if (chosen) {
            committedRef.current = true;
            setActionLocked(true);
            sendGameEvent?.({ type: 'game:attack', direction: chosen });
          }
          break;
        }
        default:
          break;
      }
    };

    const runDefenderFrame = (landmarks) => {
      const chosen = detectHeldDirection(landmarks);
      if (chosen) {
        committedRef.current = true;
        setActionLocked(true);
        sendGameEvent?.({ type: 'game:defend', direction: chosen });
      }
    };

    const tick = () => {
      const landmarks = landmarksRef.current;
      const myId = userIdRef.current;
      const { attackerId: atkId, defenderId: defId } = rolesRef.current;

      if (landmarks && !committedRef.current) {
        if (phaseRef.current === 'attackerTurn' && myId === atkId) {
          runAttackerFrame(landmarks);
        } else if (phaseRef.current === 'defenderTurn' && myId === defId) {
          runDefenderFrame(landmarks);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, landmarksRef, sendGameEvent, onNod1, onNod2]);

  const myRole = userId && userId === attackerId
    ? 'attacker'
    : userId && userId === defenderId
      ? 'defender'
      : null;

  return {
    phase,
    isPeerGameActive: phase !== 'idle',
    myRole,
    attackerId,
    defenderId,
    scores,
    winScore,
    winnerId,
    nodCount,
    peerNodCount,
    actionLocked,
    lastResult,
    handleGameEvent,
    stopGame,
  };
}
