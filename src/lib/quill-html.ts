/** Quill reports an untouched editor as `"<p><br></p>"`, not `""` — strip tags to tell "empty" from "has content". */
export function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === ""
}

/** Strips HTML tags for plain-text search matching. Uses a space, not empty string, so text on either side of a stripped tag doesn't get glued together. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ")
}
