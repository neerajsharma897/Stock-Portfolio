import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BrokerAccountDialog } from "@/app/(app)/members/[id]/broker-account-dialog"
import { DeleteAccountButton } from "@/app/(app)/members/[id]/delete-account-button"
import { FundTransactionsCard } from "@/app/(app)/members/[id]/fund-transactions-card"
import { FundsCard } from "@/app/(app)/members/[id]/funds-card"
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
import {
  listMemberFundTransactions,
  toFundHoldingTransaction,
  toFundNav,
} from "@/lib/data/mutual-funds"
import { listPrices } from "@/lib/data/prices"
import {
  listMemberTransactions,
  toHoldingTransaction,
} from "@/lib/data/transactions"
import { BROKER_LABELS, RELATION_LABELS } from "@/lib/members/options"
import {
  combinedReturn,
  forFamilyTotals,
  groupFundHoldings,
  valueFund,
} from "@/lib/mutual-funds/portfolio"
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

  const [transactions, fundTransactions, liveStatus] = await Promise.all([
    listMemberTransactions(member.id),
    listMemberFundTransactions(member.id),
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
  const hasStocks = valued.some((holding) => holding.position.quantity > 0)

  const schemes = new Map(
    fundTransactions.map((transaction) => [
      transaction.amfi_code,
      transaction.scheme,
    ]),
  )
  const { holdings: fundHoldings, problems: fundProblems } = groupFundHoldings(
    fundTransactions.map(toFundHoldingTransaction),
  )
  const funds = fundHoldings.map((holding) =>
    valueFund(holding, toFundNav(schemes.get(holding.amfiCode))),
  )
  const summary = summarize([...valued, ...forFamilyTotals(funds)])

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card p-4 ring-1 ring-border">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/members"
            aria-label="Back to members"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </Link>
          <MemberAvatar name={member.name} color={member.color} size="lg" />
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
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
        <div className="flex flex-wrap items-center gap-2">
          {hasStocks && <LivePrices initialStatus={liveStatus} />}
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
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          {member.name} is archived: hidden from the members list and from
          family totals. Restore to make changes.
        </p>
      )}

      {member.notes && (
        <p className="rounded-xl bg-card px-4 py-3 text-sm whitespace-pre-line text-muted-foreground ring-1 ring-border">
          {member.notes}
        </p>
      )}

      {summary.holdingCount > 0 && <PortfolioSummaryTiles summary={summary} />}

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

      <FundsCard
        memberId={member.id}
        memberName={member.name}
        archived={archived}
        accounts={stockAccounts}
        funds={funds}
        problems={fundProblems}
        schemes={schemes}
        xirr={combinedReturn(funds)}
      />

      <TransactionsCard
        memberId={member.id}
        archived={archived}
        accounts={stockAccounts}
        transactions={transactions}
      />

      <FundTransactionsCard
        memberId={member.id}
        archived={archived}
        accounts={stockAccounts}
        transactions={fundTransactions}
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
  )
}
