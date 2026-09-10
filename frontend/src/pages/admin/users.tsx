import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/format'
import type { AdminUser } from '@/lib/types'
import { AdminGate, AdminHeader } from './shared'

export function AdminUsersPage() {
  return (
    <AppShell title="User Management">
      <AdminGate>
        <UsersContent />
      </AdminGate>
    </AppShell>
  )
}

function UsersContent() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)

  useEffect(() => {
    let alive = true
    api.listAdminUsers().then((u) => {
      if (alive) setUsers(u)
    })
    return () => {
      alive = false
    }
  }, [])

  const toggleStatus = (id: string) => {
    setUsers((list) =>
      list
        ? list.map((u) =>
            u.id === id
              ? { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' }
              : u,
          )
        : list,
    )
    setSelected(null)
  }

  const filtered = (users ?? []).filter((u) => {
    const q = query.trim().toLowerCase()
    return !q || `${u.name} ${u.email}`.toLowerCase().includes(q)
  })

  return (
    <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-5">
      <AdminHeader
        title="User management"
        description="Search registered candidates and manage account status (FR-33)."
      />

      {/* search */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3.5">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {filtered.length} user{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* table */}
      {users === null ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">No users match your search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Interviews</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="text-sm transition-colors hover:bg-accent/40">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{u.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={u.status === 'Active' ? 'strong' : 'weak'} dot>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {fmtDate(u.joinedAt)}
                    </td>
                    <td className="px-4 py-3.5 font-mono tabular-nums">{u.interviewCount}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Button variant="outline" size="xs" onClick={() => setSelected(u)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* manage dialog */}
      <Dialog open={selected !== null} onClose={() => setSelected(null)}>
        {selected ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold tracking-tight">Manage {selected.name}</h2>
            <p className="font-mono text-xs text-muted-foreground">{selected.email}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selected.status === 'Active'
                ? 'Suspending blocks sign-in and pauses any live interviews for this account.'
                : 'Re-activating restores sign-in and access to interview history.'}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              {selected.status === 'Active' ? (
                <Button variant="destructive" onClick={() => toggleStatus(selected.id)}>
                  Suspend account
                </Button>
              ) : (
                <Button onClick={() => toggleStatus(selected.id)}>Re-activate</Button>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}