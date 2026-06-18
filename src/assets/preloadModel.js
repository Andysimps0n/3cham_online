import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_PATH } from './modelConfig';
import { prepareModelScene } from './prepareModelScene';

let cachedGltf = null;
let preparedModel = null;
let loadPromise = null;
let fullBootPromise = null;
let latestProgress = 0;
let latestPhase = 'downloading';
const progressListeners = new Set();
const phaseListeners = new Set();

function notifyProgress(progress) {
  latestProgress = progress;
  progressListeners.forEach((listener) => listener(progress));
}

function notifyPhase(phase) {
  latestPhase = phase;
  phaseListeners.forEach((listener) => listener(phase));
}

export function subscribeModelPreloadProgress(listener) {
  progressListeners.add(listener);
  listener(latestProgress);
  return () => progressListeners.delete(listener);
}

export function subscribeModelPreloadPhase(listener) {
  phaseListeners.add(listener);
  listener(latestPhase);
  return () => phaseListeners.delete(listener);
}

export function getModelBootPhase() {
  return latestPhase;
}

export function isModelBootReady() {
  return preparedModel !== null;
}

export function startModelDownload() {
  if (cachedGltf) {
    return Promise.resolve(cachedGltf);
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader();

      loader.load(
        MODEL_PATH,
        (gltf) => {
          cachedGltf = gltf;
          notifyProgress(100);
          resolve(gltf);
        },
        (event) => {
          if (event.lengthComputable && event.total > 0) {
            notifyProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
        (error) => {
          loadPromise = null;
          reject(error);
        },
      );
    });
  }

  return loadPromise;
}

export function startFullModelBoot() {
  if (preparedModel) {
    return Promise.resolve(preparedModel);
  }

  if (!fullBootPromise) {
    fullBootPromise = startModelDownload()
      .then((gltf) => new Promise((resolve, reject) => {
        notifyPhase('preparing');

        // Yield so the boot screen can paint before this heavy synchronous work.
        setTimeout(() => {
          try {
            preparedModel = prepareModelScene(gltf.scene);
            notifyPhase('ready');
            resolve(preparedModel);
          } catch (prepareError) {
            reject(prepareError);
          }
        }, 0);
      }))
      .catch((error) => {
        fullBootPromise = null;
        throw error;
      });
  }

  return fullBootPromise;
}

export function getPreparedModel() {
  if (!preparedModel) {
    throw new Error('3D model is not prepared yet');
  }

  return preparedModel;
}

