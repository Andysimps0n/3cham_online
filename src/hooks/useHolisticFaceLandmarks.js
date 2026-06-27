import { useEffect, useRef, useState } from 'react';
import {
  getSharedHolistic,
  isHolisticFatalError,
  subscribeHolisticResults,
} from '../tracking/sharedHolistic';

/**
 * MediaPipe Holistic tracking only — no rendering.
 * Updates landmarksRef each frame; exposes fps for UI.
 *
 * Uses a module-level shared Holistic instance (WASM must not be duplicated).
 * Effect A: subscribe to results on mount
 * Effect B: start/stop the RAF loop when isActive changes
 */
export function useHolisticFaceLandmarks(videoRef, isActive) {
  const landmarksRef = useRef(null);
  const leftHandLandmarksRef = useRef(null);
  const rightHandLandmarksRef = useRef(null);
  const runningRef = useRef(false);
  const [fps, setFps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [holisticReady, setHolisticReady] = useState(false);

  // Effect A: wire up results handler once per hook consumer
  useEffect(() => {
    let frameCount = 0;
    let lastFpsTime = performance.now();

    getSharedHolistic();
    setHolisticReady(true);

    const unsubscribe = subscribeHolisticResults((results) => {
      if (!runningRef.current) return;

      landmarksRef.current = results.faceLandmarks ?? null;
      leftHandLandmarksRef.current = results.leftHandLandmarks ?? null;
      rightHandLandmarksRef.current = results.rightHandLandmarks ?? null;

      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      setIsTracking(Boolean(
        results.faceLandmarks?.length
        || results.leftHandLandmarks?.length
        || results.rightHandLandmarks?.length
      ));
    });

    return () => {
      runningRef.current = false;
      unsubscribe();
      setHolisticReady(false);
      landmarksRef.current = null;
      leftHandLandmarksRef.current = null;
      rightHandLandmarksRef.current = null;
      setFps(0);
      setIsTracking(false);
    };
  }, []);

  // Effect B: start/stop the frame loop when cam toggles
  useEffect(() => {
    if (!isActive) {
      runningRef.current = false;
      landmarksRef.current = null;
      leftHandLandmarksRef.current = null;
      rightHandLandmarksRef.current = null;
      setFps(0);
      setIsTracking(false);
      return;
    }

    if (!videoRef || !holisticReady) return;

    const holistic = getSharedHolistic();
    runningRef.current = true;

    let cancelled = false;
    let rafId = 0;
    let sendInFlight = false;
    let fatalError = false;

    const processFrame = async () => {
      if (cancelled || !runningRef.current || fatalError) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        landmarksRef.current = null;
        leftHandLandmarksRef.current = null;
        rightHandLandmarksRef.current = null;
        setIsTracking(false);
        rafId = requestAnimationFrame(processFrame);
        return;
      }

      // MediaPipe rejects overlapping send() on the same instance
      if (sendInFlight) {
        rafId = requestAnimationFrame(processFrame);
        return;
      }

      sendInFlight = true;
      try {
        await holistic.send({ image: video });
      } catch (err) {
        console.warn('MediaPipe Holistic frame error:', err);
        if (isHolisticFatalError(err)) {
          fatalError = true;
          runningRef.current = false;
          return;
        }
      } finally {
        sendInFlight = false;
      }

      if (cancelled || !runningRef.current || fatalError) return;
      rafId = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => {
      cancelled = true;
      runningRef.current = false;
      cancelAnimationFrame(rafId);
      landmarksRef.current = null;
      leftHandLandmarksRef.current = null;
      rightHandLandmarksRef.current = null;
      setFps(0);
      setIsTracking(false);
    };
  }, [isActive, videoRef, holisticReady]);

  return { landmarksRef, leftHandLandmarksRef, rightHandLandmarksRef, fps, isTracking };
}
