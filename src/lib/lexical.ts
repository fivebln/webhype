/**
 * Lexical-Richtext (Payload) → HTML — abhängigkeitsfrei (kein @payloadcms/richtext-lexical
 * im Marketing-Build, kein Google-CDN). Deckt die Knoten ab, die echte Artikel nutzen:
 * Überschriften, Absätze, Listen, Links, Fett/Kursiv/…, Zitate, Trennlinie, Zeilenumbruch,
 * Inline-Bilder (Upload → /bild/<id>). Der Body kommt aus vertrauenswürdiger Quelle (Staff);
 * Textknoten werden dennoch escaped und Link-Ziele sanitisiert (Defense-in-Depth).
 */

type LxNode = Record<string, any>

// Lexical-Text-Format-Bitmaske
const F_BOLD = 1
const F_ITALIC = 2
const F_STRIKE = 4
const F_UNDERLINE = 8
const F_CODE = 16
const F_SUB = 32
const F_SUPER = 64

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Nur sichere Link-Ziele zulassen (http/https/mailto/tel + root-relative). Sonst „#". */
function safeHref(url: unknown): string {
  const u = String(url ?? '').trim()
  if (!u) return '#'
  if (/^(https?:|mailto:|tel:)/i.test(u)) return esc(u)
  if (u.startsWith('/') || u.startsWith('#')) return esc(u)
  // alles andere (javascript:, data:, …) blocken
  return '#'
}

function renderText(node: LxNode): string {
  let html = esc(node.text ?? '')
  const f = typeof node.format === 'number' ? node.format : 0
  if (f & F_CODE) html = `<code>${html}</code>`
  if (f & F_BOLD) html = `<strong>${html}</strong>`
  if (f & F_ITALIC) html = `<em>${html}</em>`
  if (f & F_UNDERLINE) html = `<u>${html}</u>`
  if (f & F_STRIKE) html = `<s>${html}</s>`
  if (f & F_SUB) html = `<sub>${html}</sub>`
  if (f & F_SUPER) html = `<sup>${html}</sup>`
  return html
}

function childrenHtml(node: LxNode, baseUrl: string): string {
  const kids = Array.isArray(node?.children) ? node.children : []
  return kids.map((k: LxNode) => renderNode(k, baseUrl)).join('')
}

function assetIdOf(value: unknown): string | number | null {
  if (value == null) return null
  if (typeof value === 'object') {
    const v = value as { id?: unknown }
    return (v.id as string | number | undefined) ?? null
  }
  return value as string | number
}

function renderNode(node: LxNode, baseUrl: string): string {
  if (!node || typeof node !== 'object') return ''
  switch (node.type) {
    case 'text':
      return renderText(node)
    case 'linebreak':
      return '<br />'
    case 'paragraph': {
      const inner = childrenHtml(node, baseUrl)
      return inner.trim() ? `<p>${inner}</p>` : ''
    }
    case 'heading': {
      // h1 im Body → h2 (die Artikel-Überschrift ist die einzige echte h1 der Seite).
      const tagRaw = String(node.tag || 'h2').toLowerCase()
      const tag = tagRaw === 'h1' ? 'h2' : /^h[2-6]$/.test(tagRaw) ? tagRaw : 'h2'
      return `<${tag}>${childrenHtml(node, baseUrl)}</${tag}>`
    }
    case 'quote':
      return `<blockquote>${childrenHtml(node, baseUrl)}</blockquote>`
    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${tag}>${childrenHtml(node, baseUrl)}</${tag}>`
    }
    case 'listitem':
      return `<li>${childrenHtml(node, baseUrl)}</li>`
    case 'link':
    case 'autolink': {
      const fields = (node.fields ?? {}) as LxNode
      const href = safeHref(fields.url ?? node.url)
      const newTab = fields.newTab === true
      const rel = newTab ? ' rel="noopener noreferrer" target="_blank"' : ''
      return `<a href="${href}"${rel}>${childrenHtml(node, baseUrl)}</a>`
    }
    case 'horizontalrule':
      return '<hr />'
    case 'upload': {
      const id = assetIdOf(node.value)
      if (id == null) return ''
      const alt = esc((node.fields && (node.fields.alt || node.fields.caption)) || '')
      return `<img src="${esc(baseUrl)}/bild/${esc(String(id))}" alt="${alt}" loading="lazy" decoding="async" />`
    }
    case 'tab':
      return ' '
    default:
      // Unbekannter Knoten: Kinder rendern, falls vorhanden (keine leeren Löcher).
      return childrenHtml(node, baseUrl)
  }
}

/**
 * Wandelt einen Payload-Lexical-Wert (`{ root: {...} }` oder direkt der Root) in HTML.
 * @param baseUrl CMS-Basis-URL für Inline-Bilder (/bild/<id>).
 */
export function lexicalToHtml(value: unknown, baseUrl = 'https://mein.web-hype.de'): string {
  if (!value || typeof value !== 'object') return ''
  const root = (value as LxNode).root ?? value
  if (!root || !Array.isArray((root as LxNode).children)) return ''
  const base = baseUrl.replace(/\/+$/, '')
  return (root as LxNode).children.map((n: LxNode) => renderNode(n, base)).join('')
}

/** Reintext (für Fallback-Meta/Excerpt), abhängigkeitsfrei. */
export function lexicalToText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const root = (value as LxNode).root ?? value
  const walk = (n: LxNode): string => {
    if (!n || typeof n !== 'object') return ''
    if (typeof n.text === 'string') return n.text
    const kids = Array.isArray(n.children) ? n.children : []
    return kids.map(walk).join(' ')
  }
  return walk(root as LxNode).replace(/\s+/g, ' ').trim()
}
