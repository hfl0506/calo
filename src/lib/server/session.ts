import { createServerFn } from '@tanstack/react-start'

/** Safe to import from client code (route files). Calls getSession via RPC boundary. */
export const getSessionFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { getSession } = await import('./session.server')
    return getSession()
  })
