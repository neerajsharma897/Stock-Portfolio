"use client"

import { DownloadIcon, FileCheckIcon, FileSpreadsheetIcon } from "lucide-react"
import { useRef, useState, useTransition } from "react"

import {
  previewRestore,
  restoreBackup,
  type RestorePreview,
} from "@/app/(app)/settings/backup-actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ENVELOPE_FORMAT } from "@/lib/backup/envelope.mjs"
import type { BackupCounts } from "@/lib/backup/schema"
import { formatDate, formatQuantity } from "@/lib/format"
import { showResult } from "@/lib/show-result"

const COUNT_LABELS: [keyof BackupCounts, string][] = [
  ["members", "Members"],
  ["brokerAccounts", "Broker accounts"],
  ["transactions", "Stock transactions"],
  ["fundEntries", "Mutual fund entries"],
  ["cryptoEntries", "Crypto entries"],
  ["watchlists", "Watchlists"],
  ["watchlist", "Watchlist stocks"],
  ["deposits", "Fixed deposits"],
  ["otherAssets", "Other assets"],
  ["ipos", "IPO applications"],
  ["corporateActions", "Splits & bonuses"],
  ["prices", "Saved prices"],
  ["holidays", "Market holidays"],
  ["closingPrices", "Daily closing prices"],
  ["snapshots", "Daily portfolio snapshots"],
]

export function BackupCard() {
  const formRef = useRef<HTMLFormElement>(null)
  const [encrypted, setEncrypted] = useState(false)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [checking, startChecking] = useTransition()

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPreview(null)
    setEncrypted(false)
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const json = JSON.parse(await file.text())
      setEncrypted(json?.format === ENVELOPE_FORMAT)
    } catch {
      // Not JSON: "Check file" explains the problem.
    }
  }

  function checkFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startChecking(async () => {
      setPreview(await previewRestore(formData))
    })
  }

  async function confirmRestore() {
    if (!formRef.current) return false
    const restored = showResult(
      await restoreBackup(new FormData(formRef.current)),
    )
    if (restored) {
      formRef.current.reset()
      setPreview(null)
      setEncrypted(false)
    }
    return restored
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-labelledby="export-heading">
        <div className="grid gap-1">
          <h3 id="export-heading" className="text-sm font-medium">
            Download your data
          </h3>
          <p className="text-sm text-muted-foreground">
            Members, accounts, stock, mutual fund and crypto entries, FDs, other
            assets, watchlists, prices, holidays and daily history in one file.
            Keep it somewhere safe; it isn&apos;t encrypted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="w-fit">
            <a href="/api/export" download>
              <DownloadIcon />
              Download data
            </a>
          </Button>
          <Button asChild variant="outline" className="w-fit">
            <a href="/api/export/excel" download>
              <FileSpreadsheetIcon />
              Download Excel
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          &ldquo;Download data&rdquo; is the file to restore from.
          &ldquo;Download Excel&rdquo; is for reading: holdings, this
          year&apos;s capital gains and every entry, one sheet each.
        </p>
      </section>

      <Separator />

      <section className="grid gap-3" aria-labelledby="restore-heading">
        <div className="grid gap-1">
          <h3 id="restore-heading" className="text-sm font-medium">
            Restore from a backup
          </h3>
          <p className="text-sm text-muted-foreground">
            Use a downloaded file or a weekly encrypted backup from GitHub
            (unzip it first). Restoring{" "}
            <strong className="font-medium text-foreground">
              replaces all current data
            </strong>{" "}
            with the file&apos;s contents. Download the stock, fund and coin
            lists above first.
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={checkFile}
          className="grid gap-3 sm:max-w-md"
          noValidate
        >
          <FormField id="backup-file" label="Backup file">
            {(props) => (
              <Input
                {...props}
                type="file"
                name="file"
                accept=".json,application/json"
                onChange={handleFileChange}
              />
            )}
          </FormField>
          {encrypted && (
            <FormField
              id="backup-passphrase"
              label="Passphrase"
              hint="The BACKUP_PASSPHRASE saved in GitHub when this backup was made."
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  name="passphrase"
                  autoComplete="off"
                  onChange={() => setPreview(null)}
                />
              )}
            </FormField>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={checking}
            className="w-fit"
          >
            <FileCheckIcon />
            {checking ? "Checking…" : "Check file"}
          </Button>
        </form>

        {preview?.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {preview.message}
          </p>
        )}

        {preview?.status === "ready" && (
          <div className="grid gap-3 rounded-lg border p-4 sm:max-w-md">
            <p className="text-sm font-medium">
              {preview.encrypted ? "Encrypted backup" : "Backup"} from{" "}
              {formatDate(preview.exportedAt)}
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
              {COUNT_LABELS.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right tabular-nums">
                    {formatQuantity(preview.counts[key])}
                  </dd>
                </div>
              ))}
            </dl>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" className="w-fit">
                  Replace all data with this backup
                </Button>
              }
              title="Replace all data?"
              description={`This deletes the current members, accounts, stock, mutual fund and crypto entries, watchlist, prices, holidays and history, then loads the backup from ${formatDate(preview.exportedAt)}. Download your current data first if you might need it. This can't be undone.`}
              confirmLabel="Replace all data"
              destructive
              onConfirm={confirmRestore}
            />
          </div>
        )}
      </section>
    </div>
  )
}
