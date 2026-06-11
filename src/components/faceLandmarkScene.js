import * as THREE from 'three';

const FACE_LANDMARK_COUNT = 468;
const SPHERE_RADIUS = 2.2;

export function createFaceLandmarkScene(mountEl) {
  const scene = new THREE.Scene();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  camera.position.z = 500;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  mountEl.appendChild(renderer.domElement);

  const landmarkGroup = new THREE.Group();
  scene.add(landmarkGroup);

  const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 8, 8);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffde4d,
    transparent: true,
    opacity: 0.92,
  });

  const spheres = [];
  for (let i = 0; i < FACE_LANDMARK_COUNT; i++) {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial.clone());
    sphere.visible = false;
    landmarkGroup.add(sphere);
    spheres.push(sphere);
  }

  const depthScale = 120;

  function resize(width, height) {
    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  }

  function updateLandmarks(landmarks, coverRect, visible) {
    if (!visible || !landmarks || landmarks.length === 0) {
      for (const sphere of spheres) {
        sphere.visible = false;
      }
      return;
    }

    const { offsetX, offsetY, drawW, drawH } = coverRect;

    for (let i = 0; i < spheres.length; i++) {
      const sphere = spheres[i];
      const landmark = landmarks[i];

      if (!landmark) {
        sphere.visible = false;
        continue;
      }

      const screenX = landmark.x * drawW + offsetX;
      const screenY = landmark.y * drawH + offsetY;

      sphere.position.set(
        screenX - coverRect.containerW / 2,
        -(screenY - coverRect.containerH / 2),
        -(landmark.z || 0) * depthScale
      );
      sphere.visible = true;
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  function dispose() {
    sphereGeometry.dispose();
    for (const sphere of spheres) {
      sphere.material.dispose();
    }
    renderer.dispose();
    if (renderer.domElement.parentNode === mountEl) {
      mountEl.removeChild(renderer.domElement);
    }
  }

  return {
    resize,
    updateLandmarks,
    render,
    dispose,
  };
}
