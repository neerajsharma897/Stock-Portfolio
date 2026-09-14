export type PriceInput =
  { ok: true; value: number | null } | { ok: false; message: string }

// Fits the numeric(18,4) price columns.
const MAX_PRICE = 1e14

/** A price typed into the prices form: "1,250.50" → 1250.5, blank → null. */
export function parsePriceInput(raw: FormDataEntryValue | null): PriceInput {
  const text = typeof raw === "string" ? raw.replace(/,/g, "").trim() : ""
  if (text === "") return { ok: true, value: null }
  if (!/^\d+(\.\d{1,4})?$/.test(text)) {
    return { ok: false, message: "Use a number with up to 4 decimals" }
  }

  const value = Number(text)
  if (value <= 0) return { ok: false, message: "Must be more than 0" }
  if (value >= MAX_PRICE) return { ok: false, message: "Too large" }
  return { ok: true, value }
}
