import React, { useState } from 'react';
import { useHolisticFaceLandmarks } from '../hooks/useHolisticFaceLandmarks';
import FaceLandmarkViewer from './FaceLandmarkViewer';

export default function MediaPipeHolisticCanvas({
  videoRef,
  isActive,
  label = 'You',
}) {
  const { landmarksRef, fps, isTracking } = useHolisticFaceLandmarks(videoRef, isActive);
  const [showLandmarks, setShowLandmarks] = useState(true);

  return (
    <div
      className="holistic-canvas-container"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: '#0d0d0d',
      }}
    >
      {isActive ? (
        <FaceLandmarkViewer landmarksRef={landmarksRef} visible={showLandmarks} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFDE4D',
            border: '3px solid #000',
            boxSizing: 'border-box',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 800,
              fontSize: '1.1rem',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            {label}
          </div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
            Turn cam on to explore face landmark geometry in 3D
          </div>
        </div>
      )}

      {isActive && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              zIndex: 40,
            }}
          >
            <button
              type="button"
              className="neo-btn neo-btn-xs"
              style={{
                fontSize: '9px',
                padding: '2px 6px',
                backgroundColor: showLandmarks ? 'var(--color-yellow)' : '#f3f4f6',
                color: '#000',
                boxShadow: '1px 1px 0px #000',
                border: '1.5px solid #000',
              }}
              onClick={() => setShowLandmarks((v) => !v)}
            >
              {showLandmarks ? 'LANDMARKS ON' : 'LANDMARKS OFF'}
            </button>
          </div>

          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: isTracking ? 'var(--color-green)' : 'var(--color-cyan)',
              border: '1.5px solid #000',
              boxShadow: '2px 2px 0px #000',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: '700',
              padding: '2px 8px',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 40,
            }}
          >
            <div
              className="status-dot-blink"
              style={{ width: '6px', height: '6px', backgroundColor: '#000', borderRadius: '50%' }}
            />
            <span>
              {fps} FPS · {isTracking ? 'TRACKING' : 'NO FACE'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
