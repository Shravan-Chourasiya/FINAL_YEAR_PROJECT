import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CheckCircle2, ClipboardList, Users } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Bars } from '@/components/charts'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { AdminUser, Interview } from '@/lib/types'
import { AdminGate, AdminHeader } from './shared'

export function AdminOverviewPage() {
  return (
    <AppShell title="Admin Overview">
      <AdminGate>
        <OverviewContent />
      </AdminGate>
    </AppShell>
  )
}

function OverviewContent() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [interviews, setInterviews] = useState<Interview[] | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([api.listAdminUsers(), api.listInterviews()]).then(([u, i]) => {
      if (!alive) return
      setUsers(u)
      setInterviews(i)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!users || !interviews) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true">
        <Skeleton className="h-20 w-full max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const completed = interviews.filter((i) => i.status === 'COMPLETED').length
  const live = interviews.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'CREATED')
  const typeCounts = ['Behavioral', 'Technical', 'Coding', 'Mixed'].map((t) => ({
    label: t,
    value: interviews.filter((i) => i.type === t).length,
  }))

  return (
    <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-6">
      <AdminHeader
        title="Platform overview"
        description="Usage and activity across all SynthView AI users (FR-33)."
      />

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={String(users.length)} />
        <StatCard
          icon={Activity}
          label="Active users"
          value={String(users.filter((u) => u.status === 'Active').length)}
        />
        <StatCard icon={ClipboardList} label="Total interviews" value={String(interviews.length)} />
        <StatCard icon={CheckCircle2} label="Completed" value={String(completed)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* usage by type */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Interviews by type</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              platform-wide
            </span>
          </div>
          <Bars data={typeCounts} height={150} color="var(--chart-1)" />
        </section>

        {/* live activity */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live activity</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {live.length} open
            </span>
          </div>
          {live.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No open interviews right now.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {live.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.roleTitle}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {i.company} · {timeAgo(i.lastActivityAt)}
                    </p>
                  </div>
                  <StatusBadge status={i.status} />
                  <Link
                    to={`/interviews/${i.id}`}
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    Inspect →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
          <Icon className="size-4 text-primary" />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}