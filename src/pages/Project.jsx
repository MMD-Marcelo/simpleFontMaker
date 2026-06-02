import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import { getCharacterSet } from '../lib/characterSets.js'
import {
  downloadTemplate,
  extractGlyphsFromSheet,
} from '../lib/templateSheet.js'
import GlyphGrid from '../components/GlyphGrid/GlyphGrid.jsx'
import styles from './Project.module.css'

export default function Project() {
  const { id } = useParams()
  const { projects, setActiveProject, updateGlyph } = useProjectStore()
  const navigate = useNavigate()
  const importRef = useRef()
  const project = projects[id]

  useEffect(() => { setActiveProject(id) }, [id])
  if (!project) return <p>Project not found.</p>

  const chars = getCharacterSet(project.characterSet, project.customChars)
  const drawn = Object.values(project.glyphs).filter(g => g?.rasterData || g?.svgPaths?.length).length

  async function handleImportSheet(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      let count = 0
      const glyphs = await extractGlyphsFromSheet(file, chars)
      Object.entries(glyphs).forEach(([unicode, rasterData]) => {
        updateGlyph(unicode, { rasterData, mode: 'raster' })
        count++
      })
      alert(`Imported ${count} glyphs.`)
    } catch (err) {
      alert(`Import failed: ${err.message}`)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{project.name}</h1>
        <div className={styles.actions}>
          <button onClick={() => navigate(`/project/${id}/settings`)}>Settings</button>
          <div className={styles.templateGroup}>
            <button onClick={() => downloadTemplate(chars, project.name)}>Template PNG</button>
            <button onClick={() => importRef.current.click()}>Import sheet</button>
          </div>
          <button onClick={() => navigate(`/project/${id}/preview`)}>Preview text</button>
          <button className="primary" onClick={() => navigate(`/project/${id}/export`)}>Export font</button>
        </div>
      </div>
      <p className={styles.count}>{drawn} / {chars.length} glyphs drawn</p>
      <GlyphGrid projectId={id} chars={chars} glyphs={project.glyphs} onUpdateGlyph={updateGlyph} />
      <input ref={importRef} type="file" accept="image/*" hidden onChange={handleImportSheet} />
    </div>
  )
}
