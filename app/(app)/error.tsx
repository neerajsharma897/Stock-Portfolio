"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
        <CardDescription>
          This page couldn&apos;t load. Check your internet connection. If it
          keeps happening, a database migration may not have been run yet (see
          README).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error.digest && (
          <p className="text-sm text-muted-foreground">
            Error reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <Button className="w-fit" onClick={() => retry()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  )
}
