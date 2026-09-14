"use client"

import { Trash2Icon } from "lucide-react"

import { deleteTransaction } from "@/app/(app)/members/transaction-actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function DeleteTransactionButton({
  transactionId,
  summary,
}: {
  transactionId: string
  /** e.g. "buy of 10 TCS on 14 Sept 2026" */
  summary: string
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${summary}`}>
          <Trash2Icon />
        </Button>
      }
      title="Delete this transaction?"
      description={`This deletes the ${summary}. Holdings are recalculated. This can't be undone.`}
      confirmLabel="Delete"
      destructive
      onConfirm={async () => showResult(await deleteTransaction(transactionId))}
    />
  )
}
