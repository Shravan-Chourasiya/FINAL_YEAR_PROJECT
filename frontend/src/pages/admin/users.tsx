import { AppShell } from '@/components/app-shell'
import { AdminUnavailable } from './shared'

export function AdminUsersPage() {
    return <AppShell title="User Management"><AdminUnavailable /></AppShell>
}
