import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getFaceDirection,
  getHeadNodState,
  getHeadNodY,
  isHeadNodding,
  isSurvivalResponse,
  NOD_COOLDOWN_MS,
  pickRandomGameCue,
} from '../tracking/faceDirection';

// ---------------------------------------------------------------------------
// Tunable constants (kept in one place so they are easy to calibrate)
// ---------------------------------------------------------------------------
// How many neutral-pitch samples we average before trusting the nod baseline.
const BASELINE_SAMPLE_COUNT = 12;
// A left/right aim must be held steadily this long before we "commit" it.
// Same value the real game uses (useAttackDefendGame DIRECTION_HOLD_MS).
const DIRECTION_HOLD_MS = 350;
// How long the "ATTACK!" flash stays on the attacker screen before resetting.
const ATTACK_FLASH_MS = 1000;

// Defender pacing — the pseudo attacker's rhythm: "cham ... cham ... CHAM!".
const PREP_BEEP_GAP_MS = 550;          // gap between the two low prep beeps
const DEFENDER_RESPONSE_WINDOW_MS = 1400; // time to dodge after the attack beep
const DEFENDER_FLASH_MS = 900;         // how long the survived/hit flash shows
const DEFENDER_ROUND_PAUSE_MS = 350;   // breather before the next attack

// Attacker turn is a small state machine: down, un-nod, down, un-nod, then aim.
const ATTACK_STAGE = {
  WAIT_DOWN_1: 'waitDown1',
  WAIT_DOWN_2: 'waitDown2',
  CHOOSE: 'choose',
};

/**
 * Drives the single-player PRACTICE area.
 *
 * Unlike `useAttackDefendGame` (which is server-authoritative), this hook owns
 * all of its own logic locally. There is no opponent and no network: it just
 * reads the local camera landmarks and the shared tracking helpers.
 *
 * - mode 'attacker': repeat the nod-nod-aim sequence as many times as you like.
 * - mode 'defender': a fake attacker beeps "cham cham CHAM" and cues a random
 *   direction; you survive (and score) by turning a DIFFERENT direction. In
 *   practice you always live, even when you "lose", and the role never changes.
 */
