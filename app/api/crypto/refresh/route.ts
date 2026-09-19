import { requireOwner } from "@/lib/auth"
import { refreshCryptoPrices } from "@/lib/crypto/live"

// Polled by the live crypto badge. CoinDCX is only called when the refresh
// interval allows (see lib/crypto/live.ts).
export async function POST() {
  await requireOwner()
  return Response.json(await refreshCryptoPrices())
}
