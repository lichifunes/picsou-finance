import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useAppStore, type DateFormat } from "@/stores/app-store"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLocale(): string {
  try {
    const lang = document.documentElement.lang || navigator.language
    return lang.startsWith('fr') ? 'fr-FR' : 'en-US'
  } catch {
    return 'fr-FR'
  }
}

export function formatCurrency(value: number, currency = 'EUR', locale = getLocale()): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

export function formatDate(dateStr: string | null | undefined, locale = getLocale(), format?: DateFormat): string {
  if (!dateStr) return '—'
  const resolvedFormat = format ?? useAppStore.getState().dateFormat
  if (resolvedFormat === 'iso') {
    const d = new Date(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr))
}

export function formatPercent(value: number, locale = getLocale()): string {
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

export function todayLabel(locale = getLocale()): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
}

export function formatLocalDate(dateStr: string | null | undefined, locale = getLocale()): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr))
}

export function formatTimeAgo(dateStr: string | null | undefined, locale = getLocale()): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'minute')
  if (minutes < 60) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day')
}

export function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    LEP: 'LEP',
    PEA: 'PEA',
    COMPTE_TITRES: 'Compte-titres',
    CRYPTO: 'Crypto',
    CHECKING: 'Compte courant',
    SAVINGS: 'Épargne',
    REAL_ESTATE: 'Immobilier',
    LOAN: 'Emprunt',
    OTHER: 'Autre',
  }
  return labels[type] ?? type
}

export function safeRedirect(redirect: string | null, fallback = '/'): string {
  if (!redirect || !redirect.startsWith('/')) return fallback
  return redirect
}
