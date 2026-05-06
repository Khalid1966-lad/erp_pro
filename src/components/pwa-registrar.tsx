'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { APP_VERSION } from '@/lib/version'

// ── Global state for update availability ──
type UpdateListener = (available: boolean) => void
let updateAvailable = false
let updateListeners: UpdateListener[] = []
let serverVersion: string | null = null

function emitUpdateState() {
  updateListeners.forEach(fn => fn(updateAvailable))
}

export function isUpdateAvailable() {
  return updateAvailable
}

export function getServerVersion() {
  return serverVersion
}

export function subscribeUpdateAvailable(fn: UpdateListener) {
  updateListeners.push(fn)
  return () => { updateListeners = updateListeners.filter(l => l !== fn) }
}

// ── Version comparison helpers ──
function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
}

function isNewerVersion(a: string, b: string): boolean {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

// ── Fetch build-meta.json from server to compare versions ──
//    This is the PRIMARY detection method for Windows PWA where
//    the browser SW byte-comparison can be unreliable due to caching.
async function checkServerVersion(): Promise<boolean> {
  try {
    const res = await fetch('/build-meta.json?_t=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return false
    const meta = await res.json()
    const remoteVersion = meta.version
    serverVersion = remoteVersion
    console.log('[PWA] Server version:', remoteVersion, '| Local version:', APP_VERSION)

    if (remoteVersion && isNewerVersion(remoteVersion, APP_VERSION)) {
      return true
    }
    return false
  } catch (err) {
    console.warn('[PWA] Could not check server version:', err)
    return false
  }
}

/**
 * Check for a new version using BOTH methods:
 * 1. Server version comparison (build-meta.json) — most reliable
 * 2. Service Worker byte-diff — as fallback
 */
export function checkForUpdates(): Promise<boolean> {
  return new Promise((resolve) => {
    // ── Method 1: Check build-meta.json for version mismatch ──
    checkServerVersion().then((serverHasUpdate) => {
      if (serverHasUpdate) {
        updateAvailable = true
        emitUpdateState()
        resolve(true)
        return
      }

      // ── Method 2: SW update check (fallback) ──
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        resolve(false)
        return
      }

      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          resolve(false)
          return
        }

        // Already have a waiting SW → update ready
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

        const onUpdateFound = () => {
          const newWorker = reg.installing
          if (!newWorker) { done(false); return }

          const onStateChange = () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                updateAvailable = true
                emitUpdateState()
                done(true)
              } else {
                done(false)
              }
            } else if (newWorker.state === 'redundant') {
              done(false)
            }
          }
          newWorker.addEventListener('statechange', onStateChange)
        }

        reg.addEventListener('updatefound', onUpdateFound)

        reg.update()
          .then(() => {
            setTimeout(() => done(false), 3000)
          })
          .catch(() => done(false))
      }).catch(() => resolve(false))
    })
  })
}

/**
 * Apply a pending update: tell the waiting SW to skipWaiting, then reload.
 * If no waiting SW (e.g. version detected via build-meta.json), unregister
 * the old SW and force a full reload to fetch fresh assets.
 */
export function applyUpdate() {
  if (typeof window === 'undefined') return

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && reg.waiting) {
        // Has waiting SW → activate it
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })
        return
      }

      // No waiting SW but update detected via version check
      // → unregister old SW, clear caches, then hard reload
      if (reg) {
        reg.unregister().then(() => {
          caches.keys().then((names) => {
            Promise.all(names.map(n => caches.delete(n))).then(() => {
              window.location.reload()
            })
          })
        })
        return
      }

      // Fallback: just reload
      window.location.reload()
    })
  } else {
    window.location.reload()
  }
}

export function PwaRegistrar() {
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false)

  const showUpdateNotification = useCallback(() => {
    if (updateBannerDismissed) return
    toast.info('🔔 Mise à jour disponible', {
      description: `Une nouvelle version est disponible. Cliquez sur l'icône ↻ dans l'en-tête pour mettre à jour.`,
      duration: 15000,
      action: {
        label: 'Mettre à jour',
        onClick: () => {
          applyUpdate()
        },
      },
    })
  }, [updateBannerDismissed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // ── Cache-bust the manifest link so Windows/browser always reads latest version ──
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (manifestLink) {
      const base = manifestLink.href.split('?')[0]
      manifestLink.href = `${base}?v=${APP_VERSION}`
    }

    // Register SW with updateViaCache: none to force update checks
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope)

        // ── Method 1: Listen for SW updates (byte-diff) ──
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateAvailable = true
              emitUpdateState()
              showUpdateNotification()
            }
          })
        })

        // ── Method 2: Check server version immediately (reliable on Windows PWA) ──
        //    This is the main mechanism: compare build-meta.json version with APP_VERSION
        checkServerVersion().then((hasUpdate) => {
          if (hasUpdate) {
            updateAvailable = true
            emitUpdateState()
            showUpdateNotification()
          }
        })

        // ── Periodic checks every 2 minutes ──
        //    More aggressive for Windows PWA where SW byte-check can be unreliable
        const versionInterval = setInterval(async () => {
          const hasUpdate = await checkServerVersion()
          if (hasUpdate && !updateAvailable) {
            updateAvailable = true
            emitUpdateState()
            showUpdateNotification()
          }
        }, 2 * 60 * 1000)

        // Also do periodic SW byte-check every 5 minutes
        const swInterval = setInterval(() => {
          registration.update()
        }, 5 * 60 * 1000)

        return () => {
          clearInterval(versionInterval)
          clearInterval(swInterval)
        }
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error)
      })

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        updateAvailable = true
        emitUpdateState()
        showUpdateNotification()
      }
    })
  }, [showUpdateNotification])

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
