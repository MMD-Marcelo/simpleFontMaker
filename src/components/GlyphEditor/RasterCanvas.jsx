import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { pushUndo, popUndo, pushRedo, popRedo, clearHistory } from '../../lib/glyphHistory.js'
import GuideLines from './GuideLines.jsx'
import styles from './RasterCanvas.module.css'
import { GLYPH_W, GLYPH_H } from '../../lib/templateSheet.js'

const BASELINE = 0.75
const CAP = 0.20

const RasterCanvas = forwardRef(function RasterCanvas({ initialData, char, unicode, guidelines, onChange }, ref) {
  const ghostRef = useRef()
  const canvasRef = useRef()
  const drawing = useRef(false)
  const lastPos = useRef(null)
  const lastUrl = useRef(initialData || null)
  const smoothPoints = useRef([])
  const lassoPoints = useRef([])
  const lassoBase = useRef(null)
  const { activeTool, brushSize, brushShape, smoothing, zoom } = useEditorStore()

  function dpr() { return window.devicePixelRatio || 1 }

  function setupCanvas(canvas) {
    const d = dpr()
    canvas.width = GLYPH_W * d
    canvas.height = GLYPH_H * d
    const ctx = canvas.getContext('2d')
    ctx.scale(d, d)
    return ctx
  }

  function drawGhost() {
    const ghost = ghostRef.current
    if (!ghost) return
    const ctx = setupCanvas(ghost)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, GLYPH_W, GLYPH_H)
    if (char && char.trim()) {
      const targetCapH = (BASELINE - CAP) * GLYPH_H
      const fontSize = Math.round(targetCapH / 0.72)
      ctx.font = `${fontSize}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = 'rgba(0,0,0,0.07)'
      ctx.fillText(char, GLYPH_W / 2, GLYPH_H * BASELINE)
    }
  }

  useEffect(() => {
    drawGhost()
    const ctx = setupCanvas(canvasRef.current)
    if (initialData) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, GLYPH_W, GLYPH_H)
      img.src = initialData
    }
    clearHistory(unicode)
  }, [])

  useEffect(() => { drawGhost() }, [char])

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (GLYPH_W / rect.width),
      y: (clientY - rect.top) * (GLYPH_H / rect.height),
    }
  }

  function snapshot() {
    const d = dpr()
    return canvasRef.current.getContext('2d').getImageData(0, 0, GLYPH_W * d, GLYPH_H * d)
  }

  // ---------------------------------------------------------------------------
  // Context setup — always resets lineDash to prevent lasso leak
  // ---------------------------------------------------------------------------

  function prepareCtx(ctx) {
    ctx.setLineDash([])
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth = brushSize * 3
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = ctx.fillStyle = '#000000'
      ctx.lineWidth = brushSize
    }
    ctx.lineJoin = 'round'
  }

  // ---------------------------------------------------------------------------
  // Stroke-based drawing (round and square use native canvas lineTo)
  // ---------------------------------------------------------------------------

  function beginStroke(ctx, pos) {
    prepareCtx(ctx)
    const shape = activeTool === 'eraser' ? 'round' : brushShape
    ctx.lineCap = shape === 'square' ? 'square' : 'round'
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    // Stamp a dot at the click point
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function continueStroke(ctx, pos) {
    if (smoothing && activeTool === 'brush') {
      smoothPoints.current.push(pos)
      const pts = smoothPoints.current
      if (pts.length >= 3) {
        const p1 = pts[pts.length - 2]
        const p2 = pts[pts.length - 1]
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(mid.x, mid.y)
      }
    } else {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }

  // ---------------------------------------------------------------------------
  // Calligraphy — stamp-based (angled flat ellipse)
  // ---------------------------------------------------------------------------

  function stampCalligraphy(ctx, x, y, size) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-Math.PI / 4)
    ctx.scale(0.28, 1)
    ctx.beginPath()
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function stampCalligraphySegment(ctx, from, to, size) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const step = Math.max(0.5, size * 0.08)
    const steps = Math.ceil(dist / step)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      stampCalligraphy(ctx, from.x + dx * t, from.y + dy * t, size)
    }
  }

  // ---------------------------------------------------------------------------
  // Flood fill
  // ---------------------------------------------------------------------------

  function floodFill(ctx, startX, startY) {
    const dprVal = dpr()
    const pw = GLYPH_W * dprVal
    const ph = GLYPH_H * dprVal
    const imageData = ctx.getImageData(0, 0, pw, ph)
    const data = imageData.data

    const sx = Math.round(startX * dprVal)
    const sy = Math.round(startY * dprVal)
    if (sx < 0 || sx >= pw || sy < 0 || sy >= ph) return

    function isInk(i) {
      return data[i + 3] > 128 && (data[i] + data[i + 1] + data[i + 2]) < 200
    }

    if (isInk((sy * pw + sx) * 4)) return

    const stack = [sx + sy * pw]
    const visited = new Uint8Array(pw * ph)

    while (stack.length) {
      const pos = stack.pop()
      if (visited[pos]) continue
      visited[pos] = 1
      const i = pos * 4
      if (isInk(i)) continue

      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255

      const x = pos % pw
      const y = (pos - x) / pw
      if (x > 0) stack.push(pos - 1)
      if (x < pw - 1) stack.push(pos + 1)
      if (y > 0) stack.push(pos - pw)
      if (y < ph - 1) stack.push(pos + pw)
    }

    ctx.putImageData(imageData, 0, 0)
  }

  // ---------------------------------------------------------------------------
  // Lasso fill — draw a closed shape, fills the interior on release
  // ---------------------------------------------------------------------------

  function updateLasso(ctx, pos) {
    if (!lassoBase.current) return
    ctx.putImageData(lassoBase.current, 0, 0)
    lassoPoints.current.push(pos)
    const pts = lassoPoints.current
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
    ctx.restore()
  }

  function commitLasso(ctx) {
    if (!lassoBase.current) return
    ctx.putImageData(lassoBase.current, 0, 0)  // always remove the preview
    const pts = lassoPoints.current
    if (pts.length >= 3) {
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#000000'
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    lassoPoints.current = []
    lassoBase.current = null
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function startDraw(e) {
    e.preventDefault()
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')

    if (activeTool === 'fill') {
      pushUndo(unicode, snapshot())
      floodFill(ctx, pos.x, pos.y)
      onChange(exportUrl())
      return
    }

    pushUndo(unicode, snapshot())
    drawing.current = true
    lastPos.current = pos
    smoothPoints.current = [pos]

    if (brushShape === 'lasso' && activeTool === 'brush') {
      lassoBase.current = snapshot()
      lassoPoints.current = [pos]
      return
    }

    if (brushShape === 'calligraphy' && activeTool === 'brush') {
      prepareCtx(ctx)
      stampCalligraphy(ctx, pos.x, pos.y, brushSize)
      return
    }

    beginStroke(ctx, pos)
  }

  function draw(e) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)

    if (brushShape === 'lasso' && activeTool === 'brush') {
      updateLasso(ctx, pos)
      lastPos.current = pos
      return
    }

    if (brushShape === 'calligraphy' && activeTool === 'brush') {
      prepareCtx(ctx)
      if (smoothing) {
        smoothPoints.current.push(pos)
        const pts = smoothPoints.current
        if (pts.length >= 3) {
          const p1 = pts[pts.length - 2]
          const p2 = pts[pts.length - 1]
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
          // Stamp along the quadratic bezier arc
          const dist = Math.hypot(mid.x - lastPos.current.x, mid.y - lastPos.current.y)
          const step = Math.max(0.5, brushSize * 0.08)
          const N = Math.max(1, Math.ceil(dist / step))
          for (let i = 1; i <= N; i++) {
            const t = i / N, mt = 1 - t
            const bx = mt*mt*lastPos.current.x + 2*mt*t*p1.x + t*t*mid.x
            const by = mt*mt*lastPos.current.y + 2*mt*t*p1.y + t*t*mid.y
            stampCalligraphy(ctx, bx, by, brushSize)
          }
          lastPos.current = mid
        }
      } else {
        stampCalligraphySegment(ctx, lastPos.current, pos, brushSize)
        lastPos.current = pos
      }
      return
    }

    // Round or square (and eraser) — native stroke
    prepareCtx(ctx)
    ctx.lineCap = (activeTool === 'eraser' || brushShape === 'round') ? 'round' : 'square'
    continueStroke(ctx, pos)
    lastPos.current = pos
  }

  const STORE_W = Math.round(GLYPH_W / 2)
  const STORE_H = Math.round(GLYPH_H / 2)

  function exportUrl() {
    const tmp = document.createElement('canvas')
    tmp.width = STORE_W
    tmp.height = STORE_H
    const ctx = tmp.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, STORE_W, STORE_H)
    ctx.drawImage(canvasRef.current, 0, 0, STORE_W, STORE_H)
    return tmp.toDataURL('image/png')
  }

  function endDraw() {
    if (!drawing.current) return
    drawing.current = false
    const ctx = canvasRef.current.getContext('2d')

    if (brushShape === 'lasso' && activeTool === 'brush') {
      commitLasso(ctx)
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.setLineDash([])
    const url = exportUrl()
    lastUrl.current = url
    onChange(url)
  }

  function handleUndo() {
    const snap = popUndo(unicode)
    if (!snap) return
    const d = dpr()
    const ctx = canvasRef.current.getContext('2d')
    pushRedo(unicode, ctx.getImageData(0, 0, GLYPH_W * d, GLYPH_H * d))
    ctx.clearRect(0, 0, GLYPH_W, GLYPH_H)
    ctx.putImageData(snap, 0, 0)
    onChange(exportUrl())
  }

  function handleRedo() {
    const snap = popRedo(unicode)
    if (!snap) return
    const d = dpr()
    const ctx = canvasRef.current.getContext('2d')
    pushUndo(unicode, ctx.getImageData(0, 0, GLYPH_W * d, GLYPH_H * d))
    ctx.clearRect(0, 0, GLYPH_W, GLYPH_H)
    ctx.putImageData(snap, 0, 0)
    onChange(exportUrl())
  }

  function handleClear() {
    pushUndo(unicode, snapshot())
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, GLYPH_W, GLYPH_H)
    onChange(exportUrl())
  }

  function handleLoadImage(src) {
    const img = new Image()
    img.onload = () => {
      pushUndo(unicode, snapshot())
      const d = dpr()
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, GLYPH_W, GLYPH_H)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, GLYPH_W, GLYPH_H)
      ctx.drawImage(img, 0, 0, GLYPH_W, GLYPH_H)
      const pw = GLYPH_W * d, ph = GLYPH_H * d
      const imageData = ctx.getImageData(0, 0, pw, ph)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const b = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        if (b < 160) { data[i] = data[i+1] = data[i+2] = 0; data[i+3] = 255 }
        else { data[i] = data[i+1] = data[i+2] = 255; data[i+3] = 255 }
      }
      ctx.putImageData(imageData, 0, 0)
      onChange(exportUrl())
    }
    img.src = src
  }

  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    clear: handleClear,
    loadImage: handleLoadImage,
  }))

  return (
    <div className={styles.wrapper} style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
      <canvas ref={ghostRef} className={styles.layer} />
      <canvas
        ref={canvasRef}
        className={styles.layer}
        style={{ cursor: activeTool === 'eraser' ? 'cell' : 'crosshair' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {guidelines && <GuideLines guidelines={guidelines} />}
    </div>
  )
})

export default RasterCanvas
