import { AppShell } from '@/components/app-shell'
import { AdminUnavailable } from './shared'

export function AdminOverviewPage() {
    return <AppShell title="Admin Overview"><AdminUnavailable /></AppShell>
}
