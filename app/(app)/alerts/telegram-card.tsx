"use client"

import { ExternalLinkIcon, SendIcon } from "lucide-react"
import { useState, useTransition } from "react"

import {
  disconnectTelegram,
  finishTelegramLink,
  sendTestAlert,
  startTelegramLink,
  type TelegramLink,
} from "@/app/(app)/alerts/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

/** Links the owner's Telegram chat, or shows the linked chat with a test button. */
export function TelegramCard({ chatName }: { chatName: string | null }) {
  const [link, setLink] = useState<TelegramLink | null>(null)
  const [pending, startTransition] = useTransition()

  if (chatName) {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          Alerts go to <span className="font-medium">{chatName}</span>&apos;s
          Telegram.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                showResult(await sendTestAlert())
              })
            }
          >
            <SendIcon />
            {pending ? "Sending…" : "Send test alert"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                Disconnect
              </Button>
            }
            title="Disconnect Telegram?"
            description="No alerts will be sent until it's connected again."
            confirmLabel="Disconnect"
            destructive
            onConfirm={async () => showResult(await disconnectTelegram())}
          />
        </div>
      </div>
    )
  }

  if (link?.status === "ready") {
    return (
      <div className="grid gap-3 text-sm">
        <ol className="grid list-decimal gap-1 pl-5 text-muted-foreground">
          <li>
            On the phone whose Telegram should get the alerts, open the link
            below. It opens @{link.botName}.
          </li>
          <li>Press Start (or Restart) in Telegram.</li>
          <li>Come back here and press &ldquo;I pressed Start&rdquo;.</li>
        </ol>
        <Button asChild variant="outline" className="w-fit">
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            Open @{link.botName} in Telegram
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          The link works for 15 minutes.
        </p>
        <div className="flex gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (showResult(await finishTelegramLink())) setLink(null)
              })
            }
          >
            {pending ? "Checking…" : "I pressed Start"}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setLink(null)}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Not connected. Connect the Telegram account that should get the alerts.
      </p>
      {link?.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {link.message}
        </p>
      )}
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setLink(await startTelegramLink())
          })
        }
      >
        <SendIcon />
        {pending ? "Starting…" : "Connect Telegram"}
      </Button>
    </div>
  )
}
