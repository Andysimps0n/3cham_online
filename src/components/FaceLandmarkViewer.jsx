import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { mediaPipeToR3F } from '../tracking/mediaPipeCoordinates';

const MODEL_PATH = '/models/model.obj';

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

function ObjModel() {
  const obj = useLoader(OBJLoader, MODEL_PATH);

  const { prepared, boxHelper } = useMemo(() => {
    const clone = obj.clone();

    // material setup
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#d4d4d4',
          roughness: 0.45,
          metalness: 0.15,
        });
      }
      clone.rotation.z = -Math.PI / 2;
    });

    // bounding box
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.8 / maxDim;
    clone.scale.setScalar(scale);

    // IMPORTANT: recompute after scaling
    const scaledBox = new THREE.Box3().setFromObject(clone);

    const boxSize = scaledBox.getSize(new THREE.Vector3());
    const boxCenter = scaledBox.getCenter(new THREE.Vector3());

    // create visible box geometry
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
  }, [obj]);

return (
  <Center>
    <group>
      {/* your model */}
      <primitive object={prepared} />

      {/* invisible box (now visible) */}
      <primitive object={boxHelper} />
    </group>
  </Center>
);
}

function FaceDirectionArrow({ landmarksRef, visible }) {
  const arrowRef = useRef();

  const arrowObject = useMemo(
    () => new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      ARROW_LENGTH,
      ARROW_COLOR,
      0.1,
      0.05
    ),
    []
  );

  useFrame(() => {
    const arrow = arrowRef.current;
    if (!arrow) return;

    const landmarks = landmarksRef.current;
    const show = visible && hasRequiredLandmarks(landmarks);

    arrow.visible = show;
    if (!show) return;

    computeFaceOrientation(landmarks);

    // Base at eye midpoint; tip points along MediaPipe-derived forward
    arrow.position.copy(tempOrigin);
    arrow.setDirection(tempForward);
    arrow.setLength(ARROW_LENGTH, 0.1, 0.05);
  });

  return <primitive ref={arrowRef} object={arrowObject} />;
}

function FaceOrientedModel({ landmarksRef, visible, children }) {
  const groupRef = useRef();

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const landmarks = landmarksRef.current;
    const show = visible && hasRequiredLandmarks(landmarks);

    group.visible = show;
    if (!show) return;

    computeFaceOrientation(landmarks);
    // tempRotationMatrix.makeBasis(tempRight, tempUp, tempForward);
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

      <FaceDirectionArrow landmarksRef={landmarksRef} visible={visible} />

      <Suspense fallback={null}>
        <FaceOrientedModel landmarksRef={landmarksRef} visible={visible}>
          <ObjModel />
        </FaceOrientedModel>
      </Suspense>

      <gridHelper
        args={[4, 20, '#333333', '#1a1a1a']}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.55, 0]}
      />
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
