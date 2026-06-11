import { useEffect, useRef, useState } from 'react';
import { Holistic } from '@mediapipe/holistic';

/**
 * MediaPipe Holistic tracking only — no rendering.
 * Updates landmarksRef each frame; exposes fps for UI.
 */
export function useHolisticFaceLandmarks(videoRef, isActive) {
  const landmarksRef = useRef(null);
  const holisticRef = useRef(null);
  const [fps, setFps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!isActive || !videoRef?.current) {
      landmarksRef.current = null;
      setFps(0);
      setIsTracking(false);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });
    holisticRef.current = holistic;

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults((results) => {
      if (cancelled) return;

      landmarksRef.current = results.faceLandmarks ?? null;

      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      setIsTracking(Boolean(results.faceLandmarks?.length));
    });

    const processFrame = async () => {
      if (cancelled) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        landmarksRef.current = null;
        setIsTracking(false);
        rafId = requestAnimationFrame(processFrame);
        return;
      }

      try {
        await holistic.send({ image: video });
      } catch (err) {
        console.warn('MediaPipe Holistic frame error:', err);
      }

      rafId = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      holistic.close();
      holisticRef.current = null;
      landmarksRef.current = null;
      setFps(0);
      setIsTracking(false);
    };
  }, [isActive, videoRef]);

  return { landmarksRef, fps, isTracking };
}
