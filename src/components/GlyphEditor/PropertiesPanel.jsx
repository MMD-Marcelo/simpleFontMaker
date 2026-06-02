import styles from './PropertiesPanel.module.css'

export default function PropertiesPanel({ glyph, onUpdate, globalLetterSpacing }) {
  const guidelines = glyph.guidelines ?? {}
  const offset = glyph.spacingOffset ?? 0
  const effective = (globalLetterSpacing ?? 0) + offset

  function toggleGuide(key) {
    onUpdate({ guidelines: { ...guidelines, [key]: !guidelines[key] } })
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h3>Guide lines</h3>
        {[
          ['showBaseline',  'Baseline',   'Linha onde as letras assentam'],
          ['showXHeight',   'X-height',   'Altura das letras minusculas (ex: a, x)'],
          ['showCapHeight', 'Cap height', 'Altura das maiusculas (ex: A, H)'],
          ['showDescender', 'Descender',  'Linha das letras que descem (ex: p, g, y)'],
        ].map(([key, label, desc]) => (
          <label key={key} className={styles.checkLabel} title={desc}>
            <input type="checkbox" checked={!!guidelines[key]} onChange={() => toggleGuide(key)} />
            <span>{label}</span>
          </label>
        ))}
      </section>

      <section className={styles.section}>
        <h3>Spacing</h3>
        <div className={styles.spacingRow}>
          <label>
            Offset
            <input
              type="number"
              value={offset}
              onChange={e => onUpdate({ spacingOffset: Number(e.target.value) })}
            />
          </label>
          {offset !== 0 && (
            <button onClick={() => onUpdate({ spacingOffset: 0 })}>Revert</button>
          )}
        </div>
        <p className={styles.spacingInfo}>
          Global {globalLetterSpacing ?? 0}px + offset {offset >= 0 ? '+' : ''}{offset}px = {effective}px
        </p>
      </section>
    </div>
  )
}
