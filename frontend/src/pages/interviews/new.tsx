import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInterviewListStore } from '@/lib/stores/interview-list.store'
import type { Difficulty, ExperienceLevel, InterviewType } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS = [
  'Role & Context',
  'Interview Type',
  'Difficulty & Experience',
  'Topics & Skills',
  'Duration & Rounds',
  'Review',
] as const

interface WizardState {
  domain: string
  roleTitle: string
  company: string
  experienceLevel: ExperienceLevel
  difficulty: Difficulty
  type: InterviewType
  durationMin: number
  rounds: number
  topics: string[]
  language: string
}

const initialState: WizardState = {
  domain: '',
  roleTitle: '',
  company: '',
  experienceLevel: 'Entry',
  difficulty: 'Adaptive',
  type: 'Mixed',
  durationMin: 30,
  rounds: 3,
  topics: [],
  language: 'JavaScript',
}

const TYPE_OPTIONS: { value: InterviewType; title: string; description: string }[] = [
  { value: 'Behavioral', title: 'Behavioral', description: 'Communication, STAR stories, situational judgment.' },
  { value: 'Technical', title: 'Technical', description: 'Concepts, system design, domain knowledge.' },
  { value: 'Coding', title: 'Coding', description: 'Hands-on problems run in the Codebox sandbox.' },
  { value: 'Mixed', title: 'Mixed', description: 'A realistic blend of all round types.' },
]

const DIFFICULTY_OPTIONS: { value: Difficulty; title: string; description: string }[] = [
  { value: 'Adaptive', title: 'Adaptive', description: 'Difficulty rises and falls with your performance. Recommended.' },
  { value: 'Easy', title: 'Easy', description: 'A gentle, confidence-building session.' },
  { value: 'Medium', title: 'Medium', description: 'A balanced challenge.' },
  { value: 'Hard', title: 'Hard', description: 'Consistently demanding questions.' },
]

const TOPIC_SUGGESTIONS = [
  'React',
  'JavaScript',
  'DSA',
  'SQL',
  'System Design',
  'Node.js',
  'Communication',
  'Python',
  'ML Basics',
]

const selectCls =
  'h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring'

