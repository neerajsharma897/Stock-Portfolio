import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** Shown instead of the app until Supabase settings are added to .env.local. */
export function SetupNotice() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Connect Supabase to continue</CardTitle>
          <CardDescription>
            The app can&apos;t find its Supabase settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ol className="grid list-decimal gap-2 pl-5">
            <li>
              Copy <code className="font-mono">.env.example</code> to{" "}
              <code className="font-mono">.env.local</code>.
            </li>
            <li>
              Fill in the URL and publishable key from Supabase → Project
              Settings → API Keys.
            </li>
            <li>
              Restart <code className="font-mono">npm run dev</code>.
            </li>
          </ol>
          <p className="text-muted-foreground">Full steps are in README.md.</p>
        </CardContent>
      </Card>
    </main>
  )
}
