import { MessagesSquare, Braces, Code2, type LucideIcon } from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

interface TypeCard {
  icon: LucideIcon
  title: string
  description: string
  visual: React.ReactNode
}

function BehavioralVisual() {
  return (
    <div className="flex flex-col gap-2">
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-primary/10 px-3 py-1.5 text-[11px] leading-snug text-foreground ring-1 ring-primary/20">
        “Tell me about a time you resolved a team conflict.”
      </div>
      <div className="max-w-[70%] rounded-lg rounded-tl-sm bg-secondary px-3 py-1.5 text-[11px] leading-snug text-muted-foreground">
        Using the STAR method…
      </div>
    </div>
  )
}

function TechnicalVisual() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] text-muted-foreground">
        System design · scalability
      </div>
      <div className="flex items-center gap-1.5">
        {['Caching', 'Sharding', 'Queues'].map((t) => (
          <span
            key={t}
            className="rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary ring-1 ring-primary/20"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function CodingVisual() {
  return (
    <div className="overflow-hidden rounded-lg bg-background/70 ring-1 ring-border">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
        <span className="size-2 rounded-full bg-[var(--signal-weak)]/70" />
        <span className="size-2 rounded-full bg-[var(--signal-vague)]/70" />
        <span className="size-2 rounded-full bg-[var(--signal-strong)]/70" />
      </div>
      <pre className="px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        <span className="text-primary">function</span> twoSum(nums) {'{'}
        {'\n'}  <span className="text-primary">const</span> seen = {'{}'}
        {'\n'}
        {'}'}
      </pre>
    </div>
  )
}

const cards: TypeCard[] = [
  {
    icon: MessagesSquare,
    title: 'Behavioral',
    description:
      'Practice communication, decision-making, real experiences, and situational questions.',
    visual: <BehavioralVisual />,
  },
  {
    icon: Braces,
    title: 'Technical',
    description:
      'Practice technical concepts, problem solving, algorithms, and system design knowledge.',
    visual: <TechnicalVisual />,
  },
  {
    icon: Code2,
    title: 'Coding',
    description:
      'Solve coding problems in an integrated editor with real code execution and AI evaluation.',
    visual: <CodingVisual />,
  },
]

export function InterviewTypes() {
  return (
    <Section id="interview-types" bordered>
      <SectionHeading
        eyebrow="Interview modes"
        title="Three ways to prepare"
        description="Whatever the role demands, SynthView runs a realistic, adaptive session tuned to that format."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Reveal key={card.title} delay={i * 100}>
              <article
                className={cn(
                  'group flex h-full flex-col rounded-2xl border border-border bg-card p-6',
                  'transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/8',
                )}
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25 transition-colors group-hover:bg-primary/15">
                  <Icon className="size-5 text-primary" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {card.description}
                </p>
                <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-3">
                  {card.visual}
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}