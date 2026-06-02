// Shared canvas internal resolution — 3:4 ratio, high DPI-friendly
export const GLYPH_W = 1200
export const GLYPH_H = 1600

// Template layout — wide format, 12 columns, 3:4 cells
const PAGE_W = 3508            // ~A4 landscape width at 300 DPI
const COLS = 12
const MARGIN = 80
export const CELL_W = Math.floor((PAGE_W - MARGIN * 2) / COLS)  // 279
export const CELL_H = Math.round(CELL_W * 4 / 3)                // 372 — keeps 3:4 ratio
const HEADER_H = 220

// Threshold for import: pixels darker than this are ink, lighter become white
const THRESHOLD = 160

function computeLayout(chars) {
  const rows = Math.ceil(chars.length / COLS)
  const pageH = MARGIN + HEADER_H + rows * CELL_H + MARGIN
  return { rows, pageH }
}

function cellRect(index) {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return {
    x: MARGIN + col * CELL_W,
    y: MARGIN + HEADER_H + row * CELL_H,
    w: CELL_W,
    h: CELL_H,
  }
}

// Remove template artifacts: keep only dark ink, make everything else white
function applyThreshold(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const brightness = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    if (brightness < THRESHOLD) {
      d[i] = d[i + 1] = d[i + 2] = 0
      d[i + 3] = 255
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255
      d[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function drawCell(ctx, rect, char) {
  const { x, y, w, h } = rect

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)

  // Horizontal guide lines: cap height, x-height, baseline, descender
  // All well above threshold (brightness > 230) so removed on import
  const guides = [
    { t: 0.20, dash: [6, 4] },  // cap height
    { t: 0.50, dash: [6, 4] },  // x-height
    { t: 0.75, dash: [8, 0] },  // baseline — solid
    { t: 0.88, dash: [6, 4] },  // descender
  ]
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  guides.forEach(({ t, dash }) => {
    ctx.setLineDash(dash)
    ctx.beginPath()
    ctx.moveTo(x, y + h * t)
    ctx.lineTo(x + w, y + h * t)
    ctx.stroke()
  })
  ctx.setLineDash([])

  // Cell border
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)

  // Character label top-left — brightness ~178, above threshold, removed on import
  ctx.fillStyle = 'rgba(0,0,0,0.30)'
  ctx.font = '18px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const code = char.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
  ctx.fillText(code, x + 6, y + 6)

  // Ghost character — 10% opacity, brightness ~229, well above threshold 160
  const targetCapH = (0.75 - 0.20) * h
  const ghostSize = Math.round(targetCapH / 0.72)
  ctx.font = `${ghostSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  ctx.fillText(char, x + w / 2, y + h * 0.75)
}

export function generateTemplateCanvas(chars, projectName) {
  const { pageH } = computeLayout(chars)
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_W
  canvas.height = pageH
  const ctx = canvas.getContext('2d')

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_W, pageH)

  // Header
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 80px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`${projectName} template`, MARGIN, MARGIN)

  ctx.fillStyle = '#888888'
  ctx.font = '36px sans-serif'
  ctx.fillText(
    'Create a new layer in the software of your preference, use the boxes as guides and import only the new layer to the site.',
    MARGIN,
    MARGIN + 104
  )

  // Separator line below header
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(MARGIN, MARGIN + HEADER_H - 10)
  ctx.lineTo(PAGE_W - MARGIN, MARGIN + HEADER_H - 10)
  ctx.stroke()

  chars.forEach((char, i) => drawCell(ctx, cellRect(i), char))

  return canvas
}

export function downloadTemplate(chars, projectName) {
  const canvas = generateTemplateCanvas(chars, projectName)
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName.replace(/\s+/g, '-')}-template.png`
  a.click()
}

const BORDER = 2

export function extractGlyphsFromSheet(file, chars) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { pageH } = computeLayout(chars)
      const scaleX = img.width / PAGE_W
      const scaleY = img.height / pageH
      const results = {}

      chars.forEach((char, i) => {
        const { x, y, w, h } = cellRect(i)
        const sx = Math.round((x + BORDER) * scaleX)
        const sy = Math.round((y + BORDER) * scaleY)
        const sw = Math.round((w - BORDER * 2) * scaleX)
        const sh = Math.round((h - BORDER * 2) * scaleY)
        if (sw <= 0 || sh <= 0) return

        const storeW = Math.round(GLYPH_W / 2)
        const storeH = Math.round(GLYPH_H / 2)
        const tmp = document.createElement('canvas')
        tmp.width = storeW
        tmp.height = storeH
        const ctx = tmp.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, storeW, storeH)
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, storeW, storeH)

        applyThreshold(ctx, storeW, storeH)

        const unicode = char.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
        results[unicode] = tmp.toDataURL('image/png')
      })

      URL.revokeObjectURL(img.src)
      resolve(results)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}
