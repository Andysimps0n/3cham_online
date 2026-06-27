import { useEffect, useRef, useState } from 'react';
import { Holistic } from '@mediapipe/holistic';

/**
 * MediaPipe Holistic tracking only — no rendering.
 * Updates landmarksRef each frame; exposes fps for UI.
 *
 * Split into two effects:
 * - Mount effect: create Holistic once, keep it warm across cam toggles
 * - Active effect: start/stop the RAF loop when isActive changes
 */
export function useHolisticFaceLandmarks(videoRef, isActive) {
  const landmarksRef = useRef(null);
  const leftHandLandmarksRef = useRef(null);
  const rightHandLandmarksRef = useRef(null);
  const holisticRef = useRef(null);
  const runningRef = useRef(false);
  const [fps, setFps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  // Effect A: expensive setup once on mount, teardown only on unmount
  useEffect(() => {
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults((results) => {
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

    holisticRef.current = holistic;

    return () => {
      runningRef.current = false;
      holistic.close();
      holisticRef.current = null;
      landmarksRef.current = null;
      leftHandLandmarksRef.current = null;
      rightHandLandmarksRef.current = null;
      setFps(0);
      setIsTracking(false);
    };
  }, []);

  // Effect B: cheap start/stop of the frame loop when cam toggles
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

    if (!videoRef) return;

    const holistic = holisticRef.current;
    if (!holistic) return;

    runningRef.current = true;

    let cancelled = false;
    let rafId = 0;

    const processFrame = async () => {
      if (cancelled || !runningRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        landmarksRef.current = null;
        leftHandLandmarksRef.current = null;
        rightHandLandmarksRef.current = null;
        setIsTracking(false);
        rafId = requestAnimationFrame(processFrame);
        return;
      }

      try {
        await holistic.send({ image: video });
      } catch (err) {
        console.warn('MediaPipe Holistic frame error:', err);
      }

      if (cancelled || !runningRef.current) return;
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
  }, [isActive, videoRef]);

  return { landmarksRef, leftHandLandmarksRef, rightHandLandmarksRef, fps, isTracking };
}
