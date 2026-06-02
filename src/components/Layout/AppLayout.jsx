import { Link } from 'react-router-dom'
import styles from './AppLayout.module.css'

export default function AppLayout({ children }) {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>simpleFontMaker</Link>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
