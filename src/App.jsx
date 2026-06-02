import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout.jsx'
import Home from './pages/Home.jsx'
import Project from './pages/Project.jsx'
import GlyphEdit from './pages/GlyphEdit.jsx'
import Settings from './pages/Settings.jsx'
import Export from './pages/Export.jsx'
import TextPreview from './pages/TextPreview.jsx'

export default function App() {
  return (
    <BrowserRouter basename="/simpleFontMaker">
      <AppLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/project/:id" element={<Project />} />
          <Route path="/project/:id/glyph/:unicode" element={<GlyphEdit />} />
          <Route path="/project/:id/settings" element={<Settings />} />
          <Route path="/project/:id/export" element={<Export />} />
          <Route path="/project/:id/preview" element={<TextPreview />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
