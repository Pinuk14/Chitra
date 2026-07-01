'use client';

import React, { useRef, useEffect } from 'react';
import { useDrawing } from '@/lib/store';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { tool, color, strokeWidth, strokes, addStroke } = useDrawing();
  const isDrawing = useRef(false);
  
  // For brush
  const currentPoints = useRef<{x: number, y: number}[]>([]);
  // For shapes
  const startPoint = useRef<{x: number, y: number} | null>(null);

  const redrawCanvas = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.fillStyle = '#E8EDF5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        addStroke({
          type: 'brush',
          points: currentPoints.current,
          color,
          strokeWidth,
        });
      }
    } else if (startPoint.current) {
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      
      if (tool === 'rectangle') {
        addStroke({ type: 'rectangle', x: startX, y: startY, width: endX - startX, height: endY - startY, color, strokeWidth });
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        addStroke({ type: 'circle', cx: startX, cy: startY, radius, color, strokeWidth });
      } else if (tool === 'line') {
        addStroke({ type: 'line', x1: startX, y1: startY, x2: endX, y2: endY, color, strokeWidth });
      }
    }
    
    isDrawing.current = false;
    currentPoints.current = [];
    startPoint.current = null;
  };

  return (
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
  );
};
