import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mediaPipeToR3F } from '../tracking/mediaPipeCoordinates';

const LANDMARK_COUNT = 21;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const LEFT_HAND_COLOR = 0x66ccff;
const RIGHT_HAND_COLOR = 0xff3366;

// --- Arrow model (disabled) ---
// const LM = {
//   WRIST: 0,
//   INDEX_MCP: 5,
//   MIDDLE_MCP: 9,
//   PINKY_MCP: 17,
// };
// const ROTATION_SENSITIVITY = 3;
// const ARROW_LENGTH = 0.35;
// const ARROW_COLOR = 0xff3366;
// const tempRight = new THREE.Vector3();
// const tempUp = new THREE.Vector3();
// const tempForward = new THREE.Vector3();
// const tempOrigin = new THREE.Vector3();
// const tempWrist = new THREE.Vector3();
// const tempIndexMcp = new THREE.Vector3();
// const tempMiddleMcp = new THREE.Vector3();
// const tempPinkyMcp = new THREE.Vector3();
// const tempRotationMatrix = new THREE.Matrix4();

function hasHandLandmarks(landmarks) {
  return landmarks?.length >= LANDMARK_COUNT && landmarks[0];
}

function HandWireframe({ landmarksRef, visible, color }) {
  const lineRef = useRef();

  const lineObject = useMemo(() => {
    const positions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, toneMapped: false })
    );
  }, [color]);

  useFrame(() => {
    const line = lineRef.current;
    if (!line) return;

    const landmarks = landmarksRef.current;
    const show = visible && hasHandLandmarks(landmarks);

    line.visible = show;
    if (!show) return;

    const positions = line.geometry.attributes.position.array;
    let i = 0;

    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const start = mediaPipeToR3F(landmarks[startIndex]);
      const end = mediaPipeToR3F(landmarks[endIndex]);

      positions[i++] = start.x;
      positions[i++] = start.y;
      positions[i++] = start.z;
      positions[i++] = end.x;
      positions[i++] = end.y;
      positions[i++] = end.z;
    }

    line.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive ref={lineRef} object={lineObject} />;
}

// function HandDirectionArrow({ leftHandLandmarksRef, rightHandLandmarksRef, visible }) {
//   const groupRef = useRef();
//
//   const arrowObject = useMemo(
//     () => new THREE.ArrowHelper(
//       new THREE.Vector3(0, 0, 1),
//       new THREE.Vector3(0, 0, 0),
//       ARROW_LENGTH,
//       ARROW_COLOR,
//       0.1,
//       0.05
//     ),
//     []
//   );
//
//   useFrame(() => {
//     const group = groupRef.current;
//     if (!group) return;
//
//     const landmarks = pickActiveHandLandmarks(leftHandLandmarksRef, rightHandLandmarksRef);
//     const show = visible && landmarks;
//
//     group.visible = show;
//     if (!show) return;
//
//     computeHandOrientation(landmarks);
//     tempRotationMatrix.makeBasis(tempRight, tempUp, tempForward);
//     group.quaternion.setFromRotationMatrix(tempRotationMatrix);
//     group.position.copy(tempOrigin);
//   });
//
//   return (
//     <group ref={groupRef}>
//       <primitive object={arrowObject} />
//     </group>
//   );
// }

function SceneContent({ leftHandLandmarksRef, rightHandLandmarksRef, visible }) {
  return (
    <>
      <color attach="background" args={['#0d0d0d']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 4]} intensity={1.1} />
      <directionalLight position={[-2, -1, -3]} intensity={0.35} />

      <HandWireframe
        landmarksRef={leftHandLandmarksRef}
        visible={visible}
        color={LEFT_HAND_COLOR}
      />
      <HandWireframe
        landmarksRef={rightHandLandmarksRef}
        visible={visible}
        color={RIGHT_HAND_COLOR}
      />

      {/* <HandDirectionArrow
        leftHandLandmarksRef={leftHandLandmarksRef}
        rightHandLandmarksRef={rightHandLandmarksRef}
        visible={visible}
      /> */}

      <gridHelper
        args={[4, 20, '#333333', '#1a1a1a']}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.55, 0]}
      />
    </>
  );
}

export default function HandLandmarkViewer({
  leftHandLandmarksRef,
  rightHandLandmarksRef,
  visible = true,
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 1.5], fov: 50, near: 0.01, far: 100 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ antialias: true }}
    >
      <SceneContent
        leftHandLandmarksRef={leftHandLandmarksRef}
        rightHandLandmarksRef={rightHandLandmarksRef}
        visible={visible}
      />
    </Canvas>
  );
}
