// Used by .github/workflows/backup.yml. Reads the app's JSON export on stdin and
// writes an encrypted backup to stdout. The passphrase comes from BACKUP_PASSPHRASE.
// The result can be restored in the app: Settings → Backup & restore.

import { encryptBackup } from "../lib/backup/crypto.mjs"

const passphrase = process.env.BACKUP_PASSPHRASE
if (!passphrase) {
  console.error("BACKUP_PASSPHRASE isn't set.")
  process.exit(1)
}

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const plaintext = Buffer.concat(chunks).toString("utf8")

// Refuse to encrypt anything that isn't an export, such as an error page.
let parsed
try {
  parsed = JSON.parse(plaintext)
} catch {
  console.error("The export isn't valid JSON.")
  process.exit(1)
}
if (parsed?.app !== "family-portfolio") {
  console.error("The download doesn't look like a Family Portfolio export.")
  process.exit(1)
}

process.stdout.write(encryptBackup(plaintext, passphrase))
