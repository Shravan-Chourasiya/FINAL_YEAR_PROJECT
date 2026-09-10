import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, BarChart3, ClipboardList, Plus, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Bars, Sparkline } from '@/components/charts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AnalyticsData {
  average: number
  best: number
  total: number
  completed: number
  trend: number[]
  categories: { label: string; value: number }[]
  strongest: string[]
  weakest: string[]
  frequency: { label: string; value: number }[]
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [typeCounts, setTypeCounts] = useState<{ label: string; value: number }[]>([])

  useEffect(() => {
    let alive = true
    Promise.all([api.getAnalytics(), api.listInterviews()]).then(([a, list]) => {
      if (!alive) return
      setData(a as AnalyticsData)
      const counts: Record<string, number> = {}
      list.forEach((i) => {
        counts[i.type] = (counts[i.type] ?? 0) + 1
      })
      setTypeCounts(Object.entries(counts).map(([label, value]) => ({ label, value })))
    })
    return () => {
      alive = false
    }
  }, [])

  if (!data) {
    return (
      <AppShell title="Analytics">
        <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true">
          <Skeleton className="h-9 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Analytics">
      <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-6">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Performance analytics
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            How you're improving
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Scores, categories and skill signals aggregated across every
            completed interview.
          </p>
        </header>

        {data.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
              <BarChart3 className="size-6 text-primary" />
            </span>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
              No analytics yet.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Complete an interview to start building your performance profile.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/interviews/new" className={cn(buttonVariants(), 'h-10 px-4')}>
                <Plus className="size-4" />
                Start your first interview
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={BarChart3} label="Average score" value={String(data.average)} />
              <StatCard icon={Award} label="Best score" value={String(data.best)} />
              <StatCard icon={ClipboardList} label="Total interviews" value={String(data.total)} />
              <StatCard icon={Sparkles} label="Completed" value={String(data.completed)} />
            </div>

            {/* trend + categories */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Score over time</h2>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Last {data.trend.length} completed
                  </span>
                </div>
                <div className="mt-4">
                  <Sparkline values={data.trend} height={88} />
                </div>
              </section>
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold">Category comparison</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {data.categories.map((c) => (
                    <div key={c.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span>{c.label}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {c.value}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${c.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* skills + frequency */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold">Skill analysis</h2>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-strong)]">
                  Strongest topics
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.strongest.map((s) => (
                    <Badge key={s} variant="strong" dot>
                      {s}
                    </Badge>
                  ))}
                </div>
                <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-weak)]">
                  Weakest topics
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.weakest.map((w) => (
                    <Badge key={w} variant="weak" dot>
                      {w}
                    </Badge>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Frequently evaluated skills</h2>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    appearances
                  </span>
                </div>
                <Bars data={data.frequency} height={150} color="var(--chart-5)" />
              </section>
            </div>

            {/* breakdown by type */}
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Interview breakdown by type</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  all sessions
                </span>
              </div>
              <Bars data={typeCounts} height={150} color="var(--chart-1)" />
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3
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