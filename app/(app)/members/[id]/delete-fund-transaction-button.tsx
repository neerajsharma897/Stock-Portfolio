"use client"

import { Trash2Icon } from "lucide-react"

import { deleteFundTransaction } from "@/app/(app)/members/fund-actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function DeleteFundTransactionButton({
  transactionId,
  summary,
}: {
  transactionId: string
  /** e.g. "SIP instalment of 55.82 units of Parag Parikh Flexi Cap Fund on 5 Sept 2026" */
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
      description={`This deletes the ${summary}. Fund holdings are recalculated. This can't be undone.`}
      confirmLabel="Delete"
      destructive
      onConfirm={async () =>
        showResult(await deleteFundTransaction(transactionId))
      }
    />
  )
}
