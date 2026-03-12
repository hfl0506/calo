import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/demo/better-auth')({
  component: AuthPage,
})

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const signUpSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

function AuthPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const navigate = useNavigate()

  return (
    <main className="page-wrap flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="island-shell rise-in w-full max-w-md rounded-2xl p-8">
        <h1 className="mb-1 text-2xl font-bold text-[var(--sea-ink)]">
          {tab === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          {tab === 'signin'
            ? 'Sign in to your account to continue.'
            : 'Sign up to get started.'}
        </p>

        <div className="mb-6 flex rounded-xl border border-[rgba(50,143,151,0.2)] bg-[rgba(79,184,178,0.06)] p-1">
          <button
            type="button"
            onClick={() => setTab('signin')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === 'signin'
                ? 'bg-white text-[var(--sea-ink)] shadow-sm dark:bg-neutral-800'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === 'signup'
                ? 'bg-white text-[var(--sea-ink)] shadow-sm dark:bg-neutral-800'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {tab === 'signin' ? (
          <SignInForm onSuccess={() => navigate({ to: '/' })} />
        ) : (
          <SignUpForm onSuccess={() => setTab('signin')} />
        )}
      </div>
    </main>
  )
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (values: SignInValues) => {
    setServerError(null)
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })
    if (error) {
      setServerError(error.message ?? 'Sign in failed. Please try again.')
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Email" error={errors.email?.message}>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass(!!errors.email)}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputClass(!!errors.password)}
        />
      </Field>

      {serverError && (
        <p className="text-sm text-red-500">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[var(--lagoon-deep)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (values: SignUpValues) => {
    setServerError(null)
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    if (error) {
      setServerError(error.message ?? 'Sign up failed. Please try again.')
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Name" error={errors.name?.message}>
        <input
          {...register('name')}
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          className={inputClass(!!errors.name)}
        />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass(!!errors.email)}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          {...register('password')}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputClass(!!errors.password)}
        />
      </Field>

      <Field label="Confirm Password" error={errors.confirmPassword?.message}>
        <input
          {...register('confirmPassword')}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputClass(!!errors.confirmPassword)}
        />
      </Field>

      {serverError && (
        <p className="text-sm text-red-500">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[var(--lagoon-deep)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[var(--sea-ink)]">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function inputClass(hasError: boolean) {
  return `w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-neutral-900 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none transition focus:ring-2 focus:ring-[rgba(79,184,178,0.4)] ${
    hasError
      ? 'border-red-400 focus:border-red-400'
      : 'border-[rgba(50,143,151,0.3)] focus:border-[rgba(79,184,178,0.6)]'
  }`
}
