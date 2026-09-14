import "server-only"

import type { JobName } from "@/lib/jobs/names"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type JobOutcome = {
  status: "success" | "skipped" | "failed"
  summary: string
  error?: string | null
}

/** Runs `task` and records it in job_runs. A thrown error becomes a failed run. */
export async function runJob(
  supabase: AppSupabaseClient,
  job: JobName,
  task: () => Promise<JobOutcome>,
): Promise<JobOutcome> {
  const { data: run, error } = await supabase
    .from("job_runs")
    .insert({ job })
    .select("id")
    .single()
  if (error) throw new Error(`Couldn't record the job run: ${error.message}`)

  let outcome: JobOutcome
  try {
    outcome = await task()
  } catch (taskError) {
    outcome = {
      status: "failed",
      summary: "The job stopped with an error.",
      error: taskError instanceof Error ? taskError.message : String(taskError),
    }
  }

  const { error: updateError } = await supabase
    .from("job_runs")
    .update({
      status: outcome.status,
      summary: outcome.summary,
      error: outcome.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id)
  if (updateError) {
    console.error(`Couldn't finish job run ${run.id}: ${updateError.message}`)
  }
  return outcome
}
