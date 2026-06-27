import { Holistic } from '@mediapipe/holistic';

/**
 * One Holistic instance for the whole app.
 * MediaPipe WASM cannot safely handle multiple instances or concurrent send() calls.
 */
let sharedHolistic = null;
const resultSubscribers = new Set();

function ensureSharedHolistic() {
  if (sharedHolistic) {
    return sharedHolistic;
  }

  sharedHolistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  });

  sharedHolistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  sharedHolistic.onResults((results) => {
    resultSubscribers.forEach((listener) => {
      try {
        listener(results);
      } catch (err) {
        console.warn('Holistic results listener error:', err);
      }
    });
  });

  return sharedHolistic;
}

export function getSharedHolistic() {
  return sharedHolistic ?? ensureSharedHolistic();
}

export function subscribeHolisticResults(listener) {
  ensureSharedHolistic();
  resultSubscribers.add(listener);
  return () => {
    resultSubscribers.delete(listener);
  };
}

export function isHolisticFatalError(err) {
  const message = err?.message ?? String(err);
  return (
    message.includes('Aborted')
    || message.includes('RuntimeError')
    || message.includes('Module.arguments')
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (sharedHolistic) {
      sharedHolistic.close();
      sharedHolistic = null;
      resultSubscribers.clear();
    }
  });
}
