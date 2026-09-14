import { z } from "zod"

/** Result returned by Server Actions to forms and buttons. */
export type FormState =
  | { status: "success"; message: string }
  | {
      status: "error"
      message?: string
      fieldErrors?: Record<string, string[] | undefined>
    }
  | undefined

export function validationError(error: z.ZodError): FormState {
  return {
    status: "error",
    fieldErrors: z.flattenError(error).fieldErrors,
  }
}

export function actionError(message: string): FormState {
  return { status: "error", message }
}
