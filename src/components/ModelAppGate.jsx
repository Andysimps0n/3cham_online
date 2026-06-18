import React from 'react';
import { useModelPreload } from '../hooks/useModelPreload';
import ModelBootScreen from './ModelBootScreen';

export default function ModelAppGate({ children }) {
  const { progress, phase, status, error } = useModelPreload();

  if (status === 'error') {
    return <ModelBootScreen error={error} />;
  }

  if (status !== 'ready') {
    return <ModelBootScreen progress={progress} phase={phase} />;
  }

  return children;
}
