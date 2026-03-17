import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

const inputClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2.5 text-base text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[var(--lagoon-deep)]/20'

function SignUpPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 types incompatible with @hookform/resolvers
} = useForm<FormData>({ resolver: zodResolver(schema as any) })

  const onSubmit = async (data: FormData) => {
    const { error } = await authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    })
    if (error) {
      setError('root', { message: error.message ?? 'Failed to create account' })
      return
    }
    await navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="display-title text-4xl font-bold text-[var(--lagoon-deep)]">Calo</h1>
          <p className="mt-1 text-sm font-medium text-[var(--sea-ink)]">Create account</p>
          <p className="text-sm text-[var(--sea-ink-soft)]">Start tracking your meals today</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="island-shell space-y-4 rounded-2xl p-6">
          {errors.root && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {errors.root.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-semibold text-[var(--sea-ink)]">Name</label>
            <input id="name" type="text" autoComplete="name" placeholder="Your name" className={inputClass} {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-[var(--sea-ink)]">Email</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={inputClass} {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-[var(--sea-ink)]">Password</label>
            <input id="password" type="password" autoComplete="new-password" placeholder="Min. 8 characters" className={inputClass} {...register('password')} />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-semibold text-[var(--sea-ink)]">Confirm password</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter your password" className={inputClass} {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--sea-ink-soft)]">
          Already have an account?{' '}
          <Link to="/sign-in" className="font-semibold text-[var(--lagoon-deep)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
