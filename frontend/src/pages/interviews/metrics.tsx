import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Activity, Code2, ListChecks, Timer } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Bars } from '@/components/charts'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  DetailSkeleton,
  InterviewHeader,
  InterviewNotFound,
  useInterview,
} from './shared'

interface Metrics {
  interviewId: string
  overall: number
  questionScores: { label: string; value: number }[]
  topics: { label: string; value: number }[]
  timePerQuestion: number[]
  activePercent: number
  coding: {
    passed: number
    total: number
    attempts: number
    runtime: string
    memory: string
  }
}

export function InterviewMetricsPage() {
  const { id } = useParams()
  const { interview, loading } = useInterview(id)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    api
      .getMetrics(id)
      .then((m) => {
        if (alive) setMetrics(m as Metrics)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [id])

  if (loading || (!metrics && !failed)) {
    return (
      <AppShell title="Interview Metrics">
        <DetailSkeleton />
      </AppShell>
    )
  }
  if (!interview || !metrics) {
    return (
      <AppShell title="Interview Metrics">
        <InterviewNotFound />
      </AppShell>
    )
  }

  const hasCoding = interview.type !== 'Behavioral'
  const timeData = metrics.timePerQuestion.map((v, i) => ({
    label: `Q${i + 1}`,
    value: v,
  }))

  return (
    <AppShell title="Interview Metrics">
      <div className="animate-slide-up mx-auto flex max-w-5xl flex-col gap-5">
        <InterviewHeader interview={interview} active="metrics" />

        {/* stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Activity} label="Overall score" value={String(metrics.overall)} />
          <StatCard icon={Timer} label="Active time" value={`${metrics.activePercent}%`} />
          <StatCard icon={ListChecks} label="Questions" value={String(metrics.questionScores.length)} />
          {hasCoding ? (
            <StatCard
              icon={Code2}
              label="Tests passed"
              value={`${metrics.coding.passed}/${metrics.coding.total}`}
            />
          ) : (
            <StatCard icon={Code2} label="Coding" value="n/a" />
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Question-level scores" note="per-question evaluation">
            <Bars data={metrics.questionScores} height={150} color="var(--chart-1)" />
          </ChartCard>
          <ChartCard title="Topic performance" note="strength by topic">
            <Bars data={metrics.topics} height={150} color="var(--chart-2)" />
          </ChartCard>
          <ChartCard title="Time per question" note="seconds spent">
            <Bars data={timeData} height={150} color="var(--chart-3)" />
          </ChartCard>

          {/* coding metrics */}
          {hasCoding ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Coding metrics</h2>
              <div className="mt-3">
                <MetricRow label="Test cases">
                  {metrics.coding.passed} of {metrics.coding.total} passed
                </MetricRow>
                <MetricRow label="Attempts">{metrics.coding.attempts}</MetricRow>
                <MetricRow label="Runtime">{metrics.coding.runtime}</MetricRow>
                <MetricRow label="Memory">{metrics.coding.memory}</MetricRow>
              </div>
              <p className="mt-4 rounded-lg bg-primary/5 px-3.5 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground ring-1 ring-primary/20">
                Code ran in an isolated Codebox sandbox while the next question
                was prepared in parallel (NFR-02).
              </p>
            </section>
          ) : (
            <section className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-6">
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                This was a behavioral interview — no coding metrics were
                collected.
              </p>
            </section>
          )}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {metrics.activePercent}% active · {100 - metrics.activePercent}% reconnecting / idle
        </p>
      </div>
    </AppShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity
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

function ChartCard({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {note}
        </span>
      </div>
      {children}
    </section>
  )
}

function MetricRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}