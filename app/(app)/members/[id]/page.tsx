import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BrokerAccountDialog } from "@/app/(app)/members/[id]/broker-account-dialog"
import { DeleteAccountButton } from "@/app/(app)/members/[id]/delete-account-button"
import { MemberStatusActions } from "@/app/(app)/members/[id]/member-status-actions"
import { MemberFormDialog } from "@/app/(app)/members/member-form-dialog"
import { ComingSoon } from "@/components/coming-soon"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getMember } from "@/lib/data/members"
import { BROKER_LABELS, RELATION_LABELS } from "@/lib/members/options"

export async function generateMetadata({
  params,
}: PageProps<"/members/[id]">): Promise<Metadata> {
  const { id } = await params
  const member = await getMember(id)
  return { title: member?.name ?? "Member not found" }
}

export default async function MemberPage({
  params,
}: PageProps<"/members/[id]">) {
  const { id } = await params
  const member = await getMember(id)
  if (!member) notFound()

  const archived = !!member.archived_at
  const accounts = member.broker_accounts

  return (
    <>
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Members
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <MemberAvatar name={member.name} color={member.color} size="lg" />
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {member.name}
              </h1>
              {archived && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {RELATION_LABELS[member.relation]}
              {member.pan_last4 && <> · PAN ending {member.pan_last4}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived && <MemberFormDialog member={member} />}
          <MemberStatusActions
            memberId={member.id}
            name={member.name}
            archived={archived}
            accountCount={accounts.length}
          />
        </div>
      </div>

      {archived && (
        <p className="mb-6 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {member.name} is archived: hidden from the members list and, later,
          from family totals. Restore to make changes.
        </p>
      )}

      {member.notes && (
        <p className="mb-6 text-sm whitespace-pre-line text-muted-foreground">
          {member.notes}
        </p>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Broker and exchange accounts {member.name} holds.
            </CardDescription>
            {!archived && (
              <CardAction>
                <BrokerAccountDialog memberId={member.id} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No accounts linked yet.
                {!archived && " Add each broker or exchange they use."}
              </p>
            ) : (
              <ul className="divide-y">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="grid min-w-0 gap-0.5">
                      <p className="font-medium">
                        {BROKER_LABELS[account.broker]}
                        {account.label && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {account.label}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {account.client_id_last4
                          ? `Client ID ending ${account.client_id_last4}`
                          : "No client ID saved"}
                        {account.notes && ` · ${account.notes}`}
                      </p>
                    </div>
                    {!archived && (
                      <div className="flex shrink-0 gap-1">
                        <BrokerAccountDialog
                          memberId={member.id}
                          account={account}
                        />
                        <DeleteAccountButton
                          accountId={account.id}
                          broker={account.broker}
                          label={account.label}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <ComingSoon
          stage={4}
          title="Holdings"
          items={[
            "Opening balances and buy/sell entries for this member",
            "Current holdings with quantity, average cost and invested amount",
            "Value and P&L once prices arrive (Stages 5–6)",
          ]}
        />
      </div>
    </>
  )
}
