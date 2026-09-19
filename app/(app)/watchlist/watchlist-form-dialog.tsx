"use client"

import { ListPlusIcon, PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import {
  saveWatchlist,
  type WatchlistFormState,
} from "@/app/(app)/watchlist/actions"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type ListToRename = { id: string; name: string }

/** "New watchlist" button, or a rename icon when a list is passed. */
export function WatchlistFormDialog({ list }: { list?: ListToRename }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {list ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${list.name}`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <ListPlusIcon />
            New watchlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {list ? "Rename watchlist" : "New watchlist"}
          </DialogTitle>
          <DialogDescription>
            Group stocks however suits you, e.g. by sector or plan.
          </DialogDescription>
        </DialogHeader>
        <WatchlistForm
          list={list}
          onSaved={(message, watchlistId) => {
            setOpen(false)
            toast.success(message)
            if (!list) router.push(`/watchlist?list=${watchlistId}`)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function WatchlistForm({
  list,
  onSaved,
}: {
  list?: ListToRename
  onSaved: (message: string, watchlistId: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: WatchlistFormState, formData: FormData) => {
      const result = await saveWatchlist(prevState, formData)
      if (result?.status === "success" && "watchlistId" in result) {
        onSaved(result.message, result.watchlistId)
      }
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      {list && <input type="hidden" name="id" value={list.id} />}
      <FormField id="watchlist-name" label="Name" error={errors.name?.[0]}>
        {(props) => (
          <Input
            {...props}
            name="name"
            autoComplete="off"
            maxLength={40}
            placeholder="e.g. Banks"
            defaultValue={list?.name ?? ""}
            required
          />
        )}
      </FormField>

      {state?.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : list ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  )
}
