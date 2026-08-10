import type { CvSnapshotV1 } from "@/lib/cv-snapshot"

/**
 * Triggers a browser download of a snapshot as `<slugified-name>.json` — the
 * "Export" action on the CV list and the CV print page both call this.
 *
 * Deliberately split out of `cv-snapshot.ts`: that file's `CvSnapshotV1` type
 * is imported (type-only) by `mocks/types.ts`, which `scripts/seed.ts` pulls
 * in, so `cv-snapshot.ts` is part of `tsconfig.node.json`'s program (lib:
 * ES2023, no DOM). This module uses `Blob`/`URL`/`document`, so it must stay
 * out of that import chain — only UI components import it, never `scripts/`.
 */
export function downloadCvSnapshot(snapshot: CvSnapshotV1): void {
  const slug =
    snapshot.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cv"
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${slug}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
