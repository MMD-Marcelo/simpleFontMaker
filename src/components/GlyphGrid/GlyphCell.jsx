import { Link } from 'react-router-dom'
import styles from './GlyphGrid.module.css'

export default function GlyphCell({ projectId, char, glyph, copiedGlyph, onCopy, onPaste }) {
  const unicode = char.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()
  const filled = !!(glyph?.rasterData || glyph?.svgPaths?.length)
  const canCopy = filled
  const canPaste = !!(copiedGlyph && copiedGlyph.unicode !== unicode)

  function handleCopy(e) {
    e.preventDefault()
    onCopy({ unicode, rasterData: glyph.rasterData })
  }

  function handlePaste(e) {
    e.preventDefault()
    onPaste(unicode)
  }

  return (
    <div className={styles.cellWrap}>
      <Link
        to={`/project/${projectId}/glyph/${unicode}`}
        className={styles.cell}
        data-filled={filled}
      >
        {filled && glyph.rasterData ? (
          <img src={glyph.rasterData} alt={char} className={styles.preview} />
        ) : (
          <span className={styles.placeholder}>{char}</span>
        )}
        <span className={styles.label} aria-hidden="true">{unicode}</span>
      </Link>
      {(canCopy || canPaste) && (
        <div className={styles.actions}>
          {canCopy && (
            <button className={styles.actionBtn} onClick={handleCopy} title="Copy glyph">
              Copy
            </button>
          )}
          {canPaste && (
            <button className={styles.actionBtn} onClick={handlePaste} title="Paste glyph">
              Paste
            </button>
          )}
        </div>
      )}
    </div>
  )
}
