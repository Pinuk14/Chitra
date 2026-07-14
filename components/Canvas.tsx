'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDrawing } from '@/lib/store';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionDeniedDialog } from './PermissionDeniedDialog';
import type { Role, Action } from '@/lib/security/permissions';

interface CanvasProps {
  roomId: string;
  role: Role | null;
  memberColor?: string;
}

export const Canvas: React.FC<CanvasProps> = ({ roomId, role, memberColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    tool, color, strokeWidth, opacity, fontFamily, fontSize, textAlign,
    scale, offsetX, offsetY, setTransform,
    strokes, addStroke, updateStroke, removeStroke, cursors, setTool,
    selectedStrokeId, setSelectedStrokeId
  } = useDrawing();
  const { broadcastStroke, broadcastUpdateStroke, broadcastCursor, broadcastUndo, isKeyLoaded } = useRealtimeSync(roomId, memberColor);
  const { can, requestPermission } = usePermissions(roomId, role);
  
  const [deniedAction, setDeniedAction] = useState<Action | null>(null);
  
  // Text input state
  const [textInput, setTextInput] = useState<{ id?: string, x: number, y: number, canvasX: number, canvasY: number, text: string, color?: string, fontSize?: number, fontFamily?: string, textAlign?: string, opacity?: number, width?: number } | null>(null);

  // Selection state
  const activeHandle = useRef<string | null>(null);

  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const isDraggingStroke = useRef(false);
  const isSpaceDown = useRef(false);
  
  const lastPanPoint = useRef<{x: number, y: number} | null>(null);
  const dragStartPoint = useRef<{x: number, y: number} | null>(null);
  const originalStrokeState = useRef<any>(null);

  const currentPoints = useRef<{x: number, y: number}[]>([]);
  const startPoint = useRef<{x: number, y: number} | null>(null);
  const clipboardStroke = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, strokeId: string } | null>(null);
  
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  const getCanvasCoords = (e: React.MouseEvent | React.WheelEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  };

  const generateId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 15}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        isSpaceDown.current = true;
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStrokeId && tool === 'select') {
          e.preventDefault();
          removeStroke(selectedStrokeId);
          broadcastUndo(selectedStrokeId);
          setSelectedStrokeId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedStrokeId) {
          const stroke = strokes.find(s => s.id === selectedStrokeId);
          if (stroke) clipboardStroke.current = stroke;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboardStroke.current && can('draw')) {
          e.preventDefault();
          const newStroke = {
            ...clipboardStroke.current,
            id: generateId(),
          };
          if (newStroke.x !== undefined) newStroke.x += 20;
          if (newStroke.y !== undefined) newStroke.y += 20;
          if (newStroke.cx !== undefined) newStroke.cx += 20;
          if (newStroke.cy !== undefined) newStroke.cy += 20;
          if (newStroke.x1 !== undefined) {
            newStroke.x1 += 20; newStroke.x2 += 20;
            newStroke.y1 += 20; newStroke.y2 += 20;
          }
          addStroke(newStroke);
          broadcastStroke(newStroke);
          setSelectedStrokeId(newStroke.id);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDown.current = false;
        isPanning.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedStrokeId, tool, strokes, can, removeStroke, broadcastUndo, setSelectedStrokeId, addStroke, broadcastStroke]);

  // Wheel zoom (non-passive to prevent default scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = 1.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const newScale = direction > 0 ? scale * zoomFactor : scale / zoomFactor;
        
        if (newScale < 0.1 || newScale > 10) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newOffsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
        const newOffsetY = mouseY - (mouseY - offsetY) * (newScale / scale);

        setTransform(newScale, newOffsetX, newOffsetY);
      } else {
        setTransform(scale, offsetX - e.deltaX, offsetY - e.deltaY);
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [scale, offsetX, offsetY, setTransform]);

  // Sync toolbar styles to selected stroke
  const prevStyleRef = useRef({ color, strokeWidth, opacity, fontFamily, fontSize, textAlign });
  useEffect(() => {
    const prev = prevStyleRef.current;
    if (selectedStrokeId) {
      const stroke = strokes.find(s => s.id === selectedStrokeId);
      if (stroke) {
        const updates: any = {};
        if (color !== prev.color && stroke.color !== color) updates.color = color;
        if (strokeWidth !== prev.strokeWidth && stroke.strokeWidth !== strokeWidth) updates.strokeWidth = strokeWidth;
        if (opacity !== prev.opacity && stroke.opacity !== opacity) updates.opacity = opacity;
        if (fontFamily !== prev.fontFamily && stroke.fontFamily !== fontFamily) updates.fontFamily = fontFamily;
        if (fontSize !== prev.fontSize && stroke.fontSize !== fontSize) updates.fontSize = fontSize;
        if (textAlign !== prev.textAlign && stroke.textAlign !== textAlign) updates.textAlign = textAlign;
        
        if (Object.keys(updates).length > 0) {
          updateStroke(selectedStrokeId, updates);
          broadcastUpdateStroke({ ...stroke, ...updates });
        }
      }
    }
    prevStyleRef.current = { color, strokeWidth, opacity, fontFamily, fontSize, textAlign };
  }, [color, strokeWidth, opacity, fontFamily, fontSize, textAlign, selectedStrokeId, strokes, updateStroke, broadcastUpdateStroke]);

  const getBoundingBox = (stroke: any) => {
    if (stroke.type === 'rectangle' || stroke.type === 'image') {
      return { x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height };
    } else if (stroke.type === 'circle') {
      const rx = stroke.rx || stroke.radius;
      const ry = stroke.ry || stroke.radius;
      return { x: stroke.cx - rx, y: stroke.cy - ry, width: rx * 2, height: ry * 2 };
    } else if (stroke.type === 'line') {
      return { 
        x: Math.min(stroke.x1, stroke.x2), y: Math.min(stroke.y1, stroke.y2), 
        width: Math.abs(stroke.x2 - stroke.x1), height: Math.abs(stroke.y2 - stroke.y1) 
      };
    } else if (stroke.type === 'triangle') {
      if (stroke.width !== undefined && stroke.height !== undefined) {
        return { x: Math.min(stroke.x, stroke.x + stroke.width), y: Math.min(stroke.y, stroke.y + stroke.height), width: Math.abs(stroke.width), height: Math.abs(stroke.height) };
      }
      return { x: stroke.x - stroke.radius, y: stroke.y - stroke.radius, width: stroke.radius * 2, height: stroke.radius * 2 };
    } else if (stroke.type === 'text') {
      const fontSize = stroke.fontSize || 24;
      const hardLines = stroke.text.split('\n');
      let approxLines = 0;
      if (stroke.width) {
        for (const hl of hardLines) {
           approxLines += Math.max(1, Math.ceil((hl.length * fontSize * 0.6) / stroke.width));
        }
      } else {
        approxLines = hardLines.length;
      }
      const boxWidth = stroke.width || Math.max(...hardLines.map((l: string) => l.length)) * fontSize * 0.6;
      let startX = stroke.x;
      if (!stroke.width) {
        if (stroke.textAlign === 'center') startX -= boxWidth / 2;
        else if (stroke.textAlign === 'right') startX -= boxWidth;
      }
      return { x: startX, y: stroke.y, width: boxWidth, height: approxLines * fontSize * 1.2 };
    } else if (stroke.type === 'brush' || stroke.type === 'eraser') {
      if (!stroke.points || stroke.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = stroke.points[0].x, maxX = stroke.points[0].x, minY = stroke.points[0].y, maxY = stroke.points[0].y;
      stroke.points.forEach((p: any) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  };

  const isPointInBox = (x: number, y: number, box: {x: number, y: number, width: number, height: number}) => {
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  };

  const getResizeHandle = (x: number, y: number, box: {x: number, y: number, width: number, height: number}, stroke?: any) => {
    const handleSize = 10 / scale;
    let handles = [];
    
    if (stroke && stroke.type === 'line') {
      handles = [
        { id: 'w', x: stroke.x1, y: stroke.y1 },
        { id: 'e', x: stroke.x2, y: stroke.y2 }
      ];
    } else {
      handles = [
        { id: 'nw', x: box.x, y: box.y },
        { id: 'n', x: box.x + box.width / 2, y: box.y },
        { id: 'ne', x: box.x + box.width, y: box.y },
        { id: 'w', x: box.x, y: box.y + box.height / 2 },
        { id: 'e', x: box.x + box.width, y: box.y + box.height / 2 },
        { id: 'sw', x: box.x, y: box.y + box.height },
        { id: 's', x: box.x + box.width / 2, y: box.y + box.height },
        { id: 'se', x: box.x + box.width, y: box.y + box.height },
      ];
    }

    for (const h of handles) {
      if (x >= h.x - handleSize && x <= h.x + handleSize && y >= h.y - handleSize && y <= h.y + handleSize) {
        return h.id;
      }
    }
    return null;
  };

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, stroke: any) => {
    const box = getBoundingBox(stroke);
    ctx.save();
    
    if (stroke.type === 'line') {
      ctx.strokeStyle = '#6C63FF';
      ctx.lineWidth = 2 / scale;
      const handleSize = 8 / scale;
      const drawHandle = (hx: number, hy: number) => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
      };
      drawHandle(stroke.x1, stroke.y1);
      drawHandle(stroke.x2, stroke.y2);
    } else {
      ctx.strokeStyle = '#6C63FF';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      ctx.setLineDash([]);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#6C63FF';
      ctx.lineWidth = 2 / scale;

      const handleSize = 8 / scale;
      const drawHandle = (hx: number, hy: number) => {
        ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
      };

      drawHandle(box.x, box.y);
      drawHandle(box.x + box.width / 2, box.y);
      drawHandle(box.x + box.width, box.y);
      drawHandle(box.x, box.y + box.height / 2);
      drawHandle(box.x + box.width, box.y + box.height / 2);
      drawHandle(box.x, box.y + box.height);
      drawHandle(box.x + box.width / 2, box.y + box.height);
      drawHandle(box.x + box.width, box.y + box.height);
    }

    ctx.restore();
  };

  const redrawCanvas = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    strokes.forEach((stroke) => {
      drawShape(ctx, canvas, stroke);
      if (tool === 'select' && stroke.id === selectedStrokeId) {
        drawBoundingBox(ctx, stroke);
      }
    });
  }, [strokes, scale, offsetX, offsetY, tool, selectedStrokeId]);

  const drawShape = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, shape: any) => {
    ctx.save();
    ctx.globalAlpha = shape.opacity !== undefined ? shape.opacity : 1;
    ctx.strokeStyle = shape.color || '#565656';
    ctx.lineWidth = shape.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = shape.fill || 'transparent';

    if (shape.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = shape.strokeWidth || 10;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    switch (shape.type) {
      case 'rectangle':
        if (shape.fill && shape.fill !== 'transparent') ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'circle':
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(shape.cx, shape.cy, shape.rx || shape.radius, shape.ry || shape.radius, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
        }
        if (shape.fill && shape.fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        if (shape.width !== undefined && shape.height !== undefined) {
          ctx.moveTo(shape.x + shape.width / 2, shape.y);
          ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
          ctx.lineTo(shape.x, shape.y + shape.height);
        } else {
          ctx.moveTo(shape.x, shape.y - shape.radius);
          ctx.lineTo(shape.x + shape.radius * 0.866, shape.y + shape.radius * 0.5);
          ctx.lineTo(shape.x - shape.radius * 0.866, shape.y + shape.radius * 0.5);
        }
        ctx.closePath();
        if (shape.fill && shape.fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;
      case 'brush':
      case 'eraser':
        if (!shape.points || shape.points.length === 0) break;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        break;
      case 'text': {
        const fontSize = shape.fontSize || 24;
        ctx.font = `${fontSize}px ${shape.fontFamily || 'sans-serif'}`;
        ctx.fillStyle = shape.color;
        ctx.textBaseline = 'top';
        
        const align = shape.textAlign || 'left';
        const maxWidth = shape.width;
        const lineHeight = fontSize * 1.2;
        const hardLines = shape.text.split('\n');
        const lines: string[] = [];
        
        if (maxWidth) {
          for (const hLine of hardLines) {
            const words = hLine.split(' ');
            let currentLine = '';
            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const testLine = currentLine + word + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > maxWidth && i > 0) {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
              } else {
                currentLine = testLine;
              }
            }
            lines.push(currentLine.trim());
          }
        } else {
          lines.push(...hardLines);
        }

        let startY = shape.y;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let startX = shape.x;
          
          if (maxWidth) {
             if (align === 'center') {
               ctx.textAlign = 'center';
               startX = shape.x + maxWidth / 2;
             } else if (align === 'right') {
               ctx.textAlign = 'right';
               startX = shape.x + maxWidth;
             } else {
               ctx.textAlign = 'left';
             }
          } else {
             ctx.textAlign = align === 'justify' ? 'left' : (align as CanvasTextAlign);
          }
          
          if (align === 'justify' && maxWidth && i < lines.length - 1 && line.includes(' ')) {
             ctx.textAlign = 'left';
             const words = line.split(' ');
             const textWidth = ctx.measureText(line).width;
             const spaceDiff = maxWidth - textWidth;
             if (spaceDiff > 0 && spaceDiff < maxWidth * 0.5) {
               const spaceToAdd = spaceDiff / (words.length - 1);
               let currentX = shape.x;
               for (let j = 0; j < words.length; j++) {
                 ctx.fillText(words[j], currentX, startY);
                 currentX += ctx.measureText(words[j] + ' ').width + spaceToAdd;
               }
             } else {
               ctx.fillText(line, startX, startY);
             }
          } else {
             ctx.fillText(line, startX, startY);
          }
          startY += lineHeight;
        }
        break;
      }
      case 'image':
        if (imageCache.current[shape.id]) {
          ctx.drawImage(imageCache.current[shape.id], shape.x, shape.y, shape.width, shape.height);
        } else {
          const img = new Image();
          img.onload = () => {
            imageCache.current[shape.id] = img;
            redrawCanvas(ctx, canvas);
          };
          img.src = shape.dataUrl;
        }
        break;
    }
    
    // Draw text inside shape if it exists
    if (shape.text && ['rectangle', 'circle', 'triangle'].includes(shape.type)) {
      ctx.globalCompositeOperation = 'source-over';
      const fSize = shape.fontSize || 16;
      ctx.font = `${fSize}px ${shape.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = shape.color || '#565656';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let centerX = 0;
      let centerY = 0;
      
      if (shape.type === 'rectangle') {
        centerX = shape.x + shape.width / 2;
        centerY = shape.y + shape.height / 2;
      } else if (shape.type === 'circle') {
        centerX = shape.cx;
        centerY = shape.cy;
      } else if (shape.type === 'triangle') {
        centerX = shape.x;
        centerY = shape.y;
      }
      
      ctx.fillText(shape.text, centerX, centerY);
    }
    
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawCanvas(ctx, canvas);
  }, [strokes, scale, offsetX, offsetY, redrawCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default focus stealing so text area can be focused
    if (textInput) {
      if (textInput.text.trim()) {
        if (textInput.id) {
          const updates = { text: textInput.text };
          updateStroke(textInput.id, updates);
          const updated = strokes.find(s => s.id === textInput.id);
          if (updated) broadcastUpdateStroke({ ...updated, text: textInput.text });
        } else {
          const newStroke = {
            id: generateId(),
            type: 'text',
            x: textInput.canvasX,
            y: textInput.canvasY,
            text: textInput.text,
            color: textInput.color || color,
            fontSize: textInput.fontSize || fontSize,
            fontFamily: textInput.fontFamily || fontFamily,
            textAlign: textInput.textAlign || textAlign,
            opacity: textInput.opacity || opacity,
            width: textInput.width
          };
          addStroke(newStroke);
          broadcastStroke(newStroke);
        }
      } else if (textInput.id) {
        removeStroke(textInput.id);
        broadcastUndo(textInput.id);
      }
      setTextInput(null);
      if (tool !== 'text') return;
    }

    if (isSpaceDown.current || tool === 'pan') {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!can('draw')) {
      setDeniedAction('draw');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e, canvas);

    if (tool === 'select') {
      let hitId: string | null = null;
      let hitHandle: string | null = null;

      if (selectedStrokeId) {
        const selectedStroke = strokes.find(s => s.id === selectedStrokeId);
        if (selectedStroke) {
          const box = getBoundingBox(selectedStroke);
          hitHandle = getResizeHandle(x, y, box, selectedStroke);
          if (hitHandle) {
            hitId = selectedStrokeId;
            activeHandle.current = hitHandle;
          } else if (isPointInBox(x, y, box)) {
            hitId = selectedStrokeId;
          }
        }
      }

      if (!hitId) {
        for (let i = strokes.length - 1; i >= 0; i--) {
          if (strokes[i].type === 'eraser') continue;
          const box = getBoundingBox(strokes[i]);
          if (isPointInBox(x, y, box)) {
            hitId = strokes[i].id;
            break;
          }
        }
      }

      setSelectedStrokeId(hitId);
      
      if (hitId) {
        isDraggingStroke.current = true;
        dragStartPoint.current = { x, y };
        originalStrokeState.current = JSON.parse(JSON.stringify(strokes.find(s => s.id === hitId)));
      }
      return;
    }

    setSelectedStrokeId(null);
    activeHandle.current = null;
    isDrawing.current = true;
    startPoint.current = { x, y };

    if (tool === 'brush') {
      currentPoints.current = [{ x, y }];
    } else if (tool === 'eraser') {
      for (let i = strokes.length - 1; i >= 0; i--) {
        const box = getBoundingBox(strokes[i]);
        const paddedBox = { x: box.x - 5, y: box.y - 5, width: box.width + 10, height: box.height + 10 };
        if (isPointInBox(x, y, paddedBox)) {
          const id = strokes[i].id;
          removeStroke(id);
          broadcastUndo(id);
          break;
        }
      }
      isDrawing.current = false;
    } else if (tool === 'text') {
      const rect = containerRef.current?.getBoundingClientRect();
      setTextInput({ 
        x: e.clientX - (rect?.left || 0), 
        y: e.clientY - (rect?.top || 0), 
        canvasX: x, 
        canvasY: y, 
        text: '' 
      });
      isDrawing.current = false;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!can('draw')) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e, canvas);

    let hitId: string | null = null;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].type === 'eraser') continue;
      const box = getBoundingBox(strokes[i]);
      if (isPointInBox(x, y, box)) {
        hitId = strokes[i].id;
        break;
      }
    }

    if (hitId) {
      setSelectedStrokeId(hitId);
      setTool('select');
      const rect = containerRef.current?.getBoundingClientRect();
      setContextMenu({ 
        x: e.clientX - (rect?.left || 0), 
        y: e.clientY - (rect?.top || 0), 
        strokeId: hitId 
      });
    } else {
      setContextMenu(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning.current && lastPanPoint.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      setTransform(scale, offsetX + dx, offsetY + dy);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const { x, y } = getCanvasCoords(e, canvas);
    broadcastCursor(x, y);

    if (tool === 'select' && selectedStrokeId) {
      const stroke = strokes.find(s => s.id === selectedStrokeId);
      if (stroke) {
        const box = getBoundingBox(stroke);
        const handle = getResizeHandle(x, y, box);
        if (handle) {
          canvas.style.cursor = `${handle}-resize`;
        } else if (isPointInBox(x, y, box)) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'default';
        }
      }

      if (isDraggingStroke.current && dragStartPoint.current && originalStrokeState.current) {
        const dx = x - dragStartPoint.current.x;
        const dy = y - dragStartPoint.current.y;
        
        let updates: any = {};
        const orig = originalStrokeState.current;
        const curHandle = activeHandle.current;

        if (curHandle) {
           // Resizing logic can be complex depending on shape. For simplicity, if it's rect/image, scale width/height.
           if (orig.type === 'rectangle' || orig.type === 'image') {
              if (curHandle.includes('e')) updates.width = Math.max(10, orig.width + dx);
              if (curHandle.includes('s')) updates.height = Math.max(10, orig.height + dy);
              if (curHandle.includes('w')) {
                updates.x = orig.x + dx;
                updates.width = Math.max(10, orig.width - dx);
              }
              if (curHandle.includes('n')) {
                updates.y = orig.y + dy;
                updates.height = Math.max(10, orig.height - dy);
              }
           } else if (orig.type === 'circle') {
              let newRx = orig.rx || orig.radius;
              let newRy = orig.ry || orig.radius;
              let newCx = orig.cx;
              let newCy = orig.cy;
              
              if (curHandle.includes('e')) {
                newRx = Math.max(5, newRx + dx / 2);
                newCx = orig.cx + (newRx - (orig.rx || orig.radius));
              }
              if (curHandle.includes('w')) {
                newRx = Math.max(5, newRx - dx / 2);
                newCx = orig.cx - (newRx - (orig.rx || orig.radius));
              }
              if (curHandle.includes('s')) {
                newRy = Math.max(5, newRy + dy / 2);
                newCy = orig.cy + (newRy - (orig.ry || orig.radius));
              }
              if (curHandle.includes('n')) {
                newRy = Math.max(5, newRy - dy / 2);
                newCy = orig.cy - (newRy - (orig.ry || orig.radius));
              }
              
              updates.rx = newRx;
              updates.ry = newRy;
              updates.cx = newCx;
              updates.cy = newCy;
           } else if (orig.type === 'text') {
              let baseWidth = orig.width;
              if (!baseWidth) {
                 const hardLines = orig.text.split('\n');
                 baseWidth = Math.max(...hardLines.map((l: string) => l.length)) * (orig.fontSize || 24) * 0.6;
              }
              if (curHandle.includes('e')) updates.width = Math.max(20, baseWidth + dx);
              if (curHandle.includes('w')) {
                 updates.width = Math.max(20, baseWidth - dx);
                 updates.x = orig.x + dx;
              }
              if (curHandle.includes('s')) updates.fontSize = Math.max(8, (orig.fontSize || 24) + dy);
              if (curHandle.includes('n')) updates.fontSize = Math.max(8, (orig.fontSize || 24) - dy);
           } else if (orig.type === 'triangle') {
              if (orig.width !== undefined && orig.height !== undefined) {
                if (curHandle.includes('e')) updates.width = orig.width + dx;
                if (curHandle.includes('s')) updates.height = orig.height + dy;
                if (curHandle.includes('w')) {
                  updates.x = orig.x + dx;
                  updates.width = orig.width - dx;
                }
                if (curHandle.includes('n')) {
                  updates.y = orig.y + dy;
                  updates.height = orig.height - dy;
                }
              } else {
                updates.radius = Math.max(5, orig.radius + Math.max(dx, dy));
              }
           } else if (orig.type === 'line') {
              if (curHandle.includes('e')) { updates.x2 = orig.x2 + dx; updates.y2 = orig.y2 + dy; }
              if (curHandle.includes('w')) { updates.x1 = orig.x1 + dx; updates.y1 = orig.y1 + dy; }
           } else if (orig.type === 'brush') {
              const origBox = getBoundingBox(orig);
              const newWidth = Math.max(10, origBox.width + (curHandle.includes('e') ? dx : curHandle.includes('w') ? -dx : 0));
              const newHeight = Math.max(10, origBox.height + (curHandle.includes('s') ? dy : curHandle.includes('n') ? -dy : 0));
              const scaleX = newWidth / (origBox.width || 1);
              const scaleY = newHeight / (origBox.height || 1);
              const shiftX = curHandle.includes('w') ? dx : 0;
              const shiftY = curHandle.includes('n') ? dy : 0;
              updates.points = orig.points.map((p: any) => ({
                x: origBox.x + shiftX + (p.x - origBox.x) * scaleX,
                y: origBox.y + shiftY + (p.y - origBox.y) * scaleY
              }));
           }
        } else {
           // Dragging logic
           if (orig.type === 'brush' || orig.type === 'eraser') {
             updates.points = orig.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
           } else if (orig.type === 'rectangle' || orig.type === 'image' || orig.type === 'text' || orig.type === 'triangle') {
             updates.x = orig.x + dx;
             updates.y = orig.y + dy;
           } else if (orig.type === 'circle') {
             updates.cx = orig.cx + dx;
             updates.cy = orig.cy + dy;
           } else if (orig.type === 'line') {
             updates.x1 = orig.x1 + dx;
             updates.y1 = orig.y1 + dy;
             updates.x2 = orig.x2 + dx;
             updates.y2 = orig.y2 + dy;
           }
        }

        updateStroke(selectedStrokeId, updates);
      }
      return;
    }

    if (!isDrawing.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tool === 'brush') {
      currentPoints.current.push({ x, y });
      
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      ctx.globalAlpha = opacity;
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
      ctx.restore();
    } else if (tool === 'eraser') {
      for (let i = strokes.length - 1; i >= 0; i--) {
        const box = getBoundingBox(strokes[i]);
        const paddedBox = { x: box.x - 5, y: box.y - 5, width: box.width + 10, height: box.height + 10 };
        if (isPointInBox(x, y, paddedBox)) {
          const id = strokes[i].id;
          removeStroke(id);
          broadcastUndo(id);
        }
      }
    } else {
      if (!startPoint.current) return;
      redrawCanvas(ctx, canvas);
      
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      
      let previewShape: any = { type: tool, color, strokeWidth, opacity };
      
      if (tool === 'rectangle') {
        previewShape = { ...previewShape, x: startX, y: startY, width: x - startX, height: y - startY };
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        previewShape = { ...previewShape, cx: startX, cy: startY, radius };
      } else if (tool === 'line') {
        previewShape = { ...previewShape, x1: startX, y1: startY, x2: x, y2: y };
      } else if (tool === 'triangle') {
        previewShape = { ...previewShape, x: startX, y: startY, width: x - startX, height: y - startY };
      }
      
      drawShape(ctx, canvas, previewShape);
      ctx.restore();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      lastPanPoint.current = null;
      return;
    }

    if (isDraggingStroke.current && selectedStrokeId) {
      isDraggingStroke.current = false;
      dragStartPoint.current = null;
      activeHandle.current = null;
      const updatedStroke = strokes.find(s => s.id === selectedStrokeId);
      if (updatedStroke) {
        broadcastUpdateStroke(updatedStroke);
      }
      return;
    }

    if (!isDrawing.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { x: endX, y: endY } = getCanvasCoords(e, canvas);

    if (tool === 'brush') {
      if (currentPoints.current.length > 0) {
        const newStroke = {
          id: generateId(),
          type: tool,
          points: currentPoints.current,
          color,
          strokeWidth,
          opacity,
        };
        addStroke(newStroke);
        broadcastStroke(newStroke);
      }
    } else if (startPoint.current && tool !== 'text' && tool !== 'eraser') {
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      
      let newStroke: any = null;
      if (tool === 'rectangle') {
        newStroke = { id: generateId(), type: 'rectangle', x: startX, y: startY, width: endX - startX, height: endY - startY, color, strokeWidth, opacity };
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        newStroke = { id: generateId(), type: 'circle', cx: startX, cy: startY, radius, color, strokeWidth, opacity };
      } else if (tool === 'line') {
        newStroke = { id: generateId(), type: 'line', x1: startX, y1: startY, x2: endX, y2: endY, color, strokeWidth, opacity };
      } else if (tool === 'triangle') {
        newStroke = { id: generateId(), type: 'triangle', x: startX, y: startY, width: endX - startX, height: endY - startY, color, strokeWidth, opacity };
      }

      if (newStroke) {
        addStroke(newStroke);
        broadcastStroke(newStroke);
        setTool('select');
        setSelectedStrokeId(newStroke.id);
      }
    }
    
    isDrawing.current = false;
    currentPoints.current = [];
    startPoint.current = null;
  };

  useEffect(() => {
    const handleImageUpload = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.dataUrl) {
        const img = new Image();
        img.onload = () => {
          const newStroke = {
            id: generateId(),
            type: 'image',
            x: -offsetX / scale + 50,
            y: -offsetY / scale + 50,
            width: img.width > 500 ? 500 : img.width,
            height: img.width > 500 ? (img.height * (500/img.width)) : img.height,
            dataUrl: detail.dataUrl,
            opacity: 1
          };
          addStroke(newStroke);
          broadcastStroke(newStroke);
        };
        img.src = detail.dataUrl;
      }
    };
    window.addEventListener('chitra:upload-image', handleImageUpload);
    return () => window.removeEventListener('chitra:upload-image', handleImageUpload);
  }, [offsetX, offsetY, scale, addStroke, broadcastStroke]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!can('draw')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e, canvas);

    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      if (stroke.type === 'text' || ['rectangle', 'circle', 'triangle'].includes(stroke.type)) {
        const box = getBoundingBox(stroke);
        const paddedBox = { x: box.x - 5, y: box.y - 5, width: box.width + 10, height: box.height + 10 };
        if (isPointInBox(x, y, paddedBox)) {
          setTextInput({
            id: stroke.id,
            x: stroke.type === 'text' ? stroke.x * scale + offsetX : (box.x + box.width/2) * scale + offsetX - 100,
            y: stroke.type === 'text' ? stroke.y * scale + offsetY : (box.y + box.height/2) * scale + offsetY - 20,
            canvasX: stroke.type === 'text' ? stroke.x : box.x,
            canvasY: stroke.type === 'text' ? stroke.y : box.y,
            text: stroke.text || '',
            color: stroke.color,
            fontSize: stroke.fontSize,
            fontFamily: stroke.fontFamily,
            textAlign: stroke.type === 'text' ? stroke.textAlign : 'center',
            opacity: stroke.opacity,
            width: stroke.type === 'text' ? stroke.width : undefined
          });
          return;
        }
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-neo-bg"
      style={{
        backgroundImage: `radial-gradient(rgba(128, 128, 128, 0.3) 2px, transparent 2px)`,
        backgroundSize: `${30 * scale}px ${30 * scale}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`
      }}
      onClick={() => setContextMenu(null)}
    >
      <canvas
        ref={canvasRef}
        width={1200}
        height={700}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={`border-0 rounded-neo shadow-neo-inset w-full h-full touch-none ${
          isSpaceDown.current || tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 
          tool === 'select' ? 'cursor-default' :
          can('draw') ? 'cursor-crosshair' : 'cursor-not-allowed'
        }`}
      />
      {Object.entries(cursors).map(([id, cursor]) => {
        const screenX = cursor.x * scale + offsetX;
        const screenY = cursor.y * scale + offsetY;
        return (
          <div
            key={id}
            className="absolute pointer-events-none flex flex-col items-start transition-all duration-75 z-20"
            style={{ left: screenX, top: screenY }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={cursor.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: cursor.color, fillOpacity: 0.5 }}>
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
            <span className="text-xs font-bold px-1 rounded bg-neo-bg shadow-neo-sm text-neo-text" style={{ backgroundColor: cursor.color, color: '#fff' }}>
              {cursor.name || 'Anonymous'}
            </span>
          </div>
        );
      })}

      {textInput && (
        <textarea
          ref={(el) => {
            if (el && !el.contains(document.activeElement)) {
              setTimeout(() => el.focus(), 0);
            }
          }}
          autoFocus
          placeholder="Type here..."
          className="absolute bg-white/80 border-2 border-dashed border-neo-accent outline-none resize-none p-2 shadow-neo-md rounded z-30"
          style={{
            left: textInput.x,
            top: textInput.y,
            color: textInput.color === '#FFFFFF' || (color === '#FFFFFF' && !textInput.color) ? '#000000' : (textInput.color || color),
            fontFamily: textInput.fontFamily || fontFamily,
            fontSize: `${(textInput.fontSize || fontSize) * scale}px`,
            textAlign: ((textInput.textAlign || textAlign) === 'justify' ? 'left' : (textInput.textAlign || textAlign)) as any,
            opacity: textInput.opacity || opacity,
            width: textInput.width ? `${textInput.width * scale}px` : undefined,
            minWidth: '200px',
            maxWidth: textInput.width ? `${textInput.width * scale}px` : '100%',
            whiteSpace: textInput.width ? 'pre-wrap' : 'pre',
            minHeight: `${(textInput.fontSize || fontSize) * scale * 1.5}px`,
            lineHeight: 1
          }}
          value={textInput.text}
          onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
          onBlur={() => {
            if (textInput.text.trim()) {
              if (textInput.id) {
                const updates = { text: textInput.text };
                updateStroke(textInput.id, updates);
                const updated = strokes.find(s => s.id === textInput.id);
                if (updated) broadcastUpdateStroke({ ...updated, text: textInput.text });
              } else {
                const newStroke = {
                  id: generateId(),
                  type: 'text',
                  x: textInput.canvasX,
                  y: textInput.canvasY,
                  text: textInput.text,
                  color: textInput.color || color,
                  fontSize: textInput.fontSize || fontSize,
                  fontFamily: textInput.fontFamily || fontFamily,
                  textAlign: textInput.textAlign || textAlign,
                  opacity: textInput.opacity || opacity,
                  width: textInput.width
                };
                addStroke(newStroke);
                broadcastStroke(newStroke);
              }
            } else if (textInput.id) {
              removeStroke(textInput.id);
              broadcastUndo(textInput.id);
            }
            setTextInput(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTextInput(null);
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
        />
      )}

      {contextMenu && (
        <div 
          className="absolute bg-neo-bg border border-neo-shadow/20 shadow-neo-md rounded-neo flex flex-col z-[100] py-1 text-sm font-medium min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button 
            className="px-4 py-2 text-left hover:bg-neo-shadow/10 text-neo-text"
            onClick={(e) => {
              e.stopPropagation();
              const stroke = strokes.find(s => s.id === contextMenu.strokeId);
              if (stroke) clipboardStroke.current = stroke;
              setContextMenu(null);
            }}
          >
            Copy (Ctrl+C)
          </button>
          <button 
            className="px-4 py-2 text-left hover:bg-neo-shadow/10 text-neo-text"
            onClick={(e) => {
              e.stopPropagation();
              if (clipboardStroke.current && can('draw')) {
                const newStroke = {
                  ...clipboardStroke.current,
                  id: generateId(),
                };
                if (newStroke.x !== undefined) newStroke.x += 20;
                if (newStroke.y !== undefined) newStroke.y += 20;
                if (newStroke.cx !== undefined) newStroke.cx += 20;
                if (newStroke.cy !== undefined) newStroke.cy += 20;
                if (newStroke.x1 !== undefined) {
                  newStroke.x1 += 20; newStroke.x2 += 20;
                  newStroke.y1 += 20; newStroke.y2 += 20;
                }
                addStroke(newStroke);
                broadcastStroke(newStroke);
                setSelectedStrokeId(newStroke.id);
              }
              setContextMenu(null);
            }}
          >
            Paste (Ctrl+V)
          </button>
          <div className="h-px bg-neo-shadow/10 my-1"></div>
          <button 
            className="px-4 py-2 text-left hover:bg-neo-shadow/10 text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              removeStroke(contextMenu.strokeId);
              broadcastUndo(contextMenu.strokeId);
              setSelectedStrokeId(null);
              setContextMenu(null);
            }}
          >
            Delete (Del)
          </button>
        </div>
      )}

      <PermissionDeniedDialog
        action={deniedAction || 'draw'}
        isOpen={deniedAction !== null}
        onClose={() => setDeniedAction(null)}
        onRequestPermission={requestPermission}
      />

      {!isKeyLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-neo-bg/80 backdrop-blur-sm">
          <div className="bg-neo-bg rounded-neo shadow-neo-md p-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-neo-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-neo-text font-medium text-sm">Initializing Secure Canvas...</span>
          </div>
        </div>
      )}
    </div>
  );
};
