import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BrokerAccountDialog } from "@/app/(app)/members/[id]/broker-account-dialog"
import { DeleteAccountButton } from "@/app/(app)/members/[id]/delete-account-button"
import { HoldingsCard } from "@/app/(app)/members/[id]/holdings-card"
import { MemberStatusActions } from "@/app/(app)/members/[id]/member-status-actions"
import { TransactionsCard } from "@/app/(app)/members/[id]/transactions-card"
import { MemberFormDialog } from "@/app/(app)/members/member-form-dialog"
import { LivePrices } from "@/components/live-prices"
import { MemberAvatar } from "@/components/member-avatar"
import { PortfolioSummaryTiles } from "@/components/portfolio-summary-tiles"
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
import { listPrices } from "@/lib/data/prices"
import {
  listMemberTransactions,
  toHoldingTransaction,
} from "@/lib/data/transactions"
import { BROKER_LABELS, RELATION_LABELS } from "@/lib/members/options"
import { groupHoldings } from "@/lib/portfolio/member-holdings"
import {
  buildPriceItems,
  summarize,
  valueHolding,
} from "@/lib/portfolio/valuation"
import { getLiveStatus } from "@/lib/prices/live"

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
  // CoinDCX holds crypto (Stage 10), so it can't be used for stock transactions.
  const stockAccounts = accounts.filter(
    (account) => account.broker !== "coindcx",
  )

  const [transactions, liveStatus] = await Promise.all([
    listMemberTransactions(member.id),
    getLiveStatus(),
  ])
  const instruments = new Map(
    transactions.map((transaction) => [
      transaction.instrument_id,
      transaction.instrument,
    ]),
  )
  const prices = await listPrices(instruments.keys())
  const { holdings, problems } = groupHoldings(
    transactions.map(toHoldingTransaction),
  )
  const valued = holdings.map((holding) =>
    valueHolding(holding, prices.get(holding.instrumentId) ?? null),
  )
  const summary = summarize(valued)

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
          {member.name} is archived: hidden from the members list and from
          family totals. Restore to make changes.
        </p>
      )}

      {member.notes && (
        <p className="mb-6 text-sm whitespace-pre-line text-muted-foreground">
          {member.notes}
        </p>
      )}

      <div className="grid gap-4">
        {summary.holdingCount > 0 && (
          <>
            <div className="flex justify-end">
              <LivePrices initialStatus={liveStatus} />
            </div>
            <PortfolioSummaryTiles summary={summary} />
          </>
        )}

        <HoldingsCard
          memberId={member.id}
          memberName={member.name}
          archived={archived}
          accounts={stockAccounts}
          holdings={valued}
          problems={problems}
          instruments={instruments}
          priceItems={buildPriceItems(valued, instruments)}
        />

        <TransactionsCard
          memberId={member.id}
          archived={archived}
          accounts={stockAccounts}
          transactions={transactions}
        />

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
      </div>
    </>
  )
}
