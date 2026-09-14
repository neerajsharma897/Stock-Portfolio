"use client"

import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { deleteMember, setMemberArchived } from "@/app/(app)/members/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

/** Archive for active members; Restore and Delete for archived ones. */
export function MemberStatusActions({
  memberId,
  name,
  archived,
  accountCount,
}: {
  memberId: string
  name: string
  archived: boolean
  accountCount: number
}) {
  const router = useRouter()
  const [restoring, startTransition] = useTransition()

  if (!archived) {
    return (
      <ConfirmDialog
        trigger={
          <Button variant="outline">
            <ArchiveIcon />
            Archive
          </Button>
        }
        title={`Archive ${name}?`}
        description="They'll be hidden from the members list. Nothing is deleted, and you can restore them at any time."
        confirmLabel="Archive"
        onConfirm={async () =>
          showResult(await setMemberArchived(memberId, true))
        }
      />
    )
  }

  const accountsNote =
    accountCount > 0
      ? ` Their ${accountCount} linked account${accountCount === 1 ? "" : "s"} will be deleted too.`
      : ""

  return (
    <>
      <Button
        variant="outline"
        disabled={restoring}
        onClick={() =>
          startTransition(async () => {
            showResult(await setMemberArchived(memberId, false))
          })
        }
      >
        <ArchiveRestoreIcon />
        {restoring ? "Restoring…" : "Restore"}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="destructive">
            <Trash2Icon />
            Delete
          </Button>
        }
        title={`Delete ${name} permanently?`}
        description={`This can't be undone.${accountsNote}`}
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          const deleted = showResult(await deleteMember(memberId))
          if (deleted) router.push("/members")
          return deleted
        }}
      />
    </>
  )
}
