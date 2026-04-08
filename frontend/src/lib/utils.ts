import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'EUR', locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

export function formatDate(dateStr: string | null | undefined, locale = 'fr-FR'): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr))
}

export function formatPercent(value: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

export function todayLabel(locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
}

export function formatLocalDate(dateStr: string | null | undefined, locale = 'fr-FR'): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr))
}

export function formatTimeAgo(dateStr: string | null | undefined, locale = 'fr-FR'): string {
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
    OTHER: 'Autre',
  }
  return labels[type] ?? type
}

export function safeRedirect(redirect: string | null, fallback = '/'): string {
  if (!redirect || !redirect.startsWith('/')) return fallback
  return redirect
}
