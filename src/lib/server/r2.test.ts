import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/lib/env', () => ({
  env: {
    R2_ACCOUNT_ID: 'test-account-id',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://test.r2.dev',
  },
}))

import { getR2Client } from './r2'

describe('getR2Client', () => {
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = 'test-account-id'
    process.env.R2_ACCESS_KEY_ID = 'test-access-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
  })

  it('returns an S3Client instance', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3')
    const client = getR2Client()
    expect(client).toBeInstanceOf(S3Client)
  })

  it('creates a new client on each call', () => {
    const client1 = getR2Client()
    const client2 = getR2Client()
    expect(client1).not.toBe(client2)
  })
})
