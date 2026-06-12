import React from 'react';
import { useHolisticFaceLandmarks } from '../hooks/useHolisticFaceLandmarks';
import HandLandmarkViewer from './HandLandmarkViewer';

export default function MediaPipeHandCanvas({
  videoRef,
  isActive,
  label = 'You',
}) {
  const { leftHandLandmarksRef, rightHandLandmarksRef } = useHolisticFaceLandmarks(videoRef, isActive);

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
        <HandLandmarkViewer
          leftHandLandmarksRef={leftHandLandmarksRef}
          rightHandLandmarksRef={rightHandLandmarksRef}
          visible
        />
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
            Turn cam on to explore hand direction in 3D
          </div>
        </div>
      )}
    </div>
  );
}
