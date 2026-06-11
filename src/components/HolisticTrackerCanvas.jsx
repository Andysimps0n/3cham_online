import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Activity, ShieldAlert } from 'lucide-react';

export default function HolisticTrackerCanvas({ 
  videoRef, 
  isLive, 
  label, 
  avatarColor = "var(--color-cyan)", 
  personaName = "System", 
  interests = [], 
  isTyping = false,
  filterName = "none"
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [fps, setFps] = useState(60);
  const [inferenceTime, setInferenceTime] = useState(1.8);
  const [gesture, setGesture] = useState("PEACE SIGN");
  const [handCount, setHandCount] = useState(2);
  const [showFacePolygons, setShowFacePolygons] = useState(true);
  const [showHandPolygons, setShowHandPolygons] = useState(true);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [hovered, setHovered] = useState(false);

  // Monitor canvas size dynamically to fit the parent container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight || 320;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Periodically enforce size to prevent shifting layout glitches
    const checkTimer = setInterval(handleResize, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(checkTimer);
    };
  }, []);

  // Set up mouse interaction inside canvas
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => {
    setHovered(false);
    setMousePos({ x: -1000, y: -1000 });
  };

  useEffect(() => {
    let animationId;
    let lastTime = performance.now();
    let frameCount = 0;
    let tickCount = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // 1. Calculate FPS and inference parameters
      const now = performance.now();
      frameCount++;
      tickCount++;
      if (now > lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }

      // Update inference times slightly to simulate real hardware activity
      if (tickCount % 30 === 0) {
        setInferenceTime((1.4 + Math.random() * 0.9).toFixed(1));
        const gestures = ["OPEN PALM", "VICTORY", "OK SIGN", "FIST", "THUMBS UP", "POINTING"];
        setGesture(gestures[Math.floor(Math.random() * gestures.length)]);
        setHandCount(Math.random() > 0.15 ? 2 : 1);
      }

      // 2. Draw base video frame or fallback background pattern
      ctx.clearRect(0, 0, w, h);

      if (isLive && videoRef && videoRef.current) {
        try {
          // Render raw camera feed on background of the canvas
          ctx.drawImage(videoRef.current, 0, 0, w, h);
          
          // Draw translucent scanlines or pixelization over the feed for retro vibe
          ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
          for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 1);
          }
        } catch (e) {
          // If video isn't ready or failing, fall back to solid layout
          drawPlaceholderBg(ctx, w, h);
        }
      } else {
        drawPlaceholderBg(ctx, w, h);
      }

      // 3. Draw a tech grid tracker overlay
      ctx.strokeStyle = "rgba(0,0,0,0.07)";
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 4. Generate holistic coordinates
      const t = now * 0.0015; // smooth speed modifier
      
      // Face Mesh Center Coordinates
      const faceX = w / 2 + Math.sin(t * 0.8) * 15;
      const faceY = h / 2.7 + Math.cos(t * 0.5) * 10;
      const faceRadiusX = Math.min(w, h) * 0.16;
      const faceRadiusY = Math.min(w, h) * 0.22;

      // Draw Pose Shoulders
      const leftShoulderX = faceX + faceRadiusX * 1.5;
      const leftShoulderY = faceY + faceRadiusY * 1.3;
      const rightShoulderX = faceX - faceRadiusX * 1.5;
      const rightShoulderY = faceY + faceRadiusY * 1.3;

      ctx.strokeStyle = "#FF8A3D"; // Brutalist Orange
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftShoulderX, leftShoulderY);
      ctx.lineTo(rightShoulderX, rightShoulderY);
      ctx.stroke();

      // Neck joint
      ctx.beginPath();
      ctx.moveTo(faceX, faceY + faceRadiusY * 0.9);
      ctx.lineTo(faceX, faceY + faceRadiusY * 1.3);
      ctx.stroke();

      // 5. DRAW FACE MESH TRIANGLES & POLYGONS
      const facePoints = [];
      const numFacePoints = 16;
      for (let i = 0; i < numFacePoints; i++) {
        const angle = (i / numFacePoints) * Math.PI * 2;
        // Make individual facial features fluctuate
        const noiseScalar = 0.95 + Math.sin(t * 3 + i) * 0.05;
        const px = faceX + Math.cos(angle) * faceRadiusX * noiseScalar;
        const py = faceY + Math.sin(angle) * faceRadiusY * noiseScalar;
        facePoints.push({ x: px, y: py });
      }

      // Internal Facial Features
      const leftEye = { x: faceX - faceRadiusX * 0.35 + Math.sin(t * 2) * 2, y: faceY - faceRadiusY * 0.2 + Math.cos(t * 2) * 2 };
      const rightEye = { x: faceX + faceRadiusX * 0.35 + Math.cos(t * 2) * 2, y: faceY - faceRadiusY * 0.2 + Math.sin(t * 2) * 2 };
      const noseTip = { x: faceX + Math.sin(t * 1.2) * 1.5, y: faceY + faceRadiusY * 0.15 };
      const mouthLeft = { x: faceX - faceRadiusX * 0.3, y: faceY + faceRadiusY * 0.4 + Math.sin(t * 4) * 1 };
      const mouthRight = { x: faceX + faceRadiusX * 0.3, y: faceY + faceRadiusY * 0.4 + Math.sin(t * 4) * 1 };
      const mouthCenter = { x: faceX, y: faceY + faceRadiusY * 0.48 + Math.abs(Math.sin(t * 3)) * 4 };

      // Drawing Face boundary polygon with fill shading
      if (showFacePolygons) {
        ctx.fillStyle = "rgba(255, 219, 21, 0.12)"; // Amber-yellow translucent
        ctx.beginPath();
        ctx.moveTo(facePoints[0].x, facePoints[0].y);
        for (let i = 1; i < facePoints.length; i++) {
          ctx.lineTo(facePoints[i].x, facePoints[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Draw left eye polygon (cheek area mapping)
        ctx.fillStyle = "rgba(63, 205, 255, 0.14)"; // Neon Cyan shade
        ctx.beginPath();
        ctx.moveTo(facePoints[14].x, facePoints[14].y);
        ctx.lineTo(leftEye.x, leftEye.y);
        ctx.lineTo(noseTip.x, noseTip.y);
        ctx.lineTo(facePoints[12].x, facePoints[12].y);
        ctx.closePath();
        ctx.fill();

        // Draw right eye polygon
        ctx.beginPath();
        ctx.moveTo(facePoints[2].x, facePoints[2].y);
        ctx.lineTo(rightEye.x, rightEye.y);
        ctx.lineTo(noseTip.x, noseTip.y);
        ctx.lineTo(facePoints[4].x, facePoints[4].y);
        ctx.closePath();
        ctx.fill();

        // Draw mouth zone polygon
        ctx.fillStyle = "rgba(255, 102, 170, 0.18)"; // Hot Pink mouth polygon
        ctx.beginPath();
        ctx.moveTo(mouthLeft.x, mouthLeft.y);
        ctx.lineTo(noseTip.x, noseTip.y);
        ctx.lineTo(mouthRight.x, mouthRight.y);
        ctx.lineTo(mouthCenter.x, mouthCenter.y);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Face mesh lines (The wireframe polygons)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = 1;
      
      // Face outer outline
      ctx.beginPath();
      ctx.moveTo(facePoints[0].x, facePoints[0].y);
      for (let i = 1; i < facePoints.length; i++) {
        ctx.lineTo(facePoints[i].x, facePoints[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // Facial wireframe connections to features (triangulation polygons)
      ctx.beginPath();
      for (let i = 0; i < facePoints.length; i += 2) {
        ctx.moveTo(facePoints[i].x, facePoints[i].y);
        ctx.lineTo(noseTip.x, noseTip.y);
        
        ctx.moveTo(facePoints[i].x, facePoints[i].y);
        if (i < facePoints.length / 2) {
          ctx.lineTo(rightEye.x, rightEye.y);
        } else {
          ctx.lineTo(leftEye.x, leftEye.y);
        }
      }
      ctx.stroke();

      // Draw eyes + nose + mouth markers
      ctx.fillStyle = "var(--color-yellow)";
      ctx.strokeStyle = "var(--color-dark)";
      ctx.lineWidth = 1.5;
      
      [leftEye, rightEye, noseTip, mouthLeft, mouthRight, mouthCenter].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // 6. DRAW REALISTIC HANDS & CLOSED HAND POLYGONS
      // Left Hand Generation (oscillates naturally on LHS)
      const leftHandAnchorX = leftShoulderX + Math.sin(t * 1.5 + 2) * 20;
      const leftHandAnchorY = h - 60 + Math.cos(t * 1.2) * 15;

      // Right Hand Generation (moves towards cursor if hovered on local)
      let rightHandAnchorX = rightShoulderX + Math.cos(t * 1.5) * 20;
      let rightHandAnchorY = h - 60 + Math.sin(t * 1.2) * 15;
      
      if (hovered && mousePos.x !== -1000) {
        // Interpolate right hand towards mouse coordinates for cool physical interaction!
        rightHandAnchorX = rightHandAnchorX * 0.3 + mousePos.x * 0.7;
        rightHandAnchorY = rightHandAnchorY * 0.3 + mousePos.y * 0.7;
      }

      // Compile hands arrays to draw
      const drawHand = (anchorX, anchorY, isLeft) => {
        const scale = Math.min(w, h) * 0.22;
        const pts = [];
        
        // Palm Base (Landmark 0)
        pts.push({ x: anchorX, y: anchorY });

        // Generate 5 fingers with 4 joints each (standard MediaPipe hand structure of 21 points total)
        // Angle offsets for fingers
        const fingerAngles = isLeft 
          ? [Math.PI * 0.9, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.3, Math.PI * 0.1] 
          : [Math.PI * 0.1, Math.PI * 0.3, Math.PI * 0.5, Math.PI * 0.7, Math.PI * 0.9];
          
        const fingerLengths = [0.45, 0.65, 0.7, 0.62, 0.5]; // length multipliers

        fingerAngles.forEach((baseAngle, fIdx) => {
          const lMult = fingerLengths[fIdx];
          
          // Joint 1: base of finger
          const f0_x = anchorX + Math.cos(baseAngle) * scale * 0.35;
          const f0_y = anchorY - Math.sin(baseAngle) * scale * 0.35;
          pts.push({ x: f0_x, y: f0_y });

          // Joint 2
          const f1_x = f0_x + Math.cos(baseAngle + Math.sin(t * 4 + fIdx) * 0.08) * scale * lMult * 0.3;
          const f1_y = f0_y - Math.sin(baseAngle + Math.sin(t * 4 + fIdx) * 0.08) * scale * lMult * 0.3;
          pts.push({ x: f1_x, y: f1_y });

          // Joint 3
          const f2_x = f1_x + Math.cos(baseAngle + Math.sin(t * 4.5 + fIdx) * 0.12) * scale * lMult * 0.25;
          const f2_y = f1_y - Math.sin(baseAngle + Math.sin(t * 4.5 + fIdx) * 0.12) * scale * lMult * 0.25;
          pts.push({ x: f2_x, y: f2_y });

          // Finger Tip (Joint 4)
          const f3_x = f2_x + Math.cos(baseAngle + Math.sin(t * 5 + fIdx) * 0.15) * scale * lMult * 0.2;
          const f3_y = f2_y - Math.sin(baseAngle + Math.sin(t * 5 + fIdx) * 0.15) * scale * lMult * 0.2;
          pts.push({ x: f3_x, y: f3_y });
        });

        // DRAW HAND GEOMETRY POLYGON
        if (showHandPolygons && pts.length >= 21) {
          // Convex polygon linking the outside edges: Tip of thumb, Tip of Index, Tip of Middle, Tip of Ring, Tip of Pinky, Wrist
          const outerPolygonPoints = [
            pts[0],  // wrist Center
            pts[4],  // Thumb Tip
            pts[8],  // Index Tip
            pts[12], // Middle Tip
            pts[16], // Ring Tip
            pts[20], // Pinky Tip
          ];

          ctx.fillStyle = isLeft ? "rgba(63, 205, 255, 0.2)" : "rgba(255, 102, 170, 0.22)"; // Cyan & pink polygons
          ctx.beginPath();
          ctx.moveTo(outerPolygonPoints[0].x, outerPolygonPoints[0].y);
          for (let i = 1; i < outerPolygonPoints.length; i++) {
            ctx.lineTo(outerPolygonPoints[i].x, outerPolygonPoints[i].y);
          }
          ctx.closePath();
          ctx.fill();

          // Palm Polygon (Wrist to finger bases)
          const palmPoints = [
            pts[0],  // wrist
            pts[1],  // thumb base
            pts[5],  // index base
            pts[9],  // middle base
            pts[13], // ring base
            pts[17]  // pinky base
          ];
          ctx.fillStyle = "rgba(60, 224, 132, 0.15)"; // Green translucent palm
          ctx.beginPath();
          ctx.moveTo(palmPoints[0].x, palmPoints[0].y);
          for (let i = 1; i < palmPoints.length; i++) {
            ctx.lineTo(palmPoints[i].x, palmPoints[i].y);
          }
          ctx.closePath();
          ctx.fill();
        }

        // Draw Skeletal Joints connects
        ctx.strokeStyle = "var(--color-dark)";
        ctx.lineWidth = 2.5;

        // Connect fingers (from wrist to knuckle to tip)
        for (let i = 0; i < 5; i++) {
          const startIndex = 1 + i * 4;
          // Wrist to finger base
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[startIndex].x, pts[startIndex].y);
          ctx.stroke();

          // Knuckles to tips
          ctx.beginPath();
          ctx.moveTo(pts[startIndex].x, pts[startIndex].y);
          for (let j = 1; j < 4; j++) {
            ctx.lineTo(pts[startIndex + j].x, pts[startIndex + j].y);
          }
          ctx.stroke();
        }

        // Draw Joint circles
        pts.forEach((pt, idx) => {
          const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
          ctx.fillStyle = isTip ? (isLeft ? "var(--color-cyan)" : "var(--color-pink)") : "var(--color-green)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isTip ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      };

      // Draw the hands!
      if (handCount >= 1) drawHand(leftHandAnchorX, leftHandAnchorY, true);
      if (handCount >= 2) drawHand(rightHandAnchorX, rightHandAnchorY, false);

      // 7. DRAW HOVER CURSOR GLOW (If mouse interacted over canvas)
      if (hovered && mousePos.x !== -1000) {
        ctx.strokeStyle = "rgba(255, 102, 170, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, 25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 102, 170, 0.1)";
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, 25, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 8px Courier New, monospace';
        ctx.fillStyle = "var(--color-dark)";
        ctx.fillText(`CAPTURE: X:${Math.round(mousePos.x)} Y:${Math.round(mousePos.y)}`, mousePos.x + 30, mousePos.y + 4);
      }

      // 8. CORNER INFO LABELS (True Neobrutalist design details)
      ctx.fillStyle = "var(--color-dark)";
      ctx.strokeStyle = "var(--color-dark)";

      // Top corner active tracker status bar
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(10, 10, 180, 50);
      ctx.strokeRect(10, 10, 180, 50);

      ctx.fillStyle = "var(--color-dark)";
      ctx.font = 'bold 9px "JetBrains Mono", Courier New, monospace';
      ctx.fillText(`⚡ MEDIA_PIPE: HOLISTIC_v3`, 18, 23);
      ctx.fillText(`📈 STATUS: FEED_TRACKING`, 18, 35);
      const latencyStr = `⏳ INFERENCE_TIME: ${inferenceTime} ms`;
      ctx.fillText(latencyStr, 18, 47);

      // Bottom Right parameters info capsule
      ctx.fillStyle = "rgba(255, 102, 170, 0.95)";
      ctx.fillRect(w - 170, h - 55, 160, 45);
      ctx.strokeRect(w - 170, h - 55, 160, 45);

      ctx.fillStyle = "var(--color-white)";
      ctx.fillText(`GESTURE: ${isTyping ? "TYPING GESTURE" : gesture}`, w - 160, h - 42);
      ctx.fillText(`HANDS: ${handCount} DETECTED`, w - 160, h - 30);
      ctx.fillText(`POLYGONS: ACTIVE`, w - 160, h - 18);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isLive, videoRef, showFacePolygons, showHandPolygons, mousePos, hovered, isTyping, gesture, handCount, inferenceTime]);

  // Fallback background rendering function
  const drawPlaceholderBg = (ctx, w, h) => {
    // Elegant brutalist color block split or grid
    ctx.fillStyle = avatarColor;
    ctx.fillRect(0, 0, w, h);

    // Draw raw system layout code graphics on background
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillText(personaName.substring(0, 7).toUpperCase(), 25, h - 90);

    ctx.font = '10px "JetBrains Mono", Courier, monospace';
    ctx.fillText(`ID_GRID: ${personaName.replace(/\s+/g, '').toUpperCase()}_HOST`, 25, h - 75);
    ctx.fillText(`LOCATION: GLOBAL_PROXY_PORT`, 25, h - 62);
    
    // Draw horizontal/vertical line boundaries
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, w - 30, h - 30);
  };

  return (
    <div 
      className="holistic-canvas-container" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '230px',
        overflow: 'hidden',
        border: '3px solid var(--color-dark)',
        boxShadow: '4px 4px 0px var(--color-dark)',
        backgroundColor: '#fff',
        cursor: 'crosshair'
      }}
    >
      <canvas 
        ref={canvasRef} 
        className={`effect-${filterName}`}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          transform: isLive ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* Floating control buttons with neobrutalist styling */}
      <div 
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          display: 'flex',
          gap: '4px',
          zIndex: 40
        }}
        onClick={(e) => e.stopPropagation()} // retain clicks
      >
        <button
          className={`neo-btn neo-btn-xs`}
          style={{
            fontSize: '9px',
            padding: '2px 6px',
            backgroundColor: showHandPolygons ? 'var(--color-pink)' : '#f3f4f6',
            color: showHandPolygons ? 'white' : 'black',
            boxShadow: '1px 1px 0px #000',
            border: '1.5px solid #000'
          }}
          onClick={() => setShowHandPolygons(!showHandPolygons)}
        >
          {showHandPolygons ? "HAND POLYGONS ON" : "HAND POLYGONS OFF"}
        </button>

        <button
          className={`neo-btn neo-btn-xs`}
          style={{
            fontSize: '9px',
            padding: '2px 6px',
            backgroundColor: showFacePolygons ? 'var(--color-yellow)' : '#f3f4f6',
            color: '#000',
            boxShadow: '1px 1px 0px #000',
            border: '1.5px solid #000'
          }}
          onClick={() => setShowFacePolygons(!showFacePolygons)}
        >
          {showFacePolygons ? "FACE POLYGONS ON" : "FACE POLYGONS OFF"}
        </button>
      </div>

      {/* Live frame status tracker card */}
      <div 
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: isLive ? 'var(--color-green)' : 'var(--color-cyan)',
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
          zIndex: 40
        }}
      >
        <div className="status-dot-blink" style={{ width: '6px', height: '6px', backgroundColor: '#000', borderRadius: '50%' }}></div>
        <span>{fps} FPS</span>
      </div>
    </div>
  );
}