export function usePracticeGame({
  landmarksRef,
  mode, // 'attacker' | 'defender' | null
  isActive, // camera on AND sitting on a practice play screen
  onNod1,
  onNod2,
  onAttackThrown,
  onPrepBeep,
  onAttackBeep,
  onSurvived,
  onHit,
}) {
  // ---- Attacker UI state ----
  const [nodCount, setNodCount] = useState(0); // 0..2 nods loaded this rep
  const [attacksThrown, setAttacksThrown] = useState(0);
  const [lastThrow, setLastThrow] = useState(null); // 'left' | 'right' (flash)

  // ---- Defender UI state ----
  const [isDefenderRunning, setIsDefenderRunning] = useState(false);
  const [defenderScore, setDefenderScore] = useState(0);
  const [currentCue, setCurrentCue] = useState(null); // 'left' | 'center' | 'right'
  const [lastOutcome, setLastOutcome] = useState(null); // { type, cue, dir }

  // ---- Refs used by the loops (so they read fresh values without re-subscribing) ----
  const timeoutsRef = useRef([]);
  const defenderRunIdRef = useRef(0);
  const defenderCancelledRef = useRef(false);
  // Keep the latest audio callbacks in a ref so the long-lived defender loop
  // always calls the current functions without restarting on every render.
  const callbacksRef = useRef({});
  callbacksRef.current = {
    onNod1,
    onNod2,
    onAttackThrown,
    onPrepBeep,
    onAttackBeep,
    onSurvived,
    onHit,
  };

  const sleep = useCallback(
    (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        timeoutsRef.current.push(id);
      }),
    [],
  );

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const stopDefense = useCallback(() => {
    defenderCancelledRef.current = true;
    defenderRunIdRef.current += 1; // invalidate any in-flight loop
    clearTimeouts();
    setIsDefenderRunning(false);
    setCurrentCue(null);
    setLastOutcome(null);
  }, [clearTimeouts]);

  // -------------------------------------------------------------------------
  // ATTACKER LOOP: one requestAnimationFrame loop that runs the nod machine.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive || mode !== 'attacker' || !landmarksRef) return undefined;

    // Reset everything for a fresh attacker session.
    setNodCount(0);
    setAttacksThrown(0);
    setLastThrow(null);

    let rafId;
    let stage = ATTACK_STAGE.WAIT_DOWN_1;
    let nodCountLocal = 0; // mirror of nodCount, avoids setState every frame
    let baseline = null;
    const samples = [];
    let dirHold = { direction: null, since: 0 };
    let lastNodRegisteredAt = 0;
    let hasUnNodded = true;
    let flashClearId = null;

    const canRegisterNod = () =>
      hasUnNodded
      && (lastNodRegisteredAt === 0
        || performance.now() - lastNodRegisteredAt >= NOD_COOLDOWN_MS);

    const setNodCountIfChanged = (next) => {
      if (next !== nodCountLocal) {
        nodCountLocal = next;
        setNodCount(next);
      }
    };

    // Same hold logic as the real game: a direction must be held steadily
    // before we trust it, so a flick through "left" on the way to "right"
    // does not register.
    const detectHeldDirection = (landmarks) => {
      const dir = getFaceDirection(landmarks);
      if (dir === 'left' || dir === 'right') {
        if (dirHold.direction === dir) {
          if (performance.now() - dirHold.since >= DIRECTION_HOLD_MS) return dir;
        } else {
          dirHold = { direction: dir, since: performance.now() };
        }
      } else {
        dirHold = { direction: null, since: 0 };
      }
      return null;
    };

    const tick = () => {
      const landmarks = landmarksRef.current;
      if (landmarks) {
        const pitch = getHeadNodY(landmarks);
        if (pitch != null) {
          // Calibrate a neutral baseline once, from the first few frames.
          if (baseline == null) {
            samples.push(pitch);
            if (samples.length >= BASELINE_SAMPLE_COUNT) {
              const sum = samples.reduce((a, b) => a + b, 0);
              baseline = Math.floor(sum / samples.length);
            }
          } else {
            const nodState = getHeadNodState(landmarks, baseline);
            const isDown = isHeadNodding(nodState);
            if (!isDown) {
              hasUnNodded = true;
            }

            switch (stage) {
              case ATTACK_STAGE.WAIT_DOWN_1:
                if (isDown && canRegisterNod()) {
                  setNodCountIfChanged(1);
                  callbacksRef.current.onNod1?.();
                  hasUnNodded = false;
                  lastNodRegisteredAt = performance.now();
                  stage = ATTACK_STAGE.WAIT_DOWN_2;
                }
                break;
              case ATTACK_STAGE.WAIT_DOWN_2:
                if (isDown && canRegisterNod()) {
                  setNodCountIfChanged(2);
                  callbacksRef.current.onNod2?.();
                  hasUnNodded = false;
                  lastNodRegisteredAt = performance.now();
                  stage = ATTACK_STAGE.CHOOSE;
                }
                break;
              case ATTACK_STAGE.CHOOSE: {
                const chosen = detectHeldDirection(landmarks);
                if (chosen) {
                  // A full rep is done: flash it, count it, then reset so the
                  // player can immediately throw the next one.
                  setLastThrow(chosen);
                  setAttacksThrown((c) => c + 1);
                  callbacksRef.current.onAttackThrown?.();

                  if (flashClearId) clearTimeout(flashClearId);
                  flashClearId = setTimeout(() => setLastThrow(null), ATTACK_FLASH_MS);

                  stage = ATTACK_STAGE.WAIT_DOWN_1;
                  setNodCountIfChanged(0);
                  lastNodRegisteredAt = 0;
                  hasUnNodded = true;
                  dirHold = { direction: null, since: 0 };
                }
                break;
              }
              default:
                break;
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (flashClearId) clearTimeout(flashClearId);
    };
  }, [isActive, mode, landmarksRef]);

  // -------------------------------------------------------------------------
  // DEFENDER LOOP: an async loop kicked off by the green Start button.
  // -------------------------------------------------------------------------
  const waitForDodge = useCallback(
    (cue, timeoutMs, isCancelled) =>
      new Promise((resolve) => {
        const start = performance.now();
        let rafId;
        const check = () => {
          if (isCancelled()) {
            cancelAnimationFrame(rafId);
            resolve({ survived: false, cancelled: true });
            return;
          }
          const dir = getFaceDirection(landmarksRef.current);
          // isSurvivalResponse encodes "a DIFFERENT direction survives".
          if (isSurvivalResponse(cue, dir)) {
            cancelAnimationFrame(rafId);
            resolve({ survived: true, dir });
            return;
          }
          if (performance.now() - start >= timeoutMs) {
            cancelAnimationFrame(rafId);
            resolve({ survived: false, dir });
            return;
          }
          rafId = requestAnimationFrame(check);
        };
        rafId = requestAnimationFrame(check);
      }),
    [landmarksRef],
  );

  const startDefense = useCallback(async () => {
    if (isDefenderRunning) return;

    const runId = defenderRunIdRef.current + 1;
    defenderRunIdRef.current = runId;
    defenderCancelledRef.current = false;
    clearTimeouts();

    const active = () => defenderRunIdRef.current === runId && !defenderCancelledRef.current;

    setDefenderScore(0);
    setLastOutcome(null);
    setCurrentCue(null);
    setIsDefenderRunning(true);

    try {
      while (active()) {
        // "cham ... cham" — two low prep beeps to telegraph the attack.
        callbacksRef.current.onPrepBeep?.();
        await sleep(PREP_BEEP_GAP_MS);
        if (!active()) return;
        callbacksRef.current.onPrepBeep?.();
        await sleep(PREP_BEEP_GAP_MS);
        if (!active()) return;

        // "CHAM!" — the attack: pick + reveal a random direction.
        const cue = pickRandomGameCue();
        setCurrentCue(cue);
        callbacksRef.current.onAttackBeep?.();

        const result = await waitForDodge(
          cue,
          DEFENDER_RESPONSE_WINDOW_MS,
          () => !active(),
        );
        if (!active()) return;

        setCurrentCue(null);

        if (result.survived) {
          setDefenderScore((s) => s + 1);
          setLastOutcome({ type: 'survived', cue, dir: result.dir });
          callbacksRef.current.onSurvived?.();
        } else {
          // Lose condition (same direction as the attacker). In practice you
          // still LIVE — no point, no role change — so the loop just continues.
          setLastOutcome({ type: 'hit', cue, dir: result.dir });
          callbacksRef.current.onHit?.();
        }

        await sleep(DEFENDER_FLASH_MS);
        if (!active()) return;
        setLastOutcome(null);
        await sleep(DEFENDER_ROUND_PAUSE_MS);
      }
    } finally {
      if (defenderRunIdRef.current === runId) setIsDefenderRunning(false);
    }
  }, [isDefenderRunning, clearTimeouts, sleep, waitForDodge]);

  // Stop the defender loop if we leave the screen or the camera turns off.
  useEffect(() => {
    if (!isActive || mode !== 'defender') stopDefense();
  }, [isActive, mode, stopDefense]);

  // Clean up any pending timers when the hook unmounts.
  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  return {
    // attacker
    nodCount,
    attacksThrown,
    lastThrow,
    // defender
    isDefenderRunning,
    defenderScore,
    currentCue,
    lastOutcome,
    startDefense,
    stopDefense,
  };
}
