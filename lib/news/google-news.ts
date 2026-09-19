// Google News RSS search results (news.google.com/rss/search). The feed is plain
// RSS 2.0 with HTML entities, so a small parser is enough.

export type NewsItem = {
  title: string
  /** Google News link, which redirects to the article. */
  url: string
  source: string | null
  publishedAt: string
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/** Decodes &amp;, &#39; and similar, once (so "&amp;lt;" becomes "&lt;"). */
export function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#")) {
        const code =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1))
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match
    },
  )
}

function readTag(item: string, name: string): string | null {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(
    item,
  )
  if (!match) return null
  const raw = match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
  return decodeEntities(raw).replace(/\s+/g, " ").trim()
}

/** Google ends each headline with " - Source"; the source is shown separately. */
export function stripSource(title: string, source: string | null): string {
  const suffix = source ? ` - ${source}` : null
  return suffix && title.endsWith(suffix) && title.length > suffix.length
    ? title.slice(0, -suffix.length).trim()
    : title
}

export function parseGoogleNewsRss(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = match[1]
    const title = readTag(body, "title")
    const url = readTag(body, "link")
    const published = Date.parse(readTag(body, "pubDate") ?? "")
    if (!title || !url?.startsWith("https://") || Number.isNaN(published)) {
      continue
    }
    const source = readTag(body, "source") || null
    items.push({
      title: stripSource(title, source),
      url,
      source,
      publishedAt: new Date(published).toISOString(),
    })
  }
  return items
}
