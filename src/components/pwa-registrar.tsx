'use client'

import { useEffect } from 'react'
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

/**
 * Check for a new service worker version.
 * Properly waits for the SW to download & install before resolving.
 * Returns true if a new version is available (waiting SW detected).
 */
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

      // ── Already have a waiting SW → update ready ──
      if (reg.waiting) {
        updateAvailable = true
        emitUpdateState()
        resolve(true)
        return
      }

      let resolved = false
      const done = (result: boolean) => {
        if (resolved) return
        resolved = true
        cleanup()
        resolve(result)
      }

      const cleanup = () => {
        reg.removeEventListener('updatefound', onUpdateFound)
      }

      // ── Listen for the updatefound event ──
      const onUpdateFound = () => {
        const newWorker = reg.installing
        if (!newWorker) { done(false); return }

        const onStateChange = () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New SW installed and old SW still active → real update
              updateAvailable = true
              emitUpdateState()
              done(true)
            } else {
              // First install (no previous controller)
              done(false)
            }
          } else if (newWorker.state === 'redundant') {
            // Install failed
            done(false)
          }
        }
        newWorker.addEventListener('statechange', onStateChange)
      }

      reg.addEventListener('updatefound', onUpdateFound)

      // ── Trigger the update check ──
      reg.update()
        .then(() => {
          // The browser fetched sw.js. If no updatefound fired within
          // a few seconds, there's genuinely no update.
          setTimeout(() => done(false), 3000)
        })
        .catch(() => done(false))
    }).catch(() => resolve(false))
  })
}

/**
 * Apply a pending update: tell the waiting SW to skipWaiting, then reload.
 */
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
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Register SW
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope)

        // Listen for updates found in the background
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

  // Listen for SKIP_WAITING from SW → reload
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
