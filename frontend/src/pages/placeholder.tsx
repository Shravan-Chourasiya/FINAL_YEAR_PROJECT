import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PlaceholderPage({ title, part }: { title: string; part: number }) {
  return (
    <div className="animate-slide-up mx-auto max-w-2xl pt-8">
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
          <Hammer className="size-5 text-primary" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          This screen ships in{' '}
          <span className="font-medium text-foreground">Part {part}</span> of the
          build. Routing, auth and the design system are already wired around it.
        </p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button variant="outline" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}