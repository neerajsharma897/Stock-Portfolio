import "server-only"

import { cache } from "react"
import { z } from "zod"

import { requireOwner } from "@/lib/auth"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type Member = Tables<"members">
export type BrokerAccount = Tables<"broker_accounts">
export type MemberWithAccounts = Member & { broker_accounts: BrokerAccount[] }

/** All members (active and archived) with their accounts, oldest first. */
export async function listMembers(): Promise<MemberWithAccounts[]> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .select("*, broker_accounts(*)")
    .order("created_at")
    .order("created_at", { referencedTable: "broker_accounts" })

  if (error) throw new Error(`Couldn't load members: ${error.message}`)
  return data
}

/** One member with their accounts, or null if the id is invalid or unknown. */
export const getMember = cache(
  async (id: string): Promise<MemberWithAccounts | null> => {
    await requireOwner()
    if (!z.uuid().safeParse(id).success) return null

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("members")
      .select("*, broker_accounts(*)")
      .eq("id", id)
      .order("created_at", { referencedTable: "broker_accounts" })
      .maybeSingle()

    if (error) throw new Error(`Couldn't load member: ${error.message}`)
    return data
  },
)