export function NewInterviewPage() {
  const navigate = useNavigate()
  const createInterview = useInterviewListStore((s) => s.createInterview)
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialState)
  const [errors, setErrors] = useState<string[]>([])
  const [topicInput, setTopicInput] = useState('')
  const [creating, setCreating] = useState(false)

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }))

  const validateStep = (): string[] => {
    if (step !== 0) return []
    const errs: string[] = []
    if (!state.domain.trim()) errs.push('Field / domain is required.')
    if (!state.roleTitle.trim()) errs.push('Target role is required.')
    return errs
  }

  const next = () => {
    const errs = validateStep()
    setErrors(errs)
    if (errs.length) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => {
    setErrors([])
    setStep((s) => Math.max(s - 1, 0))
  }

  const addTopic = (t: string) => {
    const v = t.trim()
    if (!v) return
    if (!state.topics.includes(v)) patch({ topics: [...state.topics, v] })
    setTopicInput('')
  }

  const removeTopic = (t: string) =>
    patch({ topics: state.topics.filter((x) => x !== t) })

  const create = async () => {
    setCreating(true)
    try {
      const id = await createInterview(state)
      navigate(`/interviews/${id}/lobby`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppShell title="New Interview">
      <div className="animate-slide-up mx-auto flex max-w-3xl flex-col gap-6">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            New interview
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Configure your interview
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The AI interviewer adapts to everything you set here. Review it all
            before entering the lobby.
          </p>
        </header>

        {/* step indicator */}
        <ol className="flex flex-wrap items-center gap-y-2">
          {STEPS.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <li key={label} className="flex items-center">
                {i > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mx-1.5 h-px w-5 sm:mx-2 sm:w-8',
                      i <= step ? 'bg-primary/50' : 'bg-border',
                    )}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => done && setStep(i)}
                  disabled={!done}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-full py-1 pl-1 transition-colors',
                    done ? 'cursor-pointer pr-2' : 'pr-1',
                    active && 'pr-3',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full font-mono text-[11px] font-semibold ring-1 transition-colors',
                      done && 'bg-[var(--signal-strong)]/15 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30',
                      active && 'bg-primary text-primary-foreground ring-primary',
                      !done && !active && 'bg-secondary text-muted-foreground ring-border',
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {active || done ? (
                    <span
                      className={cn(
                        'hidden font-mono text-[10px] uppercase tracking-wider md:inline',
                        active ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ol>

        {/* step body */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
          {errors.length > 0 ? (
            <div className="mb-4">
              <Alert variant="destructive" icon={<AlertTriangle className="size-4" />}>
                <ul className="list-inside list-disc">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="domain">
                  Field / domain <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="domain"
                  placeholder="e.g. Software Engineering"
                  value={state.domain}
                  onChange={(e) => patch({ domain: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">
                    Target role <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="role"
                    placeholder="e.g. Frontend Engineer"
                    value={state.roleTitle}
                    onChange={(e) => patch({ roleTitle: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="company">Company / context</Label>
                  <Input
                    id="company"
                    placeholder="e.g. Flipkart (optional)"
                    value={state.company}
                    onChange={(e) => patch({ company: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TYPE_OPTIONS.map((opt) => {
                  const selected = state.type === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => patch({ type: opt.value })}
                      className={cn(
                        'relative rounded-xl border p-4 text-left transition-all',
                        selected
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/30 hover:bg-accent/40',
                      )}
                    >
                      {selected ? (
                        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                      <p className="pr-6 text-sm font-semibold">{opt.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {opt.description}
                      </p>
                    </button>
                  )
                })}
              </div>
              {state.type === 'Coding' || state.type === 'Mixed' ? (
                <div className="mt-5 flex flex-col gap-1.5">
                  <Label htmlFor="language">Preferred coding language</Label>
                  <SelectShell>
                    <select
                      id="language"
                      className={selectCls}
                      value={state.language}
                      onChange={(e) => patch({ language: e.target.value })}
                    >
                      {['JavaScript', 'Python', 'Java', 'C++'].map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </SelectShell>
                </div>
              ) : null}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="experience">Experience level</Label>
                <SelectShell>
                  <select
                    id="experience"
                    className={selectCls}
                    value={state.experienceLevel}
                    onChange={(e) =>
                      patch({ experienceLevel: e.target.value as ExperienceLevel })
                    }
                  >
                    {(['Entry', 'Mid-level', 'Senior'] as const).map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </SelectShell>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const selected = state.difficulty === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => patch({ difficulty: opt.value })}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-all',
                        selected
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/30 hover:bg-accent/40',
                      )}
                    >
                      <p className="text-sm font-semibold">{opt.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {opt.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <Label>Topics &amp; skills to cover</Label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent p-2 transition-shadow focus-within:ring-1 focus-within:ring-ring">
                {state.topics.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground"
                  >
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => removeTopic(t)}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTopic(topicInput)
                    } else if (
                      e.key === 'Backspace' &&
                      !topicInput &&
                      state.topics.length
                    ) {
                      removeTopic(state.topics[state.topics.length - 1])
                    }
                  }}
                  placeholder={state.topics.length ? 'Add another…' : 'Type a topic and press Enter…'}
                  aria-label="Add topic"
                  className="min-w-32 flex-1 border-0 bg-transparent px-1.5 py-1 text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Suggestions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TOPIC_SUGGESTIONS.filter((s) => !state.topics.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTopic(s)}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Plus className="size-3" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-5">
              <div>
                <Label>Duration</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patch({ durationMin: m })}
                      className={cn(
                        'rounded-lg border px-4 py-2.5 font-mono text-sm tabular-nums transition-colors',
                        state.durationMin === m
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Number of rounds</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => patch({ rounds: r })}
                      className={cn(
                        'rounded-lg border px-4 py-2.5 font-mono text-sm tabular-nums transition-colors',
                        state.rounds === r
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {r} rounds
                    </button>
                  ))}
                </div>
              </div>
              <Alert variant="default">
                During coding rounds, the next question is prepared while your
                code executes — you never sit idle between rounds.
              </Alert>
            </div>
          )}

          {step === 5 && (
            <div>
              <Alert variant="strong" icon={<Check className="size-4" />}>
                Everything looks good. Review the configuration, then create
                your interview.
              </Alert>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ReviewItem
                  label="Role"
                  value={state.roleTitle + (state.company ? ` · ${state.company}` : '')}
                />
                <ReviewItem label="Domain" value={state.domain} />
                <ReviewItem label="Type" value={state.type} />
                <ReviewItem
                  label="Difficulty"
                  value={`${state.difficulty} · ${state.experienceLevel}`}
                />
                <ReviewItem label="Duration" value={`${state.durationMin} minutes`} />
                <ReviewItem label="Rounds" value={`${state.rounds} rounds`} />
                <ReviewItem
                  label="Topics"
                  value={state.topics.length ? state.topics.join(', ') : 'AI will choose based on the role'}
                />
                {state.type === 'Coding' || state.type === 'Mixed' ? (
                  <ReviewItem label="Language" value={state.language} />
                ) : null}
              </div>
            </div>
          )}

          {/* footer nav */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
            <Button variant="ghost" onClick={back} disabled={step === 0 || creating}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              {step < STEPS.length - 1 ? (
                <Button onClick={next}>
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={create} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      Create &amp; Enter Lobby
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function SelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}