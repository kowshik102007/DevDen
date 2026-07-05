import React, { useEffect, useRef, useState } from 'react';

export const GlobeBackground = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredCity, setHoveredCity] = useState(null);

  // Define cities with their actual Latitude & Longitude coordinates (Teal/Cyan theme)
  const cities = [
    { name: 'New York', lat: 40.7128, lon: -74.0060, color: '#2dd4bf' },
    { name: 'London', lat: 51.5074, lon: -0.1278, color: '#2dd4bf' },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503, color: '#2dd4bf' },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093, color: '#2dd4bf' },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777, color: '#2dd4bf' },
    { name: 'Paris', lat: 48.8566, lon: 2.3522, color: '#2dd4bf' },
    { name: 'San Francisco', lat: 37.7749, lon: -122.4194, color: '#2dd4bf' },
    { name: 'Berlin', lat: 52.5200, lon: 13.4050, color: '#2dd4bf' },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198, color: '#2dd4bf' },
    { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, color: '#2dd4bf' },
    { name: 'Cape Town', lat: -33.9249, lon: 18.4241, color: '#2dd4bf' },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708, color: '#2dd4bf' }
  ];

  // Define connection lines (Teal/Cyan theme)
  const connections = [
    { from: 0, to: 1, speed: 0.008, color: '#2dd4bf' }, // NY -> London
    { from: 0, to: 6, speed: 0.012, color: '#2dd4bf' }, // NY -> SF
    { from: 1, to: 5, speed: 0.015, color: '#2dd4bf' }, // London -> Paris
    { from: 1, to: 7, speed: 0.010, color: '#2dd4bf' }, // London -> Berlin
    { from: 2, to: 3, speed: 0.007, color: '#2dd4bf' }, // Tokyo -> Sydney
    { from: 2, to: 8, speed: 0.011, color: '#2dd4bf' }, // Tokyo -> Singapore
    { from: 4, to: 11, speed: 0.009, color: '#2dd4bf' }, // Mumbai -> Dubai
    { from: 4, to: 8, speed: 0.014, color: '#2dd4bf' }, // Mumbai -> Singapore
    { from: 9, to: 0, speed: 0.006, color: '#2dd4bf' }, // Rio -> NY
    { from: 10, to: 11, speed: 0.013, color: '#2dd4bf' }, // Cape Town -> Dubai
    { from: 6, to: 2, speed: 0.008, color: '#2dd4bf' }  // SF -> Tokyo
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Dimensions
    let width = canvas.width = containerRef.current.clientWidth;
    let height = canvas.height = containerRef.current.clientHeight;

    const handleResize = () => {
      if (canvas && containerRef.current) {
        width = canvas.width = containerRef.current.clientWidth;
        height = canvas.height = containerRef.current.clientHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    // Globe parameters
    let globeRadius = Math.min(width, height) * 0.35;
    if (globeRadius > 320) globeRadius = 320;
    if (globeRadius < 180) globeRadius = 180;

    // Rotations (angles in radians)
    let rotationY = 0.5; // Start with a nice view showing Americas/Atlantic
    let rotationX = 0.3; // Slight tilt
    let targetRotationX = 0.3;
    let targetRotationY = 0.5;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    // Connection particle tracking
    const particles = connections.map(() => ({ t: Math.random() }));

    // Interactive mouse tracking
    let mouseX = 0;
    let mouseY = 0;

    // Simplified polygon models of world continents for solid mapping
    const continentPolygons = [
      // North America
      [
        {lat: 75, lon: -165}, {lat: 80, lon: -120}, {lat: 75, lon: -80}, {lat: 70, lon: -60},
        {lat: 50, lon: -55}, {lat: 40, lon: -75}, {lat: 25, lon: -80}, {lat: 25, lon: -97},
        {lat: 15, lon: -90}, {lat: 8, lon: -78}, {lat: 15, lon: -100}, {lat: 25, lon: -110},
        {lat: 33, lon: -120}, {lat: 45, lon: -125}, {lat: 58, lon: -140}, {lat: 65, lon: -168}
      ],
      // South America
      [
        {lat: 12, lon: -72}, {lat: 10, lon: -62}, {lat: -5, lon: -35}, {lat: -8, lon: -35},
        {lat: -23, lon: -43}, {lat: -40, lon: -64}, {lat: -54, lon: -67}, {lat: -54, lon: -72},
        {lat: -40, lon: -74}, {lat: -18, lon: -70}, {lat: -5, lon: -81}, {lat: 5, lon: -80}
      ],
      // Africa
      [
        {lat: 37, lon: 10}, {lat: 36, lon: 15}, {lat: 31, lon: 32}, {lat: 30, lon: 34},
        {lat: 22, lon: 37}, {lat: 11, lon: 43}, {lat: 12, lon: 51}, {lat: -5, lon: 39},
        {lat: -20, lon: 35}, {lat: -34, lon: 19}, {lat: -33, lon: 18}, {lat: -15, lon: 12},
        {lat: 5, lon: 9}, {lat: 15, lon: -17}, {lat: 32, lon: -9}, {lat: 36, lon: -6}
      ],
      // Europe & Asia (Eurasia)
      [
        {lat: 70, lon: -10}, {lat: 75, lon: 20}, {lat: 75, lon: 60}, {lat: 75, lon: 100},
        {lat: 70, lon: 140}, {lat: 70, lon: 170}, {lat: 60, lon: 170}, {lat: 50, lon: 140},
        {lat: 40, lon: 145}, {lat: 35, lon: 140}, {lat: 30, lon: 130}, {lat: 22, lon: 115},
        {lat: 10, lon: 108}, {lat: 15, lon: 96}, {lat: 25, lon: 90}, {lat: 20, lon: 75},
        {lat: 10, lon: 76}, {lat: 25, lon: 62}, {lat: 12, lon: 43}, {lat: 30, lon: 32},
        {lat: 31, lon: 35}, {lat: 40, lon: 26}, {lat: 37, lon: 15}, {lat: 36, lon: -5},
        {lat: 43, lon: -9}, {lat: 50, lon: -4}, {lat: 60, lon: 5}
      ],
      // Australia
      [
        {lat: -11, lon: 131}, {lat: -10, lon: 142}, {lat: -22, lon: 150}, {lat: -38, lon: 146},
        {lat: -35, lon: 117}, {lat: -22, lon: 114}
      ]
    ];

    const getCartesian = (lat, lon) => {
      const radLat = (lat * Math.PI) / 180;
      const radLon = (lon * Math.PI) / 180;
      return {
        x: Math.cos(radLat) * Math.cos(radLon),
        y: Math.sin(radLat),
        z: Math.cos(radLat) * Math.sin(radLon)
      };
    };

    const rotateCoords = (pt, rotY, rotX) => {
      // Rotation Y
      const x1 = pt.x * Math.cos(rotY) - pt.z * Math.sin(rotY);
      const z1 = pt.x * Math.sin(rotY) + pt.z * Math.cos(rotY);
      // Rotation X
      const y2 = pt.y * Math.cos(rotX) - z1 * Math.sin(rotX);
      const z2 = pt.y * Math.sin(rotX) + z1 * Math.cos(rotX);
      return { x: x1, y: y2, z: z2 };
    };

    // Generate Cartesian points and centroids for polygons to optimize performance & backface culling
    const continentData = continentPolygons.map((poly) => {
      let cx = 0, cy = 0, cz = 0;
      const pts = poly.map((vertex) => {
        const pt = getCartesian(vertex.lat, vertex.lon);
        cx += pt.x;
        cy += pt.y;
        cz += pt.z;
        return pt;
      });
      const len = poly.length;
      return {
        points: pts,
        centroid: { x: cx / len, y: cy / len, z: cz / len }
      };
    });

    const handleMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;

      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        targetRotationY += deltaX * 0.005;
        targetRotationX += deltaY * 0.005;
        targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation Loop
    const draw = () => {
      // Background clears to deep dark space theme
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);

      // Add a subtle grid/stars background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridSize = 80;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Smooth rotation transitions
      if (!isDragging) {
        rotationY += 0.0015; // Slow professional rotation
      } else {
        rotationY += (targetRotationY - rotationY) * 0.15;
      }
      rotationX += (targetRotationX - rotationX) * 0.15;

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw Glowing Aura behind the globe
      const auraGradient = ctx.createRadialGradient(
        centerX, centerY, globeRadius * 0.7,
        centerX, centerY, globeRadius * 1.3
      );
      auraGradient.addColorStop(0, 'rgba(45, 212, 191, 0.07)'); // Cyan center glow
      auraGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.05)'); // Blue outer ring
      auraGradient.addColorStop(1, 'rgba(11, 15, 25, 0)');
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw solid globe sphere background (dark core)
      ctx.fillStyle = '#111726';
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
      ctx.fill();

      // 1. Draw Globe Base Outline
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Draw Latitude/Longitude Grid Lines (Wireframe sphere)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;

      // Longitude hoops (Meridians)
      for (let i = 0; i < 9; i++) {
        const angle = (i * Math.PI) / 9 + rotationY;
        ctx.beginPath();
        for (let j = 0; j <= 50; j++) {
          const latAngle = -Math.PI / 2 + (j * Math.PI) / 50;
          const pt = {
            x: Math.cos(latAngle) * Math.cos(angle),
            y: Math.sin(latAngle),
            z: Math.cos(latAngle) * Math.sin(angle)
          };
          const rotated = rotateCoords(pt, 0, rotationX);
          const screenX = centerX + rotated.x * globeRadius;
          const screenY = centerY - rotated.y * globeRadius;

          if (rotated.z >= -0.05) {
            if (j === 0) ctx.moveTo(screenX, screenY);
            else ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
      }

      // Latitude hoops (Parallels)
      for (let i = -6; i <= 6; i++) {
        const lat = (i * Math.PI) / 14;
        const rad = Math.cos(lat);
        const yOffset = Math.sin(lat);
        ctx.beginPath();
        for (let j = 0; j <= 50; j++) {
          const lonAngle = (j * Math.PI * 2) / 50 + rotationY;
          const pt = {
            x: rad * Math.cos(lonAngle),
            y: yOffset,
            z: rad * Math.sin(lonAngle)
          };
          const rotated = rotateCoords(pt, 0, rotationX);
          const screenX = centerX + rotated.x * globeRadius;
          const screenY = centerY - rotated.y * globeRadius;

          if (rotated.z >= -0.05) {
            if (j === 0) ctx.moveTo(screenX, screenY);
            else ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
      }

      // 3. Draw Solid Projected Continents Map
      continentData.forEach((continent) => {
        // Rotated centroid to check visibility
        const rotatedCentroid = rotateCoords(continent.centroid, rotationY, rotationX);
        if (rotatedCentroid.z < -0.32) {
          // Skip if continent is mostly backfacing
          return;
        }

        ctx.beginPath();
        continent.points.forEach((pt, idx) => {
          const rotated = rotateCoords(pt, rotationY, rotationX);
          let px = rotated.x;
          let py = rotated.y;

          if (rotated.z < -0.05) {
            // Project back-facing vertices onto the sphere's outer limb
            const d = Math.hypot(rotated.x, rotated.y);
            if (d > 0) {
              px = rotated.x / d;
              py = rotated.y / d;
            }
          }

          const screenX = centerX + px * globeRadius;
          const screenY = centerY - py * globeRadius;

          if (idx === 0) ctx.moveTo(screenX, screenY);
          else ctx.lineTo(screenX, screenY);
        });
        ctx.closePath();

        // Dark filled continents overlay
        ctx.fillStyle = 'rgba(23, 31, 54, 0.85)';
        ctx.fill();
        
        // Crisp land borders
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.12)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // Project all city points
      const projectedCities = cities.map((city) => {
        const pt = getCartesian(city.lat, city.lon);
        const rotated = rotateCoords(pt, rotationY, rotationX);
        return {
          ...city,
          screenX: centerX + rotated.x * globeRadius,
          screenY: centerY - rotated.y * globeRadius,
          z: rotated.z,
          rotatedX: rotated.x,
          rotatedY: rotated.y
        };
      });

      // 4. Draw Connecting Paths
      connections.forEach((conn, index) => {
        const start = projectedCities[conn.from];
        const end = projectedCities[conn.to];

        if (start.z > -0.2 && end.z > -0.2) {
          const startPt = getCartesian(start.lat, start.lon);
          const endPt = getCartesian(end.lat, end.lon);
          const midPt = {
            x: (startPt.x + endPt.x) * 0.5,
            y: (startPt.y + endPt.y) * 0.5,
            z: (startPt.z + endPt.z) * 0.5
          };

          const dist = Math.sqrt(midPt.x * midPt.x + midPt.y * midPt.y + midPt.z * midPt.z);
          const elevation = 1.25; // Height of arc above earth surface
          midPt.x = (midPt.x / dist) * elevation;
          midPt.y = (midPt.y / dist) * elevation;
          midPt.z = (midPt.z / dist) * elevation;

          const rotatedMid = rotateCoords(midPt, rotationY, rotationX);
          const ctrlX = centerX + rotatedMid.x * globeRadius;
          const ctrlY = centerY - rotatedMid.y * globeRadius;

          const pathOpacity = Math.min(start.z + 0.35, end.z + 0.35, 0.6);
          ctx.strokeStyle = conn.color;
          ctx.lineWidth = 2.0; // Slightly thicker glowing lines
          ctx.globalAlpha = pathOpacity > 0 ? pathOpacity : 0;

          ctx.beginPath();
          ctx.moveTo(start.screenX, start.screenY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, end.screenX, end.screenY);
          ctx.stroke();
          ctx.globalAlpha = 1;

          // 5. Draw Animated Pulses (particles traveling along path)
          const p = particles[index];
          p.t += conn.speed;
          if (p.t > 1) p.t = 0;

          const t = p.t;
          const x = (1 - t) * (1 - t) * start.screenX + 2 * (1 - t) * t * ctrlX + t * t * end.screenX;
          const y = (1 - t) * (1 - t) * start.screenY + 2 * (1 - t) * t * ctrlY + t * t * end.screenY;

          const particleZ = (1 - t) * start.z + t * end.z;
          if (particleZ > 0) {
            ctx.fillStyle = '#ffffff'; // White glowing pulse
            ctx.beginPath();
            ctx.arc(x, y, 3.2, 0, Math.PI * 2);
            ctx.shadowColor = conn.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      });

      // 6. Draw City Nodes
      let currentHovered = null;

      projectedCities.forEach((city) => {
        if (city.z > -0.15) {
          const isFront = city.z > 0;
          const radius = isFront ? 5 : 3;

          const distToMouse = Math.hypot(city.screenX - mouseX, city.screenY - mouseY);
          const isMouseOver = distToMouse < 15;

          if (isMouseOver && isFront) {
            currentHovered = city.name;
          }

          ctx.fillStyle = isMouseOver ? '#ffffff' : city.color;
          ctx.beginPath();
          ctx.arc(city.screenX, city.screenY, isMouseOver ? 7.5 : radius, 0, Math.PI * 2);
          
          if (isFront) {
            ctx.shadowColor = city.color;
            ctx.shadowBlur = isMouseOver ? 15 : 6;
          }
          ctx.fill();
          ctx.shadowBlur = 0;

          if (isFront && (isMouseOver || hoveredCity === city.name)) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Outfit, Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(city.name, city.screenX, city.screenY - 12);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(city.screenX, city.screenY - 3);
            ctx.lineTo(city.screenX, city.screenY - 10);
            ctx.stroke();
          }
        }
      });

      if (currentHovered !== hoveredCity) {
        setHoveredCity(currentHovered);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '10px Outfit, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Drag to Rotate Globe', width - 20, height - 20);

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
      }
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [hoveredCity]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-auto z-0 overflow-hidden select-none">
      <canvas ref={canvasRef} className="block w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
