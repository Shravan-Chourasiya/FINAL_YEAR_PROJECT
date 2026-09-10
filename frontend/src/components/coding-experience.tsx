import { useEffect, useState } from 'react'
import { Play, Send, Check, Cpu, ChevronDown, Zap } from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

const codeLines = [
  { t: 'function twoSum(nums, target) {', c: 'text-foreground' },
  { t: '  const seen = new Map()', c: 'text-muted-foreground' },
  { t: '  for (let i = 0; i < nums.length; i++) {', c: 'text-muted-foreground' },
  { t: '    const need = target - nums[i]', c: 'text-muted-foreground' },
  { t: '    if (seen.has(need))', c: 'text-muted-foreground' },
  { t: '      return [seen.get(need), i]', c: 'text-primary' },
  { t: '    seen.set(nums[i], i)', c: 'text-muted-foreground' },
  { t: '  }', c: 'text-muted-foreground' },
  { t: '}', c: 'text-foreground' },
]

const tests = [
  '[2,7,11,15], 9  →  [0,1]',
  '[3,2,4], 6  →  [1,2]',
  '[3,3], 6  →  [0,1]',
]

export function CodingExperience() {
  // step 0 idle, 1 running, 2 exec-done+ai-running, 3 done, 4 fading-out before reset
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const timings = [1600, 1500, 1600, 2200]
    const id = setTimeout(() => {
      if (step === 3) {
        // fade out before hard reset to avoid flash
        setFading(true)
        setTimeout(() => {
          setStep(0)
          setFading(false)
        }, 400)
      } else {
        setStep((s) => s + 1)
      }
    }, timings[step] ?? 1600)
    return () => clearTimeout(id)
  }, [step])

  const running = step === 1
  const execDone = step >= 2
  const aiRunning = step === 2
  const aiDone = step === 3

  return (
    <Section bordered>
      <SectionHeading
        eyebrow="Coding mode"
        title={
          <>
            Write code. Run it.{' '}
            <span className="text-primary">Adapt instantly.</span>
          </>
        }
        description="Solve problems in a real editor. Code execution and AI preparation run in parallel, so you spend your time thinking — not waiting."
      />
      <Reveal delay={120} className="mt-12">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/30">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* problem statement */}
            <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Problem · Medium
              </p>
              <h3 className="mt-2 text-base font-semibold">Two Sum</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Given an array of integers and a target, return the indices of
                the two numbers that add up to the target. You may assume
                exactly one valid answer.
              </p>
              <div className="mt-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Test cases
                </p>
                {tests.map((tc, i) => {
                  const passed = execDone && !fading
                  return (
                    <div
                      key={tc}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[11px] transition-all duration-500',
                        passed
                          ? 'border-[var(--signal-strong)]/30 bg-[var(--signal-strong)]/10'
                          : 'border-border bg-background/50',
                        fading && 'opacity-0',
                      )}
                      style={{ transitionDelay: passed ? `${i * 120}ms` : '0ms' }}
                    >
                      <span
                        className={cn(
                          'flex size-4 items-center justify-center rounded-full',
                          passed
                            ? 'bg-[var(--signal-strong)]/20 text-[var(--signal-strong)]'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {passed ? (
                          <Check className="size-2.5" strokeWidth={3} />
                        ) : (
                          <span className="size-1 rounded-full bg-current" />
                        )}
                      </span>
                      <span
                        className={cn(
                          passed
                            ? 'text-[var(--signal-strong)]'
                            : 'text-muted-foreground',
                        )}
                      >
                        {tc}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* editor */}
            <div className="flex flex-col">
              {/* editor toolbar */}
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
                <button className="flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground ring-1 ring-border">
                  JavaScript
                  <ChevronDown className="size-3" />
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      running
                        ? 'bg-primary/15 text-primary'
                        : 'bg-background text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    <Play
                      className={cn('size-3', running && 'animate-pulse')}
                      fill="currentColor"
                    />
                    Run
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                    <Send className="size-3" />
                    Submit
                  </span>
                </div>
              </div>

              {/* code */}
              <pre className="flex-1 overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed">
                {codeLines.map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="w-4 select-none text-right text-muted-foreground/40">
                      {i + 1}
                    </span>
                    <span className={line.c}>{line.t}</span>
                  </div>
                ))}
              </pre>

              {/* output console */}
              <div className="border-t border-border bg-background/70 px-4 py-3 font-mono text-[11px]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-primary">$</span>
                  <span>node solution.js</span>
                </div>
                <div className="mt-1.5 min-h-[18px]">
                  {running ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      running tests
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="size-1 rounded-full bg-primary"
                          style={{
                            animation: 'pulse-dot 1s ease-in-out infinite',
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </span>
                  ) : execDone ? (
                    <span className="text-[var(--signal-strong)]">
                      ✓ 3/3 tests passed · 42ms
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">
                      Press Run to execute
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* parallel workflow strip */}
          <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
            <ParallelTrack
              icon={Zap}
              label="Code execution"
              active={running}
              done={execDone}
              activeText="Compiling & running tests…"
              doneText="Tests passed"
            />
            <ParallelTrack
              icon={Cpu}
              label="AI preparation (in parallel)"
              active={aiRunning}
              done={aiDone}
              activeText="Evaluating & preparing next problem…"
              doneText="Next problem ready"
            />
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

function ParallelTrack({
  icon: Icon,
  label,
  active,
  done,
  activeText,
  doneText,
}: {
  icon: typeof Cpu
  label: string
  active: boolean
  done: boolean
  activeText: string
  doneText: string
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-4 py-3">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors',
          done
            ? 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30'
            : active
              ? 'bg-primary/15 text-primary ring-primary/30'
              : 'bg-secondary text-muted-foreground ring-border',
        )}
      >
        {done ? (
          <Check className="size-4" strokeWidth={3} />
        ) : (
          <Icon className={cn('size-4', active && 'animate-pulse')} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'truncate text-xs',
            done
              ? 'text-[var(--signal-strong)]'
              : active
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {done ? doneText : active ? activeText : 'Idle'}
        </p>
      </div>
    </div>
  )
}