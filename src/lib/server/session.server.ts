import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

/** Use inside other server function handlers — no RPC overhead. */
export async function getSession() {
  const req = getRequest()
  return auth.api.getSession({ headers: req.headers })
}
