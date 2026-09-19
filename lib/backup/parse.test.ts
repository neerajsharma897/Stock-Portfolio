import { describe, expect, it } from "vitest"

import { encryptBackup } from "@/lib/backup/crypto.mjs"
import { parseBackupText } from "@/lib/backup/parse"
import {
  coinRefs,
  countBackup,
  fundRefs,
  stockRefs,
  type Backup,
} from "@/lib/backup/schema"

const MEMBER_ID = "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b"
const ACCOUNT_ID = "4a2d3b5f-6c7e-4f80-9bac-1d2e3f4a5b6c"
const WATCHLIST_ID = "8e6b7f9d-0abc-4d24-9ef0-5b6c7d8e9fa0"
const TIME = "2026-09-14T10:00:00+00:00"

const backup: Backup = {
  app: "family-portfolio",
  version: 5,
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
  cryptoTransactions: [
    {
      id: "7d5a6e8c-9fab-4c13-8def-4a5b6c7d8e9f",
      member_id: MEMBER_ID,
      broker_account_id: ACCOUNT_ID,
      market: "BTCINR",
      type: "buy",
      quantity: 0.0125,
      price: 7720121.2,
      charges: 12.5,
      trade_date: "2026-09-10",
      notes: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  watchlists: [
    {
      id: WATCHLIST_ID,
      name: "Banks",
      position: 0,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  watchlist: [
    {
      watchlist_id: WATCHLIST_ID,
      exchange: "NSE",
      token: "2885",
      symbol: "RELIANCE",
      note: "After results",
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  newsSearches: [
    {
      exchange: "NSE",
      token: "2885",
      symbol: "RELIANCE",
      search_name: "Reliance Industries",
    },
  ],
  corporateActions: [
    {
      id: "9f7c8a0e-1bcd-4e35-8f01-6c7d8e9fa0b1",
      exchange: "NSE",
      token: "11536",
      symbol: "TCS",
      kind: "bonus",
      ex_date: "2026-08-01",
      ratio_from: 1,
      ratio_to: 1,
      notes: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  fixedDeposits: [
    {
      id: "a08d9b1f-2cde-4f46-9012-7d8e9fa0b1c2",
      member_id: MEMBER_ID,
      bank: "SBI",
      principal: 100000,
      rate_pct: 7.1,
      interest: "quarterly",
      start_date: "2026-01-01",
      maturity_date: "2027-01-01",
      closed_on: null,
      notes: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  otherAssets: [],
  ipoApplications: [],
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

  it("reads a version 1 backup, which has no fund, crypto or watchlist rows", () => {
    const versionOne: Partial<Backup> = { ...backup, version: 1 }
    delete versionOne.mfTransactions
    delete versionOne.cryptoTransactions
    delete versionOne.watchlists
    delete versionOne.watchlist
    delete versionOne.newsSearches
    delete versionOne.corporateActions
    delete versionOne.fixedDeposits
    delete versionOne.otherAssets
    delete versionOne.ipoApplications
    const result = parseBackupText(JSON.stringify(versionOne), null)
    expect(result.backup.version).toBe(1)
    expect(result.backup.mfTransactions).toEqual([])
    expect(result.backup.cryptoTransactions).toEqual([])
    expect(result.backup.watchlists).toEqual([])
    expect(result.backup.watchlist).toEqual([])
    expect(result.backup.newsSearches).toEqual([])
    expect(result.backup.fixedDeposits).toEqual([])
  })

  it("reads a version 3 backup, whose watchlist stocks have no list", () => {
    const versionThree = structuredClone(backup) as Partial<Backup>
    versionThree.version = 3
    delete versionThree.watchlists
    delete versionThree.watchlist![0].watchlist_id
    const result = parseBackupText(JSON.stringify(versionThree), null)
    expect(result.backup.watchlists).toEqual([])
    expect(result.backup.watchlist[0].watchlist_id).toBeUndefined()
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

describe("countBackup and references", () => {
  it("counts rows and lists each referenced stock, fund and coin once", () => {
    expect(countBackup(backup)).toEqual({
      members: 1,
      brokerAccounts: 1,
      transactions: 1,
      fundEntries: 1,
      cryptoEntries: 1,
      watchlists: 1,
      watchlist: 1,
      deposits: 1,
      otherAssets: 0,
      ipos: 0,
      corporateActions: 1,
      prices: 1,
      holidays: 1,
      closingPrices: 1,
      snapshots: 0,
    })
    expect(stockRefs(backup)).toEqual([
      { exchange: "NSE", token: "11536", symbol: "TCS" },
      { exchange: "BSE", token: "500325", symbol: "RELIANCE" },
      { exchange: "NSE", token: "2885", symbol: "RELIANCE" },
    ])
    expect(fundRefs(backup)).toEqual([122639])
    expect(coinRefs(backup)).toEqual(["BTCINR"])
  })
})
