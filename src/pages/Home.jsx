import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import { importProjectFromFile } from '../lib/persistence.js'
import styles from './Home.module.css'

export default function Home() {
  const { projects, createProject, deleteProject, setActiveProject, importProject } = useProjectStore()
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const fileRef = useRef()

  function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    const id = createProject(name.trim())
    setName('')
    navigate(`/project/${id}`)
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const project = await importProjectFromFile(file)
      importProject(project)
      navigate(`/project/${project.id}`)
    } catch {
      alert('Invalid project file.')
    }
    e.target.value = ''
  }

  const list = Object.values(projects).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className={styles.page}>
      <h1>Projects</h1>

      <form className={styles.form} onSubmit={handleCreate}>
        <input
          placeholder="Font name"
          value={name}
          onChange={e => setName(e.target.value)}
          className={styles.input}
        />
        <button type="submit" className="primary" disabled={!name.trim()}>Create</button>
        <button type="button" onClick={() => fileRef.current.click()}>Import</button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImport} />
      </form>

      {list.length === 0 ? (
        <p className={styles.empty}>No projects yet. Create one above.</p>
      ) : (
        <ul className={styles.list}>
          {list.map(p => (
            <li key={p.id} className={styles.item}>
              <Link className={styles.name} to={`/project/${p.id}`} onClick={() => setActiveProject(p.id)}>{p.name}</Link>
              <span className={styles.date}>{new Date(p.updatedAt).toLocaleDateString()}</span>
              <button className="danger" aria-label="Delete" onClick={() => deleteProject(p.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
