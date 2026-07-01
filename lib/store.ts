import { create } from 'zustand';

export type Tool = 'brush' | 'rectangle' | 'circle' | 'line' | 'text';

export interface Cursor {
  x: number;
  y: number;
  color: string;
  name?: string;
}

export interface DrawingState {
  tool: Tool;
  color: string;
  strokeWidth: number;
  strokes: Array<any>;
  history: Array<any[]>;
  redoStack: Array<any[]>;
  cursors: Record<string, Cursor>;
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  addStroke: (stroke: any) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  setCursor: (userId: string, x: number, y: number, color?: string, name?: string) => void;
  removeCursor: (userId: string) => void;
  setStrokes: (strokes: any[]) => void;
}

export const useDrawing = create<DrawingState>((set) => ({
  tool: 'brush',
  color: '#565656',
  strokeWidth: 2,
  strokes: [],
  history: [[]],
  redoStack: [],
  cursors: {},
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  addStroke: (stroke) => set((state) => ({
    strokes: [...state.strokes, stroke],
    history: [...state.history, [...state.strokes, stroke]],
    redoStack: [], // clearing redo stack on new action
  })),
  setStrokes: (strokes) => set({ strokes, history: [strokes], redoStack: [] }),
  setCursor: (userId, x, y, color = '#565656', name = 'Anonymous') => set((state) => ({
    cursors: {
      ...state.cursors,
      [userId]: { x, y, color, name }
    }
  })),
  removeCursor: (userId) => set((state) => {
    const newCursors = { ...state.cursors };
    delete newCursors[userId];
    return { cursors: newCursors };
  }),
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
