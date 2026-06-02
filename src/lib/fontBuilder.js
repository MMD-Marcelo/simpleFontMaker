import { Font, Glyph, Path } from 'opentype.js'
import { rasterDataToSVGPaths } from './tracer.js'
import { svgPathToCommands } from './svgPathParser.js'
import { GLYPH_W, GLYPH_H } from './templateSheet.js'

const STORE_W = Math.round(GLYPH_W / 2)  // 600
const STORE_H = Math.round(GLYPH_H / 2)  // 800

const BASELINE_PX = STORE_H * 0.75   // 600
const CAP_PX      = STORE_H * 0.20   // 160
const FONT_SCALE  = 800 / (BASELINE_PX - CAP_PX)  // ≈ 1.818

const PREVIEW_GLYPH_DW = Math.round(160 * GLYPH_W / GLYPH_H)  // 120px
const LS_TO_FONT_UNITS = (STORE_W * FONT_SCALE) / PREVIEW_GLYPH_DW  // ≈ 9.09

const INK_MARGIN = 60

// ---------------------------------------------------------------------------
// Contour utilities
// ---------------------------------------------------------------------------

// Signed area via shoelace (positive = CCW in Y-up = outer for CFF/PostScript).
function contourSignedArea(cmds) {
  let area = 0
  let sx = 0, sy = 0, px = 0, py = 0
  for (const cmd of cmds) {
    if (cmd.type === 'M') {
      sx = px = cmd.x; sy = py = cmd.y
    } else if (cmd.type === 'L') {
      area += px * cmd.y - cmd.x * py
      px = cmd.x; py = cmd.y
    } else if (cmd.type === 'C') {
      area += px * cmd.y - cmd.x * py
      px = cmd.x; py = cmd.y
    } else if (cmd.type === 'Z') {
      area += px * sy - sx * py
    }
  }
  return area / 2
}

// Ray-casting point-in-contour. Cubic beziers are subdivided into 8 segments each.
function pointInContour(px, py, cmds) {
  let inside = false
  let sx = 0, sy = 0, cx = 0, cy = 0

  function testSeg(x1, y1, x2, y2) {
    if ((y2 > py) !== (y1 > py) && px < (x2 - x1) * (py - y1) / (y2 - y1) + x1) {
      inside = !inside
    }
  }

  for (const cmd of cmds) {
    if (cmd.type === 'M') {
      sx = cx = cmd.x; sy = cy = cmd.y
    } else if (cmd.type === 'L') {
      testSeg(cx, cy, cmd.x, cmd.y)
      cx = cmd.x; cy = cmd.y
    } else if (cmd.type === 'C') {
      const N = 8
      let bx0 = cx, by0 = cy
      for (let k = 1; k <= N; k++) {
        const t = k / N, u = 1 - t
        const bx = u*u*u*cx + 3*u*u*t*cmd.x1 + 3*u*t*t*cmd.x2 + t*t*t*cmd.x
        const by = u*u*u*cy + 3*u*u*t*cmd.y1 + 3*u*t*t*cmd.y2 + t*t*t*cmd.y
        testSeg(bx0, by0, bx, by)
        bx0 = bx; by0 = by
      }
      cx = cmd.x; cy = cmd.y
    } else if (cmd.type === 'Z') {
      testSeg(cx, cy, sx, sy)
      cx = sx; cy = sy
    }
  }
  return inside
}

// Split flat command list into per-contour arrays (each M…Z is one contour).
function splitContours(cmds) {
  const out = []
  let cur = []
  for (const cmd of cmds) {
    cur.push(cmd)
    if (cmd.type === 'Z') { out.push(cur); cur = [] }
  }
  if (cur.length) out.push(cur)
  return out
}

// Reverse the winding of a single closed contour.
function reverseContour(cmds) {
  const hasZ = cmds[cmds.length - 1]?.type === 'Z'
  const pts = hasZ ? cmds.slice(0, -1) : [...cmds]
  if (pts.length < 2) return cmds

  const last = pts[pts.length - 1]
  const result = [{ type: 'M', x: last.x, y: last.y }]

  for (let i = pts.length - 1; i >= 1; i--) {
    const from = pts[i]
    const to = pts[i - 1]
    if (from.type === 'C') {
      result.push({ type: 'C', x1: from.x2, y1: from.y2, x2: from.x1, y2: from.y1, x: to.x, y: to.y })
    } else {
      result.push({ type: 'L', x: to.x, y: to.y })
    }
  }

  if (hasZ) result.push({ type: 'Z' })
  return result
}

