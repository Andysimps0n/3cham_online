import React from 'react';

const PHASE_LABELS = {
  downloading: 'Downloading 3D assets...',
  preparing: 'Preparing model for rendering...',
  ready: 'Ready',
};

export default function ModelBootScreen({ progress = 0, phase = 'downloading', error = null }) {
  if (error) {
    return (
      <div className="model-boot-screen">
        <div className="model-boot-screen__card model-boot-screen__card--error">
          <h1 className="model-boot-screen__title">Model failed to load</h1>
          <p className="model-boot-screen__hint">
            Check your network connection and refresh the page.
          </p>
          <button
            type="button"
            className="neo-btn neo-btn-sm"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const isPreparing = phase === 'preparing';
  const phaseLabel = PHASE_LABELS[phase] ?? PHASE_LABELS.downloading;

  return (
    <div className="model-boot-screen">
      <div className="model-boot-screen__card">
        <h1 className="model-boot-screen__title">Cham Cham Cham</h1>
        <p className="model-boot-screen__subtitle">{phaseLabel}</p>

        <div className="model-load-overlay__bar model-boot-screen__bar">
          <div
            className={`model-load-overlay__fill${isPreparing ? ' model-load-overlay__fill--indeterminate' : ''}`}
            style={isPreparing ? undefined : { width: `${Math.round(progress)}%` }}
          />
        </div>

        <div className="model-load-overlay__percent">
          {isPreparing ? 'Almost there...' : `${Math.round(progress)}%`}
        </div>
        <p className="model-boot-screen__hint">First visit can take a few seconds</p>
      </div>
    </div>
  );
}
