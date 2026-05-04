'use client'

import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

// ── Global state for update availability ──
type UpdateListener = (available: boolean) => void
let updateAvailable = false
let updateListeners: UpdateListener[] = []

function emitUpdateState() {
  updateListeners.forEach(fn => fn(updateAvailable))
}

export function isUpdateAvailable() {
  return updateAvailable
}

export function subscribeUpdateAvailable(fn: UpdateListener) {
  updateListeners.push(fn)
  return () => { updateListeners = updateListeners.filter(l => l !== fn) }
}

export function checkForUpdates(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      resolve(false)
      return
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) {
        resolve(false)
        return
      }
      reg.update().then(() => {
        // If a new SW is waiting, an update is available
        if (reg.waiting) {
          updateAvailable = true
          emitUpdateState()
          resolve(true)
        } else {
          resolve(false)
        }
      }).catch(() => resolve(false))
    }).catch(() => resolve(false))
  })
}

export function applyUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg || !reg.waiting) {
      // No waiting SW — force full reload
      window.location.reload()
      return
    }
    // Tell the waiting SW to skip waiting and take control
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    // Once the new SW activates, reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  })
}

export function PwaRegistrar() {
  const checkingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Register SW
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope)

        // Listen for update found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed but old one still active → update available
              updateAvailable = true
              emitUpdateState()
              toast.info('Mise à jour disponible', {
                description: 'Cliquez sur l\'icône ↻ dans l\'en-tête pour mettre à jour.',
                duration: 8000,
              })
            }
          })
        })

        // Check immediately + every 30 minutes
        registration.update()
        const interval = setInterval(() => {
          registration.update()
        }, 30 * 60 * 1000)

        return () => clearInterval(interval)
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error)
      })

    // Listen for messages from SW (e.g. SKIP_WAITING response)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        updateAvailable = true
        emitUpdateState()
      }
    })
  }, [])

  // Expose checkForUpdates globally for the header button
  const handleCheckUpdates = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      const available = await checkForUpdates()
      if (available) {
        toast.success('Nouvelle version disponible', {
          description: 'Mise à jour en cours...',
          duration: 3000,
        })
        setTimeout(() => applyUpdate(), 1500)
      } else {
        toast.info('Application à jour', {
          description: 'Aucune mise à jour disponible.',
          duration: 3000,
        })
      }
    } finally {
      checkingRef.current = false
    }
  }, [])

  // Store the handler on window for the header to access
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__pwaCheckUpdates = handleCheckUpdates
    return () => {
      delete (window as unknown as Record<string, unknown>).__pwaCheckUpdates
    }
  }, [handleCheckUpdates])

  // Listen for SKIP_WAITING from SW
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }, [])

  return null
}