// Fix winding using nesting depth (CFF/PostScript convention):
//   depth even (outer) → CCW → positive area
//   depth odd  (hole)  → CW  → negative area
// imagetracer represents letter counters as inner CCW dark contours; using
// nesting depth on the dark paths alone avoids double-counting the hole boundary.
function fixContourWindings(contours) {
  return contours.map((contour, i) => {
    const mCmd = contour.find(c => c.type === 'M')
    if (!mCmd) return contour

    let depth = 0
    for (let j = 0; j < contours.length; j++) {
      if (j !== i && pointInContour(mCmd.x, mCmd.y, contours[j])) depth++
    }

    const area = contourSignedArea(contour)
    const shouldBeOuter = depth % 2 === 0
    const isOuter = area > 0  // positive = CCW = outer in CFF

    return shouldBeOuter === isOuter ? contour : reverseContour(contour)
  })
}

// ---------------------------------------------------------------------------

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function buildOpenTypeGlyph(unicode, glyph, globalLetterSpacing) {
  let svgPathItems
  if (glyph.mode === 'raster' && glyph.rasterData) {
    svgPathItems = await rasterDataToSVGPaths(glyph.rasterData, glyph.smoothing)
  } else {
    svgPathItems = (glyph.svgPaths ?? []).map(d => ({ d, isHole: false }))
  }

  if (!svgPathItems.length) return null

  // Use only DARK (isHole=false) paths for the compound glyph outline.
  // imagetracer represents counters as inner CCW contours within the dark path set;
  // including the white (isHole=true) paths would duplicate each hole boundary.
  const darkItems = svgPathItems.filter(item => !item.isHole)
  if (!darkItems.length) return null

  let minInkX = Infinity
  let maxInkX = -Infinity
  const allDarkCmds = []

  for (const { d } of darkItems) {
    const commands = svgPathToCommands(d, STORE_H, FONT_SCALE, BASELINE_PX)
    for (const cmd of commands) {
      if (cmd.type === 'M' || cmd.type === 'L') {
        if (cmd.x < minInkX) minInkX = cmd.x
        if (cmd.x > maxInkX) maxInkX = cmd.x
      } else if (cmd.type === 'C') {
        for (const x of [cmd.x, cmd.x1, cmd.x2]) {
          if (x < minInkX) minInkX = x
          if (x > maxInkX) maxInkX = x
        }
      }
      allDarkCmds.push(cmd)
    }
  }

  if (!allDarkCmds.length) return null
  if (!isFinite(minInkX)) { minInkX = 0; maxInkX = 0 }

  const xOffset = INK_MARGIN - minInkX

  // Split into individual contours and fix winding by nesting depth.
  const contours = splitContours(allDarkCmds)
  const fixedContours = fixContourWindings(contours)

  const path = new Path()
  for (const contour of fixedContours) {
    for (const cmd of contour) {
      if (cmd.type === 'M') {
        path.moveTo(cmd.x + xOffset, cmd.y)
      } else if (cmd.type === 'L') {
        path.lineTo(cmd.x + xOffset, cmd.y)
      } else if (cmd.type === 'C') {
        path.curveTo(cmd.x1 + xOffset, cmd.y1, cmd.x2 + xOffset, cmd.y2, cmd.x + xOffset, cmd.y)
      } else if (cmd.type === 'Z') {
        path.close()
      }
    }
  }

  const inkWidth = maxInkX - minInkX
  const codePoint = parseInt(unicode, 16)
  const effectiveSpacing = globalLetterSpacing + (glyph.spacingOffset ?? 0)
  const letterSpacingUnits = Math.round(effectiveSpacing * LS_TO_FONT_UNITS)

  const advanceWidth = Math.max(INK_MARGIN + inkWidth + INK_MARGIN + letterSpacingUnits, INK_MARGIN * 2)

  return new Glyph({
    name: String.fromCodePoint(codePoint),
    unicode: codePoint,
    advanceWidth,
    path,
  })
}

export async function buildFont(project) {
  const notdefGlyph = new Glyph({
    name: '.notdef',
    advanceWidth: 500,
    path: new Path(),
  })

  const glyphEntries = Object.entries(project.glyphs).filter(
    ([, g]) => g && (g.rasterData || (g.svgPaths && g.svgPaths.length > 0))
  )

  const globalLetterSpacing = project.letterSpacing ?? 0
  const otGlyphs = (await Promise.all(
    glyphEntries.map(([unicode, glyph]) => buildOpenTypeGlyph(unicode, glyph, globalLetterSpacing))
  )).filter(Boolean)

  const font = new Font({
    familyName: project.name,
    styleName: 'Regular',
    unitsPerEm: project.unitsPerEm,
    ascender: project.ascender,
    descender: project.descender,
    glyphs: [notdefGlyph, ...otGlyphs],
  })

  return font
}

export async function exportFont(project) {
  const font = await buildFont(project)
  const safeName = project.name.replace(/\s+/g, '-')
  downloadBuffer(font.toArrayBuffer(), `${safeName}.ttf`)
}
