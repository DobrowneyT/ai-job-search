// Adzuna's free API has no endpoint to fetch a single job by ID (confirmed
// during investigation: an `id` filter is not a real parameter, and the ad
// redirect page that would show the full posting returns 403). So `detail`
// cannot query Adzuna directly — instead `search` caches full job records to
// a small disk file, keyed by ID, and `detail` reads from that cache. This is
// the only way this data source can support a `detail` command at all.

import { tmpdir } from "node:os"
import { join } from "node:path"
import type { JobCard } from "./helpers.js"

const CACHE_PATH = join(tmpdir(), "adzuna-search-cache.json")
const MAX_ENTRIES = 500

type Cache = Record<string, JobCard>

async function readCache(): Promise<Cache> {
  try {
    const file = Bun.file(CACHE_PATH)
    if (!(await file.exists())) return {}
    return (await file.json()) as Cache
  } catch {
    return {}
  }
}

/** Merge new job cards into the cache, keeping only the most recent MAX_ENTRIES. */
export async function cacheJobs(jobs: JobCard[]): Promise<void> {
  if (jobs.length === 0) return
  const cache = await readCache()
  for (const job of jobs) cache[job.id] = job
  const ids = Object.keys(cache)
  if (ids.length > MAX_ENTRIES) {
    for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete cache[id]
  }
  await Bun.write(CACHE_PATH, JSON.stringify(cache))
}

export async function lookupCachedJob(id: string): Promise<JobCard | null> {
  const cache = await readCache()
  return cache[id] ?? null
}
