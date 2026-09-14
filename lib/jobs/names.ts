// Scheduled jobs. Schedules live in vercel.json (UTC); on Vercel's free plan each
// job runs once a day, at some point within its scheduled hour.

export const JOBS = {
  "daily-snapshot": {
    label: "Daily snapshot",
    schedule: "Weekdays, between 4:30 and 5:30 PM India time",
  },
  "mf-nav": {
    label: "Mutual fund NAVs",
    schedule: "Weekdays, between 11:30 PM and 12:30 AM India time",
  },
  "stock-list": {
    label: "Stock list update",
    schedule: "Mondays, between 7:30 and 8:30 AM India time",
  },
} as const

export type JobName = keyof typeof JOBS

export const JOB_NAMES = Object.keys(JOBS) as JobName[]
