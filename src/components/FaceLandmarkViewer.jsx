import React, { Component, Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, Html, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { mediaPipeToR3F } from '../tracking/mediaPipeCoordinates';

const MODEL_PATH = '/models/model2.glb';

useGLTF.preload(MODEL_PATH);

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

function ModelLoadProgress() {
  const { progress, active } = useProgress();

  if (!active) return null;

  return (
    <Html center>
      <div className="model-load-overlay">
        <div className="model-load-overlay__title">Loading 3D model</div>
        <div className="model-load-overlay__bar">
          <div
            className="model-load-overlay__fill"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <div className="model-load-overlay__percent">{Math.round(progress)}%</div>
        <div className="model-load-overlay__hint">First load can take a moment</div>
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
  const { scene } = useGLTF(MODEL_PATH);

  const { prepared, boxHelper } = useMemo(() => {
    const clone = scene.clone();

    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#d4d4d4',
          roughness: 0.45,
          metalness: 0.15,
        });
      }
    });
    clone.rotation.z = -Math.PI / 2;

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) {
      console.warn('Model bounding box is invalid; skipping wireframe helper');
      return { prepared: clone, boxHelper: null };
    }

    const scale = 0.8 / maxDim;
    clone.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(clone);
    const boxSize = scaledBox.getSize(new THREE.Vector3());
    const boxCenter = scaledBox.getCenter(new THREE.Vector3());

    const geometry = new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const line = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({ color: 'red' })
    );

    line.position.copy(boxCenter);

    return {
      prepared: clone,
      boxHelper: line,
    };
  }, [scene]);

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
// This does not puts the model on the scene
function FaceOrientedModel({ landmarksRef, visible, children }) {
  const groupRef = useRef();

  useFrame(() => {
    const group = groupRef.current

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

function SceneContent({ landmarksRef, visible }) {
  return (
    <>
      <color attach="background" args={['#0d0d0d']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 4]} intensity={1.1} />
      <directionalLight position={[-2, -1, -3]} intensity={0.35} />

      <ModelLoadProgress />


      <ModelErrorBoundary>
        <Suspense fallback={null}>
          <FaceOrientedModel landmarksRef={landmarksRef} visible={visible}>
            <ObjModel />
          </FaceOrientedModel>
        </Suspense>
      </ModelErrorBoundary>
    </>
  );
}

export default function FaceLandmarkViewer({ landmarksRef, visible = true }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 1.5], fov: 50, near: 0.01, far: 100 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ antialias: true }}
    >
      <SceneContent landmarksRef={landmarksRef} visible={visible} />
    </Canvas>
  );
}
