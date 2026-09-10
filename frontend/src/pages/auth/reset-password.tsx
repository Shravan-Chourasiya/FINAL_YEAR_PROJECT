import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { PasswordChecklist, passwordIsValid } from './password-checklist'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || expired) return
    setError(null)
    if (!passwordIsValid(password))
      return setError('Password does not meet the requirements below.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      if (!email) return setError('Your reset email is missing. Please request a new reset.')
      if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit verification code.')
      await api.resetPassword(email, otp, password)
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password you haven't used before.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {expired ? (
          <Alert variant="warning" icon={<AlertTriangle className="size-4" />}>
            This reset link has expired.{' '}
            <Link to="/forgot-password" className="font-medium underline underline-offset-2">
              Request a new one
            </Link>
            .
          </Alert>
        ) : null}
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp">Verification code</Label>
          <Input id="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordChecklist value={password} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <Button type="submit" className="h-10 w-full" disabled={loading || expired}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Resetting…
            </>
          ) : (
            'Reset password'
          )}
        </Button>

        <button
          type="button"
          onClick={() => setExpired(true)}
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          Demo: simulate expired token
        </button>
      </form>
    </AuthLayout>
  )
}