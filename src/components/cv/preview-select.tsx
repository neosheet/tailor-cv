import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * The picker behind both preview surfaces: choose a template on a CV, choose a
 * CV on a template.
 *
 * Neither choice is stored — a CV owns no template and a template owns no CV.
 * Both are just "show me this combination", which is why one component serves
 * both directions. See spec 03.
 */
export function PreviewSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const items = options.map((option) => ({
    value: option.value,
    label: option.label,
  }))

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onChange(next as string)}
      >
        <SelectTrigger size="sm" className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  )
}
