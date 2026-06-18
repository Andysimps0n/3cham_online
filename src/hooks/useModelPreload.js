import { useLayoutEffect, useState } from 'react';
import {
  getModelBootPhase,
  isModelBootReady,
  startFullModelBoot,
  subscribeModelPreloadPhase,
  subscribeModelPreloadProgress,
} from '../assets/preloadModel';

export function useModelPreload() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(getModelBootPhase);
  const [status, setStatus] = useState(() => (isModelBootReady() ? 'ready' : 'loading'));
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    const unsubscribeProgress = subscribeModelPreloadProgress(setProgress);
    const unsubscribePhase = subscribeModelPreloadPhase(setPhase);

    startFullModelBoot()
      .then(() => setStatus('ready'))
      .catch((loadError) => {
        console.error('Failed to boot 3D model:', loadError);
        setError(loadError);
        setStatus('error');
      });

    return () => {
      unsubscribeProgress();
      unsubscribePhase();
    };
  }, []);

  return { progress, phase, status, error };
}
