import React, { Component, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getPreparedModel } from '../assets/preloadModel';
import { useModelPreload } from '../hooks/useModelPreload';
import { mediaPipeToR3F } from '../tracking/mediaPipeCoordinates';

const LM = {
  FOREHEAD: 10,
  LEFT_EYE: 33,
  RIGHT_EYE: 263,
  CHIN: 152,
};

const ROTATION_SENSITIVITY = 3;
const ARROW_LENGTH = 0.35;
const ARROW_COLOR = 0xff3366;

const tempRight = new THREE.Vector3();
const tempUp = new THREE.Vector3();
const tempForward = new THREE.Vector3();
const tempOrigin = new THREE.Vector3();
const tempAmplified = new THREE.Vector3();
const tempLeft = new THREE.Vector3();
const tempRightEye = new THREE.Vector3();
const tempChin = new THREE.Vector3();
const tempRotationMatrix = new THREE.Matrix4();

function landmarkToVector3(landmark, target = new THREE.Vector3()) {
  const { x, y, z } = mediaPipeToR3F(landmark);
  return target.set(x, y, z);
}

function amplifyAroundPivot(point, pivot, sensitivity, target) {
  return target.copy(point).sub(pivot).multiplyScalar(sensitivity).add(pivot);
}

function computeFaceOrientation(landmarks) {
  const leftEye = landmarkToVector3(landmarks[LM.LEFT_EYE], tempLeft);
  const rightEye = landmarkToVector3(landmarks[LM.RIGHT_EYE], tempRightEye);
  const forehead = landmarkToVector3(landmarks[LM.FOREHEAD], tempAmplified);
  const chin = landmarkToVector3(landmarks[LM.CHIN], tempChin);

  tempOrigin.addVectors(leftEye, rightEye).multiplyScalar(0.5);

  const ampLeft = amplifyAroundPivot(leftEye, tempOrigin, ROTATION_SENSITIVITY, new THREE.Vector3());
  const ampRight = amplifyAroundPivot(rightEye, tempOrigin, ROTATION_SENSITIVITY, new THREE.Vector3());
  const ampForehead = amplifyAroundPivot(forehead, tempOrigin, ROTATION_SENSITIVITY, new THREE.Vector3());
  const ampChin = amplifyAroundPivot(chin, tempOrigin, ROTATION_SENSITIVITY, new THREE.Vector3());

  tempRight.subVectors(ampRight, ampLeft).normalize();
  tempUp.subVectors(ampForehead, ampChin).normalize();
  tempForward.crossVectors(tempRight, tempUp).normalize().negate();

  return true;
}

function hasRequiredLandmarks(landmarks) {
  return landmarks?.length > 0
    && landmarks[LM.LEFT_EYE]
    && landmarks[LM.RIGHT_EYE]
    && landmarks[LM.FOREHEAD]
    && landmarks[LM.CHIN];
}

const PHASE_LABELS = {
  downloading: 'Downloading 3D assets...',
  preparing: 'Preparing model for rendering...',
  ready: 'Ready',
};

function ModelLoadOverlay({ progress, phase, error }) {
  if (error) {
    return (
      <Html center>
        <div className="model-load-overlay model-load-overlay--error">
          <div className="model-load-overlay__title">Model failed to load</div>
          <div className="model-load-overlay__hint">Check your network and refresh the page.</div>
        </div>
      </Html>
    );
  }

  const isPreparing = phase === 'preparing';
  const phaseLabel = PHASE_LABELS[phase] ?? PHASE_LABELS.downloading;

  return (
    <Html center>
      <div className="model-load-overlay">
        <div className="model-load-overlay__title">{phaseLabel}</div>
        <div className="model-load-overlay__bar">
          <div
            className={`model-load-overlay__fill${isPreparing ? ' model-load-overlay__fill--indeterminate' : ''}`}
            style={isPreparing ? undefined : { width: `${Math.round(progress)}%` }}
          />
        </div>
        <div className="model-load-overlay__percent">
          {isPreparing ? 'Almost there...' : `${Math.round(progress)}%`}
        </div>
      </div>
    </Html>
  );
}

function TrackingWarmupOverlay() {
  return (
    <Html center>
      <div className="model-load-overlay">
        <div className="model-load-overlay__title">Warming up face tracking...</div>
        <div className="model-load-overlay__hint">Point your face at the camera</div>
      </div>
    </Html>
  );
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Failed to load 3D model:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="model-load-overlay model-load-overlay--error">
            <div className="model-load-overlay__title">Model failed to load</div>
            <div className="model-load-overlay__hint">Check your network and refresh the page.</div>
          </div>
        </Html>
      );
    }

    return this.props.children;
  }
}

function ObjModel() {
  const { prepared, boxHelper } = getPreparedModel();

  return (
    <Center>
      <group>
        <primitive object={prepared} />
        {boxHelper && <primitive object={boxHelper} />}
      </group>
    </Center>
  );
}

// Rotates the model based on the face orientation
function FaceOrientedModel({ landmarksRef, visible, children }) {
  const groupRef = useRef();

  useFrame(() => {
    const group = groupRef.current;

    if (!group) return;
    group.visible = visible;

    if (!visible) return;

    const landmarks = landmarksRef.current;
    if (!hasRequiredLandmarks(landmarks)) return;

    computeFaceOrientation(landmarks);
    tempRotationMatrix.makeBasis(tempUp, tempRight, tempForward);
    group.quaternion.setFromRotationMatrix(tempRotationMatrix);
  });

  return <group ref={groupRef}>{children}</group>;
}

function SceneContent({
  landmarksRef,
  visible,
  modelStatus,
  modelProgress,
  modelPhase,
  modelError,
  isTracking,
}) {
  const modelReady = modelStatus === 'ready';
  const showModel = modelReady && isTracking;

  return (
    <>
      <color attach="background" args={['#0d0d0d']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 4]} intensity={1.1} />
      <directionalLight position={[-2, -1, -3]} intensity={0.35} />

      {!modelReady && (
        <ModelLoadOverlay progress={modelProgress} phase={modelPhase} error={modelError} />
      )}

      {modelReady && !isTracking && <TrackingWarmupOverlay />}

      <FaceOrientedModel landmarksRef={landmarksRef} visible={visible}>
        {showModel && (
          <ModelErrorBoundary>
            <ObjModel />
          </ModelErrorBoundary>
        )}
      </FaceOrientedModel>
    </>
  );
}

export default function FaceLandmarkViewer({ landmarksRef, visible = true, isTracking = false }) {
  const { progress, phase, status, error } = useModelPreload();

  return (
    <Canvas
      camera={{ position: [0, 0, 1.5], fov: 50, near: 0.01, far: 100 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ antialias: true }}
    >
      <SceneContent
        landmarksRef={landmarksRef}
        visible={visible}
        modelStatus={status}
        modelProgress={progress}
        modelPhase={phase}
        modelError={error}
        isTracking={isTracking}
      />
    </Canvas>
  );
}
