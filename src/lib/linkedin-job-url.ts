/**
 * Cleans a pasted LinkedIn job link down to `https://linkedin.com/jobs/view/:id`,
 * stripping tracking params from a `/jobs/view/:id` link and extracting the id
 * out of a `/jobs/search-results/?currentJobId=:id` link. Non-LinkedIn URLs
 * (and LinkedIn URLs without a recognizable job id) are returned unchanged.
 */
export function cleanLinkedInJobUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  if (host !== "linkedin.com") return trimmed

  const viewMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/)
  const jobId = viewMatch?.[1] ?? parsed.searchParams.get("currentJobId")
  if (!jobId) return trimmed

  return `https://linkedin.com/jobs/view/${jobId}`
}
