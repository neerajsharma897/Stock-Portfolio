// Supabase's API returns at most 1,000 rows per request, so long lists are read in pages.
export const PAGE_SIZE = 1000

type Page<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

/** Reads every row. `fetchPage` must use a stable order and `.range(from, to)`. */
export async function readAllRows<T>(
  label: string,
  fetchPage: (from: number, to: number) => Page<T>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Couldn't load ${label}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}
