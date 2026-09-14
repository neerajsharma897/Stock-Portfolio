// Turns Angel One's instrument file (OpenAPIScripMaster.json) into rows for the
// instruments table. Keeps NSE/BSE shares, SME shares, Sovereign Gold Bonds and
// indices; skips futures, options, commodities, currency, bonds and bills.

export type Exchange = "NSE" | "BSE"
export type InstrumentKind = "equity" | "sgb" | "index"

export type InstrumentRecord = {
  exchange: Exchange
  token: string
  trading_symbol: string
  symbol: string
  name: string
  series: string | null
  kind: InstrumentKind
  tick_size: number
}

// Share series on NSE: regular (EQ), trade-for-trade (BE, BZ) and SME (SM, ST).
const NSE_SHARE_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST"])
const NSE_GOLD_BOND_SERIES = "GB"

// BSE scrip codes for shares and ETFs; bonds and other debt use other ranges.
const BSE_SHARE_CODES = { min: 500000, max: 599999 }

type RawRecord = Record<string, unknown>

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

/** The file gives tick size in paise ("10.000000" = ₹0.10). */
function tickSizeInRupees(value: unknown) {
  const paise = Number(text(value))
  return Number.isFinite(paise) && paise > 0 ? paise / 100 : 0.01
}

export function parseInstrument(raw: RawRecord): InstrumentRecord | null {
  const exchange = text(raw.exch_seg)
  if (exchange !== "NSE" && exchange !== "BSE") return null

  const token = text(raw.token)
  const tradingSymbol = text(raw.symbol)
  if (!/^\d+$/.test(token) || !tradingSymbol) return null
  const name = text(raw.name) || tradingSymbol
  const type = text(raw.instrumenttype)

  if (type === "AMXIDX") {
    return {
      exchange,
      token,
      trading_symbol: tradingSymbol,
      symbol: tradingSymbol,
      name,
      series: null,
      kind: "index",
      tick_size: 0.01,
    }
  }
  if (type !== "") return null

  if (exchange === "NSE") {
    const match = tradingSymbol.match(/^(.+)-([A-Z0-9]{2})$/)
    if (!match) return null
    const [, symbol, series] = match
    const isGoldBond = series === NSE_GOLD_BOND_SERIES
    if (!isGoldBond && !NSE_SHARE_SERIES.has(series)) return null
    return {
      exchange,
      token,
      trading_symbol: tradingSymbol,
      symbol,
      name,
      series,
      kind: isGoldBond ? "sgb" : "equity",
      tick_size: tickSizeInRupees(raw.tick_size),
    }
  }

  const code = Number(token)
  if (code < BSE_SHARE_CODES.min || code > BSE_SHARE_CODES.max) return null
  return {
    exchange,
    token,
    trading_symbol: tradingSymbol,
    symbol: tradingSymbol,
    name,
    series: null,
    kind: "equity",
    tick_size: tickSizeInRupees(raw.tick_size),
  }
}

export function parseScripMaster(data: unknown): InstrumentRecord[] {
  if (!Array.isArray(data)) {
    throw new Error("The instrument file isn't in the expected format.")
  }

  const seen = new Set<string>()
  const records: InstrumentRecord[] = []
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue
    const record = parseInstrument(raw as RawRecord)
    if (!record) continue
    const key = `${record.exchange}:${record.token}`
    if (seen.has(key)) continue
    seen.add(key)
    records.push(record)
  }
  return records
}
