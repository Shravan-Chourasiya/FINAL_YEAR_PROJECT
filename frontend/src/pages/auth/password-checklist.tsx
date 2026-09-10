import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const rules = [
  { id: 'len', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { id: 'num', label: 'At least one number', test: (v: string) => /\d/.test(v) },
  {
    id: 'case',
    label: 'Upper & lowercase letters',
    test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
]

export function passwordIsValid(value: string) {
  return rules.every((r) => r.test(value))
}

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {rules.map((r) => {
        const ok = r.test(value)
        return (
          <li
            key={r.id}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              ok ? 'text-signal-strong' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded-full ring-1 transition-colors',
                ok
                  ? 'bg-(--signal-strong)/15 ring-(--signal-strong)/30'
                  : 'bg-secondary ring-border',
              )}
            >
              {ok ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            {r.label}
          </li>
        )
      })}
    </ul>
  )
}