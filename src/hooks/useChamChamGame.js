import { useCallback, useEffect, useRef, useState } from 'react';
import { getFaceDirection, isSurvivalResponse, pickRandomGameCue } from '../tracking/faceDirection';

const COUNTDOWN_STEP_MS = 700;
const RESPONSE_WINDOW_MS = 100;
const CUE_HOLD_ON_SUCCESS_MS = 100;
const ROUND_PAUSE_MS = 400;

function waitForSurvivalResponse(landmarksRef, cue, timeoutMs, isCancelled) {
  return new Promise((resolve) => {
    const start = performance.now();
    let rafId;

    const check = () => {
      if (isCancelled()) {
        cancelAnimationFrame(rafId);
        resolve(false);
        return;
      }

      const currentDirection = getFaceDirection(landmarksRef.current);
      if (isSurvivalResponse(cue, currentDirection)) {
        cancelAnimationFrame(rafId);
        resolve(true);
        return;
      }

      if (performance.now() - start >= timeoutMs) {
        cancelAnimationFrame(rafId);
        resolve(false);
        return;
      }

      rafId = requestAnimationFrame(check);
    };

    rafId = requestAnimationFrame(check);
  });
}

export function useChamChamGame({ landmarksRef, onTickBeep, onSuccessBeep, onFailBeep }) {
  const [gamePhase, setGamePhase] = useState('idle');
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [gameCue, setGameCue] = useState(null);
  const [canStart, setCanStart] = useState(false);

  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);
  const loopActiveRef = useRef(false);
  const timeoutsRef = useRef([]);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const clearScheduled = useCallback(() => {
    clearTimeouts();
    cancelledRef.current = true;
    runIdRef.current += 1;
  }, [clearTimeouts]);

  const sleep = useCallback((ms) => new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    timeoutsRef.current.push(id);
  }), []);

  const stopGame = useCallback(() => {
    clearScheduled();
    loopActiveRef.current = false;
    setGameCue(null);
    setCountdown(null);
    setGamePhase('idle');
  }, [clearScheduled]);

  useEffect(() => {
    const canPoll = gamePhase === 'idle' || gamePhase === 'gameOver';
    if (!canPoll || !landmarksRef) {
      if (!canPoll) setCanStart(false);
      return undefined;
    }

    let rafId;
    const tick = () => {
      const direction = getFaceDirection(landmarksRef.current);
      const readyToStart = direction !== null && direction !== 'center';
      setCanStart((prev) => (prev === readyToStart ? prev : readyToStart));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gamePhase, landmarksRef]);

  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  const startGame = useCallback(async () => {
    if (loopActiveRef.current) return;

    const direction = getFaceDirection(landmarksRef.current);
    if (direction === null || direction === 'center') return;

    loopActiveRef.current = true;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    cancelledRef.current = false;
    clearTimeouts();

    const isActiveRun = () => runIdRef.current === runId && !cancelledRef.current;

    try {
      setScore(0);
      setGameCue(null);
      setCountdown(null);
      setGamePhase('playing');

      while (isActiveRun()) {
        for (let n = 3; n >= 1; n -= 1) {
          if (!isActiveRun()) return;

          setCountdown(n);
          onTickBeep?.();
          await sleep(COUNTDOWN_STEP_MS);
        }

        if (!isActiveRun()) return;

        setCountdown(null);

        const cue = pickRandomGameCue();
        setGameCue(cue);

        const success = await waitForSurvivalResponse(
          landmarksRef,
          cue,
          RESPONSE_WINDOW_MS,
          () => !isActiveRun()
        );

        if (!isActiveRun()) return;

        if (success) {
          await sleep(CUE_HOLD_ON_SUCCESS_MS);
          if (!isActiveRun()) return;

          setGameCue(null);
          setScore((prev) => prev + 1);
          onSuccessBeep?.();
          await sleep(ROUND_PAUSE_MS);
        } else {
          setGameCue(null);
          onFailBeep?.();
          setGamePhase('gameOver');
          return;
        }
      }
    } finally {
      loopActiveRef.current = false;
    }
  }, [landmarksRef, onTickBeep, onSuccessBeep, onFailBeep, sleep, clearTimeouts]);

  return {
    gamePhase,
    score,
    countdown,
    gameCue,
    canStart,
    startGame,
    stopGame,
    gameActive: gamePhase === 'playing',
    showScore: gamePhase === 'playing' || gamePhase === 'gameOver',
  };
}
