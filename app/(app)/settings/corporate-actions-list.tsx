import { deleteCorporateAction } from "@/app/(app)/settings/corporate-action-actions"
import { DeleteButton } from "@/components/delete-button"
import { describeCorporateAction } from "@/lib/corporate-actions/schema"
import type { CorporateActionRow } from "@/lib/data/corporate-actions"
import { formatDate } from "@/lib/format"

export function CorporateActionsList({
  actions,
}: {
  actions: CorporateActionRow[]
}) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        None yet. When a stock the family holds splits or issues bonus shares,
        add it here so quantities and average prices stay right.
      </p>
    )
  }

  return (
    <ul className="divide-y text-sm">
      {actions.map((action) => {
        const description = describeCorporateAction({
          kind: action.kind,
          ratioFrom: action.ratio_from,
          ratioTo: action.ratio_to,
        })
        return (
          <li
            key={action.id}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <div className="grid min-w-0 gap-0.5">
              <p>
                <span className="font-medium">{action.instrument.symbol}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {action.instrument.exchange} · {description}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Ex-date {formatDate(action.ex_date)}
                {action.notes && ` · ${action.notes}`}
              </p>
            </div>
            <DeleteButton
              label={`Delete ${description.toLowerCase()} of ${action.instrument.symbol}`}
              title="Delete this entry?"
              description={`${action.instrument.symbol}'s holdings go back to how they were without the ${action.kind}.`}
              action={deleteCorporateAction.bind(null, action.id)}
            />
          </li>
        )
      })}
    </ul>
  )
}
