import { Mail, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { Button } from '@/components/ui/button'

function PublicPage({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <SiteNav />
            <main className="animate-slide-up mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">{children}</main>
            <SiteFooter />
        </div>
    )
}

function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
    return (
        <header className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">{body}</p>
        </header>
    )
}

export function AboutPage() {
    return (
        <PublicPage>
            <PageIntro
                eyebrow="About SynthView AI"
                title="Practice for the interview that actually happens."
                body="SynthView AI gives candidates a realistic place to rehearse technical and behavioral interviews, then turns each session into useful, specific feedback."
            />
            <div className="mt-16 grid gap-10 border-y border-border py-10 md:grid-cols-3">
                <section>
                    <Sparkles className="size-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">Adaptive by design</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Every answer helps shape what comes next, so practice does not feel like a fixed quiz.</p>
                </section>
                <section>
                    <Users className="size-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">Built for candidates</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Clear feedback helps you understand your strengths, gaps, and next best practice step.</p>
                </section>
                <section>
                    <ShieldCheck className="size-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">A private practice space</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Your sessions are designed for reflection and improvement, not public performance.</p>
                </section>
            </div>
            <div className="mt-12 flex flex-wrap gap-3">
                <Link to="/register"><Button>Start practicing</Button></Link>
                <Link to="/contact"><Button variant="outline">Talk to us</Button></Link>
            </div>
        </PublicPage>
    )
}

export function ContactPage() {
    return (
        <PublicPage>
            <PageIntro
                eyebrow="Contact"
                title="Questions, feedback, or a partnership idea?"
                body="We would like to hear what would make interview practice more useful for you. Send a note and our team will get back to you."
            />
            <section className="mt-12 border-y border-border py-10">
                <Mail className="size-7 text-primary" />
                <h2 className="mt-4 text-xl font-semibold">Email the SynthView team</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">For product questions, account help, or feedback, email us directly. Include the page or session you are asking about so we can respond efficiently.</p>
                <a href="mailto:hello@synthview.ai" className="mt-6 inline-flex"><Button>hello@synthview.ai</Button></a>
            </section>
        </PublicPage>
    )
}

function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
    const privacy = type === 'privacy'
    return (
        <PublicPage>
            <PageIntro
                eyebrow={privacy ? 'Privacy' : 'Terms'}
                title={privacy ? 'Privacy at a glance' : 'Terms of use'}
                body={privacy ? 'This summary explains the principles we follow when handling your account and interview practice data.' : 'These terms describe the ground rules for using SynthView AI and its interview practice features.'}
            />
            <div className="mt-12 max-w-3xl space-y-10 border-t border-border pt-10 text-sm leading-7 text-muted-foreground">
                {privacy ? (
                    <>
                        <section><h2 className="text-lg font-semibold text-foreground">What we collect</h2><p className="mt-2">We collect the account details and interview content needed to provide the service, improve your experience, and keep accounts secure.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">How we use it</h2><p className="mt-2">Your information is used to run interviews, generate feedback, maintain account security, and communicate important service updates. We do not sell personal information.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">Your choices</h2><p className="mt-2">You can review or update profile information and request account deletion through the account settings or by contacting us.</p></section>
                    </>
                ) : (
                    <>
                        <section><h2 className="text-lg font-semibold text-foreground">Use of the service</h2><p className="mt-2">Use SynthView AI for lawful interview preparation. Keep your account credentials private and do not submit content you do not have permission to use.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">Feedback is guidance</h2><p className="mt-2">Interview evaluations are practice guidance, not employment advice or a guarantee of hiring outcomes. Review results with your own judgment.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">Availability</h2><p className="mt-2">We work to keep the service reliable, but features may change or be temporarily unavailable for maintenance and improvements.</p></section>
                    </>
                )}
                <p className="border-t border-border pt-6 font-mono text-xs">Last updated September 10, 2026</p>
            </div>
        </PublicPage>
    )
}

export function PrivacyPage() {
    return <LegalPage type="privacy" />
}

export function TermsPage() {
    return <LegalPage type="terms" />
}
