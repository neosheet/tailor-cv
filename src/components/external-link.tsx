import * as React from "react"

/**
 * A URL rendered as a link that opens in a new tab, sharing the
 * target/rel contract everywhere a raw URL becomes clickable. Defaults to
 * showing the URL with its `http(s)://` prefix stripped; pass `children` to
 * show something else instead.
 */
export function ExternalLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string
  className?: string
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
      {children ?? href.replace(/^https?:\/\//, "")}
    </a>
  )
}
