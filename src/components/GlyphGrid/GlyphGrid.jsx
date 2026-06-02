import { useState } from 'react'
import GlyphCell from './GlyphCell.jsx'
import styles from './GlyphGrid.module.css'

export default function GlyphGrid({ projectId, chars, glyphs, onUpdateGlyph }) {
  const [copiedGlyph, setCopiedGlyph] = useState(null)

  function handlePaste(unicode) {
    if (!copiedGlyph) return
    onUpdateGlyph(unicode, { rasterData: copiedGlyph.rasterData, mode: 'raster' })
  }

  return (
    <div className={styles.grid}>
      {chars.map(char => {
        const unicode = char.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
        return (
          <GlyphCell
            key={char}
            projectId={projectId}
            char={char}
            glyph={glyphs[unicode]}
            copiedGlyph={copiedGlyph}
            onCopy={setCopiedGlyph}
            onPaste={handlePaste}
          />
        )
      })}
    </div>
  )
}
