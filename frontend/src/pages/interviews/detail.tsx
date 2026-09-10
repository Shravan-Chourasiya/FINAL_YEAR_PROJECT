import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { fmtDate, fmtMinutes } from '@/lib/format'
import type { InterviewStatus } from '@/lib/types'
import {
  DetailSkeleton,
  InterviewHeader,
  InterviewNotFound,
  useInterview,
} from './shared'
import type { ReactNode } from 'react'

const STATUS_ALERT: Record<
  InterviewStatus,
  { variant: 'default' | 'strong' | 'destructive'; message: string }
> = {
  CREATED: { variant: 'default', message: 'Interview configured and ready to start.' },
  READY: { variant: 'default', message: 'Interview configured and ready to start.' },
  IN_PROGRESS: { variant: 'default', message: 'Interview in progress — resume any time to continue.' },
  COMPLETED: { variant: 'strong', message: 'Interview finished. The full report is ready.' },
  CANCELLED: { variant: 'destructive', message: 'This interview was cancelled and can no longer be resumed.' },
  ABANDONED: { variant: 'destructive', message: 'This interview was abandoned and can no longer be resumed.' },
}

export function InterviewDetailPage() {
  const { id } = useParams()
  const { interview, loading } = useInterview(id)

  if (loading) {
    return (
      <AppShell title="Interview Detail">
        <DetailSkeleton />
      </AppShell>
    )
  }
  if (!interview) {
    return (
      <AppShell title="Interview Detail">
        <InterviewNotFound />
      </AppShell>
    )
  }

  const alert = STATUS_ALERT[interview.status]
  const pct = Math.round(interview.progress * 100)

  return (
    <AppShell title="Interview Detail">
      <div className="animate-slide-up mx-auto flex max-w-5xl flex-col gap-5">
        <InterviewHeader interview={interview} active="overview" />

        {/* stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Overall score" value={interview.score !== null ? String(interview.score) : '—'} />
          <StatCard label="Duration" value={fmtMinutes(interview.durationMin)} />
          <StatCard label="Rounds" value={String(interview.rounds)} />
          <StatCard label="Progress" value={`${pct}%`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* configuration */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Configuration</h2>
            <div className="mt-2">
              <ConfigRow label="Domain">{interview.domain}</ConfigRow>
              <ConfigRow label="Target role">{interview.roleTitle}</ConfigRow>
              <ConfigRow label="Company">{interview.company || '—'}</ConfigRow>
              <ConfigRow label="Type">
                <TypeBadge type={interview.type} />
              </ConfigRow>
              <ConfigRow label="Difficulty">
                <DifficultyBadge difficulty={interview.difficulty} />
              </ConfigRow>
              <ConfigRow label="Experience">{interview.experienceLevel}</ConfigRow>
              <ConfigRow label="Language">{interview.language ?? '—'}</ConfigRow>
            </div>
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Topics
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {interview.topics.length ? (
                  interview.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    AI will choose based on the role
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* status & progress */}
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Status &amp; progress</h2>
                <StatusBadge status={interview.status} />
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>Completion</span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <dl className="mt-4 flex flex-col gap-2 font-mono text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Created</dt>
                  <dd>{fmtDate(interview.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Last activity</dt>
                  <dd>{fmtDate(interview.lastActivityAt)}</dd>
                </div>
                {interview.status === 'IN_PROGRESS' ? (
                  <div className="flex justify-between">
                    <dt>Position</dt>
                    <dd>
                      Round {interview.currentRound}/{interview.rounds} · Q{interview.currentQuestion}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <Alert
              variant={alert.variant}
              icon={
                alert.variant === 'strong' ? (
                  <CheckCircle2 className="size-4" />
                ) : alert.variant === 'destructive' ? (
                  <AlertTriangle className="size-4" />
                ) : (
                  <Info className="size-4" />
                )
              }
            >
              {alert.message}
            </Alert>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ConfigRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm">{children}</span>
    </div>
  )
}