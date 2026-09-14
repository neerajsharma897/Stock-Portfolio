import { describe, expect, it } from "vitest"

import { encryptBackup } from "@/lib/backup/crypto.mjs"
import { parseBackupText } from "@/lib/backup/parse"
import {
  countBackup,
  fundRefs,
  stockRefs,
  type Backup,
} from "@/lib/backup/schema"

const MEMBER_ID = "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b"
const ACCOUNT_ID = "4a2d3b5f-6c7e-4f80-9bac-1d2e3f4a5b6c"
const TIME = "2026-09-14T10:00:00+00:00"

const backup: Backup = {
  app: "family-portfolio",
  version: 2,
  exportedAt: TIME,
  members: [
    {
      id: MEMBER_ID,
      name: "Dad",
      relation: "self",
      color: "#2563eb",
      pan_last4: null,
      notes: null,
      archived_at: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  brokerAccounts: [
    {
      id: ACCOUNT_ID,
      member_id: MEMBER_ID,
      broker: "zerodha",
      label: null,
      client_id_last4: null,
      notes: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  transactions: [
    {
      id: "5b3e4c6a-7d8f-4a91-8cbd-2e3f4a5b6c7d",
      member_id: MEMBER_ID,
      broker_account_id: ACCOUNT_ID,
      exchange: "NSE",
      token: "11536",
      symbol: "TCS",
      type: "opening_balance",
      quantity: 10,
      price: 3200.5,
      charges: 0,
      trade_date: "2026-09-01",
      notes: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  mfTransactions: [
    {
      id: "6c4f5d7b-8e9a-4b02-9dce-3f4a5b6c7d8e",
      member_id: MEMBER_ID,
      broker_account_id: ACCOUNT_ID,
      amfi_code: 122639,
      folio_number: "12345678",
      type: "sip",
      units: 55.8231,
      nav: 89.5712,
      charges: 0.25,
      trade_date: "2026-09-05",
      notes: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  instrumentPrices: [
    {
      exchange: "NSE",
      token: "11536",
      symbol: "TCS",
      last_price: 3300,
      previous_close: 3280,
      source: "angelone",
      priced_at: TIME,
      updated_at: TIME,
    },
  ],
  marketHolidays: [
    { holiday_date: "2026-10-20", description: "Diwali", created_at: TIME },
  ],
  eodPrices: [
    {
      exchange: "BSE",
      token: "500325",
      symbol: "RELIANCE",
      price_date: "2026-09-14",
      close_price: 1400,
      created_at: TIME,
    },
  ],
  portfolioSnapshots: [],
}

describe("parseBackupText", () => {
  it("reads a plain export", () => {
    const result = parseBackupText(JSON.stringify(backup), null)
    expect(result.encrypted).toBe(false)
    expect(result.backup).toEqual(backup)
  })

  it("reads an encrypted backup with its passphrase", () => {
    const text = encryptBackup(JSON.stringify(backup), "family secret")
    const result = parseBackupText(text, "family secret")
    expect(result.encrypted).toBe(true)
    expect(result.backup.members[0].name).toBe("Dad")
  })

  it("asks for the passphrase and rejects a wrong one", () => {
    const text = encryptBackup(JSON.stringify(backup), "family secret")
    expect(() => parseBackupText(text, null)).toThrow("Enter its passphrase")
    expect(() => parseBackupText(text, "guess")).toThrow("Wrong passphrase")
  })

  it("reads a version 1 backup, which has no mutual fund entries", () => {
    const versionOne: Partial<Backup> = { ...backup, version: 1 }
    delete versionOne.mfTransactions
    const result = parseBackupText(JSON.stringify(versionOne), null)
    expect(result.backup.version).toBe(1)
    expect(result.backup.mfTransactions).toEqual([])
  })

  it("rejects files that aren't backups, pointing at the problem", () => {
    expect(() => parseBackupText("not json", null)).toThrow(
      "isn't a Family Portfolio backup",
    )
    expect(() =>
      parseBackupText(JSON.stringify({ ...backup, app: "other" }), null),
    ).toThrow("problem at app")
    const badPrice = structuredClone(backup)
    badPrice.transactions[0].price = -1
    expect(() => parseBackupText(JSON.stringify(badPrice), null)).toThrow(
      "problem at transactions.0.price",
    )
  })
})

describe("countBackup and stockRefs", () => {
  it("counts rows and lists each referenced stock once", () => {
    expect(countBackup(backup)).toEqual({
      members: 1,
      brokerAccounts: 1,
      transactions: 1,
      fundEntries: 1,
      prices: 1,
      holidays: 1,
      closingPrices: 1,
      snapshots: 0,
    })
    expect(stockRefs(backup)).toEqual([
      { exchange: "NSE", token: "11536", symbol: "TCS" },
      { exchange: "BSE", token: "500325", symbol: "RELIANCE" },
    ])
    expect(fundRefs(backup)).toEqual([122639])
  })
})
