"use client"

import { Trash2Icon } from "lucide-react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { FormState } from "@/lib/action-state"
import { showResult } from "@/lib/show-result"

/**
 * A trash icon that asks before running a delete Server Action. Pass the
 * action with its id bound, e.g. `deleteDeposit.bind(null, deposit.id)`.
 */
export function DeleteButton({
  label,
  title,
  description,
  action,
}: {
  /** Accessible name, e.g. "Delete SBI fixed deposit". */
  label: string
  title: string
  description: string
  action: () => Promise<FormState>
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <Trash2Icon />
        </Button>
      }
      title={title}
      description={description}
      confirmLabel="Delete"
      destructive
      onConfirm={async () => showResult(await action())}
    />
  )
}
