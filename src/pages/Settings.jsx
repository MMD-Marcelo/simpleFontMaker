import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import { SETS } from '../lib/characterSets.js'
import styles from './Settings.module.css'

export default function Settings() {
  const { id } = useParams()
  const { projects, updateProject } = useProjectStore()
  const navigate = useNavigate()
  const project = projects[id]

  if (!project) return <p>Project not found.</p>

  function update(field) {
    return e => updateProject(id, { [field]: e.target.value })
  }

  function updateNum(field) {
    return e => updateProject(id, { [field]: Number(e.target.value) })
  }

  function toggleCustomChar(char) {
    const set = new Set(project.customChars)
    set.has(char) ? set.delete(char) : set.add(char)
    updateProject(id, { customChars: [...set] })
  }

  return (
    <div className={styles.page}>
      <button onClick={() => navigate(`/project/${id}`)} className={styles.back}>Back to project</button>
      <h1>Font settings</h1>

      <section className={styles.section}>
        <h2>Metadata</h2>
        <label>Font name<input value={project.name} onChange={update('name')} /></label>
        <label>Author<input value={project.author} onChange={update('author')} /></label>
        <label>Version<input value={project.version} onChange={update('version')} /></label>
        <label>Weight<input type="number" value={project.weight} onChange={updateNum('weight')} /></label>
      </section>

      <section className={styles.section}>
        <h2>Metrics</h2>
        <label>Units per em (UPM)<input type="number" value={project.unitsPerEm} onChange={updateNum('unitsPerEm')} /></label>
        <label>Ascender<input type="number" value={project.ascender} onChange={updateNum('ascender')} /></label>
        <label>Descender<input type="number" value={project.descender} onChange={updateNum('descender')} /></label>
      </section>

      <section className={styles.section}>
        <h2>Character set</h2>
        <div className={styles.radio}>
          {['basic', 'extended', 'custom'].map(opt => (
            <label key={opt} className={styles.radioLabel}>
              <input
                type="radio"
                name="characterSet"
                value={opt}
                checked={project.characterSet === opt}
                onChange={() => updateProject(id, { characterSet: opt })}
              />
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </label>
          ))}
        </div>

        {project.characterSet === 'custom' && (
          <div className={styles.checkboxGrid}>
            {SETS.extended.map(char => (
              <label key={char} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={project.customChars.includes(char)}
                  onChange={() => toggleCustomChar(char)}
                />
                <span>{char}</span>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
