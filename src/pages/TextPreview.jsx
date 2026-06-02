import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import { GLYPH_W, GLYPH_H } from '../lib/templateSheet.js'
import styles from './TextPreview.module.css'

const LINE_H = 160
const GLYPH_DW = Math.round(LINE_H * (GLYPH_W / GLYPH_H))
const PADDING = 24
const LINE_GAP = 28
// Consistent gap added on the right of every glyph's ink edge.
const INK_MARGIN_PX = 8

const DEFAULT_TEXT =
  'The quick brown fox jumps over the lazy dog.\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789'

function loadImg(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Returns the left and right ink boundaries (in GLYPH_DW × LINE_H pixel space).
// leftInk: first column with a dark pixel.
// rightInk: last column with a dark pixel + 1.
// Callers place each glyph so its leftInk aligns with the current cursor position,
// then advance the cursor by (rightInk - leftInk) + INK_MARGIN_PX.
// This gives a fixed visual gap between every pair of glyphs regardless of their widths.
function measureInkBounds(img) {
  if (!img) return { leftInk: 0, rightInk: GLYPH_DW }
  const tmp = document.createElement('canvas')
  tmp.width = GLYPH_DW
  tmp.height = LINE_H
  const ctx = tmp.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, GLYPH_DW, LINE_H)
  const { data } = ctx.getImageData(0, 0, GLYPH_DW, LINE_H)
  let left = GLYPH_DW
  let right = -1
  for (let y = 0; y < LINE_H; y++) {
    for (let x = 0; x < GLYPH_DW; x++) {
      const i = (y * GLYPH_DW + x) * 4
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) {
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (right < 0) return { leftInk: 0, rightInk: GLYPH_DW }
  return { leftInk: left, rightInk: right + 1 }
}

export default function TextPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects, updateProject, updateGlyph, setActiveProject } = useProjectStore()
  const [text, setText] = useState(DEFAULT_TEXT)
  const [selectedUnicode, setSelectedUnicode] = useState(null)
  const canvasRef = useRef()
  const wrapRef = useRef()
  const charPositionsRef = useRef([])
  const selectedUnicodeRef = useRef(null)
  const selectedOccurrenceRef = useRef(null)  // {unicode, x, y} of the clicked slot
  const cleanImageDataRef = useRef(null)       // canvas pixels without any overlay box

  const project = projects[id]
  useEffect(() => { setActiveProject(id) }, [id])
  if (!project) return <p>Project not found.</p>

  const letterSpacing = project.letterSpacing ?? 0

  function setSelected(unicode, occurrence = null) {
    selectedUnicodeRef.current = unicode
    selectedOccurrenceRef.current = occurrence
    setSelectedUnicode(unicode)
  }

  function handleLetterSpacing(value) {
    updateProject(id, { letterSpacing: value })
  }

  function handleGlyphOffset(unicode, value) {
    updateGlyph(unicode, { spacingOffset: value })
  }

  function handleTypeSelect(e) {
    const raw = e.target.value
    const ch = [...raw].at(-1)
    if (!ch || !ch.trim()) { setSelected(null); return }
    const unicode = ch.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
    setSelected(unicode)
  }

  // Restores the clean (no-box) canvas, then draws exactly ONE bounding box on the
  // specific occurrence that was clicked (matched by slot position).
  function drawOverlay(unicode) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    // Always restore clean canvas first so previous boxes are erased.
    if (cleanImageDataRef.current) {
      ctx.putImageData(cleanImageDataRef.current, 0, 0)
    }
    if (!unicode) return
    const occ = selectedOccurrenceRef.current
    let pos
    if (occ && occ.unicode === unicode) {
      pos = charPositionsRef.current.find(c =>
        c.unicode === unicode && Math.abs(c.x - occ.x) < 2 && Math.abs(c.y - occ.y) < 2
      )
    }
    if (!pos) pos = charPositionsRef.current.find(c => c.unicode === unicode)
    if (!pos) return
    ctx.strokeStyle = 'rgba(70, 110, 220, 0.85)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    ctx.strokeRect(pos.x + 1, pos.y + 1, pos.w - 2, pos.h - 2)
    ctx.setLineDash([])
  }

  useEffect(() => {
    drawOverlay(selectedUnicodeRef.current)
  }, [selectedUnicode])

  useEffect(() => {
    renderText()
  }, [text, project.glyphs, letterSpacing])

  async function renderText() {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const canvasW = Math.max(wrap.clientWidth - 2, 400)

    const neededUnicodes = new Set()
    for (const ch of text) {
      if (ch === '\n') continue
      neededUnicodes.add(ch.codePointAt(0).toString(16).padStart(4, '0').toUpperCase())
    }

    const imageMap = {}
    await Promise.all(
      Array.from(neededUnicodes).map(async unicode => {
        const g = project.glyphs[unicode]
        imageMap[unicode] = g?.rasterData ? await loadImg(g.rasterData) : null
      })
    )

    // Measure ink bounds for every glyph; this drives proportional spacing.
    const inkBoundsMap = {}
    for (const unicode of neededUnicodes) {
      inkBoundsMap[unicode] = measureInkBounds(imageMap[unicode])
    }

    // cursor = position of the next glyph's LEFT INK edge (relative to PADDING).
    // advance per glyph = inkWidth + INK_MARGIN_PX + letterSpacing
    // → gap between any two consecutive glyphs' ink edges is always INK_MARGIN_PX.
    const availW = canvasW - PADDING * 2

    const renderLines = []
    for (const inputLine of text.split('\n')) {
      if (!inputLine) { renderLines.push(null); continue }
      let row = []
      let cursor = 0
      for (const ch of inputLine) {
        const unicode = ch.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
        const g = project.glyphs[unicode]
        const bounds = inkBoundsMap[unicode] ?? { leftInk: 0, rightInk: GLYPH_DW }
        const inkW = bounds.rightInk - bounds.leftInk
        const glyphExtra = letterSpacing + (g?.spacingOffset ?? 0)
        const advance = Math.max(inkW + INK_MARGIN_PX + glyphExtra, 4)
        if (cursor + advance > availW && row.length > 0) {
          renderLines.push(row)
          row = []
          cursor = 0
        }
        row.push({ ch, unicode, bounds, glyphExtra, advance })
        cursor += advance
      }
      if (row.length > 0) renderLines.push(row)
    }

    const totalH = PADDING * 2 + renderLines.reduce((acc, row) => {
      return acc + (row === null ? Math.round(LINE_H * 0.4) : LINE_H) + LINE_GAP
    }, 0)

    canvas.width = canvasW
    canvas.height = totalH

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, totalH)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const positions = []
    let y = PADDING

    for (const row of renderLines) {
      if (row === null) { y += Math.round(LINE_H * 0.4) + LINE_GAP; continue }

      // cursor is the absolute x of the current glyph's LEFT INK edge.
      let cursor = PADDING
      for (const { ch, unicode, bounds, glyphExtra, advance } of row) {
        // Shift image left so its leftmost ink aligns with cursor.
        const drawX = cursor - bounds.leftInk
        // Click / overlay slot spans the ink + margin.
        positions.push({ unicode, x: cursor, y, w: advance, h: LINE_H })
        const img = imageMap[unicode]
        if (img) {
          ctx.globalCompositeOperation = 'multiply'
          ctx.drawImage(img, drawX, y, GLYPH_DW, LINE_H)
          ctx.globalCompositeOperation = 'source-over'
        } else {
          ctx.fillStyle = '#cccccc'
          ctx.font = `${Math.round(LINE_H * 0.65)}px serif`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(ch, cursor + 2, y + Math.round(LINE_H * 0.08))
        }
        cursor += advance
      }

      y += LINE_H + LINE_GAP
      ctx.strokeStyle = '#f0f0f0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PADDING, y - LINE_GAP / 2)
      ctx.lineTo(canvasW - PADDING, y - LINE_GAP / 2)
      ctx.stroke()
    }

    charPositionsRef.current = positions
    // Snapshot the canvas before any overlay so drawOverlay can restore it cleanly.
    cleanImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    drawOverlay(selectedUnicodeRef.current)
  }

  function handleCanvasClick(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY
    const hit = charPositionsRef.current.find(c =>
      cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h
    )
    setSelected(
      hit?.unicode ?? null,
      hit ? { unicode: hit.unicode, x: hit.x, y: hit.y } : null
    )
  }

  function handleCanvasMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY
    const isOver = charPositionsRef.current.some(c =>
      cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h
    )
    canvas.style.cursor = isOver ? 'pointer' : 'default'
  }

  const selectedGlyph = selectedUnicode ? (project.glyphs[selectedUnicode] ?? null) : null
  const selectedChar = selectedUnicode
    ? String.fromCodePoint(parseInt(selectedUnicode, 16))
    : ''
  const selectedOffset = selectedGlyph?.spacingOffset ?? 0

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button onClick={() => navigate(`/project/${id}`)}>Back to {project.name}</button>
        <span className={styles.title}>Text preview — {project.name}</span>

        <label className={styles.spacingControl}>
          Letter spacing
          <input
            type="number"
            value={letterSpacing}
            onChange={e => handleLetterSpacing(Number(e.target.value))}
          />
          <span className={styles.spacingUnit}>px</span>
        </label>

        <div className={styles.charControl}>
          <label className={styles.charSelectLabel}>
            Char
            <input
              className={styles.charTypeInput}
              value={selectedChar}
              placeholder="?"
              onChange={handleTypeSelect}
              title="Type a character or click one in the preview"
            />
          </label>
          <label className={selectedUnicode ? '' : styles.disabled}>
            Offset
            <input
              type="number"
              value={selectedUnicode ? selectedOffset : 0}
              disabled={!selectedUnicode}
              onChange={e => selectedUnicode && handleGlyphOffset(selectedUnicode, Number(e.target.value))}
            />
            px
          </label>
          {selectedUnicode && selectedOffset !== 0 && (
            <button onClick={() => handleGlyphOffset(selectedUnicode, 0)}>Revert</button>
          )}
          {selectedUnicode && (
            <button className={styles.closeBtn} onClick={() => setSelected(null)}>×</button>
          )}
        </div>
      </div>

      <textarea
        className={styles.input}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="Type text to preview..."
      />
      <div className={styles.canvasWrap} ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
        />
      </div>
    </div>
  )
}
