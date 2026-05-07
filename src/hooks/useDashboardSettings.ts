'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface DashboardSettings {
  matrixRain: boolean
  animationSpeed: number
  cardStyle: 'glass' | 'flat' | 'neon'
  compactMode: boolean
  tradeAlerts: boolean
  clusterAlerts: boolean
  priceThreshold: number
  sentimentThreshold: number
  autoTrade: boolean
  kellyFraction: number
  confidenceThreshold: number
  maxPositionSize: number
  refreshInterval: number
  timeRange: string
  walletFilter: string
}

const DEFAULT_SETTINGS: DashboardSettings = {
  matrixRain: false,
  animationSpeed: 1.0,
  cardStyle: 'glass',
  compactMode: false,
  tradeAlerts: true,
  clusterAlerts: true,
  priceThreshold: 10,
  sentimentThreshold: 0.3,
  autoTrade: false,
  kellyFraction: 0.5,
  confidenceThreshold: 0.75,
  maxPositionSize: 500,
  refreshInterval: 15,
  timeRange: '24H',
  walletFilter: 'All',
}

const STORAGE_KEY = 'polyagent-settings'

function readFromStorage(): DashboardSettings | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return null
  }
}

function writeToStorage(settings: DashboardSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage might be full or unavailable
  }
}

export function useDashboardSettings() {
  // Always start with defaults to avoid SSR/client hydration mismatch
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)
  const [hydrated, setHydrated] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from localStorage AFTER hydration to avoid mismatch
  useEffect(() => {
    const stored = readFromStorage()
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(stored)
    }
    setHydrated(true)
  }, [])

  // Debounced write to localStorage
  const persistSettings = useCallback((newSettings: DashboardSettings) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      writeToStorage(newSettings)
    }, 300)
  }, [])

  const updateSettings = useCallback(
    (partial: Partial<DashboardSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial }
        persistSettings(next)
        return next
      })
    },
    [persistSettings]
  )

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    writeToStorage(DEFAULT_SETTINGS)
  }, [])

  return { settings, updateSettings, resetSettings, hydrated }
}
