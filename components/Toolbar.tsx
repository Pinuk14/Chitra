'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useDrawing, Tool } from '@/lib/store';
import { Button } from './ui/Button';
import { supabase } from '@/lib/api';
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

// Tool icons for compact mobile display
const TOOL_ICONS: Record<string, React.ReactNode> = {
  select: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path></svg>,
  pan: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4"></path><path d="M14 11V4a2 2 0 0 0-4 0v6"></path><path d="M10 10.5V3a2 2 0 0 0-4 0v9"></path><path d="M6 12v-1a2 2 0 0 0-4 0v8a8 8 0 0 0 8 8h3a8 8 0 0 0 8-8v-6a2 2 0 0 0-4 0v4"></path></svg>,
  brush: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>,
  eraser: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13.5 3 12.5L13 2.5C14 1.5 15.5 1.5 16.5 2.5L21.5 7.5C22.5 8.5 22.5 10 21.5 11L15 17.5"></path><path d="M17 10L10 17"></path></svg>,
  text: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>,
  rectangle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>,
  circle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>,
  triangle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>,
  line: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5"></line></svg>,
};

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
  const [showColors, setShowColors] = useState(false);
  
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
       const { error } = await supabase.from('drawings').delete().eq('id', removedStroke.id);
       if (error) console.error('Failed to delete stroke:', error);
    }
  }, [roomId, undo]);

  const handleClear = () => {
    setShowConfirmClear(true);
  };

  const executeClear = async () => {
    setShowConfirmClear(false);
    if (roomId) {
      const { error } = await supabase.from('drawings').delete().eq('room_id', roomId);
      if (error) console.error('Failed to clear drawings:', error);
    }
    clearCanvas();
  };

  const handleExport = async () => {
    const state = useDrawing.getState();
    let roomName = 'Local Room';
    if (roomId) {
      const { data: room } = await supabase.from('rooms').select('name').eq('id', roomId).single();
      if (room?.name) roomName = room.name;
    }
    
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
      <div className="md:static md:shadow-neo-md md:rounded-neo md:mt-2 md:mx-auto md:w-max md:max-w-full md:p-2 bg-transparent md:bg-neo-bg flex flex-col md:flex-row gap-2 pointer-events-none md:pointer-events-auto z-10 absolute md:relative inset-0 md:inset-auto">
         
         {/* Tools & Colors (Top on mobile, inline on desktop) */}
         <div className="flex flex-col md:flex-row gap-2 items-center justify-center w-full md:w-auto pointer-events-auto mt-2 md:mt-0 px-2 md:px-0">
            {/* Logo — desktop only */}
            <div className="hidden md:flex items-center pr-2 border-r-2 border-neo-shadow/20 mr-1">
              <Image src="/Chitra_logo.png" alt="Chitra" width={28} height={28} className="object-contain opacity-80" />
            </div>

            {/* Tools Container Wrapper to allow absolute positioned dropdown outside overflow hidden */}
            <div className="relative flex flex-col items-center w-full md:w-auto">
              <div className="flex gap-1 md:gap-1 bg-neo-bg p-1.5 md:p-1 rounded-neo shadow-neo-sm md:shadow-none overflow-x-auto w-max max-w-full justify-center hide-scrollbar">
                {PRIMARY_TOOLS.map((t) => (
                  <button
                    key={t}
                    title={`Shortcut: ${t === 'select' ? 'S' : t === 'pan' ? 'V' : t.charAt(0).toUpperCase()}`}
                    onClick={() => guardAction('draw', () => { setTool(t); setShowShapes(false); setShowSettings(false); setShowColors(false); })}
                    className={`flex flex-col md:flex-row items-center justify-center w-[42px] h-[42px] md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-neo transition-all text-[10px] md:text-sm font-bold gap-1 md:gap-2 shrink-0 ${
                      tool === t
                        ? 'shadow-neo-inset text-neo-accent bg-neo-bg'
                        : 'hover:bg-neo-shadow/10 text-neo-text'
                    } ${!can('draw') && t !== 'pan' ? 'opacity-50' : ''}`}
                  >
                    <span className="flex items-center justify-center text-base md:text-sm leading-none">{TOOL_ICONS[t]}</span>
                    <span className="md:inline leading-none">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                  </button>
                ))}
                
                <div className="relative flex items-center shrink-0">
                  <button
                    onClick={() => guardAction('draw', () => { setShowShapes(!showShapes); setShowSettings(false); setShowColors(false); })}
                    className={`flex flex-col md:flex-row items-center justify-center w-[42px] h-[42px] md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-neo transition-all text-[10px] md:text-sm font-bold gap-1 md:gap-2 ${
                      SHAPE_TOOLS.includes(tool) || showShapes
                        ? 'shadow-neo-inset text-neo-accent bg-neo-bg'
                        : 'hover:bg-neo-shadow/10 text-neo-text'
                    } ${!can('draw') ? 'opacity-50' : ''}`}
                  >
                    <span className="flex items-center justify-center text-base md:text-sm leading-none">{SHAPE_TOOLS.includes(tool) ? TOOL_ICONS[tool] : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>}</span>
                    <span className="md:inline leading-none">Shapes {SHAPE_TOOLS.includes(tool) ? '' : '▾'}</span>
                  </button>
                </div>

                <button
                  onClick={() => guardAction('draw', () => fileInputRef.current?.click())}
                  className={`flex flex-col md:flex-row items-center justify-center w-[42px] h-[42px] md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-neo transition-all text-[10px] md:text-sm font-bold hover:bg-neo-shadow/10 text-neo-text gap-1 md:gap-2 shrink-0 ${!can('draw') ? 'opacity-50' : ''}`}
                >
                  <span className="flex items-center justify-center text-base md:text-sm leading-none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></span>
                  <span className="md:inline leading-none">Image</span>
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
              </div>
              
              {showShapes && (
                <div className="absolute top-[50px] p-2 bg-neo-bg rounded-neo shadow-neo-md flex gap-2 z-[100]">
                  {SHAPE_TOOLS.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTool(t); setShowShapes(false); }}
                      className={`flex flex-col items-center justify-center p-2 rounded text-[10px] md:text-sm font-medium ${
                        tool === t ? 'bg-neo-accent/10 text-neo-accent' : 'hover:bg-neo-shadow/10 text-neo-text'
                      }`}
                    >
                      <span className="mb-1">{TOOL_ICONS[t]}</span>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Colors Container (Dropdown swatch) */}
            <div className="flex gap-2 items-center md:border-l-2 md:border-neo-shadow/20 md:pl-2">
               <div className="relative bg-neo-bg p-1.5 rounded-neo shadow-neo-sm">
                 <button
                   onClick={() => { setShowColors(!showColors); setShowSettings(false); setShowShapes(false); }}
                   className={`w-7 h-7 rounded-full shrink-0 shadow-neo-sm border-2 ${showColors ? 'border-neo-accent ring-2 ring-neo-accent' : 'border-neo-bg'}`}
                   style={{ backgroundColor: color }}
                   aria-label="Pick color"
                 />
                 {showColors && (
                   <div className="absolute top-[50px] left-1/2 -translate-x-1/2 p-2.5 bg-neo-bg rounded-neo shadow-neo-md z-[100] grid grid-cols-5 gap-2 min-w-[170px]">
                     {COLORS.map((c) => (
                       <button
                         key={c}
                         onClick={() => { guardAction('draw', () => setColor(c)); setShowColors(false); }}
                         className={`w-7 h-7 rounded-full shrink-0 transition-transform active:scale-90 ${
                           color === c ? 'shadow-neo-md border-2 border-neo-bg ring-2 ring-neo-accent' : 'shadow-neo-sm border border-transparent'
                         } ${!can('draw') ? 'opacity-50' : ''}`}
                         style={{ backgroundColor: c }}
                         aria-label={`Select color ${c}`}
                       />
                     ))}
                   </div>
                 )}
               </div>
            </div>
         </div>

         {/* Bottom Actions (Bottom on mobile, inline on desktop) */}
         <div className="fixed bottom-[90px] left-2 right-2 md:static md:bottom-auto md:left-auto md:right-auto flex justify-between md:justify-start items-center gap-2 pointer-events-none md:pointer-events-auto md:border-l-2 md:border-neo-shadow/20 md:pl-2 z-20">
            
            {/* Zoom */}
            <div className="flex items-center gap-1 bg-neo-bg p-1 rounded-neo shadow-neo-sm md:shadow-none pointer-events-auto">
              <button onClick={handleZoomOut} className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded hover:bg-neo-shadow/10 text-sm font-bold" title="Zoom Out (-)">-</button>
              <button onClick={handleZoomReset} className="px-2 text-xs font-bold min-w-[3rem]" title="Reset Zoom (0)">{Math.round(scale * 100)}%</button>
              <button onClick={handleZoomIn} className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded hover:bg-neo-shadow/10 text-sm font-bold" title="Zoom In (+)">+</button>
            </div>

            {/* Adjust & Actions */}
            <div className="flex items-center gap-1 bg-neo-bg p-1 rounded-neo shadow-neo-sm md:shadow-none pointer-events-auto">
               <div className="relative flex items-center shrink-0">
                  <button
                    onClick={() => { setShowSettings(!showSettings); setShowShapes(false); setShowColors(false); }}
                    className={`flex items-center justify-center h-8 md:h-auto px-2 md:px-3 md:py-1.5 rounded-neo transition-all text-xs md:text-sm font-bold gap-1 ${showSettings ? 'shadow-neo-inset text-neo-accent bg-neo-bg' : 'hover:bg-neo-shadow/10 text-neo-text'}`}
                  >
                    <span>Adjust ▾</span>
                  </button>
                  
                  {showSettings && (
                    <div className="absolute bottom-full md:bottom-auto md:top-full left-1/2 -translate-x-1/2 mb-2 md:mb-0 md:mt-2 p-4 bg-neo-bg rounded-neo shadow-neo-md flex flex-col gap-4 min-w-[250px] z-[100]">
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
              <div className="w-px h-4 bg-neo-shadow/20 mx-1"></div>
              <Button onClick={() => guardAction('draw', handleUndo)} variant="secondary" className={`!px-2 !py-1 text-xs ${!can('draw') ? 'opacity-50' : ''}`} title="Undo (Ctrl+Z)">↶</Button>
              <Button onClick={() => guardAction('draw', redo)} variant="secondary" className={`!px-2 !py-1 text-xs ${!can('draw') ? 'opacity-50' : ''}`} title="Redo (Ctrl+Y)">↷</Button>
              <Button onClick={() => guardAction('clear_board', handleClear)} variant="secondary" className={`!px-2 !py-1 text-xs hidden sm:inline-flex ${!can('clear_board') ? 'opacity-50' : ''}`}>Clear</Button>
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
