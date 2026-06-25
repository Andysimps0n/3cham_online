import React, { useEffect, useRef, useState } from 'react';
import { useHolisticFaceLandmarks } from '../hooks/useHolisticFaceLandmarks';
import {
  getFaceDirection,
  getHeadNodDelta,
  getHeadNodState,
  getHeadNodY,
  logHeadTilt,
} from '../tracking/faceDirection';
import FaceLandmarkViewer from './FaceLandmarkViewer';

export default function MediaPipeHolisticCanvas({
  videoRef,
  isActive,
  label = 'You',
  landmarksRef: externalLandmarksRef,
  isTracking = false,
  gameActive = false,
  gameCue = null,
  countdown = null,
  remoteView = false,
  debugHeadTilt = false,
  nodBorderEnabled = true,
}) {
  const internalTracking = useHolisticFaceLandmarks(videoRef, isActive && !externalLandmarksRef);
  const landmarksRef = externalLandmarksRef ?? internalTracking.landmarksRef;

  const [showLandmarks, setShowLandmarks] = useState(true);
  const leftGradientRef = useRef(null);
  const rightGradientRef = useRef(null);
  const centerGradientRef = useRef(null);
  const nodGradientRef = useRef(null);
  const readyBadgeRef = useRef(null);
  const leftBadgeRef = useRef(null);
  const rightBadgeRef = useRef(null);
  const nodBadgeRef = useRef(null);
  const headTiltDebugRef = useRef(null);
  const baselinePitchRef = useRef(null);
  const baselineSamplesRef = useRef([]);
  const BASELINE_SAMPLE_COUNT = 12;

  useEffect(() => {
    if (!isActive) {
      baselinePitchRef.current = null;
      baselineSamplesRef.current = [];
      if (leftGradientRef.current) leftGradientRef.current.style.opacity = '0';
      if (rightGradientRef.current) rightGradientRef.current.style.opacity = '0';
      if (centerGradientRef.current) centerGradientRef.current.style.opacity = '0';
      if (nodGradientRef.current) nodGradientRef.current.style.opacity = '0';
      if (readyBadgeRef.current) readyBadgeRef.current.style.opacity = '0';
      if (leftBadgeRef.current) leftBadgeRef.current.style.opacity = '0';
      if (rightBadgeRef.current) rightBadgeRef.current.style.opacity = '0';
      if (nodBadgeRef.current) nodBadgeRef.current.style.opacity = '0';
      if (headTiltDebugRef.current) headTiltDebugRef.current.style.opacity = '0';
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
      if (nodGradientRef.current) nodGradientRef.current.style.opacity = '0';
      if (readyBadgeRef.current) readyBadgeRef.current.style.opacity = '0';
      if (leftBadgeRef.current) leftBadgeRef.current.style.opacity = '0';
      if (rightBadgeRef.current) rightBadgeRef.current.style.opacity = '0';
      if (nodBadgeRef.current) nodBadgeRef.current.style.opacity = '0';
    };

    const updateNodVisuals = (landmarks) => {
      if (!nodBorderEnabled || gameActive || remoteView) {
        if (nodGradientRef.current) nodGradientRef.current.style.opacity = '0';
        if (nodBadgeRef.current) nodBadgeRef.current.style.opacity = '0';
        return;
      }

      const pitch = getHeadNodY(landmarks);
      if (pitch == null) {
        if (nodGradientRef.current) nodGradientRef.current.style.opacity = '0';
        if (nodBadgeRef.current) nodBadgeRef.current.style.opacity = '0';
        return;
      }

      if (baselinePitchRef.current == null) {
        baselineSamplesRef.current.push(pitch);
        if (baselineSamplesRef.current.length < BASELINE_SAMPLE_COUNT) {
          if (debugHeadTilt && headTiltDebugRef.current) {
            headTiltDebugRef.current.textContent = `calibrating… ${baselineSamplesRef.current.length}/${BASELINE_SAMPLE_COUNT}`;
            headTiltDebugRef.current.style.opacity = '1';
          }
          return;
        }
        const sum = baselineSamplesRef.current.reduce((a, b) => a + b, 0);
        baselinePitchRef.current = Math.floor(sum / baselineSamplesRef.current.length);
      }

      const baseline = baselinePitchRef.current;
      const nodState = getHeadNodState(landmarks, baseline);
      const delta = getHeadNodDelta(landmarks, baseline);
      if (nodState == null) {
        if (nodGradientRef.current) nodGradientRef.current.style.opacity = '0';
        if (nodBadgeRef.current) nodBadgeRef.current.style.opacity = '0';
        return;
      }

      const nodding = nodState === 'down';

      if (nodGradientRef.current) {
        nodGradientRef.current.style.opacity = nodding ? '1' : '0';
        nodGradientRef.current.classList.toggle('face-direction-gradient--nod-active', nodding);
      }
      if (nodBadgeRef.current) {
        nodBadgeRef.current.style.opacity = nodding ? '1' : '0';
      }

      if (debugHeadTilt) {
        logHeadTilt(landmarks, {
          source: 'test-cam',
          baseline,
          nodding,
        });

        if (headTiltDebugRef.current) {
          headTiltDebugRef.current.textContent = `pitch ${pitch}° · base ${baseline}° · Δ ${delta}° · ${nodState}`;
          headTiltDebugRef.current.style.opacity = '1';
        }
      } else if (headTiltDebugRef.current) {
        headTiltDebugRef.current.style.opacity = '0';
      }
    };

    const updateBorderGradients = () => {
      const landmarks = landmarksRef.current;
      const direction = getFaceDirection(landmarks);

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
        if (nodGradientRef.current) nodGradientRef.current.style.opacity = '0';
        if (nodBadgeRef.current) nodBadgeRef.current.style.opacity = '0';
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

        if (landmarks) {
          updateNodVisuals(landmarks);
        }
      }

      frameId = requestAnimationFrame(updateBorderGradients);
    };

    frameId = requestAnimationFrame(updateBorderGradients);

    return () => cancelAnimationFrame(frameId);
  }, [isActive, landmarksRef, gameActive, gameCue, debugHeadTilt, nodBorderEnabled, remoteView]);

  return (
    <div
      className={`holistic-canvas-container${remoteView ? ' holistic-canvas-container--remote' : ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: '#0d0d0d',
      }}
    >
      {isActive ? (
        <FaceLandmarkViewer
          landmarksRef={landmarksRef}
          visible={showLandmarks}
          isTracking={isTracking}
          remoteView={remoteView}
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
            Turn cam on to explore face landmark geometry in 3D
          </div>
        </div>
      )}

      {isActive && (
        <>
          <div ref={leftGradientRef} className="face-direction-gradient face-direction-gradient--left" />
          <div ref={rightGradientRef} className="face-direction-gradient face-direction-gradient--right" />
          <div ref={centerGradientRef} className="face-direction-gradient face-direction-gradient--center" />
          <div ref={nodGradientRef} className="face-direction-gradient face-direction-gradient--nod" />
          <div ref={readyBadgeRef} className="face-direction-status-badge face-direction-status-badge--ready">
            Centered
          </div>
          <div ref={leftBadgeRef} className="face-direction-status-badge face-direction-status-badge--side">
            Left
          </div>
          <div ref={rightBadgeRef} className="face-direction-status-badge face-direction-status-badge--side">
            Right
          </div>
          <div ref={nodBadgeRef} className="face-direction-status-badge face-direction-status-badge--nod">
            Nod
          </div>
          <div ref={headTiltDebugRef} className="head-tilt-debug-overlay" />

          {countdown != null && (
            <div className="game-countdown-overlay">{countdown}</div>
          )}

          {!isTracking && !gameActive && (
            <div className="face-tracking-hint">
              {remoteView ? "Waiting for opponent camera..." : "Point your face at the camera"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
