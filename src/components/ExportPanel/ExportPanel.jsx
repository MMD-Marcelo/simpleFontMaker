import styles from './ExportPanel.module.css'

export default function ExportPanel({ onExport, exporting }) {
  return (
    <div className={styles.panel}>
      <h2>Export font</h2>
      <p className={styles.desc}>
        Downloads a <code>.ttf</code> file ready to install on your system.<br />
        Only glyphs that have been drawn are included.
      </p>
      <button
        className="primary"
        onClick={onExport}
        disabled={exporting}
      >
        {exporting ? 'Exporting...' : 'Export font'}
      </button>
    </div>
  )
}
