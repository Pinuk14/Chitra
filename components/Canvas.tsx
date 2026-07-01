'use client';

import React, { useRef, useEffect } from 'react';
import { useDrawing } from '@/lib/store';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { tool, color, strokeWidth, strokes, addStroke } = useDrawing();
  const isDrawing = useRef(false);
  const currentStroke = useRef<any[]>([]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: any) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    
    ctx.strokeStyle = stroke.color || '#565656';
    ctx.lineWidth = stroke.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw all strokes
    ctx.fillStyle = '#E8EDF5'; // neo-bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });
  }, [strokes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    currentStroke.current = [{ x, y }];
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStroke.current.push({ x, y });

    // Draw on canvas in real-time
    const ctx = canvas.getContext('2d');
    if (ctx && tool === 'brush') {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const lastIdx = currentStroke.current.length - 1;
      const prevPoint = currentStroke.current[lastIdx - 1];
      const currentPoint = currentStroke.current[lastIdx];
      
      if (prevPoint) {
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing.current && currentStroke.current.length > 0) {
      addStroke({
        type: tool,
        points: currentStroke.current,
        color,
        strokeWidth,
      });
    }
    isDrawing.current = false;
    currentStroke.current = [];
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
