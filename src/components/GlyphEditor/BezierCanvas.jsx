import { useRef, useEffect, useState } from 'react'
import paper from 'paper'
import styles from './BezierCanvas.module.css'

export default function BezierCanvas({ initialPaths = [], onChange }) {
  const canvasRef = useRef()
  const scopeRef = useRef(null)
  const pathRef = useRef(null)
  const bgRef = useRef(null)
  const [tool, setTool] = useState('pen')
  const toolRef = useRef('pen')

  useEffect(() => {
    const canvas = canvasRef.current
    const scope = new paper.PaperScope()
    scope.setup(canvas)
    scopeRef.current = scope

    const bg = new scope.Path.Rectangle(scope.view.bounds)
    bg.fillColor = 'white'
    bgRef.current = bg

    if (initialPaths.length > 0) {
      initialPaths.forEach(d => {
        try {
          const g = scope.project.importSVG(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`)
          const p = g.children?.[0] ?? g
          p.fillColor = '#111111'
          p.strokeColor = null
          if (g !== p) g.remove()
          scope.project.activeLayer.addChild(p)
        } catch {}
      })
    }

    const penTool = new scope.Tool()

    penTool.onMouseDown = (event) => {
      if (toolRef.current === 'select') {
        const hit = scope.project.hitTest(event.point, {
          segments: true, stroke: true, fill: true, tolerance: 10,
        })
        scope.project.activeLayer.selected = false
        if (hit?.item && hit.item !== bgRef.current) {
          hit.item.selected = true
          hit.item.fullySelected = true
        }
        return
      }

      if (!pathRef.current) {
        const p = new scope.Path()
        p.strokeColor = '#4a4af4'
        p.strokeWidth = 1.5
        p.fillColor = 'rgba(74,74,244,0.08)'
        p.selected = true
        pathRef.current = p
      }
      pathRef.current.add(event.point)
    }

    penTool.onMouseDrag = (event) => {
      if (toolRef.current !== 'pen' || !pathRef.current) return
      const last = pathRef.current.lastSegment
      last.handleOut = event.point.subtract(last.point)
      last.handleIn = last.handleOut.multiply(-1)
    }

    penTool.onKeyDown = (event) => {
      if (event.key === 'enter' || event.key === 'escape') {
        commitPath()
      }
      if ((event.key === 'backspace' || event.key === 'delete') && toolRef.current === 'select') {
        scope.project.selectedItems.forEach(item => {
          if (item !== bgRef.current) item.remove()
        })
        emitPaths()
      }
    }

    penTool.activate()

    return () => { scope.remove() }
  }, [])

  function commitPath() {
    const scope = scopeRef.current
    const p = pathRef.current
    if (!p) return
    if (p.segments.length < 2) { p.remove(); pathRef.current = null; return }
    p.closePath()
    p.fillColor = '#111111'
    p.strokeColor = null
    p.selected = false
    pathRef.current = null
    emitPaths()
  }

  function emitPaths() {
    const scope = scopeRef.current
    const paths = []
    scope.project.activeLayer.children.forEach(item => {
      if (item instanceof scope.Path && item !== bgRef.current && item.segments.length > 0) {
        try {
          const svg = item.exportSVG({ asString: true })
          const m = svg.match(/d="([^"]+)"/)
          if (m) paths.push(m[1])
        } catch {}
      }
    })
    onChange(paths)
  }

  function clearAll() {
    const scope = scopeRef.current
    scope.project.activeLayer.children.slice().forEach(item => {
      if (item !== bgRef.current) item.remove()
    })
    pathRef.current = null
    onChange([])
  }

  function switchTool(t) {
    setTool(t)
    toolRef.current = t
    const scope = scopeRef.current
    if (!scope) return
    if (t === 'select') {
      if (pathRef.current) commitPath()
      scope.project.activeLayer.selected = false
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <button
          className={tool === 'pen' ? styles.active : ''}
          onClick={() => switchTool('pen')}
        >Pen</button>
        <button
          className={tool === 'select' ? styles.active : ''}
          onClick={() => switchTool('select')}
        >Select</button>
        <button onClick={commitPath} disabled={tool !== 'pen'}>Close path</button>
        <button onClick={clearAll} className="danger">Clear</button>
        <span className={styles.hint}>
          {tool === 'pen'
            ? 'Click to add points · Drag to curve · Enter to close path'
            : 'Click path to select · Drag handles · Delete to remove'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className={styles.canvas}
      />
    </div>
  )
}
