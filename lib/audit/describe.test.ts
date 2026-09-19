import { describe, expect, it } from "vitest"

import { describeAuditEntry } from "@/lib/audit/describe"

describe("describeAuditEntry", () => {
  it("names the row and lists changed fields", () => {
    expect(
      describeAuditEntry({
        table_name: "fixed_deposits",
        action: "update",
        old_data: { id: "1", bank: "SBI", rate_pct: 7, updated_at: "a" },
        new_data: { id: "1", bank: "SBI", rate_pct: 7.1, updated_at: "b" },
      }),
    ).toBe("Changed FD: SBI (rate pct)")
  })

  it("summarises entries without a name", () => {
    expect(
      describeAuditEntry({
        table_name: "transactions",
        action: "insert",
        old_data: null,
        new_data: {
          type: "opening_balance",
          quantity: 502,
          trade_date: "2026-09-01",
        },
      }),
    ).toBe("Added stock entry: opening balance of 502 on 2026-09-01")
    expect(
      describeAuditEntry({
        table_name: "watchlist_items",
        action: "delete",
        old_data: { instrument_id: 2885, note: null },
        new_data: null,
      }),
    ).toBe("Deleted watchlist stock")
  })

  it("describes a restore as one entry", () => {
    expect(
      describeAuditEntry({
        table_name: "backup",
        action: "restore",
        old_data: null,
        new_data: { members: 5 },
      }),
    ).toBe("Restored a backup")
  })
})
