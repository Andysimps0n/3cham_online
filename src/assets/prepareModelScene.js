import * as THREE from 'three';

export function prepareModelScene(scene) {
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
    new THREE.LineBasicMaterial({ color: 'red' }),
  );

  line.position.copy(boxCenter);

  return {
    prepared: clone,
    boxHelper: line,
  };
}
