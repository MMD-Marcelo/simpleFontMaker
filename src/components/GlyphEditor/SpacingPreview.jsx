import { useRef, useEffect, useState } from 'react'
import { GLYPH_W, GLYPH_H } from '../../lib/templateSheet.js'
import styles from './SpacingPreview.module.css'

const DISPLAY_H = 72
const DISPLAY_W = Math.round(DISPLAY_H * (GLYPH_W / GLYPH_H))
const BEARING_PX = DISPLAY_W / 500
const PAD = 8

function loadImg(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function charToUnicode(ch) {
  if (!ch) return null
  return ch.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
}

export default function SpacingPreview({ unicode, glyph, projectGlyphs }) {
  const canvasRef = useRef()
  const [leftChar, setLeftChar] = useState('n')
  const [rightChar, setRightChar] = useState('o')

  useEffect(() => {
    const leftUni = charToUnicode(leftChar)
    const rightUni = charToUnicode(rightChar)

    const slots = [
      { unicode: leftUni, meta: leftUni ? projectGlyphs?.[leftUni] : null },
      { unicode, meta: glyph },
      { unicode: rightUni, meta: rightUni ? projectGlyphs?.[rightUni] : null },
    ]

    async function paint() {
      const imgs = await Promise.all(slots.map(s => loadImg(s.meta?.rasterData ?? null)))
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')

      let totalW = PAD * 2
      slots.forEach(s => {
        const lb = (s.meta?.leftBearing ?? 50) * BEARING_PX
        const rb = (s.meta?.rightBearing ?? 50) * BEARING_PX
        totalW += lb + DISPLAY_W + rb
      })

      canvas.width = Math.max(Math.round(totalW), 200)
      canvas.height = DISPLAY_H + PAD * 2

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const baselineY = PAD + DISPLAY_H * 0.75
      ctx.strokeStyle = '#e8e8e8'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(0, baselineY)
      ctx.lineTo(canvas.width, baselineY)
      ctx.stroke()
      ctx.setLineDash([])

      let x = PAD
      slots.forEach((s, i) => {
        const lb = (s.meta?.leftBearing ?? 50) * BEARING_PX
        const rb = (s.meta?.rightBearing ?? 50) * BEARING_PX
        const isCurrent = i === 1

        ctx.fillStyle = isCurrent ? 'rgba(80,120,220,0.08)' : 'rgba(0,0,0,0.04)'
        ctx.fillRect(x, PAD, lb, DISPLAY_H)
        ctx.fillRect(x + lb + DISPLAY_W, PAD, rb, DISPLAY_H)

        if (imgs[i]) {
          ctx.drawImage(imgs[i], x + lb, PAD, DISPLAY_W, DISPLAY_H)
        } else {
          ctx.strokeStyle = '#e8e8e8'
          ctx.lineWidth = 1
          ctx.strokeRect(x + lb, PAD, DISPLAY_W, DISPLAY_H)
          if (s.unicode) {
            const fallbackChar = String.fromCodePoint(parseInt(s.unicode, 16))
            ctx.fillStyle = 'rgba(0,0,0,0.15)'
            ctx.font = `${DISPLAY_H * 0.65}px serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(fallbackChar, x + lb + DISPLAY_W / 2, PAD + DISPLAY_H / 2)
          }
        }

        x += lb + DISPLAY_W + rb
      })
    }

    paint()
  }, [unicode, glyph, projectGlyphs, leftChar, rightChar])

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Spacing</span>
      <input
        className={styles.refInput}
        value={leftChar}
        onChange={e => setLeftChar(e.target.value.slice(-1))}
        maxLength={1}
        title="Left reference character"
      />
      <canvas ref={canvasRef} className={styles.canvas} />
      <input
        className={styles.refInput}
        value={rightChar}
        onChange={e => setRightChar(e.target.value.slice(-1))}
        maxLength={1}
        title="Right reference character"
      />
    </div>
  )
}
