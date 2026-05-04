'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installEvent: BeforeInstallPromptEvent | null = null
let installListeners: Array<() => void> = []

function subscribeInstall(cb: () => void) {
  installListeners.push(cb)
  return () => {
    installListeners = installListeners.filter(l => l !== cb)
  }
}

function getInstallSnapshot() {
  return !!installEvent
}

function emitChange() {
  installListeners.forEach(l => l())
}

// Check if running as installed PWA
function getIsInstalledSnapshot() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

function subscribeInstalled(cb: () => void) {
  const handler = () => cb()
  window.addEventListener('appinstalled', handler)
  return () => window.removeEventListener('appinstalled', handler)
}

export function usePWAInstall() {
  const canInstall = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallSnapshot)
  const isInstalled = useSyncExternalStore(subscribeInstalled, getIsInstalledSnapshot, getIsInstalledSnapshot)

  useEffect(() => {
    // Listen for the beforeinstallprompt event (Chrome/Edge)
    const handler = (e: Event) => {
      e.preventDefault()
      installEvent = e as BeforeInstallPromptEvent
      emitChange()
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for successful install
    const appHandler = () => {
      installEvent = null
      emitChange()
    }
    window.addEventListener('appinstalled', appHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', appHandler)
    }
  }, [])

  const install = useCallback(async () => {
    if (!installEvent) return false
    installEvent.prompt()
    const result = await installEvent.userChoice
    if (result.outcome === 'accepted') {
      installEvent = null
      emitChange()
      return true
    }
    return false
  }, [])

  return { canInstall, isInstalled, install }
}
