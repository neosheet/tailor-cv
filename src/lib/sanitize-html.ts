import DOMPurify from "dompurify"

/** Strips scripts/handlers from Quill-authored HTML before it's rendered with `dangerouslySetInnerHTML`. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}
