import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

export async function getSession() {
  const req = getRequest()
  return auth.api.getSession({ headers: req.headers })
}
