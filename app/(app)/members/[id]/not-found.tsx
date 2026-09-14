import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function MemberNotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Member not found</CardTitle>
        <CardDescription>
          This member may have been deleted, or the link is wrong.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/members">Back to members</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
