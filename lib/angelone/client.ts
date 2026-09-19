import "server-only"

import type { AngelOneConfig } from "@/lib/angelone/config"
import {
  buildQuoteBatches,
  parseQuotes,
  type Quote,
  type QuoteExchange,
  type QuoteRequestBody,
  type QuoteRequestItem,
} from "@/lib/angelone/quotes"
import { generateTotp } from "@/lib/angelone/totp"
import {
  parseCandles,
  type Candle,
  type CandleInterval,
} from "@/lib/charts/candles"

// Endpoints, headers and limits from Angel One's SmartAPI docs (User, Market
// Data and Historical Data sections).
const API_ROOT = "https://apiconnect.angelone.in"
const LOGIN_PATH = "/rest/auth/angelbroking/user/v1/loginByPassword"
const QUOTE_PATH = "/rest/secure/angelbroking/market/v1/quote/"
const CANDLE_PATH = "/rest/secure/angelbroking/historical/v1/getCandleData"
const REQUEST_TIMEOUT_MS = 15_000
// Quotes are limited to 1 request per second.
const QUOTE_SPACING_MS = 1_100
// Historical candles are limited to 3 requests per second.
const CANDLE_SPACING_MS = 400
// Sessions last until midnight India time; renewing every few hours stays clear of that.
const SESSION_TTL_MS = 6 * 60 * 60 * 1000

// Required on every SmartAPI request. A server fetching market data has no
// meaningful device IP or MAC address to report, so fixed values are sent.
const CLIENT_HEADERS = {
  "X-UserType": "USER",
  "X-SourceID": "WEB",
  "X-ClientLocalIP": "127.0.0.1",
  "X-ClientPublicIP": "127.0.0.1",
  "X-MACAddress": "00:00:00:00:00:00",
}

export class AngelOneError extends Error {
  constructor(
    message: string,
    readonly kind: "login" | "session" | "request",
  ) {
    super(message)
    this.name = "AngelOneError"
  }
}

type Envelope = {
  status?: boolean
  message?: string
  errorcode?: string
  data?: unknown
}
type ApiResult = { httpStatus: number; envelope: Envelope | null }

async function post(
  path: string,
  config: AngelOneConfig,
  body: unknown,
  jwtToken?: string,
): Promise<ApiResult> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...CLIENT_HEADERS,
      "X-PrivateKey": config.apiKey,
      ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
    },
    body: JSON.stringify(body),
  })

  let envelope: Envelope | null = null
  try {
    envelope = (await response.json()) as Envelope
  } catch {
    envelope = null
  }
  return { httpStatus: response.status, envelope }
}

/** A readable error that never includes tokens or credentials. */
function describeFailure(result: ApiResult, what: string) {
  const detail = result.envelope?.message?.trim() || `HTTP ${result.httpStatus}`
  const code = result.envelope?.errorcode
    ? ` (${result.envelope.errorcode})`
    : ""
  return `${what}: ${detail}${code}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Sessions ---------------------------------------------------------------------

type Session = { jwtToken: string; expiresAt: number }
type SessionStore = { session?: Session; pendingLogin?: Promise<Session> }

// Kept on globalThis so it survives hot reloads in development.
const globalStore = globalThis as typeof globalThis & {
  __angelOneSession?: SessionStore
}
const sessionStore = () => (globalStore.__angelOneSession ??= {})

async function login(config: AngelOneConfig): Promise<Session> {
  let totp: string
  try {
    totp = generateTotp(config.totpSecret)
  } catch (error) {
    throw new AngelOneError(
      error instanceof Error ? error.message : "Invalid TOTP secret.",
      "login",
    )
  }

  const result = await post(LOGIN_PATH, config, {
    clientcode: config.clientCode,
    password: config.pin,
    totp,
  })
  const jwtToken = (result.envelope?.data as { jwtToken?: unknown } | null)
    ?.jwtToken
  if (!result.envelope?.status || typeof jwtToken !== "string" || !jwtToken) {
    throw new AngelOneError(
      describeFailure(result, "Angel One login failed"),
      "login",
    )
  }
  return { jwtToken, expiresAt: Date.now() + SESSION_TTL_MS }
}

/** A cached session, logging in once even if several requests need it at the same time. */
async function getSession(
  config: AngelOneConfig,
  forceNew = false,
): Promise<Session> {
  const store = sessionStore()
  if (!forceNew && store.session && store.session.expiresAt > Date.now()) {
    return store.session
  }
  store.pendingLogin ??= login(config)
    .then((session) => {
      store.session = session
      return session
    })
    .finally(() => {
      store.pendingLogin = undefined
    })
  return store.pendingLogin
}

/** Posts with the cached session, logging in again and retrying once if it's rejected. */
async function postWithSession(
  config: AngelOneConfig,
  path: string,
  body: unknown,
  { what, retryDelayMs }: { what: string; retryDelayMs: number },
): Promise<unknown> {
  let session = await getSession(config)
  let result = await post(path, config, body, session.jwtToken)
  if (result.envelope?.status) return result.envelope.data

  // An expired or rejected session: log in again and retry once.
  const sessionProblem =
    result.httpStatus === 401 ||
    /token|session/i.test(result.envelope?.message ?? "")
  if (sessionProblem) {
    session = await getSession(config, true)
    await sleep(retryDelayMs)
    result = await post(path, config, body, session.jwtToken)
    if (result.envelope?.status) return result.envelope.data
  }

  throw new AngelOneError(
    describeFailure(result, what),
    sessionProblem ? "session" : "request",
  )
}

// Quotes -----------------------------------------------------------------------

async function requestQuotes(
  config: AngelOneConfig,
  body: QuoteRequestBody,
): Promise<Quote[]> {
  return parseQuotes(
    await postWithSession(config, QUOTE_PATH, body, {
      what: "Angel One quote request failed",
      retryDelayMs: QUOTE_SPACING_MS,
    }),
  )
}

/** Latest price and previous close for each instrument, respecting SmartAPI's limits. */
export async function fetchQuotes(
  config: AngelOneConfig,
  items: readonly QuoteRequestItem[],
): Promise<Quote[]> {
  const quotes: Quote[] = []
  for (const [index, body] of buildQuoteBatches(items).entries()) {
    if (index > 0) await sleep(QUOTE_SPACING_MS)
    quotes.push(...(await requestQuotes(config, body)))
  }
  return quotes
}

// Historical candles -------------------------------------------------------------

export type CandleRequest = {
  exchange: QuoteExchange
  token: string
  interval: CandleInterval
  /** "yyyy-MM-dd HH:mm", India time */
  fromdate: string
  todate: string
}

// Requests wait their turn, so several charts opening together stay under the limit.
let candleQueue: Promise<unknown> = Promise.resolve()

/** Price history for one stock, oldest candle first. */
export function fetchCandles(
  config: AngelOneConfig,
  { exchange, token, interval, fromdate, todate }: CandleRequest,
): Promise<Candle[]> {
  const request = candleQueue.then(async () =>
    parseCandles(
      await postWithSession(
        config,
        CANDLE_PATH,
        { exchange, symboltoken: token, interval, fromdate, todate },
        {
          what: "Angel One chart request failed",
          retryDelayMs: CANDLE_SPACING_MS,
        },
      ),
    ),
  )
  candleQueue = request
    .catch(() => undefined)
    .then(() => sleep(CANDLE_SPACING_MS))
  return request
}
