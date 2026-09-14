"use client"

import { CheckIcon, PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveMember } from "@/app/(app)/members/actions"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { FormState } from "@/lib/action-state"
import {
  MEMBER_COLORS,
  MEMBER_RELATIONS,
  RELATION_LABELS,
  type MemberRelation,
} from "@/lib/members/options"

export type EditableMember = {
  id: string
  name: string
  relation: MemberRelation
  color: string
  pan_last4: string | null
  notes: string | null
}

/** "Add member" button, or "Edit" when a member is passed, that opens the member form. */
export function MemberFormDialog({
  member,
  usedColors = [],
}: {
  member?: EditableMember
  usedColors?: string[]
}) {
  const [open, setOpen] = useState(false)
  const defaultColor =
    member?.color ??
    (
      MEMBER_COLORS.find((color) => !usedColors.includes(color.value)) ??
      MEMBER_COLORS[0]
    ).value

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {member ? (
          <Button variant="outline">
            <PencilIcon />
            Edit
          </Button>
        ) : (
          <Button>
            <PlusIcon />
            Add member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {member ? `Edit ${member.name}` : "Add member"}
          </DialogTitle>
          <DialogDescription>
            {member
              ? "Update this family member's details."
              : "Add a family member whose investments you track."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so errors from a previous attempt are cleared. */}
        <MemberForm
          member={member}
          defaultColor={defaultColor}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({
  member,
  defaultColor,
  onSaved,
}: {
  member?: EditableMember
  defaultColor: string
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveMember(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}

  // Submitting through startTransition (not the form's action prop) keeps typed
  // values in the fields when the server returns validation errors.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      {member && <input type="hidden" name="id" value={member.id} />}

      <FormField id="member-name" label="Name" error={errors.name?.[0]}>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={member?.name}
            maxLength={60}
            autoComplete="off"
            required
          />
        )}
      </FormField>

      <FormField
        id="member-relation"
        label="Relation to you"
        error={errors.relation?.[0]}
      >
        {(props) => (
          <Select name="relation" defaultValue={member?.relation}>
            <SelectTrigger {...props} className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_RELATIONS.map((relation) => (
                <SelectItem key={relation} value={relation}>
                  {RELATION_LABELS[relation]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <fieldset
        className="grid gap-2"
        aria-describedby={errors.color ? "member-color-error" : undefined}
      >
        <legend className="mb-2 text-sm leading-none font-medium">
          Colour
        </legend>
        <div className="flex flex-wrap gap-2">
          {MEMBER_COLORS.map((color) => (
            <label key={color.value} className="relative cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color.value}
                defaultChecked={color.value === defaultColor}
                className="peer sr-only"
              />
              <span
                className="block size-8 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                style={{ backgroundColor: color.value }}
              />
              <CheckIcon
                aria-hidden
                className="pointer-events-none absolute inset-0 m-auto size-4 text-white opacity-0 peer-checked:opacity-100"
              />
              <span className="sr-only">{color.label}</span>
            </label>
          ))}
        </div>
        {errors.color && (
          <p id="member-color-error" className="text-sm text-destructive">
            {errors.color[0]}
          </p>
        )}
      </fieldset>

      <FormField
        id="member-pan"
        label="PAN (last 4 characters)"
        hint="Optional, e.g. 234F. Helps match statements later. Never enter the full PAN."
        error={errors.panLast4?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            name="panLast4"
            defaultValue={member?.pan_last4 ?? ""}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-28 uppercase"
          />
        )}
      </FormField>

      <FormField id="member-notes" label="Notes" error={errors.notes?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="notes"
            defaultValue={member?.notes ?? ""}
            maxLength={500}
            rows={2}
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
          {pending ? "Saving…" : member ? "Save" : "Add member"}
        </Button>
      </DialogFooter>
    </form>
  )
}
