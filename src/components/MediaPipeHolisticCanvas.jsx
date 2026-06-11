import React, { useEffect, useRef, useState } from 'react';
import { Holistic } from '@mediapipe/holistic';
import { createFaceLandmarkScene } from './faceLandmarkScene';

function getCoverRect(srcW, srcH, dstW, dstH) {
  if (!srcW || !srcH || !dstW || !dstH) {
    return { offsetX: 0, offsetY: 0, drawW: dstW, drawH: dstH, containerW: dstW, containerH: dstH };
  }

  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;

  if (srcRatio > dstRatio) {
    const drawH = dstH;
    const drawW = srcW * (dstH / srcH);
    return { offsetX: (dstW - drawW) / 2, offsetY: 0, drawW, drawH, containerW: dstW, containerH: dstH };
  }

  const drawW = dstW;
  const drawH = srcH * (dstW / srcW);
  return { offsetX: 0, offsetY: (dstH - drawH) / 2, drawW, drawH, containerW: dstW, containerH: dstH };
}

function drawVideoFrame(ctx, image, coverRect, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, width, height);

  if (image) {
    const { offsetX, offsetY, drawW, drawH } = coverRect;
    ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
  }
}

export default function MediaPipeHolisticCanvas({
  videoRef,
  isActive,
  label = 'You',
  filterName = 'none',
}) {
  const containerRef = useRef(null);
  const videoCanvasRef = useRef(null);
  const threeMountRef = useRef(null);
  const holisticRef = useRef(null);
  const faceSceneRef = useRef(null);
  const showFaceLandmarksRef = useRef(true);
  const [fps, setFps] = useState(0);
  const [showFaceLandmarks, setShowFaceLandmarks] = useState(true);

  useEffect(() => {
    showFaceLandmarksRef.current = showFaceLandmarks;
  }, [showFaceLandmarks]);

  useEffect(() => {
    const syncLayout = () => {
      const container = containerRef.current;
      const videoCanvas = videoCanvasRef.current;
      const faceScene = faceSceneRef.current;
      if (!container || !videoCanvas) return;

      const displayW = container.clientWidth;
      const displayH = container.clientHeight;
      if (!displayW || !displayH) return;

      const dpr = window.devicePixelRatio || 1;
      videoCanvas.width = Math.round(displayW * dpr);
      videoCanvas.height = Math.round(displayH * dpr);
      videoCanvas.style.width = `${displayW}px`;
      videoCanvas.style.height = `${displayH}px`;

      const ctx = videoCanvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      faceScene?.resize(displayW, displayH);
    };

    syncLayout();

    const observer = new ResizeObserver(syncLayout);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', syncLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncLayout);
    };
  }, [isActive]);

  useEffect(() => {
    if (!threeMountRef.current) return;

    const faceScene = createFaceLandmarkScene(threeMountRef.current);
    faceSceneRef.current = faceScene;

    const container = containerRef.current;
    if (container) {
      faceScene.resize(container.clientWidth, container.clientHeight);
    }

    return () => {
      faceScene.dispose();
      faceSceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isActive || !videoRef?.current) return;

    let cancelled = false;
    let rafId = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const videoCanvas = videoCanvasRef.current;
    const ctx = videoCanvas?.getContext('2d');
    if (!videoCanvas || !ctx) return;

    const drawPlaceholder = () => {
      const w = containerRef.current?.clientWidth || videoCanvas.width;
      const h = containerRef.current?.clientHeight || videoCanvas.height;

      ctx.fillStyle = '#E6F8FF';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText('INITIALIZING HOLISTIC TRACKER...', 20, h / 2);

      faceSceneRef.current?.updateLandmarks(null, { containerW: w, containerH: h }, false);
      faceSceneRef.current?.render();
    };

    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });
    holisticRef.current = holistic;

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults((results) => {
      if (cancelled) return;

      const w = containerRef.current?.clientWidth || videoCanvas.width;
      const h = containerRef.current?.clientHeight || videoCanvas.height;
      const image = results.image;
      const srcW = image?.width || videoRef.current?.videoWidth || w;
      const srcH = image?.height || videoRef.current?.videoHeight || h;
      const coverRect = getCoverRect(srcW, srcH, w, h);

      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      drawVideoFrame(ctx, image, coverRect, w, h);

      faceSceneRef.current?.updateLandmarks(
        results.faceLandmarks,
        coverRect,
        showFaceLandmarksRef.current
      );
      faceSceneRef.current?.render();
    });

    const processFrame = async () => {
      if (cancelled) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        drawPlaceholder();
        rafId = requestAnimationFrame(processFrame);
        return;
      }

      try {
        await holistic.send({ image: video });
      } catch (err) {
        console.warn('MediaPipe Holistic frame error:', err);
      }

      rafId = requestAnimationFrame(processFrame);
    };

    drawPlaceholder();
    processFrame();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      holistic.close();
      holisticRef.current = null;
    };
  }, [isActive, videoRef]);

  useEffect(() => {
    if (isActive) return;

    const videoCanvas = videoCanvasRef.current;
    const ctx = videoCanvas?.getContext('2d');
    const container = containerRef.current;
    if (!videoCanvas || !ctx || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    ctx.fillStyle = '#FFDE4D';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px "Space Grotesk", sans-serif';
    ctx.fillText(label.toUpperCase(), 20, h / 2 - 10);
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('TURN CAM ON FOR FACE LANDMARK TRACKING', 20, h / 2 + 16);

    faceSceneRef.current?.updateLandmarks(null, { containerW: w, containerH: h }, false);
    faceSceneRef.current?.render();
    setFps(0);
  }, [isActive, label]);

  return (
    <div
      className="holistic-canvas-container"
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: isActive ? 'scaleX(-1)' : 'none',
          transformOrigin: 'center',
        }}
      >
        <canvas
          ref={videoCanvasRef}
          className={`effect-${filterName}`}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        />

        <div
          ref={threeMountRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          zIndex: 40,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="neo-btn neo-btn-xs"
          style={{
            fontSize: '9px',
            padding: '2px 6px',
            backgroundColor: showFaceLandmarks ? 'var(--color-yellow)' : '#f3f4f6',
            color: '#000',
            boxShadow: '1px 1px 0px #000',
            border: '1.5px solid #000',
          }}
          onClick={() => setShowFaceLandmarks((v) => !v)}
        >
          {showFaceLandmarks ? 'FACE LANDMARKS ON' : 'FACE LANDMARKS OFF'}
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: isActive ? 'var(--color-green)' : 'var(--color-cyan)',
          border: '1.5px solid #000',
          boxShadow: '2px 2px 0px #000',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          fontWeight: '700',
          padding: '2px 8px',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 40,
        }}
      >
        <div
          className="status-dot-blink"
          style={{ width: '6px', height: '6px', backgroundColor: '#000', borderRadius: '50%' }}
        />
        <span>{isActive ? `${fps} FPS` : 'STANDBY'}</span>
      </div>
    </div>
  );
}
