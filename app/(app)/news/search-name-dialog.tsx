"use client"

import { SearchIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveNewsSearchName } from "@/app/(app)/news/actions"
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
import type { FormState } from "@/lib/action-state"

/** Changes the name searched on Google News for one stock. */
export function SearchNameDialog({
  instrumentId,
  symbol,
  searchName,
}: {
  instrumentId: number
  symbol: string
  searchName: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SearchIcon />
          Change search
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>News search for {symbol}</DialogTitle>
          <DialogDescription>
            Headlines are kept only if they mention this name. A company name
            usually works better than the symbol, e.g. &ldquo;Reliance
            Industries&rdquo; for RELIANCE.
          </DialogDescription>
        </DialogHeader>
        <SearchNameForm
          instrumentId={instrumentId}
          symbol={symbol}
          searchName={searchName}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function SearchNameForm({
  instrumentId,
  symbol,
  searchName,
  onSaved,
}: {
  instrumentId: number
  symbol: string
  searchName: string | null
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveNewsSearchName(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
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
      <input type="hidden" name="instrumentId" value={instrumentId} />
      <FormField
        id="news-search-name"
        label="Search for"
        hint={`Leave blank to search for ${symbol}. Saving clears this stock's current headlines and searches again.`}
        error={errors.searchName?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            name="searchName"
            autoComplete="off"
            maxLength={60}
            placeholder={symbol}
            defaultValue={searchName ?? ""}
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
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
