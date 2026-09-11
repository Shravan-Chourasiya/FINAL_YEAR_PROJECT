import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { cn } from '@/lib/utils'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const email = (location.state as { email?: string } | null)?.email ?? pendingEmail ?? ''
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [state, setState] = useState<'idle' | 'loading' | 'expired' | 'success'>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const code = digits.join('')

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const setDigit = (i: number, value: string) => {
    const ch = value.replace(/\D/g, '').slice(-1)
    setDigits((d) => d.map((x, idx) => (idx === i ? ch : x)))
    if (ch && i < 5) refs.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setNotice('Please request a new registration email from the sign-up form.')
    setNotice('A new code has been sent.')
    setState('idle')
    setCooldown(15)
  }

  const verify = async () => {
    if (state === 'loading') return
    if (code.length < 6) {
      setNotice('Please enter the full 6-digit code.')
      return
    }
    setState('loading')
    setNotice(null)
    try {
      if (!email) {
        setNotice('Your registration email is missing. Please start registration again.')
        setState('idle')
        return
      }
      await verifyOtp(email, code)
      setState('success')
      setTimeout(() => navigate('/login', { state: { verifiedEmail: email } }), 900)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOKEN_EXPIRED') {
        setState('expired')
      } else {
        setNotice('Verification failed. Please try again.')
        setState('idle')
      }
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Enter the 6-digit code we sent you.">
      <div className="flex flex-col gap-4">
        {state === 'expired' ? (
          <Alert variant="warning" icon={<AlertTriangle className="size-4" />}>
            This code has expired.{' '}
            <button onClick={resend} className="font-medium underline underline-offset-2">
              Request a new one
            </button>
            .
          </Alert>
        ) : null}
        {notice ? <Alert variant="default">{notice}</Alert> : null}
        {state === 'success' ? (
          <Alert variant="strong">Email verified — taking you to your dashboard…</Alert>
        ) : null}

        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              maxLength={2}
              aria-label={`Digit ${i + 1}`}
              className={cn(
                'size-11 rounded-lg border border-input bg-background text-center font-mono text-lg font-semibold tabular-nums transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                d && 'border-primary/40',
              )}
            />
          ))}
        </div>

        <Button className="h-10 w-full" onClick={verify} disabled={state === 'loading' || state === 'success'}>
          {state === 'loading' ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify'
          )}
        </Button>

        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-center font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend code'}
        </button>

      </div>
    </AuthLayout>
  )
}