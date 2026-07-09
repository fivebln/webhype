/**
 * webhype-Magazin (Blog) — Anbindung an die kundenlose Payload-Collection `marketing-blog`
 * auf mein.web-hype.de. SSR + Live-Fetch: ein neuer Beitrag im Admin ist ohne Rebuild sofort
 * live. Bei jeder Störung (Backend offline, Timeout) liefert die Seite eine leere, saubere
 * Liste statt zu brechen. Seiten, die das nutzen, setzen `export const prerender = false;`.
 *
 * Bilder: Titelbild/OG-Bild sind kundenlose Assets → öffentlich über die `/bild/<id>`-Route
 * (die Route erlaubt veröffentlichte marketing-blog-Bilder anonym; private Assets bleiben 404).
 *
 * Encoding (§5): Antwort via res.json() (UTF-8) — nie roher String-Body, kein Double-Encoding.
 */

const CMS_URL = (import.meta.env.CMS_URL ?? 'https://mein.web-hype.de').replace(/\/+$/, '')
const TIMEOUT_MS = 2500

/** Ein Lexical-Richtext-Wurzelknoten (Payload) — Struktur bewusst offen, Rendering in lexical.ts. */
export type LexicalRoot = { root?: unknown } | null | undefined

export type MarketingBlogPost = {
  slug: string
  titel: string
  teaser: string
  autor: string
  kategorie?: string
  veroeffentlichtAm?: string
  updatedAt?: string
  lesezeitMin?: number
  /** Öffentliche Bild-URL (oder null → kein Titelbild). */
  titelbild: string | null
  ogImage: string | null
  body?: LexicalRoot
  metaTitle?: string
  metaDescription?: string
}

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

/** Asset-ID → öffentliche Bild-URL über die /bild-Route (oder null). */
function bildUrl(id: unknown): string | null {
  const n = typeof id === 'object' && id ? (id as { id?: unknown }).id : id
  return n === 0 || n ? `${CMS_URL}/bild/${n}` : null
}

function normalize(doc: Json): MarketingBlogPost {
  const seo = (doc.seo ?? {}) as Json
  return {
    slug: String(doc.slug ?? doc.id ?? ''),
    titel: doc.titel ?? 'Ohne Titel',
    teaser: doc.teaser ?? '',
    autor: doc.autor || 'webhype',
    kategorie: doc.kategorie || undefined,
    veroeffentlichtAm: doc.veroeffentlichtAm ?? doc.createdAt ?? undefined,
    updatedAt: doc.updatedAt ?? undefined,
    lesezeitMin: typeof doc.lesezeitMin === 'number' ? doc.lesezeitMin : undefined,
    titelbild: bildUrl(doc.titelbild),
    ogImage: bildUrl(seo.ogImage) ?? bildUrl(doc.titelbild),
    body: doc.body ?? undefined,
    metaTitle: seo.metaTitle || undefined,
    metaDescription: seo.metaDescription || undefined,
  }
}

/** Veröffentlichte Beiträge, neueste zuerst. */
export async function getBlogPosts(limit = 24): Promise<MarketingBlogPost[]> {
  // Anonymer Zugriff → Access-Regel liefert ohnehin nur _status:published; der Filter macht es explizit + erlaubt Sortierung.
  const data = await fetchJson(
    `/api/marketing-blog?where[_status][equals]=published&sort=-veroeffentlichtAm&limit=${limit}&depth=0`,
  )
  const docs: Json[] | undefined = data?.docs
  if (!Array.isArray(docs)) return []
  return docs.map(normalize)
}

/** Ein Beitrag per Slug (nur veröffentlicht). */
export async function getBlogPost(slug: string): Promise<MarketingBlogPost | null> {
  const q =
    `where[and][0][slug][equals]=${encodeURIComponent(slug)}` +
    `&where[and][1][_status][equals]=published`
  const data = await fetchJson(`/api/marketing-blog?${q}&limit=1&depth=0`)
  const doc: Json | undefined = data?.docs?.[0]
  return doc ? normalize(doc) : null
}

/**
 * Verwandte Beiträge: bevorzugt gleiche Kategorie, sonst die neuesten — ohne den aktuellen.
 */
export async function getRelatedPosts(current: MarketingBlogPost, limit = 2): Promise<MarketingBlogPost[]> {
  const pool = await getBlogPosts(12)
  const others = pool.filter((p) => p.slug !== current.slug)
  const sameCat = current.kategorie ? others.filter((p) => p.kategorie === current.kategorie) : []
  const rest = others.filter((p) => !sameCat.includes(p))
  return [...sameCat, ...rest].slice(0, limit)
}
