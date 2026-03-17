import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockGetSignedUrl, mockR2Send } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetSignedUrl: vi.fn(),
  mockR2Send: vi.fn(),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const chain: any = {
      inputValidator: () => chain,
      handler: (fn: any) => (args?: any) => fn(args ?? {}),
    }
    return chain
  },
}))

vi.mock('#/lib/server/session.server', () => ({ getSession: mockGetSession }))

vi.mock('@aws-sdk/client-s3', () => ({ PutObjectCommand: vi.fn() }))

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mockGetSignedUrl }))

vi.mock('#/lib/server/r2', () => ({ getR2Client: vi.fn(() => ({ send: mockR2Send })) }))

import { getMealUploadUrlFn } from './upload'

const SESSION = { user: { id: 'user-1', email: 'test@example.com', name: 'Test' } }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue(SESSION)
  process.env.R2_BUCKET_NAME = 'test-bucket'
  process.env.R2_PUBLIC_URL = 'https://pub.r2.dev'
  mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com/upload')
})

describe('getMealUploadUrlFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(
      getMealUploadUrlFn({ data: { fileName: 'photo', contentType: 'image/jpeg', date: '2026-03-16' } }),
    ).rejects.toThrow('Unauthorized')
  })

  it('returns presignedUrl, key, and publicUrl', async () => {
    const result = await getMealUploadUrlFn({
      data: { fileName: 'my-photo', contentType: 'image/jpeg', date: '2026-03-16' },
    })
    expect(result.presignedUrl).toBe('https://presigned-url.example.com/upload')
    expect(result.key).toMatch(/^meals\/user-1\/2026-03-16\//)
    expect(result.publicUrl).toMatch(/^https:\/\/pub\.r2\.dev\/meals\/user-1\/2026-03-16\//)
  })

  it('uses correct extension for image/png', async () => {
    const result = await getMealUploadUrlFn({
      data: { fileName: 'photo', contentType: 'image/png', date: '2026-03-16' },
    })
    expect(result.key).toMatch(/\.png$/)
  })

  it('uses correct extension for image/webp', async () => {
    const result = await getMealUploadUrlFn({
      data: { fileName: 'photo', contentType: 'image/webp', date: '2026-03-16' },
    })
    expect(result.key).toMatch(/\.webp$/)
  })

  it('sanitizes fileName by replacing special characters with underscores', async () => {
    const result = await getMealUploadUrlFn({
      data: { fileName: 'my photo!@#$%', contentType: 'image/jpeg', date: '2026-03-16' },
    })
    expect(result.key).not.toMatch(/[!@#$% ]/)
    expect(result.key).toContain('my_photo_____')
  })

  it('key includes userId and date in path', async () => {
    const result = await getMealUploadUrlFn({
      data: { fileName: 'photo', contentType: 'image/jpeg', date: '2026-03-16' },
    })
    expect(result.key).toContain('meals/user-1/2026-03-16/')
  })
})
