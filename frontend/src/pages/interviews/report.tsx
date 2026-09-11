import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { ScoreRing } from '@/components/charts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtDate, fmtMinutes } from '@/lib/format'
import type { InterviewReport, SignalTone } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  DetailSkeleton,
  InterviewHeader,
  InterviewNotFound,
  useInterview,
} from './shared'

const SIGNAL_BADGE: Record<SignalTone, 'strong' | 'good' | 'vague' | 'weak'> = {
  strong: 'strong',
  good: 'good',
  vague: 'vague',
  weak: 'weak',
}

export function InterviewReportPage() {
  const { id } = useParams()
  const { interview, loading, error: interviewError } = useInterview(id)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    api
      .getReport(id)
      .then((r) => {
        if (alive) setReport(r)
      })
      .catch(() => {
        if (alive) setError('Unable to load interview report.')
      })
    return () => {
      alive = false
    }
  }, [id])

  if (loading || (!report && interview?.status === 'COMPLETED')) {
    return (
      <AppShell title="Interview Report">
        <DetailSkeleton />
      </AppShell>
    )
  }
  if (interviewError || error) {
    return <AppShell title="Interview Report"><Alert variant="destructive">{interviewError ?? error}</Alert></AppShell>
  }
  if (!interview || !report) {
    return (
      <AppShell title="Interview Report">
        <InterviewNotFound />
      </AppShell>
    )
  }

  return (
    <AppShell title="Interview Report">
      <div className="animate-slide-up mx-auto flex max-w-5xl flex-col gap-5">
        <InterviewHeader interview={interview} active="report" />

        {/* hero */}
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing value={report.overallScore} size={124} stroke={10} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={interview.type} />
                <DifficultyBadge difficulty={interview.difficulty} />
                <Badge variant="strong" dot>
                  Completed
                </Badge>
              </div>
              <h2 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-2xl">
                Interview Report
              </h2>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {interview.company} · {fmtDate(interview.createdAt)} ·{' '}
                {fmtMinutes(interview.durationMin)} · {interview.rounds} rounds
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {report.summary}
              </p>
            </div>
          </div>
        </section>

        {/* categories + adaptive journey */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Category performance</h2>
            <div className="mt-4 flex flex-col gap-4">
              {report.categoryScores.map((c) => (
                <div key={c.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {c.value}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${c.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Adaptive journey</h2>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {report.difficultyProgression.map((step, i) => (
                <Fragment key={`${step}-${i}`}>
                  {i > 0 ? <ArrowRight className="size-3 shrink-0 text-muted-foreground" /> : null}
                  <span
                    className={cn(
                      'rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ring-1',
                      journeyChipCls(step),
                    )}
                  >
                    {step}
                  </span>
                </Fragment>
              ))}
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              The router adapted the interview {report.difficultyProgression.length - 1} times
              based on your performance
            </p>
          </section>
        </div>

        {/* strengths / weaknesses */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-[var(--signal-strong)]">Strengths</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {report.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-strong)]" strokeWidth={3} />
                  {s}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-[var(--signal-vague)]">Areas to improve</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {report.weaknesses.map((w) => (
                <li key={w} className="flex items-start gap-2.5 text-sm">
                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-vague)]" />
                  {w}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* recommendations (FR-29) */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Recommended resources</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              tied to observed gaps
            </span>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {report.recommendations.map((r) => (
              <li
                key={r.gap}
                className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="shrink-0 self-start rounded-md bg-[var(--signal-vague)]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-vague)] ring-1 ring-[var(--signal-vague)]/25 sm:self-auto">
                  {r.gap}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{r.resource}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* question-level analysis */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Question-level analysis</h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {report.questions.length} questions
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {report.questions.map((q, i) => (
            <article key={i} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Q{i + 1}</Badge>
                  <Badge variant="outline">{q.level}</Badge>
                  <Badge variant={SIGNAL_BADGE[q.evaluation.signal]} dot>
                    {q.evaluation.signal}
                  </Badge>
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {q.evaluation.score}
                  <span className="text-muted-foreground">/100</span>
                </span>
              </div>

              <h3 className="mt-3 text-sm font-semibold leading-relaxed">{q.question}</h3>

              <div className="mt-3 rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Your answer
                </p>
                <p className="mt-1 text-sm leading-relaxed">{q.answer}</p>
              </div>

              <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-primary/5 px-3.5 py-2.5 ring-1 ring-primary/20">
                <Brain className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                    AI evaluation
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{q.evaluation.feedback}</p>
                </div>
              </div>

              {q.evaluation.strengths.length > 0 || q.evaluation.weaknesses.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {q.evaluation.strengths.length > 0 ? (
                    <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--signal-strong)]">
                        Strengths
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {q.evaluation.strengths.map((s) => (
                          <li key={s} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <Check className="mt-0.5 size-3 shrink-0 text-[var(--signal-strong)]" strokeWidth={3} />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {q.evaluation.weaknesses.length > 0 ? (
                    <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--signal-vague)]">
                        Needs work
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {q.evaluation.weaknesses.map((w) => (
                          <li key={w} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-[var(--signal-vague)]" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {q.evaluation.improvedAnswer ? (
                <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-[var(--signal-strong)]/5 px-3.5 py-2.5 ring-1 ring-[var(--signal-strong)]/25">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-strong)]" />
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--signal-strong)]">
                      Improved answer
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{q.evaluation.improvedAnswer}</p>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {/* footer actions */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/interviews/new" className={cn(buttonVariants())}>
            Practice again
          </Link>
          <Link to="/dashboard" className={cn(buttonVariants({ variant: 'outline' }))}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

function journeyChipCls(step: string) {
  const s = step.toLowerCase()
  if (s.includes('follow-up'))
    return 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30'
  if (s.includes('hard') || s.includes('raised'))
    return 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30'
  if (s.includes('easy'))
    return 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30'
  return 'bg-primary/10 text-primary ring-primary/25'
}