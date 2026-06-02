import { imageTracer } from 'imagetracer'

const OPTIONS_SMOOTH = {
  ltres: 1, qtres: 1, pathomit: 8,
  numberofcolors: 2, mincolorratio: 0, colorquantcycles: 3,
}

const OPTIONS_PRECISE = {
  ltres: 0.1, qtres: 0.1, pathomit: 0,
  numberofcolors: 2, mincolorratio: 0, colorquantcycles: 3,
}

function loadImageData(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve({ imageData: ctx.getImageData(0, 0, img.width, img.height), width: img.width, height: img.height })
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataURL
  })
}

export function rasterDataToSVGPaths(dataURL, smooth = false) {
  return loadImageData(dataURL).then(({ imageData }) => {
    const svgString = imageTracer.imageDataToSVG(imageData, smooth ? OPTIONS_SMOOTH : OPTIONS_PRECISE)
    return extractPathsFromSVG(svgString)
  })
}

export function rasterDataToSVGString(dataURL, smooth = false) {
  return loadImageData(dataURL).then(({ imageData, width, height }) => {
    return imageTracer.imageDataToSVG(imageData, smooth ? OPTIONS_SMOOTH : OPTIONS_PRECISE)
  })
}

export function downloadGlyphAsSVG(rasterData, char, smooth = false) {
  return rasterDataToSVGString(rasterData, smooth).then(svgString => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${char || 'glyph'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  })
}

function parseFillBrightness(fill) {
  if (!fill || fill === 'none') return 255
  fill = fill.trim()
  let r, g, b
  if (fill.startsWith('#')) {
    const h = fill.slice(1)
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else {
    const m = fill.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
    if (!m) return 0
    r = +m[1]; g = +m[2]; b = +m[3]
  }
  return r * 0.299 + g * 0.587 + b * 0.114
}

// Returns true when the path's first point is within 2px of the image boundary.
// imagetracer always places the background path starting at/near (0,0).
// Counter paths (interior holes like inside 'O' or 'A') start inside the image.
function pathStartsAtBoundary(d, w, h) {
  const m = d.match(/M[\s,]*([\d.]+)[\s,]+([\d.]+)/)
  if (!m) return true
  const x = parseFloat(m[1]), y = parseFloat(m[2])
  const edge = 2
  return x <= edge || y <= edge || x >= w - edge || y >= h - edge
}

// Returns { d, isHole } objects so fontBuilder can apply the correct winding.
// isHole=false → outer glyph body (dark fill)
// isHole=true  → counter / interior hole (light fill, not the background rectangle)
function extractPathsFromSVG(svgString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  const w = parseFloat(svg?.getAttribute('width') || '600')
  const h = parseFloat(svg?.getAttribute('height') || '800')

  return Array.from(doc.querySelectorAll('path'))
    .map(p => {
      const d = p.getAttribute('d') || ''
      const brightness = parseFillBrightness(p.getAttribute('fill'))
      const isHole = brightness >= 128
      return { d, isHole }
    })
    .filter(({ d, isHole }) => {
      if (!d) return false
      if (!isHole) return true  // dark path: glyph body — always keep
      // light path: keep only if it starts inside the image (counter/hole)
      return !pathStartsAtBoundary(d, w, h)
    })
}
