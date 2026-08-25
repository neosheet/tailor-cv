import ReactQuill from "react-quill-new"
import "react-quill-new/dist/quill.snow.css"

import { cn } from "@/lib/utils"

const TOOLBAR_MODULES = {
  toolbar: [
    [{ header: [false, 2, 3] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
}

/**
 * `toolbar: false` only removes the button row — Quill's clipboard matchers
 * still key off `formats` below, so pasted rich text (headings/lists/links)
 * is preserved either way.
 */
const NO_TOOLBAR_MODULES = { toolbar: false }

/**
 * Pasting a job listing off a web page carries along whatever inline
 * formats that page used — fonts, colors, sizes, images — even though the
 * toolbar above only exposes headings/bold/italic/underline/strike/lists/
 * link. Restricting `formats` to that same set makes Quill's paste handler
 * strip the rest instead of smuggling them into `vacancyDetail`'s HTML.
 */
const ALLOWED_FORMATS = ["header", "bold", "italic", "underline", "strike", "list", "link"]

/**
 * Rich-text input for `vacancyDetail`, replacing the plain `Textarea` so
 * pasted job descriptions keep their headings/lists/links instead of
 * flattening to unstructured text. Wraps `react-quill-new` (the maintained,
 * React 19-compatible fork) and restyles its Snow theme chrome to match
 * shadcn's `Input`/`Textarea` via Tailwind descendant selectors — no custom
 * CSS file, per the `.ql-*` classes Quill renders internally.
 */
export function VacancyDetailEditor({
  id,
  value,
  onValueChange,
  placeholder,
  hideToolbar,
}: {
  id?: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  hideToolbar?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-input transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        "[&_.ql-toolbar]:rounded-t-lg [&_.ql-toolbar]:border-x-0 [&_.ql-toolbar]:border-t-0 [&_.ql-toolbar]:border-b-input",
        hideToolbar
          ? "[&_.ql-container]:rounded-lg [&_.ql-container]:border-0 [&_.ql-container]:font-sans"
          : "[&_.ql-container]:rounded-b-lg [&_.ql-container]:border-0 [&_.ql-container]:font-sans",
        "[&_.ql-editor]:min-h-24 [&_.ql-editor]:text-base [&_.ql-editor]:md:text-sm [&_.ql-editor]:break-words [&_.ql-editor]:[overflow-wrap:anywhere]",
        "[&_.ql-editor.ql-blank::before]:text-muted-foreground [&_.ql-editor.ql-blank::before]:not-italic",
        "[&_.ql-stroke]:stroke-foreground [&_.ql-fill]:fill-foreground [&_.ql-picker-label]:text-foreground"
      )}
    >
      <ReactQuill
        id={id}
        theme="snow"
        value={value}
        onChange={onValueChange}
        modules={hideToolbar ? NO_TOOLBAR_MODULES : TOOLBAR_MODULES}
        formats={ALLOWED_FORMATS}
        placeholder={placeholder}
      />
    </div>
  )
}
