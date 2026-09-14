import { toast } from "sonner"

import type { FormState } from "@/lib/action-state"

/** Shows a toast for a Server Action result. Returns true on success. */
export function showResult(result: FormState): boolean {
  if (result?.status === "success") {
    toast.success(result.message)
    return true
  }
  toast.error(result?.message ?? "Something went wrong. Please try again.")
  return false
}
