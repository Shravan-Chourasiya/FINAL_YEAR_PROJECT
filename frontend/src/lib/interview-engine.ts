// Simulated real-time interview engine.
// Mirrors the WebSocket contract from the SRS (FR-12..FR-26, NFR-02/11) so the
// mock can later be replaced by the real Express gateway without UI changes.

import type {
  CodeResult,
  Interview,
  InterviewType,
  Question,
  SignalTone,
} from './types'

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export type AIState =
  | 'idle'
  | 'preparing'
  | 'evaluating'
  | 'adapting'
  | 'ready'
  | 'unavailable'

export type CodeRunState = 'running' | 'done' | 'failed'

export interface EvaluationPayload {
  score: number
  signal: SignalTone
  feedback: string
}
export interface CodePayload {
  state: CodeRunState
  result?: CodeResult
}
export interface FinishedPayload {
  reason: 'completed' | 'cancelled' | 'time'
}

interface EventMap {
  conn: ConnectionState
  ai: AIState
  tick: number
  question: Question
  evaluation: EvaluationPayload
  code: CodePayload
  finished: FinishedPayload
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const FOLLOW_UPS = [
  'Let\u2019s go deeper — walk me through your reasoning step by step.',
  'What trade-offs did you consider, and what would you change in hindsight?',
  'How would that hold up under edge cases or at scale?',
]

interface BankEntry {
  text: string
  topic: string
  kind: 'text' | 'code'
  starter?: string
}

const BANK: Record<Exclude<InterviewType, 'Mixed'>, BankEntry[]> = {
  Behavioral: [
    {
      text: 'Tell me about a time you had to learn a new technology quickly to deliver a project. What was your approach?',
      topic: 'Adaptability',
      kind: 'text',
    },
    {
      text: 'Describe a situation where you disagreed with a teammate. How did you resolve it?',
      topic: 'Conflict resolution',
      kind: 'text',
    },
    {
      text: 'How do you prioritize tasks when everything feels urgent?',
      topic: 'Prioritization',
      kind: 'text',
    },
  ],
  Technical: [
    {
      text: 'Explain the difference between synchronous and asynchronous code execution. When does blocking I/O become a real problem?',
      topic: 'Concurrency',
      kind: 'text',
    },
    {
      text: 'What is the Virtual DOM in React, and how does reconciliation improve performance?',
      topic: 'React internals',
      kind: 'text',
    },
    {
      text: 'Walk me through how you would design a rate limiter for an API gateway.',
      topic: 'System design',
      kind: 'text',
    },
  ],
  Coding: [
    {
      text: 'Implement a function twoSum(nums, target) that returns the indices of the two numbers that add up to the target.',
      topic: 'Arrays',
      kind: 'code',
      starter: 'function twoSum(nums, target) {\n  // your code here\n\n}',
    },
    {
      text: 'Write a function that reverses a singly linked list iteratively.',
      topic: 'Linked list',
      kind: 'code',
      starter: 'function reverseList(head) {\n  // your code here\n\n}',
    },
  ],
}

let qSeq = 0

function buildQueue(type: InterviewType): Question[] {
  const pick = (list: BankEntry[], category: InterviewType): Question[] =>
    list.map((e, i) => ({
      id: `q_${++qSeq}`,
      index: i,
      kind: e.kind,
      category,
      topic: e.topic,
      difficulty: i < 1 ? 'Easy' : i < 3 ? 'Medium' : 'Hard',
      text: e.text,
      starter: e.starter,
    }))

  if (type === 'Mixed') {
    return [
      ...pick([BANK.Technical[0]], 'Technical'),
      ...pick([BANK.Behavioral[0]], 'Behavioral'),
      ...pick([BANK.Coding[0]], 'Coding'),
      ...pick([BANK.Technical[2]], 'Technical'),
      ...pick([BANK.Behavioral[1]], 'Behavioral'),
    ].map((q, i) => ({ ...q, index: i }))
  }
  return pick(BANK[type], type)
}

function makeFollowUp(source: Question, index: number): Question {
  return {
    id: `q_${++qSeq}`,
    index,
    kind: 'text',
    category: source.category,
    topic: `${source.topic} — follow-up`,
    difficulty: source.difficulty,
    text: FOLLOW_UPS[Math.floor(Math.random() * FOLLOW_UPS.length)],
    isFollowUp: true,
  }
}

const SIGNAL_FEEDBACK: Record<SignalTone, string> = {
  strong: 'Strong answer — raising the challenge.',
  good: 'Good answer — moving the interview forward.',
  vague: 'Vague answer — probing for specifics.',
  weak: 'Weak answer — easing the next question.',
}

class InterviewEngine {
  connection: ConnectionState = 'idle'
  ai: AIState = 'idle'
  interview: Interview | null = null
  queue: Question[] = []
  index = 0
  remaining = 0
  answers: {
    question: Question
    text?: string
    code?: string
    score: number
    signal: SignalTone
  }[] = []
  difficultyProgression: string[] = []

  private listeners: {
    [K in keyof EventMap]?: Set<(payload: EventMap[K]) => void>
  } = {}
  private timer: ReturnType<typeof setInterval> | null = null
  private followUpsUsed = 0
  private connectToken = 0

  on<K extends keyof EventMap>(
    event: K,
    cb: (payload: EventMap[K]) => void,
  ): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set()
    this.listeners[event]!.add(cb)
    return () => {
      this.listeners[event]?.delete(cb)
    }
  }

