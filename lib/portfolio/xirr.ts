// XIRR: the yearly return that makes the value of dated cash flows zero, the
// same calculation as Excel's XIRR (365-day years from the first flow's date).

export type CashFlow = {
  /** YYYY-MM-DD */
  date: string
  /** Money invested is negative; money received (or current value) is positive. */
  amount: number
}

const DAY_MS = 86_400_000
const TOLERANCE = 1e-7
const MAX_ITERATIONS = 100
const MIN_RATE = -0.9999
const MAX_RATE = 100

function toTime(date: string) {
  return Date.parse(`${date}T00:00:00Z`)
}

/** Annual return as a fraction (0.12 = 12%), or null when it can't be worked out. */
export function xirr(flows: readonly CashFlow[], guess = 0.1): number | null {
  const valid = flows.filter(
    (flow) => Number.isFinite(flow.amount) && flow.amount !== 0,
  )
  if (!valid.some((flow) => flow.amount < 0)) return null
  if (!valid.some((flow) => flow.amount > 0)) return null

  const start = Math.min(...valid.map((flow) => toTime(flow.date)))
  const points = valid.map((flow) => ({
    years: (toTime(flow.date) - start) / DAY_MS / 365,
    amount: flow.amount,
  }))

  const value = (rate: number) =>
    points.reduce((sum, p) => sum + p.amount / (1 + rate) ** p.years, 0)
  const slope = (rate: number) =>
    points.reduce(
      (sum, p) => sum - (p.years * p.amount) / (1 + rate) ** (p.years + 1),
      0,
    )

  // Newton's method is fast when it converges...
  let rate = guess
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const v = value(rate)
    if (Math.abs(v) < TOLERANCE) return rate
    const d = slope(rate)
    if (!Number.isFinite(d) || d === 0) break
    const next = rate - v / d
    if (!Number.isFinite(next) || next <= MIN_RATE || next > MAX_RATE) break
    rate = next
  }

  // ...otherwise fall back to bisection, which always converges on a sign change.
  let low = MIN_RATE
  let high = MAX_RATE
  let lowValue = value(low)
  if (Math.sign(lowValue) === Math.sign(value(high))) return null
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2
    const midValue = value(mid)
    if (Math.abs(midValue) < TOLERANCE || high - low < 1e-10) return mid
    if (Math.sign(midValue) === Math.sign(lowValue)) {
      low = mid
      lowValue = midValue
    } else {
      high = mid
    }
  }
  return null
}
