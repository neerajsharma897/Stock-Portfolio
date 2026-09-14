import { signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** Shown to a signed-in account that isn't the app owner. */
export function NoAccess({ email }: { email: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>No access</CardTitle>
          <CardDescription>
            {email || "This account"} isn&apos;t the owner of this app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
            <li>
              The Stage 1 database migration may not have been run yet (see
              README).
            </li>
            <li>
              Or a different account was created first. The first account
              becomes the owner.
            </li>
          </ul>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
