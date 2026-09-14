"use client"

import { Trash2Icon } from "lucide-react"

import { deleteBrokerAccount } from "@/app/(app)/members/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { brokerAccountName, type Broker } from "@/lib/members/options"
import { showResult } from "@/lib/show-result"

export function DeleteAccountButton({
  accountId,
  broker,
  label,
}: {
  accountId: string
  broker: Broker
  label: string | null
}) {
  const name = brokerAccountName({ broker, label })

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${name} account`}
        >
          <Trash2Icon />
        </Button>
      }
      title={`Delete ${name} account?`}
      description="This removes the account from this member. This can't be undone."
      confirmLabel="Delete"
      destructive
      onConfirm={async () => showResult(await deleteBrokerAccount(accountId))}
    />
  )
}
