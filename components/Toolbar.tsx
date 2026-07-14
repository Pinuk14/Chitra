'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useDrawing, Tool } from '@/lib/store';
import { Button } from './ui/Button';
import { pb } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { PermissionDeniedDialog } from './PermissionDeniedDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { exportBoardToImage } from '@/lib/exportUtils';
import Image from 'next/image';
import type { Role, Action } from '@/lib/security/permissions';

const PRIMARY_TOOLS: Tool[] = ['select', 'pan', 'brush', 'eraser', 'text'];
const SHAPE_TOOLS: Tool[] = ['rectangle', 'circle', 'triangle', 'line'];
const COLORS = [
  '#565656', '#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', 
  '#FFFFFF', '#000000', '#FF9F1C', '#2EC4B6', '#E71D36', 
  '#011627', '#8338EC', '#3A86FF', '#FF006E', '#FB5607'
];
const FONTS = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'Inter', 'Roboto', 'Outfit', 'Comic Sans MS', 'Courier New', 'Impact'];

interface ToolbarProps {
  roomId?: string;
  role?: Role | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({ roomId, role = null }) => {
  const { user } = useAuth();
  const { 
    tool, setTool, color, setColor, 
    strokeWidth, setStrokeWidth, opacity, setOpacity,
    fontFamily, setFontFamily, fontSize, setFontSize,
    textAlign, setTextAlign,
    scale, offsetX, offsetY, setTransform,
    undo, redo, clearCanvas 
  } = useDrawing();
  const { can, requestPermission } = usePermissions(roomId || '', role);
  const [deniedAction, setDeniedAction] = useState<Action | null>(null);
  const [showShapes, setShowShapes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const guardAction = (action: Action, callback: () => void) => {
    if (can(action)) {
      callback();
    } else {
      setDeniedAction(action);
    }
  };

  const handleUndo = useCallback(async () => {
    const state = useDrawing.getState();
    if (state.history.length <= 1) return;
    const currentStrokes = state.history[state.history.length - 1];
    const prevStrokes = state.history[state.history.length - 2];
    
    const removedStroke = currentStrokes.find(s => !prevStrokes.includes(s));
    
    undo();

    if (removedStroke?.id && roomId) {
       await pb.collection('drawings').delete(removedStroke.id).catch(() => {});
    }
  }, [roomId, undo]);

  const handleClear = () => {
    setShowConfirmClear(true);
  };

  const executeClear = async () => {
    setShowConfirmClear(false);
    const state = useDrawing.getState();
    const strokes = state.strokes;
    if (roomId) {
      strokes.forEach((stroke) => {
        if (stroke.id) {
          pb.collection('drawings').delete(stroke.id).catch(() => {});
        }
      });
    }
    clearCanvas();
  };

  const handleExport = async () => {
    const state = useDrawing.getState();
    const roomName = roomId ? (await pb.collection('rooms').getOne(roomId, { requestKey: null })).name : 'Local Room';
    
    await exportBoardToImage(
      state.strokes, 
      roomName, 
      user?.username || 'Anonymous'
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        window.dispatchEvent(new CustomEvent('chitra:upload-image', { detail: { dataUrl } }));
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleZoomIn = () => setTransform(Math.min(scale * 1.2, 10), offsetX, offsetY);
  const handleZoomOut = () => setTransform(Math.max(scale / 1.2, 0.1), offsetX, offsetY);
  const handleZoomReset = () => setTransform(1, 0, 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (can('draw')) handleUndo();
        } else if (e.key === 'y' || (e.key === 'Z' && e.shiftKey)) {
          e.preventDefault();
          if (can('draw')) redo();
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomReset();
        }
      } else {
        switch(e.key.toLowerCase()) {
          case 's': setTool('select'); break;
          case 'v': setTool('pan'); break;
          case 'b': setTool('brush'); break;
          case 'e': setTool('eraser'); break;
          case 't': setTool('text'); break;
          case 'r': setTool('rectangle'); break;
          case 'c': setTool('circle'); break;
          case 'l': setTool('line'); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, redo, can, scale, offsetX, offsetY, setTool]);

  return (
    <>
      <div className="flex flex-wrap gap-2 p-2 mt-2 bg-neo-bg rounded-neo shadow-neo-md items-center justify-center mx-auto w-max max-w-full relative z-50">
        {/* Logo mark */}
        <div className="flex items-center pr-2 border-r-2 border-neo-shadow/20 mr-1">
          <Image src="/Chitra_logo.png" alt="Chitra" width={28} height={28} className="object-contain opacity-80" />
        </div>
        {/* Tool Selector */}
        <div className="flex gap-1 bg-neo-shadow/5 p-1 rounded-neo">
          {PRIMARY_TOOLS.map((t) => (
            <button
              key={t}
              title={`Shortcut: ${t === 'select' ? 'S' : t === 'pan' ? 'V' : t.charAt(0).toUpperCase()}`}
              onClick={() => guardAction('draw', () => { setTool(t); setShowShapes(false); setShowSettings(false); })}
              className={`px-3 py-1.5 rounded-neo transition-all text-sm font-bold ${
                tool === t
                  ? 'shadow-neo-inset text-neo-accent bg-neo-bg'
                  : 'hover:bg-neo-shadow/10 text-neo-text'
              } ${!can('draw') && t !== 'pan' ? 'opacity-50' : ''}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          
          <div className="relative flex items-center">
            <button
              onClick={() => guardAction('draw', () => { setShowShapes(!showShapes); setShowSettings(false); })}
              className={`px-3 py-1.5 rounded-neo transition-all text-sm font-bold ${
                SHAPE_TOOLS.includes(tool) || showShapes
                  ? 'shadow-neo-inset text-neo-accent bg-neo-bg'
                  : 'hover:bg-neo-shadow/10 text-neo-text'
              } ${!can('draw') ? 'opacity-50' : ''}`}
            >
              Shapes {SHAPE_TOOLS.includes(tool) ? `(${tool})` : '▾'}
            </button>
            {showShapes && (
              <div className="absolute top-full left-0 mt-2 p-2 bg-neo-bg rounded-neo shadow-neo-md flex flex-col gap-1 min-w-[120px] z-[100]">
                {SHAPE_TOOLS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTool(t); setShowShapes(false); }}
                    className={`text-left px-3 py-2 rounded text-sm font-medium ${
                      tool === t ? 'bg-neo-accent/10 text-neo-accent' : 'hover:bg-neo-shadow/10'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => guardAction('draw', () => fileInputRef.current?.click())}
            className={`px-3 py-1.5 rounded-neo transition-all text-sm font-bold hover:bg-neo-shadow/10 text-neo-text ${!can('draw') ? 'opacity-50' : ''}`}
          >
            Image
          </button>
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Color & Settings */}
        <div className="flex gap-2 items-center border-l-2 border-neo-shadow/20 pl-2">
          <div className="flex gap-1 items-center">
            {COLORS.slice(0, 10).map((c) => (
              <button
                key={c}
                onClick={() => guardAction('draw', () => setColor(c))}
                className={`w-6 h-6 rounded-full shrink-0 transition-transform hover:scale-110 active:scale-95 ${
                  color === c ? 'shadow-neo-md border-2 border-neo-bg ring-2 ring-neo-accent' : 'shadow-neo-sm border border-transparent'
                } ${!can('draw') ? 'opacity-50' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          
          <div className="relative flex items-center ml-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-1.5 rounded-neo transition-all text-sm font-bold ${showSettings ? 'shadow-neo-inset text-neo-accent bg-neo-bg' : 'hover:bg-neo-shadow/10 text-neo-text'}`}
            >
              Adjust ▾
            </button>
            
            {showSettings && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-4 bg-neo-bg rounded-neo shadow-neo-md flex flex-col gap-4 min-w-[250px] z-[100]">
              {tool === 'text' ? (
                <>
                  <label className="flex flex-col gap-1 text-xs font-bold text-neo-text/70">
                    FONT FAMILY
                    <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="bg-neo-bg shadow-neo-inset rounded px-2 py-2 outline-none text-sm text-neo-text border-r-8 border-transparent">
                      {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold text-neo-text/70">
                    FONT SIZE ({fontSize}px)
                    <input type="range" min="8" max="144" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full h-2 bg-neo-shadow/20 rounded-lg appearance-none cursor-pointer accent-neo-accent" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold text-neo-text/70">
                    ALIGNMENT
                    <div className="flex gap-1">
                      {['left', 'center', 'right', 'justify'].map((align) => (
                        <button
                          key={align}
                          onClick={() => setTextAlign(align as any)}
                          className={`flex-1 py-1 px-2 text-xs font-bold rounded-neo transition-all ${
                            textAlign === align ? 'bg-neo-accent text-white shadow-neo-md' : 'bg-neo-shadow/10 text-neo-text hover:bg-neo-shadow/20'
                          }`}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-xs font-bold text-neo-text/70">
                    STROKE WIDTH ({strokeWidth}px)
                    <input type="range" min="1" max="50" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="w-full h-2 bg-neo-shadow/20 rounded-lg appearance-none cursor-pointer accent-neo-accent" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold text-neo-text/70">
                    OPACITY ({Math.round(opacity * 100)}%)
                    <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={e => setOpacity(Number(e.target.value))} className="w-full h-2 bg-neo-shadow/20 rounded-lg appearance-none cursor-pointer accent-neo-accent" />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zoom and Actions */}
      <div className="flex gap-2 items-center border-l-2 border-neo-shadow/20 pl-2">
        <div className="flex items-center gap-1 bg-neo-shadow/5 p-1 rounded-neo">
            <button onClick={handleZoomOut} className="w-6 h-6 flex items-center justify-center rounded hover:bg-neo-shadow/10 text-sm font-bold" title="Zoom Out (-)">-</button>
            <button onClick={handleZoomReset} className="px-2 text-xs font-bold min-w-[3rem]" title="Reset Zoom (0)">{Math.round(scale * 100)}%</button>
            <button onClick={handleZoomIn} className="w-6 h-6 flex items-center justify-center rounded hover:bg-neo-shadow/10 text-sm font-bold" title="Zoom In (+)">+</button>
          </div>

          <div className="flex gap-1">
          <Button onClick={() => guardAction('draw', handleUndo)} variant="secondary" className={`!px-2 !py-1 text-xs ${!can('draw') ? 'opacity-50' : ''}`} title="Undo (Ctrl+Z)">↶</Button>
          <Button onClick={() => guardAction('draw', redo)} variant="secondary" className={`!px-2 !py-1 text-xs ${!can('draw') ? 'opacity-50' : ''}`} title="Redo (Ctrl+Y)">↷</Button>
          <Button onClick={() => guardAction('clear_board', handleClear)} variant="secondary" className={`!px-2 !py-1 text-xs ${!can('clear_board') ? 'opacity-50' : ''}`}>Clear</Button>
          <Button onClick={() => guardAction('export_board', handleExport)} className={`!px-2 !py-1 text-xs ${!can('export_board') ? 'opacity-50' : ''}`}>Export</Button>
        </div>
      </div>
      </div>
      
      <PermissionDeniedDialog
        action={deniedAction || 'draw'}
        isOpen={deniedAction !== null}
        onClose={() => setDeniedAction(null)}
        onRequestPermission={requestPermission}
      />
      <ConfirmDialog
        isOpen={showConfirmClear}
        title="Clear Canvas?"
        message="This will permanently erase all strokes on this canvas and cannot be undone."
        confirmLabel="Clear Everything"
        cancelLabel="Keep Drawing"
        isDangerous
        onConfirm={executeClear}
        onCancel={() => setShowConfirmClear(false)}
      />
    </>
  );
};
