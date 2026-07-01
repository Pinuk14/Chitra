'use client';

import React, { useRef, useEffect } from 'react';
import { useDrawing } from '@/lib/store';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export const Canvas: React.FC<{ roomId: string }> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { tool, color, strokeWidth, strokes, addStroke, cursors } = useDrawing();
  const { broadcastStroke, broadcastCursor } = useRealtimeSync(roomId);
  
  const isDrawing = useRef(false);
  
  // For brush
  const currentPoints = useRef<{x: number, y: number}[]>([]);
  // For shapes
  const startPoint = useRef<{x: number, y: number} | null>(null);

  const redrawCanvas = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Clear the canvas to let the CSS background show through
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw subtle dot pattern
    ctx.fillStyle = 'rgba(128, 128, 128, 0.2)';
    const spacing = 30;
    for (let x = spacing; x < canvas.width; x += spacing) {
      for (let y = spacing; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    strokes.forEach((stroke) => {
      drawShape(ctx, stroke);
    });
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: any) => {
    ctx.strokeStyle = shape.color || '#565656';
    ctx.lineWidth = shape.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = shape.fill || 'transparent';

    switch (shape.type) {
      case 'rectangle':
        if (shape.fill && shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
        if (shape.fill && shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        break;
      case 'brush':
        if (!shape.points || shape.points.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        break;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawCanvas(ctx, canvas);
  }, [strokes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startPoint.current = { x, y };
    if (tool === 'brush') {
      currentPoints.current = [{ x, y }];
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    broadcastCursor(x, y);

    if (tool === 'brush') {
      currentPoints.current.push({ x, y });
      // Draw Delta
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const lastIdx = currentPoints.current.length - 1;
      const prevPoint = currentPoints.current[lastIdx - 1];
      const currentPoint = currentPoints.current[lastIdx];
      
      if (prevPoint) {
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
      }
    } else {
      // Shape Preview
      if (!startPoint.current) return;
      redrawCanvas(ctx, canvas);
      
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      
      let previewShape: any = { type: tool, color, strokeWidth };
      
      if (tool === 'rectangle') {
        previewShape = { ...previewShape, x: startX, y: startY, width: x - startX, height: y - startY };
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        previewShape = { ...previewShape, cx: startX, cy: startY, radius };
      } else if (tool === 'line') {
        previewShape = { ...previewShape, x1: startX, y1: startY, x2: x, y2: y };
      }
      
      drawShape(ctx, previewShape);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    if (tool === 'brush') {
      if (currentPoints.current.length > 0) {
        const newStroke = {
          type: 'brush',
          points: currentPoints.current,
          color,
          strokeWidth,
        };
        addStroke(newStroke);
        broadcastStroke(newStroke);
      }
    } else if (startPoint.current) {
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      
      let newStroke: any = null;
      if (tool === 'rectangle') {
        newStroke = { type: 'rectangle', x: startX, y: startY, width: endX - startX, height: endY - startY, color, strokeWidth };
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        newStroke = { type: 'circle', cx: startX, cy: startY, radius, color, strokeWidth };
      } else if (tool === 'line') {
        newStroke = { type: 'line', x1: startX, y1: startY, x2: endX, y2: endY, color, strokeWidth };
      }

      if (newStroke) {
        addStroke(newStroke);
        broadcastStroke(newStroke);
      }
    }
    
    isDrawing.current = false;
    currentPoints.current = [];
    startPoint.current = null;
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        width={1200}
        height={700}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="border-0 rounded-neo shadow-neo-inset cursor-crosshair bg-neo-bg w-full"
      />
      {Object.entries(cursors).map(([id, cursor]) => (
        <div
          key={id}
          className="absolute pointer-events-none flex flex-col items-start transition-all duration-75"
          style={{ left: cursor.x, top: cursor.y }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={cursor.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: cursor.color, fillOpacity: 0.5 }}>
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
          <span className="text-xs font-bold px-1 rounded bg-neo-bg shadow-neo-sm text-neo-text" style={{ backgroundColor: cursor.color, color: '#fff' }}>
            {cursor.name || 'Anonymous'}
          </span>
        </div>
      ))}
    </div>
  );
};
