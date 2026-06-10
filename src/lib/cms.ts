/**
 * CMS-Anbindung für die webhype-Marketingseite.
 * Holt Inhalte aus dem Payload-Backend (mein.web-hype.de). Bei jeder Störung
 * (Backend offline, Timeout, Fehler) wird der mitgegebene Fallback genutzt –
 * die Seite rendert also IMMER, nie eine kaputte Seite.
 *
 * Wichtig: Die jeweilige Astro-Seite muss `export const prerender = false;`
 * setzen, damit Edits sofort sichtbar werden (SSR statt statischem Build).
 */

const CMS_URL = import.meta.env.CMS_URL ?? 'https://mein.web-hype.de'
const TIMEOUT_MS = 2500

type Json = Record<string, any>

async function fetchJson(path: string): Promise<Json | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${CMS_URL}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as Json
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/**
 * Liest einen Payload-Global (Singleton) und mischt ihn flach über den Fallback.
 * Nur Felder, die im CMS einen Wert haben, überschreiben den Fallback.
 */
export async function getGlobal<T extends Json>(slug: string, fallback: T): Promise<T> {
  const data = await fetchJson(`/api/globals/${slug}?depth=1`)
  if (!data) return fallback
  const merged: Json = { ...fallback }
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined && v !== '') merged[k] = v
  }
  return merged as T
}
