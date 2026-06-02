import { create } from 'zustand'

export const useEditorStore = create((set, get) => ({
  activeTool: 'brush',
  brushSize: 8,
  brushShape: 'round',  // 'round' | 'square' | 'calligraphy' | 'lasso'
  zoom: 1,
  smoothing: false,
  drawingMode: 'raster',
  undoStack: [],
  redoStack: [],

  setTool(tool) { set({ activeTool: tool }) },
  setBrushSize(size) { set({ brushSize: size }) },
  setBrushShape(shape) { set({ brushShape: shape }) },
  setZoom(zoom) { set({ zoom }) },
  setDrawingMode(mode) { set({ drawingMode: mode }) },
  toggleSmoothing() { set(s => ({ smoothing: !s.smoothing })) },

  pushUndo(snapshot) {
    set(s => ({
      undoStack: [...s.undoStack.slice(-49), snapshot],
      redoStack: [],
    }))
  },

  popUndo() {
    const { undoStack } = get()
    if (!undoStack.length) return null
    const snapshot = undoStack[undoStack.length - 1]
    set(s => ({ undoStack: s.undoStack.slice(0, -1) }))
    return snapshot
  },

  pushRedo(snapshot) {
    set(s => ({ redoStack: [...s.redoStack, snapshot] }))
  },

  popRedo() {
    const { redoStack } = get()
    if (!redoStack.length) return null
    const snapshot = redoStack[redoStack.length - 1]
    set(s => ({ redoStack: s.redoStack.slice(0, -1) }))
    return snapshot
  },

  clearHistory() { set({ undoStack: [], redoStack: [] }) },
}))
