'use client';

import React from 'react';
import { useDrawing, Tool } from '@/lib/store';
import { Button } from './ui/Button';

const TOOLS: Tool[] = ['brush', 'rectangle', 'circle', 'line', 'text'];
const COLORS = ['#565656', '#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FFFFFF'];

export const Toolbar: React.FC = () => {
  const { tool, setTool, color, setColor, undo, redo, clearCanvas } = useDrawing();

  return (
    <div className="flex gap-4 p-4 bg-neo-bg rounded-neo shadow-neo-md items-center mx-auto w-max max-w-full overflow-x-auto">
      {/* Tool Selector */}
      <div className="flex gap-2">
        {TOOLS.map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`px-4 py-2 rounded-neo transition-all ${
              tool === t
                ? 'shadow-neo-inset font-bold text-neo-accent'
                : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
            }`}
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
            onClick={() => setColor(c)}
            className={`w-8 h-8 rounded-full shrink-0 transition-transform hover:scale-110 active:scale-95 ${
              color === c ? 'shadow-neo-md border-2 border-neo-bg ring-2 ring-neo-accent' : 'shadow-neo-sm border border-transparent'
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Select color ${c}`}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="ml-2 border-l-2 border-neo-shadow/50 pl-6 flex gap-3">
        <Button onClick={undo} variant="secondary">↶ Undo</Button>
        <Button onClick={redo} variant="secondary">↷ Redo</Button>
        <Button onClick={clearCanvas}>Clear</Button>
      </div>
    </div>
  );
};
