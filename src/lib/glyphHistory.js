const histories = new Map() // unicode → { undo: ImageData[], redo: ImageData[] }

function get(unicode) {
  if (!histories.has(unicode)) histories.set(unicode, { undo: [], redo: [] })
  return histories.get(unicode)
}

export function pushUndo(unicode, snapshot) {
  const h = get(unicode)
  h.undo = [...h.undo.slice(-49), snapshot]
  h.redo = []
}

export function popUndo(unicode) {
  const h = get(unicode)
  if (!h.undo.length) return null
  return h.undo.pop()
}

export function pushRedo(unicode, snapshot) {
  get(unicode).redo.push(snapshot)
}

export function popRedo(unicode) {
  const h = get(unicode)
  if (!h.redo.length) return null
  return h.redo.pop()
}

export function clearHistory(unicode) {
  histories.set(unicode, { undo: [], redo: [] })
}
