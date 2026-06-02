import { useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import { useEditorStore } from '../store/editorStore.js'
import RasterCanvas from '../components/GlyphEditor/RasterCanvas.jsx'
import EditorToolbar from '../components/GlyphEditor/EditorToolbar.jsx'
import PropertiesPanel from '../components/GlyphEditor/PropertiesPanel.jsx'
import styles from './GlyphEdit.module.css'

export default function GlyphEdit() {
  const { id, unicode } = useParams()
  const navigate = useNavigate()
  const { projects, updateGlyph, updateKerning } = useProjectStore()
  const { smoothing } = useEditorStore()
  const uploadRef = useRef()
  const rasterRef = useRef()

  const project = projects[id]
  if (!project) return <p>Project not found.</p>

  const char = String.fromCodePoint(parseInt(unicode, 16))
  const glyph = project.glyphs[unicode] ?? {
    unicode,
    char,
    mode: 'raster',
    rasterData: null,
    svgPaths: [],
    leftBearing: 50,
    rightBearing: 50,
    baselineOffset: 0,
    smoothing: false,
    guidelines: { showBaseline: true, showXHeight: true, showCapHeight: true, showDescender: true },
  }

  function handleRasterChange(dataURL) {
    updateGlyph(unicode, { rasterData: dataURL, mode: 'raster' })
  }

  function handleGlyphUpdate(patch) {
    updateGlyph(unicode, patch)
  }

  function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => rasterRef.current?.loadImage(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button onClick={() => navigate(`/project/${id}`)}>Back to {project.name}</button>
        <span className={styles.glyphLabel}>
          Editing: <strong>{char}</strong> <span className={styles.code}>U+{unicode}</span>
        </span>
      </div>

      <div className={styles.workspace}>
        <EditorToolbar
          onUndo={() => rasterRef.current?.undo()}
          onRedo={() => rasterRef.current?.redo()}
          onClear={() => rasterRef.current?.clear()}
          onUpload={() => uploadRef.current.click()}
        />

        <div className={styles.canvasWrapper}>
          <RasterCanvas
            ref={rasterRef}
            initialData={glyph.rasterData}
            char={char}
            unicode={unicode}
            guidelines={glyph.guidelines}
            onChange={handleRasterChange}
          />
        </div>

        <PropertiesPanel
          glyph={glyph}
          onUpdate={handleGlyphUpdate}
          globalLetterSpacing={project.letterSpacing ?? 0}
        />
      </div>

<input
        ref={uploadRef}
        type="file"
        accept="image/*,.svg"
        hidden
        onChange={handleUpload}
      />
    </div>
  )
}
