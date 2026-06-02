import {
  PaintBrush, Eraser, PaintBucket,
  ArrowCounterClockwise, ArrowClockwise,
  ArrowUp, Trash,
  MagnifyingGlassPlus, MagnifyingGlassMinus,
} from '@phosphor-icons/react'
import { useEditorStore } from '../../store/editorStore.js'
import styles from './EditorToolbar.module.css'

const SHAPES = [
  { label: '●', value: 'round',       title: 'Round brush' },
  { label: '■', value: 'square',      title: 'Square brush' },
  { label: '◆', value: 'calligraphy', title: 'Calligraphy (flat nib, 45°)' },
  { label: '⬡', value: 'lasso',       title: 'Lasso fill — draw a closed shape, fills the interior' },
]

const SIZES = [
  { label: 'XS', value: 2 },
  { label: 'S',  value: 5 },
  { label: 'M',  value: 10 },
  { label: 'L',  value: 20 },
  { label: 'XL', value: 35 },
]

export default function EditorToolbar({ onUndo, onRedo, onClear, onUpload }) {
  const { activeTool, setTool, brushSize, setBrushSize, brushShape, setBrushShape, smoothing, toggleSmoothing, zoom, setZoom } = useEditorStore()

  return (
    <div className={styles.toolbar}>
      {/* tools */}
      <div className={styles.group}>
        <button
          className={`${styles.iconBtn} ${activeTool === 'brush' ? styles.active : ''}`}
          onClick={() => setTool('brush')}
          title="Brush"
        ><PaintBrush size={20} /></button>
        <button
          className={`${styles.iconBtn} ${activeTool === 'eraser' ? styles.active : ''}`}
          onClick={() => setTool('eraser')}
          title="Eraser"
        ><Eraser size={20} /></button>
        <button
          className={`${styles.iconBtn} ${activeTool === 'fill' ? styles.active : ''}`}
          onClick={() => setTool('fill')}
          title="Fill (bucket)"
        ><PaintBucket size={20} /></button>
      </div>

      {/* size presets */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Size</span>
        {SIZES.map(({ label, value }) => (
          <button
            key={value}
            className={`${styles.sizeBtn} ${brushSize === value ? styles.active : ''}`}
            onClick={() => setBrushSize(value)}
            title={`${label} (${value}px)`}
          >
            <span
              className={styles.sizeDot}
              style={{ width: Math.min(value, 20) + 4, height: Math.min(value, 20) + 4 }}
            />
          </button>
        ))}
      </div>

      {/* brush shape — only for brush tool */}
      {activeTool === 'brush' && (
        <div className={styles.group}>
          {SHAPES.map(s => (
            <button
              key={s.value}
              className={`${styles.shapeBtn} ${brushShape === s.value ? styles.active : ''}`}
              onClick={() => setBrushShape(s.value)}
              title={s.title}
            >{s.label}</button>
          ))}
        </div>
      )}

      {/* smooth — only for round brush */}
      {activeTool === 'brush' && brushShape === 'round' && (
        <div className={styles.group}>
          <label className={styles.checkLabel} title="Smooth strokes using bezier interpolation">
            <input type="checkbox" checked={smoothing} onChange={toggleSmoothing} />
            <span>Smooth</span>
          </label>
        </div>
      )}

      {/* undo / redo / clear */}
      <div className={styles.group}>
        <button className={styles.iconBtn} onClick={onUndo} title="Undo">
          <ArrowCounterClockwise size={18} />
        </button>
        <button className={styles.iconBtn} onClick={onRedo} title="Redo">
          <ArrowClockwise size={18} />
        </button>
        <button className={styles.iconBtn} onClick={onClear} title="Clear canvas">
          <Trash size={18} />
        </button>
      </div>

      {/* zoom */}
      <div className={styles.group}>
        <button className={styles.iconBtn} onClick={() => setZoom(Math.min(zoom + 0.5, 4))} title="Zoom in">
          <MagnifyingGlassPlus size={18} />
        </button>
        <button className={styles.iconBtn} onClick={() => setZoom(Math.max(zoom - 0.5, 0.5))} title="Zoom out">
          <MagnifyingGlassMinus size={18} />
        </button>
        <button className={styles.iconBtn} onClick={() => setZoom(1)} title="Reset zoom" style={{ fontSize: '10px' }}>
          {Math.round(zoom * 100)}%
        </button>
      </div>

      {/* import */}
      <div className={styles.group}>
        <button className={styles.iconBtn} onClick={onUpload} title="Upload image or SVG">
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  )
}
