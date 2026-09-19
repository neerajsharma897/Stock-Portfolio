"use client"

import { Trash2Icon } from "lucide-react"

import { deleteCryptoTransaction } from "@/app/(app)/members/crypto-actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function DeleteCryptoTransactionButton({
  transactionId,
  summary,
}: {
  transactionId: string
  /** e.g. "buy of 0.0125 BTC on 10 Sept 2026" */
  summary: string
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${summary}`}>
          <Trash2Icon />
        </Button>
      }
      title="Delete this entry?"
      description={`This deletes the ${summary}. Crypto holdings are recalculated. This can't be undone.`}
      confirmLabel="Delete"
      destructive
      onConfirm={async () =>
        showResult(await deleteCryptoTransaction(transactionId))
      }
    />
  )
}
