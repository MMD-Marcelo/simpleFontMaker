import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { idbStorage } from '../lib/idbStorage.js'

function defaultGlyphMeta() {
  return {
    mode: 'raster',
    rasterData: null,
    svgPaths: [],
    leftBearing: 50,
    rightBearing: 50,
    baselineOffset: 0,
    spacingOffset: 0,
    smoothing: false,
    guidelines: {
      showBaseline: true,
      showXHeight: true,
      showCapHeight: true,
      showDescender: true,
    },
  }
}

function createId() {
  const webCrypto = globalThis.crypto
  if (webCrypto?.randomUUID) return webCrypto.randomUUID()
  const bytes = new Uint8Array(16)
  webCrypto?.getRandomValues?.(bytes)
  if (!bytes.some(Boolean)) {
    return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function defaultProject(name) {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name,
    author: '',
    version: '1.0',
    weight: 400,
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    characterSet: 'basic',
    customChars: [],
    glyphs: {},
    kerningPairs: {},
    letterSpacing: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: {},
      activeProjectId: null,

      createProject(name) {
        const p = defaultProject(name)
        set(s => ({ projects: { ...s.projects, [p.id]: p }, activeProjectId: p.id }))
        return p.id
      },

      setActiveProject(id) {
        set({ activeProjectId: id })
      },

      updateProject(id, patch) {
        set(s => ({
          projects: {
            ...s.projects,
            [id]: { ...s.projects[id], ...patch, updatedAt: new Date().toISOString() },
          },
        }))
      },

      deleteProject(id) {
        set(s => {
          const { [id]: _, ...rest } = s.projects
          return { projects: rest, activeProjectId: s.activeProjectId === id ? null : s.activeProjectId }
        })
      },

      updateGlyph(unicode, patch) {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        const existing = project.glyphs[unicode] ?? defaultGlyphMeta()
        set(s => ({
          projects: {
            ...s.projects,
            [activeProjectId]: {
              ...project,
              glyphs: { ...project.glyphs, [unicode]: { ...existing, ...patch } },
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },

      updateKerning(pair, value) {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        const next = { ...project.kerningPairs }
        if (value === null) {
          delete next[pair]
        } else {
          next[pair] = value
        }
        set(s => ({
          projects: {
            ...s.projects,
            [activeProjectId]: {
              ...project,
              kerningPairs: next,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },

      importProject(project) {
        set(s => ({
          projects: { ...s.projects, [project.id]: project },
          activeProjectId: project.id,
        }))
      },
    }),
    { name: 'fontmaker-projects', storage: createJSONStorage(() => idbStorage) }
  )
)
