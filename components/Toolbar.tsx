'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useDrawing, Tool } from '@/lib/store';
import { Button } from './ui/Button';
import { pb } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionDeniedDialog } from './PermissionDeniedDialog';
import type { Role, Action } from '@/lib/security/permissions';

const TOOLS: Tool[] = ['brush', 'rectangle', 'circle', 'line', 'text'];
const COLORS = ['#565656', '#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FFFFFF'];

interface ToolbarProps {
  roomId?: string;
  role?: Role | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({ roomId, role = null }) => {
  const { tool, setTool, color, setColor, undo, redo, clearCanvas } = useDrawing();
  const { can, requestPermission } = usePermissions(roomId || '', role);
  const [deniedAction, setDeniedAction] = useState<Action | null>(null);

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

  const handleClear = async () => {
    const confirmed = window.confirm("Are you sure you want to clear the entire canvas? This action cannot be undone.");
    if (!confirmed) return;

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

  // Keyboard Shortcuts
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, redo, can]);

  return (
    <>
      <div className="flex gap-4 p-4 bg-neo-bg rounded-neo shadow-neo-md items-center mx-auto w-max max-w-full overflow-x-auto">
        {/* Tool Selector */}
        <div className="flex gap-2">
          {TOOLS.map((t) => (
            <button
              key={t}
              onClick={() => guardAction('draw', () => setTool(t))}
              className={`px-4 py-2 rounded-neo transition-all ${
                tool === t
                  ? 'shadow-neo-inset font-bold text-neo-accent'
                  : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
              } ${!can('draw') ? 'opacity-50' : ''}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Color Picker */}
        <div className="flex gap-3 ml-2 border-l-2 border-neo-shadow/50 pl-6 items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => guardAction('draw', () => setColor(c))}
              className={`w-8 h-8 rounded-full shrink-0 transition-transform hover:scale-110 active:scale-95 ${
                color === c ? 'shadow-neo-md border-2 border-neo-bg ring-2 ring-neo-accent' : 'shadow-neo-sm border border-transparent'
              } ${!can('draw') ? 'opacity-50' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="ml-2 border-l-2 border-neo-shadow/50 pl-6 flex gap-3">
          <Button
            onClick={() => guardAction('draw', handleUndo)}
            variant="secondary"
            className={!can('draw') ? 'opacity-50' : ''}
          >
            ↶ Undo
          </Button>
          <Button
            onClick={() => guardAction('draw', redo)}
            variant="secondary"
            className={!can('draw') ? 'opacity-50' : ''}
          >
            ↷ Redo
          </Button>
          <Button
            onClick={() => guardAction('clear_board', handleClear)}
            className={!can('clear_board') ? 'opacity-50' : ''}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Permission Denied Dialog */}
      <PermissionDeniedDialog
        action={deniedAction || 'draw'}
        isOpen={deniedAction !== null}
        onClose={() => setDeniedAction(null)}
        onRequestPermission={requestPermission}
      />
    </>
  );
};