  private emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.listeners[event]?.forEach((cb) => cb(payload))
  }

  private setConn(c: ConnectionState) {
    this.connection = c
    this.emit('conn', c)
  }

  private setAi(s: AIState) {
    this.ai = s
    this.emit('ai', s)
  }

  /** Resets runtime state WITHOUT touching event listeners. */
  reset(interview: Interview) {
    this.stopTimer()
    this.interview = interview
    this.queue = buildQueue(interview.type)
    this.index = 0
    this.answers = []
    this.followUpsUsed = 0
    this.remaining = 0
    this.connection = 'idle'
    this.ai = 'idle'
    this.difficultyProgression = [`Started at ${interview.difficulty}`]
  }

  /** FR-12 + FR-13/14 — connect, then deliver the first question. */
  async connect(interview: Interview) {
    const token = ++this.connectToken
    this.reset(interview)
    interview.status = 'IN_PROGRESS'
    this.setConn('connecting')
    await delay(1100)
    if (token !== this.connectToken) return
    this.setConn('connected')
    this.remaining = interview.durationMin * 60
    this.startTimer()
    await this.prepareNext(true, token)
  }

  private startTimer() {
    this.stopTimer()
    this.timer = setInterval(() => {
      this.remaining -= 1
      this.emit('tick', this.remaining)
      if (this.remaining <= 0) this.finish('time')
    }, 1000)
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async prepareNext(first = false, token = this.connectToken) {
    if (token !== this.connectToken) return
    if (this.index >= this.queue.length) {
      this.finish('completed')
      return
    }
    this.setAi('preparing')
    await delay(first ? 1400 : 1800)
    if (token !== this.connectToken) return
    this.setAi('ready')
    this.emit('question', this.queue[this.index])
  }

  /** FR-15/16/17/24 — evaluate the answer, then adapt. */
  async submitAnswer(text: string) {
    const question = this.queue[this.index]
    if (!question) return
    this.setAi('evaluating')
    await delay(2000)

    // Occasional AI hiccup — recovers gracefully (NFR-11)
    if (Math.random() < 0.1) {
      this.setAi('unavailable')
      await delay(1800)
      this.setAi('evaluating')
      await delay(800)
    }

    const { score, signal } = this.evaluate(text)
    this.answers.push({ question, text, score, signal })
    this.emit('evaluation', {
      score,
      signal,
      feedback: SIGNAL_FEEDBACK[signal],
    })

    this.setAi('adapting')
    await delay(900)

    if (
      (signal === 'weak' || signal === 'vague') &&
      !question.isFollowUp &&
      this.followUpsUsed < 3
    ) {
      // FR-17 — adaptive follow-up on weak/incomplete response
      this.followUpsUsed += 1
      this.queue.splice(this.index + 1, 0, makeFollowUp(question, this.index + 1))
      this.difficultyProgression.push('Follow-up')
    } else {
      if (signal === 'strong') this.raiseDifficulty()
      this.index += 1
    }
    await this.prepareNext()
  }

  /** FR-20..23 — sandbox execution while the AI prepares in parallel. */
  async submitCode(code: string) {
    const question = this.queue[this.index]
    if (!question) return
    this.answers.push({ question, code, score: 0, signal: 'good' })

    this.emit('code', { state: 'running' })
    this.setAi('preparing')

    const [result] = await Promise.all([
      delay(2400).then<CodeResult>(() => ({
        passed: 4,
        total: 5,
        runtime: '68ms',
        memory: '13.2MB',
        stdout: 'All test groups executed.',
      })),
      delay(1600).then(() => this.setAi('ready')),
    ])

    this.emit('code', { state: 'done', result })
    await delay(400)
    this.index += 1
    await this.prepareNext()
  }

  private evaluate(text: string): { score: number; signal: SignalTone } {
    const words = text.trim().split(/\s+/).length
    let score = 35 + words * 1.6
    if (/because|therefore|trade-?off/i.test(text)) score += 8
    score = Math.max(15, Math.min(95, Math.round(score)))
    const signal: SignalTone =
      score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 40 ? 'vague' : 'weak'
    return { score, signal }
  }

  private raiseDifficulty() {
    const next = this.queue[this.index + 1]
    if (next && next.difficulty !== 'Hard') {
      next.difficulty = next.difficulty === 'Easy' ? 'Medium' : 'Hard'
      this.difficultyProgression.push(`Raised to ${next.difficulty}`)
    }
  }

  private overallScore(): number {
    if (!this.answers.length) return 74
    const sum = this.answers.reduce((a, r) => a + (r.score || 70), 0)
    return Math.round(sum / this.answers.length)
  }

  private finish(reason: 'completed' | 'time') {
    this.stopTimer()
    if (this.interview) {
      this.interview.status = 'COMPLETED'
      this.interview.progress = 1
      this.interview.score = this.overallScore()
    }
    this.setAi('idle')
    this.emit('finished', { reason })
  }

  /** FR-11 — candidate ends the session manually (FR-26 marks it). */
  cancel() {
    this.stopTimer()
    if (this.interview) this.interview.status = 'CANCELLED'
    this.emit('finished', { reason: 'cancelled' })
  }

  /** Simulates a network drop + automatic recovery. */
  dropConnection() {
    if (this.connection !== 'connected') return
    this.setConn('reconnecting')
    setTimeout(() => {
      if (this.connection === 'reconnecting') this.setConn('connected')
    }, 2400)
  }

  /** Full teardown — called only when the room unmounts. */
  dispose() {
    this.stopTimer()
    this.listeners = {}
    this.connection = 'idle'
    this.ai = 'idle'
  }
}

export const interviewEngine = new InterviewEngine()