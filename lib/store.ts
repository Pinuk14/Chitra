import { create } from 'zustand';

export type Tool = 'brush' | 'rectangle' | 'circle' | 'line' | 'text';

export interface DrawingState {
  tool: Tool;
  color: string;
  strokeWidth: number;
  strokes: Array<any>;
  history: Array<any[]>;
  redoStack: Array<any[]>;
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  addStroke: (stroke: any) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
}

export const useDrawing = create<DrawingState>((set) => ({
  tool: 'brush',
  color: '#565656',
  strokeWidth: 2,
  strokes: [],
  history: [[]],
  redoStack: [],
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  addStroke: (stroke) => set((state) => ({
    strokes: [...state.strokes, stroke],
    history: [...state.history, [...state.strokes, stroke]],
    redoStack: [], // clearing redo stack on new action
  })),
  undo: () => set((state) => {
    if (state.history.length <= 1) return state; // nothing to undo
    
    const newHistory = state.history.slice(0, -1);
    const prevStrokes = newHistory[newHistory.length - 1];
    
    return { 
      strokes: prevStrokes, 
      history: newHistory,
      redoStack: [state.strokes, ...state.redoStack]
    };
  }),
  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    
    const nextStrokes = state.redoStack[0];
    return {
      strokes: nextStrokes,
      history: [...state.history, nextStrokes],
      redoStack: state.redoStack.slice(1)
    };
  }),
  clearCanvas: () => set({ strokes: [], history: [[]], redoStack: [] }),
}));
