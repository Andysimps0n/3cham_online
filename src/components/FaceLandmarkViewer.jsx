import React, { useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { mediaPipeToR3F } from '../tracking/mediaPipeCoordinates';

const FACE_LANDMARK_COUNT = 468;
const SPHERE_RADIUS = 0.012;

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3(SPHERE_RADIUS, SPHERE_RADIUS, SPHERE_RADIUS);

function FaceLandmarkPointCloud({ landmarksRef, visible }) {
  const meshRef = useRef();

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < FACE_LANDMARK_COUNT; i++) {
      mesh.setMatrixAt(i, hiddenMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const landmarks = landmarksRef.current;
    const show = visible && landmarks && landmarks.length > 0;

    for (let i = 0; i < FACE_LANDMARK_COUNT; i++) {
      if (!show || !landmarks[i]) {
        tempMatrix.makeScale(0, 0, 0);
      } else {
        const { x, y, z } = mediaPipeToR3F(landmarks[i]);
        tempPosition.set(x, y, z);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      }
      mesh.setMatrixAt(i, tempMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, FACE_LANDMARK_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#ffde4d" roughness={0.35} metalness={0.1} />
    </instancedMesh>
  );
}

function SceneContent({ landmarksRef, visible }) {
  return (
    <>
      <color attach="background" args={['#0d0d0d']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 4]} intensity={1.1} />
      <directionalLight position={[-2, -1, -3]} intensity={0.35} />

      <FaceLandmarkPointCloud landmarksRef={landmarksRef} visible={visible} />

      <gridHelper
        args={[4, 20, '#333333', '#1a1a1a']}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.55, 0]}
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={0.4}
        maxDistance={6}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function FaceLandmarkViewer({ landmarksRef, visible = true }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.2], fov: 50, near: 0.01, far: 100 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ antialias: true }}
    >
      <SceneContent landmarksRef={landmarksRef} visible={visible} />
    </Canvas>
  );
}
