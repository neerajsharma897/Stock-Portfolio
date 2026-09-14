import { ChevronRightIcon, UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { MemberFormDialog } from "@/app/(app)/members/member-form-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { listMembers, type MemberWithAccounts } from "@/lib/data/members"
import { brokerAccountName, RELATION_LABELS } from "@/lib/members/options"

export const metadata: Metadata = { title: "Members" }

function MemberCard({ member }: { member: MemberWithAccounts }) {
  const accounts = member.broker_accounts

  return (
    <Link
      href={`/members/${member.id}`}
      className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardContent className="flex items-start gap-3">
          <MemberAvatar name={member.name} color={member.color} />
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{member.name}</p>
              {member.archived_at && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {RELATION_LABELS[member.relation]}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <Badge key={account.id} variant="outline">
                    {brokerAccountName(account)}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  No accounts linked yet
                </span>
              )}
            </div>
          </div>
          <ChevronRightIcon
            className="mt-2 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function MembersPage() {
  const members = await listMembers()
  const active = members.filter((member) => !member.archived_at)
  const archived = members.filter((member) => member.archived_at)

  return (
    <>
      <PageHeader
        title="Members"
        description="Family members whose investments you track."
      >
        {active.length > 0 && (
          <MemberFormDialog usedColors={active.map((member) => member.color)} />
        )}
      </PageHeader>

      {active.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <UsersIcon className="size-8 text-muted-foreground" aria-hidden />
            <div className="grid gap-1">
              <p className="font-medium">No members yet</p>
              <p className="text-sm text-muted-foreground">
                Add each family member, then link their broker accounts.
              </p>
            </div>
            <MemberFormDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section
          className="mt-10 grid gap-3"
          aria-labelledby="archived-heading"
        >
          <h2
            id="archived-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Archived
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
