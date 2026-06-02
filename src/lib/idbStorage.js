const DB_NAME = 'fontmaker-db'
const STORE_NAME = 'kv'
const DB_VERSION = 1

const hasIDB = typeof indexedDB !== 'undefined'

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE_NAME)
      }
      req.onsuccess = e => resolve(e.target.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

// Fallback to localStorage when IndexedDB is unavailable (e.g. test environments)
const lsFallback = {
  async getItem(name) { try { return localStorage.getItem(name) } catch { return null } },
  async setItem(name, value) { try { localStorage.setItem(name, value) } catch {} },
  async removeItem(name) { try { localStorage.removeItem(name) } catch {} },
}

export const idbStorage = hasIDB ? {
  async getItem(name) {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(name)
      req.onsuccess = () => {
        if (req.result !== undefined) { resolve(req.result); return }
        // One-time migration from localStorage
        try {
          const lsValue = localStorage.getItem(name)
          if (lsValue !== null) {
            idbStorage.setItem(name, lsValue).then(() => {
              try { localStorage.removeItem(name) } catch {}
            })
            resolve(lsValue)
            return
          }
        } catch {}
        resolve(null)
      }
      req.onerror = () => reject(req.error)
    })
  },

  async setItem(name, value) {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(value, name)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async removeItem(name) {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(name)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },
} : lsFallback
