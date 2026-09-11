import { BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AnalyticsPage() {
    return (
        <AppShell title="Analytics">
            <div className="animate-slide-up mx-auto max-w-2xl pt-8">
                <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                        <BarChart3 className="size-5 text-primary" />
                    </span>
                    <h1 className="mt-5 text-xl font-semibold tracking-tight">Analytics is not available yet.</h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        The current backend contract does not expose an analytics endpoint. Complete interviews and review each session's report while aggregate analytics are being implemented.
                    </p>
                    <Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
                        View interview history
                    </Link>
                </div>
            </div>
        </AppShell>
    )
}
