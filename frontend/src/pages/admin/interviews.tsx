import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/format'
import { INTERVIEW_STATUSES, type Interview } from '@/lib/types'
import { AdminGate, AdminHeader } from './shared'

export function AdminInterviewsPage() {
  return (
    <AppShell title="Interview Monitoring">
      <AdminGate>
        <MonitoringContent />
      </AdminGate>
    </AppShell>
  )
}

function MonitoringContent() {
  const [all, setAll] = useState<Interview[] | null>(null)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')

  useEffect(() => {
    let alive = true
    api.listInterviews().then((l) => {
      if (alive) setAll(l)
    })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!all) return []
    return all.filter((i) => (!status || i.status === status) && (!type || i.type === type))
  }, [all, status, type])

  return (
    <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-5">
      <AdminHeader
        title="Interview monitoring"
        description="Platform-wide interview activity and state (FR-34)."
      />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3.5">
        <FilterSelect label="Filter by status" value={status} onChange={setStatus}>
          <option value="">All statuses</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by type" value={type} onChange={setType}>
          <option value="">All types</option>
          {['Behavioral', 'Technical', 'Coding', 'Mixed'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </FilterSelect>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {filtered.length} session{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* table */}
      {all === null ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">No sessions match the selected filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((i) => (
                  <tr key={i.id} className="text-sm transition-colors hover:bg-accent/40">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{i.roleTitle}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">#{i.id}</p>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">Shravankumar C.</td>
                    <td className="px-4 py-3.5">
                      <TypeBadge type={i.type} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {fmtDate(i.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {i.durationMin}m
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums">
                      {i.score !== null ? i.score : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-md border border-input bg-transparent pl-3 pr-8 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}