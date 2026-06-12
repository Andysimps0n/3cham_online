import React, { useEffect, useRef, useState } from 'react';
import { useHolisticFaceLandmarks } from '../hooks/useHolisticFaceLandmarks';
import { getFaceDirection } from '../tracking/faceDirection';
import FaceLandmarkViewer from './FaceLandmarkViewer';

export default function MediaPipeHolisticCanvas({
  videoRef,
  isActive,
  label = 'You',
  landmarksRef: externalLandmarksRef,
  gameActive = false,
  gameCue = null,
  countdown = null,
}) {
  const internalTracking = useHolisticFaceLandmarks(videoRef, isActive && !externalLandmarksRef);
  const landmarksRef = externalLandmarksRef ?? internalTracking.landmarksRef;

  const [showLandmarks, setShowLandmarks] = useState(true);
  const leftGradientRef = useRef(null);
  const rightGradientRef = useRef(null);
  const centerGradientRef = useRef(null);
  const readyBadgeRef = useRef(null);
  const leftBadgeRef = useRef(null);
  const rightBadgeRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      if (leftGradientRef.current) leftGradientRef.current.style.opacity = '0';
      if (rightGradientRef.current) rightGradientRef.current.style.opacity = '0';
      if (centerGradientRef.current) centerGradientRef.current.style.opacity = '0';
      if (readyBadgeRef.current) readyBadgeRef.current.style.opacity = '0';
      if (leftBadgeRef.current) leftBadgeRef.current.style.opacity = '0';
      if (rightBadgeRef.current) rightBadgeRef.current.style.opacity = '0';
      return undefined;
    }

    let frameId;

    const setSideCueClass = (element, isGameCue) => {
      if (!element) return;
      element.classList.toggle('face-direction-gradient--game-cue', isGameCue);
    };

    const setCenterCueClass = (element, isCenterCue) => {
      if (!element) return;
      element.classList.toggle('face-direction-gradient--game-cue-center', isCenterCue);
    };

    const hideAllOverlays = () => {
      if (leftGradientRef.current) leftGradientRef.current.style.opacity = '0';
      if (rightGradientRef.current) rightGradientRef.current.style.opacity = '0';
      if (centerGradientRef.current) centerGradientRef.current.style.opacity = '0';
      if (readyBadgeRef.current) readyBadgeRef.current.style.opacity = '0';
      if (leftBadgeRef.current) leftBadgeRef.current.style.opacity = '0';
      if (rightBadgeRef.current) rightBadgeRef.current.style.opacity = '0';
    };

    const updateBorderGradients = () => {
      const direction = getFaceDirection(landmarksRef.current);

      if (gameActive && gameCue) {
        if (gameCue === 'center') {
          setSideCueClass(leftGradientRef.current, false);
          setSideCueClass(rightGradientRef.current, false);
          setCenterCueClass(centerGradientRef.current, true);

          if (leftGradientRef.current) leftGradientRef.current.style.opacity = '0';
          if (rightGradientRef.current) rightGradientRef.current.style.opacity = '0';
          if (centerGradientRef.current) centerGradientRef.current.style.opacity = '1';
        } else {
          setSideCueClass(leftGradientRef.current, gameCue === 'left');
          setSideCueClass(rightGradientRef.current, gameCue === 'right');
          setCenterCueClass(centerGradientRef.current, false);

          if (leftGradientRef.current) {
            leftGradientRef.current.style.opacity = gameCue === 'left' ? '1' : '0';
          }
          if (rightGradientRef.current) {
            rightGradientRef.current.style.opacity = gameCue === 'right' ? '1' : '0';
          }
          if (centerGradientRef.current) centerGradientRef.current.style.opacity = '0';
        }

        if (readyBadgeRef.current) readyBadgeRef.current.style.opacity = '0';
        if (leftBadgeRef.current) leftBadgeRef.current.style.opacity = '0';
        if (rightBadgeRef.current) rightBadgeRef.current.style.opacity = '0';
      } else if (gameActive) {
        setSideCueClass(leftGradientRef.current, false);
        setSideCueClass(rightGradientRef.current, false);
        setCenterCueClass(centerGradientRef.current, false);
        hideAllOverlays();
      } else {
        setSideCueClass(leftGradientRef.current, false);
        setSideCueClass(rightGradientRef.current, false);
        setCenterCueClass(centerGradientRef.current, false);

        if (leftGradientRef.current) {
          leftGradientRef.current.style.opacity = direction === 'left' ? '1' : '0';
        }
        if (rightGradientRef.current) {
          rightGradientRef.current.style.opacity = direction === 'right' ? '1' : '0';
        }
        if (centerGradientRef.current) {
          centerGradientRef.current.style.opacity = direction === 'center' ? '1' : '0';
        }
        if (readyBadgeRef.current) {
          readyBadgeRef.current.style.opacity = direction === 'center' ? '1' : '0';
        }
        if (leftBadgeRef.current) {
          leftBadgeRef.current.style.opacity = direction === 'left' ? '1' : '0';
        }
        if (rightBadgeRef.current) {
          rightBadgeRef.current.style.opacity = direction === 'right' ? '1' : '0';
        }
      }

      frameId = requestAnimationFrame(updateBorderGradients);
    };

    frameId = requestAnimationFrame(updateBorderGradients);

    return () => cancelAnimationFrame(frameId);
  }, [isActive, landmarksRef, gameActive, gameCue]);

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
          <div ref={leftGradientRef} className="face-direction-gradient face-direction-gradient--left" />
          <div ref={rightGradientRef} className="face-direction-gradient face-direction-gradient--right" />
          <div ref={centerGradientRef} className="face-direction-gradient face-direction-gradient--center" />
          <div ref={readyBadgeRef} className="face-direction-status-badge face-direction-status-badge--ready">
            Ready
          </div>
          <div ref={leftBadgeRef} className="face-direction-status-badge face-direction-status-badge--side">
            Left
          </div>
          <div ref={rightBadgeRef} className="face-direction-status-badge face-direction-status-badge--side">
            Right
          </div>

          {countdown != null && (
            <div className="game-countdown-overlay">{countdown}</div>
          )}
        </>
      )}
    </div>
  );
}
