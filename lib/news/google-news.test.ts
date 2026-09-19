import { describe, expect, it } from "vitest"

import {
  decodeEntities,
  parseGoogleNewsRss,
  stripSource,
} from "@/lib/news/google-news"

// Two items from a real search feed (September 2026), plus one without a date.
const FEED = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><generator>NFE/5.0</generator><title>"ITC" stock - Google News</title><link>https://news.google.com/search?q=%22ITC%22&amp;hl=en-IN</link><item><title>ITC Infotech to acquire 22.1% stake in Happiest Minds for ₹1,330 crore - smallcapspotlight.in</title><link>https://news.google.com/rss/articles/CBMia0FVX3lxTFBUa1Za?oc=5</link><guid isPermaLink="false">CBMia0FVX3lxTFBUa1Za</guid><pubDate>Fri, 11 Sep 2026 07:00:00 GMT</pubDate><description>&lt;a href="https://news.google.com/rss/articles/CBMia0FVX3lxTFBUa1Za?oc=5" target="_blank"&gt;ITC Infotech&lt;/a&gt;</description><source url="https://smallcapspotlight.in">smallcapspotlight.in</source></item><item><title>ITC Share Price Today (ITC) | Live Chart, News &amp;amp; Stock Market - TechGraph</title><link>https://news.google.com/rss/articles/CBMioAFBVV95cUxONkxY?oc=5</link><pubDate>Thu, 10 Sep 2026 12:25:34 GMT</pubDate><source url="https://techgraph.co">TechGraph</source></item><item><title>No date here - Somewhere</title><link>https://news.google.com/rss/articles/abc</link><source url="https://x.y">Somewhere</source></item></channel></rss>`

describe("parseGoogleNewsRss", () => {
  it("reads headlines, links, sources and dates", () => {
    expect(parseGoogleNewsRss(FEED)).toEqual([
      {
        title:
          "ITC Infotech to acquire 22.1% stake in Happiest Minds for ₹1,330 crore",
        url: "https://news.google.com/rss/articles/CBMia0FVX3lxTFBUa1Za?oc=5",
        source: "smallcapspotlight.in",
        publishedAt: "2026-09-11T07:00:00.000Z",
      },
      {
        title:
          "ITC Share Price Today (ITC) | Live Chart, News &amp; Stock Market",
        url: "https://news.google.com/rss/articles/CBMioAFBVV95cUxONkxY?oc=5",
        source: "TechGraph",
        publishedAt: "2026-09-10T12:25:34.000Z",
      },
    ])
  })

  it("returns nothing for an empty or broken feed", () => {
    expect(parseGoogleNewsRss("<rss><channel></channel></rss>")).toEqual([])
    expect(parseGoogleNewsRss("<html>Too many requests</html>")).toEqual([])
  })
})

describe("decodeEntities and stripSource", () => {
  it("decodes named and numeric entities once", () => {
    expect(decodeEntities("M&amp;M &#8377;500 &#x2014; &quot;ok&quot;")).toBe(
      'M&M ₹500 — "ok"',
    )
    expect(decodeEntities("&amp;lt; &unknown;")).toBe("&lt; &unknown;")
  })

  it("removes the source only from the end", () => {
    expect(stripSource("Mint - Mint", "Mint")).toBe("Mint")
    expect(stripSource("A story - Mint", "Mint")).toBe("A story")
    expect(stripSource("A story - Mint", null)).toBe("A story - Mint")
  })
})
