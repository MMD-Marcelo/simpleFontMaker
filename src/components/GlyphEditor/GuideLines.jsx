import styles from './GuideLines.module.css'

const LINES = [
  { key: 'showCapHeight',  pos: 0.20, label: 'cap height',  color: '#cc6600' },
  { key: 'showXHeight',    pos: 0.50, label: 'x-height',   color: '#009900' },
  { key: 'showBaseline',   pos: 0.75, label: 'baseline',   color: '#0066ff' },
  { key: 'showDescender',  pos: 0.90, label: 'descender',  color: '#990099' },
]

export default function GuideLines({ guidelines }) {
  return (
    <div className={styles.overlay}>
      {LINES.map(({ key, pos, label, color }) =>
        guidelines[key] ? (
          <div
            key={key}
            className={styles.line}
            style={{ top: `${pos * 100}%`, borderTopColor: color }}
          >
            <span className={styles.label} style={{ color }}>{label}</span>
          </div>
        ) : null
      )}
    </div>
  )
}
