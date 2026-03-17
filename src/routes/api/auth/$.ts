import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'

async function handleAuth(request: Request): Promise<Response> {
  try {
    return await auth.handler(request)
  } catch (err) {
    console.error('[auth] handler error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
})
