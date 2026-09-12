import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Loader2, Mic, Monitor, Play, RefreshCw, Wifi } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtMinutes } from '@/lib/format'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type CheckState = 'checking' | 'ready'

const CHECKS = [
  { key: 'camera', label: 'Camera', desc: 'Your presence in the interview room', icon: Camera },
  { key: 'microphone', label: 'Microphone', desc: 'Voice input (text fallback available)', icon: Mic },
  { key: 'screen', label: 'Screen sharing', desc: 'Share your screen when asked', icon: Monitor },
  { key: 'connection', label: 'Real-time connection', desc: 'WebSocket link to the interviewer', icon: Wifi },
] as const

export function LobbyPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [interview, setInterview] = useState<Interview | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!id) return
    api.getInterview(id).then((it) => {
      if (!it) {
        setNotFound(true)
        return
      }
      if (it.status === 'COMPLETED' || it.status === 'CANCELLED' || it.status === 'ABANDONED') {
        setEnded(true)
        return
      }
      setInterview(it)
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load interview lobby.'))
  }, [id])

  const runChecks = useCallback(() => {
    setRunning(true)
    setChecks({})
    CHECKS.forEach((check, i) => {
      setChecks((c) => ({ ...c, [check.key]: 'checking' }))
      setTimeout(() => {
        setChecks((c) => ({ ...c, [check.key]: 'ready' }))
        if (i === CHECKS.length - 1) setRunning(false)
      }, 450 * (i + 1))
    })
  }, [])

  useEffect(() => {
    if (interview) runChecks()
  }, [interview, runChecks])

  const enterInterview = async () => {
    if (!interview) return
    setStarting(true)
    try {
      if (interview.status !== 'IN_PROGRESS') {
        await api.startInterview(interview.id)
      }
      navigate(`/interviews/${interview.id}/live`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to start interview.')
    } finally {
      setStarting(false)
    }
  }

  if (notFound) {
    return (
      <AppShell title="Interview Lobby">
        <LobbyNotice title="Interview not found" body="This interview doesn't exist or was removed." />
      </AppShell>
    )
  }
  if (ended) {
    return (
      <AppShell title="Interview Lobby">
        <LobbyNotice
          title="Interview unavailable"
          body="This interview has already ended, so it can't be started or resumed."
        />
      </AppShell>
    )
  }
  if (error) {
    return <AppShell title="Interview Lobby"><p className="p-6 text-sm text-destructive">{error}</p></AppShell>
  }
  if (!interview) {
    return (
      <AppShell title="Interview Lobby">
        <div className="flex justify-center pt-24">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  const allReady = CHECKS.every((c) => checks[c.key] === 'ready')
  const resuming = interview.status === 'IN_PROGRESS'

  return (
    <AppShell title="Interview Lobby">
      <div className="animate-slide-up mx-auto flex max-w-4xl flex-col gap-5">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Interview lobby
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {interview.roleTitle}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Check your environment, then enter the room.
            </p>
          </div>
          <StatusBadge status={interview.status} />
        </div>

        {/* resume banner */}
        {resuming ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="font-mono text-[11px] text-primary">
              Resuming session — Round {interview.currentRound}/{interview.rounds} · Question{' '}
              {interview.currentQuestion} · {Math.round(interview.progress * 100)}% complete
            </span>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* summary */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Interview summary</h2>
            <div className="mt-2">
              <SummaryRow label="Role">{interview.roleTitle}</SummaryRow>
              <SummaryRow label="Domain">{interview.domain}</SummaryRow>
              <SummaryRow label="Company">{interview.company || '—'}</SummaryRow>
              <SummaryRow label="Type">
                <TypeBadge type={interview.type} />
              </SummaryRow>
              <SummaryRow label="Difficulty">
                <DifficultyBadge difficulty={interview.difficulty} />
              </SummaryRow>
              <SummaryRow label="Duration">{fmtMinutes(interview.durationMin)}</SummaryRow>
              <SummaryRow label="Rounds">{interview.rounds}</SummaryRow>
              <SummaryRow label="Topics">{interview.topics.join(', ') || 'AI will choose'}</SummaryRow>
              {interview.language ? (
                <SummaryRow label="Language">{interview.language}</SummaryRow>
              ) : null}
            </div>
          </section>

          {/* environment checks */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Environment check</h2>
              <Button variant="ghost" size="sm" onClick={runChecks} disabled={running}>
                <RefreshCw className={cn('size-3.5', running && 'animate-spin')} />
                Re-run
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {CHECKS.map((check) => {
                const state = checks[check.key]
                const Icon = check.icon
                return (
                  <div
                    key={check.key}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3.5 py-3"
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors',
                        state === 'ready'
                          ? 'bg-(--signal-strong)/10 text-signal-strong ring-(--signal-strong)/30'
                          : 'bg-secondary text-muted-foreground ring-border',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{check.desc}</p>
                    </div>
                    {state === 'ready' ? (
                      <Badge variant="strong" dot>
                        Ready
                      </Badge>
                    ) : state === 'checking' ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <Badge variant="neutral">Waiting</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            By entering, your responses are evaluated in real time and the
            interview adapts to your performance.
          </p>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className={cn(buttonVariants({ variant: 'ghost' }))}>
              Cancel
            </Link>
            <Button
              size="lg"
              className="h-11 px-5"
              disabled={!allReady || running || starting}
              onClick={() => void enterInterview()}
            >
              {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {starting ? 'Starting…' : resuming ? 'Resume Interview' : 'Start Interview'}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm">{children}</span>
    </div>
  )
}

function LobbyNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-6 flex justify-center">
        <Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>
          Back to interviews
        </Link>
      </div>
    </div>
  )
}
