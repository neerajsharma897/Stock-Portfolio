import "server-only"

// Telegram Bot API with plain fetch. The token stays on the server; error
// messages come from Telegram's description and never include it.
const API_ROOT = "https://api.telegram.org"
const TIMEOUT_MS = 15_000

/** The bot token from @BotFather, or null until TELEGRAM_BOT_TOKEN is set. */
export function getTelegramToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  return token && /^\d+:[\w-]{20,}$/.test(token) ? token : null
}

async function callTelegram<T>(method: string, body?: object): Promise<T> {
  const token = getTelegramToken()
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN isn't set.")

  let response: Response
  try {
    response = await fetch(`${API_ROOT}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Couldn't reach Telegram (${reason}).`)
  }

  const json = (await response.json().catch(() => null)) as {
    ok?: boolean
    result?: T
    description?: string
  } | null
  if (!json?.ok) {
    throw new Error(
      `Telegram said: ${json?.description ?? `HTTP ${response.status}`}`,
    )
  }
  return json.result as T
}

/** Sends a message using Telegram's HTML formatting (<b>, <i>, <code>). */
export async function sendTelegramMessage(
  chatId: number,
  html: string,
): Promise<void> {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  })
}

/** The bot's @username, for the link that opens a chat with it. */
export async function getBotUsername(): Promise<string> {
  const me = await callTelegram<{ username?: string }>("getMe")
  if (!me.username) throw new Error("The bot has no username.")
  return me.username
}

type Update = {
  message?: {
    text?: string
    chat: {
      id: number
      type: string
      first_name?: string
      last_name?: string
      username?: string
    }
  }
}

/**
 * Finds the private chat that sent "/start <code>" to the bot (the link on the
 * Alerts page sends that when Start is pressed). Newest messages first.
 */
export async function findStartMessage(
  code: string,
): Promise<{ chatId: number; name: string } | null> {
  const updates = await callTelegram<Update[]>("getUpdates", {
    allowed_updates: ["message"],
  })
  for (const update of [...updates].reverse()) {
    const message = update.message
    if (message?.chat.type !== "private") continue
    if (message.text?.trim() !== `/start ${code}`) continue
    const { chat } = message
    return {
      chatId: chat.id,
      name:
        [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
        chat.username ||
        "Telegram",
    }
  }
  return null
}
