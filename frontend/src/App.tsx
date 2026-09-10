import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { ErrorState } from '@/components/error-state'
import { AuthBootstrap, RequireAuth } from '@/components/require-auth'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LandingPage } from '@/pages/landing'
import { AboutPage, ContactPage, PrivacyPage, TermsPage } from '@/pages/public-info'
import { AuthPage } from '@/pages/auth/auth'
import { VerifyEmailPage } from '@/pages/auth/verify-email'
import { ForgotPasswordPage } from '@/pages/auth/forgot-password'
import { ResetPasswordPage } from '@/pages/auth/reset-password'
import { DashboardPage } from '@/pages/dashboard'
import { InterviewsPage } from '@/pages/interviews/history'
import { ResumablePage } from '@/pages/interviews/resumable'
import { NewInterviewPage } from '@/pages/interviews/new'
import { LobbyPage } from '@/pages/interviews/lobby'
import { LiveRoomPage } from '@/pages/interviews/live'
import { CompletedPage } from '@/pages/interviews/completed'
import { InterviewDetailPage } from '@/pages/interviews/detail'
import { InterviewTimelinePage } from '@/pages/interviews/timeline'
import { InterviewMetricsPage } from '@/pages/interviews/metrics'
import { InterviewReportPage } from '@/pages/interviews/report'
import { AnalyticsPage } from '@/pages/analytics'
import { ProfilePage } from '@/pages/profile'
import { SettingsPage } from '@/pages/settings'
import { SessionsPage } from '@/pages/sessions'
import { AdminOverviewPage } from '@/pages/admin/overview'
import { AdminUsersPage } from '@/pages/admin/users'
import { AdminInterviewsPage } from '@/pages/admin/interviews'
import { useAuthStore } from '@/lib/stores/auth.store'
import { cn } from '@/lib/utils'

function GuestOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center p-8"><Skeleton className="h-24 w-full max-w-md rounded-2xl" /></div>
  }
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthBootstrap>
      <Routes>
        {/* public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/login" element={<GuestOnly><AuthPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><AuthPage /></GuestOnly>} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* candidate app */}
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/interviews" element={<RequireAuth><InterviewsPage /></RequireAuth>} />
        <Route path="/interviews/new" element={<RequireAuth><NewInterviewPage /></RequireAuth>} />
        <Route path="/interviews/resumable" element={<RequireAuth><ResumablePage /></RequireAuth>} />
        <Route path="/interviews/:id/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
        <Route path="/interviews/:id/live" element={<RequireAuth><LiveRoomPage /></RequireAuth>} />
        <Route path="/interviews/:id/completed" element={<RequireAuth><CompletedPage /></RequireAuth>} />
        <Route path="/interviews/:id" element={<RequireAuth><InterviewDetailPage /></RequireAuth>} />
        <Route path="/interviews/:id/history" element={<RequireAuth><InterviewTimelinePage /></RequireAuth>} />
        <Route path="/interviews/:id/metrics" element={<RequireAuth><InterviewMetricsPage /></RequireAuth>} />
        <Route path="/interviews/:id/report" element={<RequireAuth><InterviewReportPage /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/settings/sessions" element={<RequireAuth><SessionsPage /></RequireAuth>} />

        {/* admin */}
        <Route path="/admin" element={<RequireAuth><AdminOverviewPage /></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
        <Route path="/admin/interviews" element={<RequireAuth><AdminInterviewsPage /></RequireAuth>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthBootstrap>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <ErrorState
        code="404"
        title="This page doesn't exist."
        body="The interview, report or page you're looking for isn't here — it may have been cancelled or removed."
      >
        <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          Back to SynthView
        </Link>
      </ErrorState>
    </div>
  )
}
