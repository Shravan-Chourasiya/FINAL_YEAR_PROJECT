import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, Loader2 } from 'lucide-react'
import { CodingPanel } from '@/components/interview-room/coding-panel'
import { QuestionPanel } from '@/components/interview-room/question-panel'
import {
  AiStatusBar,
  CandidateControls,
  ConnectionIndicator,
  EndInterviewDialog,
  InterviewTimer,
  VideoTile,
} from '@/components/interview-room/widgets'
import { Button, buttonVariants } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import {
  interviewEngine,
  type AIState,
  type CodeRunState,
  type ConnectionState,
} from '@/lib/interview-engine'
import type { CodeResult, Interview, Question, SignalTone } from '@/lib/types'
import { cn } from '@/lib/utils'

const SIGNAL_STRIP: Record<SignalTone, string> = {
  strong: 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30',
  good: 'bg-[var(--signal-good)]/10 text-[var(--signal-good)] ring-[var(--signal-good)]/30',
  vague: 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30',
  weak: 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30',
}

export function LiveRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [interview, setInterview] = useState<Interview | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [ended, setEnded] = useState(false)

  const [conn, setConn] = useState<ConnectionState>('idle')
  const [ai, setAi] = useState<AIState>('idle')
  const [question, setQuestion] = useState<Question | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [evaluation, setEvaluation] = useState<{
    score: number
    signal: SignalTone
    feedback: string
  } | null>(null)
  const [runState, setRunState] = useState<CodeRunState>('idle')
  const [result, setResult] = useState<CodeResult | null>(null)

  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const busy =
    ai === 'evaluating' || ai === 'adapting' || ai === 'preparing' || ai === 'unavailable'

  /* load interview + enforce state rules */
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
    })
  }, [id])

  /* connect to the engine */
  useEffect(() => {
    if (!interview) return

    const offs = [
      interviewEngine.on('conn', setConn),
      interviewEngine.on('ai', setAi),
      interviewEngine.on('question', (q) => {
        setQuestion(q)
        setEvaluation(null)
        setRunState('idle')
        setResult(null)
      }),
      interviewEngine.on('tick', setRemaining),
      interviewEngine.on('evaluation', (ev) => {
        setEvaluation(ev)
      }),
      interviewEngine.on('code', (p) => {
        setRunState(p.state === 'running' ? 'running' : 'done')
        if (p.result) setResult(p.result)
      }),
      interviewEngine.on('finished', (p) => {
        navigate(
          p.reason === 'cancelled'
            ? `/interviews/${interview.id}`
            : `/interviews/${interview.id}/completed`,
          { replace: true },
        )
      }),
    ]

    interviewEngine.connect(interview)

    // demo: one brief network blip to show reconnection behaviour
    const blip = setTimeout(() => interviewEngine.dropConnection(), 20_000)

    return () => {
      offs.forEach((off) => off())
      clearTimeout(blip)
      interviewEngine.dispose()
    }
  }, [interview, navigate])

  if (notFound) return <RoomNotice title="Interview not found" body="This interview doesn't exist or was removed." />
  if (ended)
    return (
      <RoomNotice
        title="Interview unavailable"
        body="This interview has already ended, so the live room can't be opened."
      />
    )

  if (!interview) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="font-mono text-xs text-muted-foreground">Loading session…</p>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
          <Activity className="size-5 text-primary" strokeWidth={2.5} />
        </span>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {conn === 'connecting'
            ? 'Establishing real-time connection…'
            : 'AI interviewer is preparing your first question…'}
        </div>
        <ConnectionIndicator state={conn} />
      </div>
    )
  }

  const qIndex = interviewEngine.index + 1
  const qTotal = interviewEngine.queue.length

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Activity className="size-4 text-primary" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{interview.roleTitle}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {interview.type} · {interview.difficulty} · Session #{interview.id}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <ConnectionIndicator state={conn} />
          <InterviewTimer seconds={remaining} />
        </div>
      </header>

      {/* body */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:overflow-hidden lg:p-5">
        {/* main column */}
        <div className="flex min-h-0 flex-col gap-3">
          <AiStatusBar state={ai} />

          {evaluation ? (
            <div
              key={`${evaluation.score}-${evaluation.feedback}`}
              className={cn(
                'animate-reveal flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 ring-1',
                SIGNAL_STRIP[evaluation.signal],
              )}
            >
              <span className="size-2 shrink-0 rounded-full bg-current" />
              <span className="text-xs font-medium">{evaluation.feedback}</span>
              <span className="ml-auto font-mono text-[11px] tabular-nums">
                score {evaluation.score}
              </span>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6">
            {question.kind === 'code' ? (
              <CodingPanel
                key={question.id}
                question={question}
                index={qIndex}
                total={qTotal}
                language={interview.language ?? 'JavaScript'}
                runState={runState}
                aiState={ai}
                result={result}
                busy={busy}
                onSubmit={(code) => interviewEngine.submitCode(code)}
              />
            ) : (
              <QuestionPanel
                key={question.id}
                question={question}
                index={qIndex}
                total={qTotal}
                busy={busy}
                onSubmit={(text) => interviewEngine.submitAnswer(text)}
              />
            )}
          </div>
        </div>

        {/* side panel */}
        <aside className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
          <VideoTile cameraOn={cameraOn} sharing={sharing} name={user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : 'Candidate'} />

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                Q{qIndex}/{qTotal}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${((qIndex - 1) / Math.max(1, qTotal)) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>
                Round {interview.currentRound}/{interview.rounds}
              </span>
              <span>{interview.type}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Session notes
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The interviewer adapts after every answer — strong responses raise
              difficulty, vague ones trigger follow-ups. During coding rounds,
              the next question is prepared while your code executes.
            </p>
          </div>
        </aside>
      </div>

      {/* controls */}
      <CandidateControls
        cameraOn={cameraOn}
        micOn={micOn}
        sharing={sharing}
        onToggleCamera={() => setCameraOn((v) => !v)}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleShare={() => setSharing((v) => !v)}
        onEnd={() => setEndOpen(true)}
      />

      <EndInterviewDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => interviewEngine.cancel()}
      />
    </div>
  )
}

function RoomNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="animate-auth-card-in w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-center">
          <Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>
            Back to interviews
          </Link>
        </div>
      </div>
    </div>
  )
}