import { DepositDialog } from "@/app/(app)/members/[id]/deposit-dialog"
import { IpoDialog } from "@/app/(app)/members/[id]/ipo-dialog"
import { OtherAssetDialog } from "@/app/(app)/members/[id]/other-asset-dialog"
import {
  deleteDeposit,
  deleteIpo,
  deleteOtherAsset,
} from "@/app/(app)/members/other-asset-actions"
import { DeleteButton } from "@/components/delete-button"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  Deposit,
  IpoApplication,
  OtherAsset,
} from "@/lib/data/other-assets"
import { formatDate, formatINR, formatSignedINR } from "@/lib/format"
import {
  FD_INTEREST_LABELS,
  IPO_STATUS_LABELS,
  OTHER_ASSET_LABELS,
} from "@/lib/other-assets/options"
import { cn } from "@/lib/utils"

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function DepositsCard({
  memberId,
  archived,
  deposits,
}: {
  memberId: string
  archived: boolean
  deposits: Deposit[]
}) {
  const running = deposits.filter((deposit) => !deposit.closed)
  const value = running.reduce((sum, deposit) => sum + deposit.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fixed deposits</CardTitle>
        <CardDescription>
          {running.length === 0
            ? "No running FDs."
            : `${plural(running.length, "FD", "FDs")} · ${formatINR(value, 0)} today, with interest`}
        </CardDescription>
        {!archived && (
          <CardAction>
            <DepositDialog memberId={memberId} />
          </CardAction>
        )}
      </CardHeader>
      {deposits.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {deposits.map((deposit) => {
              const gain = deposit.value - deposit.principal
              return (
                <li
                  key={deposit.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="grid min-w-0 gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {deposit.bank}
                      {deposit.closed ? (
                        <Badge variant="secondary">Closed</Badge>
                      ) : (
                        deposit.matured && (
                          <Badge variant="outline">Matured</Badge>
                        )
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatINR(deposit.principal, 0)} at {deposit.ratePct}% ·{" "}
                      {FD_INTEREST_LABELS[deposit.interest]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deposit.closedOn
                        ? `Closed on ${formatDate(deposit.closedOn)}`
                        : `${deposit.matured ? "Matured" : "Matures"} on ${formatDate(deposit.maturityDate)} · ${formatINR(deposit.maturityValue, 0)} at maturity`}
                    </p>
                  </div>
                  <div className="ml-auto flex items-start gap-2">
                    {!deposit.closed && (
                      <div className="text-right tabular-nums">
                        <p className="font-medium">
                          {formatINR(deposit.value, 0)}
                        </p>
                        <p
                          className={cn("text-xs", toneTextClass(toneOf(gain)))}
                        >
                          {formatSignedINR(gain, 0)} interest
                        </p>
                      </div>
                    )}
                    {!archived && (
                      <div className="flex gap-1">
                        <DepositDialog memberId={memberId} deposit={deposit} />
                        <DeleteButton
                          label={`Delete the ${deposit.bank} FD`}
                          title="Delete this FD?"
                          description={`The ${deposit.bank} FD of ${formatINR(deposit.principal, 0)} is removed. To keep it for the record, set a closing date instead. This can't be undone.`}
                          action={deleteDeposit.bind(null, deposit.id)}
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

export function OtherAssetsCard({
  memberId,
  archived,
  assets,
}: {
  memberId: string
  archived: boolean
  assets: OtherAsset[]
}) {
  const value = assets.reduce((sum, asset) => sum + asset.currentValue, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Other assets</CardTitle>
        <CardDescription>
          {assets.length === 0
            ? "Gold, PPF, EPF, NPS, bonds or property."
            : `${plural(assets.length, "asset", "assets")} · ${formatINR(value, 0)}`}
        </CardDescription>
        {!archived && (
          <CardAction>
            <OtherAssetDialog memberId={memberId} />
          </CardAction>
        )}
      </CardHeader>
      {assets.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {assets.map((asset) => {
              const gain = asset.currentValue - asset.invested
              return (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="grid min-w-0 gap-0.5">
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {OTHER_ASSET_LABELS[asset.kind]} · valued{" "}
                      {formatDate(asset.valueAsOf)} ·{" "}
                      {formatINR(asset.invested, 0)} invested
                    </p>
                  </div>
                  <div className="ml-auto flex items-start gap-2">
                    <div className="text-right tabular-nums">
                      <p className="font-medium">
                        {formatINR(asset.currentValue, 0)}
                      </p>
                      <p className={cn("text-xs", toneTextClass(toneOf(gain)))}>
                        {formatSignedINR(gain, 0)}
                      </p>
                    </div>
                    {!archived && (
                      <div className="flex gap-1">
                        <OtherAssetDialog memberId={memberId} asset={asset} />
                        <DeleteButton
                          label={`Delete ${asset.name}`}
                          title={`Delete ${asset.name}?`}
                          description="It leaves this member's and the family's totals. This can't be undone."
                          action={deleteOtherAsset.bind(null, asset.id)}
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

export function IposCard({
  memberId,
  archived,
  ipos,
}: {
  memberId: string
  archived: boolean
  ipos: IpoApplication[]
}) {
  const pending = ipos.filter((ipo) => ipo.status === "applied")

  return (
    <Card>
      <CardHeader>
        <CardTitle>IPO applications</CardTitle>
        <CardDescription>
          {ipos.length === 0
            ? "Track bids until shares are allotted. Not counted in totals."
            : pending.length > 0
              ? `${plural(pending.length, "application", "applications")} waiting for allotment`
              : `${plural(ipos.length, "application", "applications")}`}
        </CardDescription>
        {!archived && (
          <CardAction>
            <IpoDialog memberId={memberId} />
          </CardAction>
        )}
      </CardHeader>
      {ipos.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {ipos.map((ipo) => {
              const price = Number(ipo.price)
              return (
                <li
                  key={ipo.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="grid min-w-0 gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {ipo.company}
                      <Badge
                        variant={
                          ipo.status === "allotted" ? "secondary" : "outline"
                        }
                      >
                        {IPO_STATUS_LABELS[ipo.status]}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ipo.shares_applied} shares at {formatINR(price)} ={" "}
                      {formatINR(ipo.shares_applied * price, 0)} · applied{" "}
                      {formatDate(ipo.applied_on)}
                    </p>
                    {ipo.status === "allotted" && ipo.shares_allotted && (
                      <p className="text-xs text-muted-foreground">
                        {ipo.shares_allotted} allotted. Add them under Stocks as
                        a buy at {formatINR(price)} once they list.
                      </p>
                    )}
                  </div>
                  {!archived && (
                    <div className="ml-auto flex gap-1">
                      <IpoDialog
                        memberId={memberId}
                        ipo={{
                          id: ipo.id,
                          company: ipo.company,
                          appliedOn: ipo.applied_on,
                          sharesApplied: ipo.shares_applied,
                          price,
                          status: ipo.status,
                          sharesAllotted: ipo.shares_allotted,
                          notes: ipo.notes,
                        }}
                      />
                      <DeleteButton
                        label={`Delete the ${ipo.company} IPO application`}
                        title="Delete this application?"
                        description={`The ${ipo.company} IPO application is removed. This can't be undone.`}
                        action={deleteIpo.bind(null, ipo.id)}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
