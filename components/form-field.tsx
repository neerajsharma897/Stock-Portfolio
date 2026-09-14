import { Label } from "@/components/ui/label"

type ControlProps = {
  id: string
  "aria-invalid": boolean
  "aria-describedby"?: string
}

/** Label, control, hint and error message, wired together for screen readers. */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: (props: ControlProps) => React.ReactNode
}) {
  const showHint = !!hint && !error
  const describedBy = error
    ? `${id}-error`
    : showHint
      ? `${id}-hint`
      : undefined

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": describedBy,
      })}
      {showHint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
