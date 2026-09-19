// A short label for headlines about events that usually move a stock. Keyword
// matching only, so it's a hint, not a verdict. First match wins.

const TOPICS: [label: string, pattern: RegExp][] = [
  [
    "Results",
    /\b(q[1-4]|results?|earnings|net profit|quarterly (profit|loss|numbers))\b/i,
  ],
  [
    "Dividend",
    /\b(dividends?|bonus (issue|shares?)|stock split|share split|buyback|record date)\b/i,
  ],
  [
    "Deal",
    /\b(merger|merges?|acquisitions?|acquires?|acquired|to acquire|stake|demerger|takeover|block deals?|bulk deals?)\b/i,
  ],
  [
    "Regulatory",
    /\b(sebi|rbi|penalty|probe|raids?|ban(s|ned)?|court|tribunal|nclt|show[- ]cause)\b/i,
  ],
  [
    "Order",
    /\b(bags?|wins?|wons?|secures?|receives?|gets?|bagged|won|secured|received)\b.*\b(orders?|contracts?)\b|\b(orders?|contracts?) (worth|from|of)\b/i,
  ],
  [
    "Rating",
    /\b(upgrades?|upgraded|downgrades?|downgraded|target price|price target|targets?|rating|buy call|sell call)\b/i,
  ],
]

export function newsTopic(title: string): string | null {
  for (const [label, pattern] of TOPICS) {
    if (pattern.test(title)) return label
  }
  return null
}
