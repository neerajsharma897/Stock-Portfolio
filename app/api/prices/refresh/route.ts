import { requireOwner } from "@/lib/auth"
import { refreshLivePrices } from "@/lib/prices/live"

// Polled every few seconds by the live prices badge. Angel One is only called
// when the refresh interval allows (see lib/prices/live.ts).
export async function POST() {
  await requireOwner()
  return Response.json(await refreshLivePrices())
}
