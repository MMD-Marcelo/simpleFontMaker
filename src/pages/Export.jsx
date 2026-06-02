import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import { exportFont } from '../lib/fontBuilder.js'
import ExportPanel from '../components/ExportPanel/ExportPanel.jsx'

export default function Export() {
  const { id } = useParams()
  const { projects } = useProjectStore()
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const project = projects[id]

  if (!project) return <p>Project not found.</p>

  async function handleExport() {
    setExporting(true)
    try {
      await exportFont(project)
    } catch (err) {
      alert(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <button onClick={() => navigate(`/project/${id}`)} style={{ marginBottom: 'var(--spacing-md)' }}>
        Back to {project.name}
      </button>
      <ExportPanel onExport={handleExport} exporting={exporting} />
    </div>
  )
}
