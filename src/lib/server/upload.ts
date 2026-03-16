import { createServerFn } from '@tanstack/react-start'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { getSession } from '#/lib/server/session'
import { getR2Client } from '#/lib/server/r2'
import { env } from '#/lib/env'

const getMealUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(100),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const getMealUploadUrlFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => getMealUploadUrlSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const ext = extMap[data.contentType] ?? 'jpg'
    const safeFileName = data.fileName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const key = `meals/${session.user.id}/${data.date}/${safeFileName}.${ext}`

    const r2 = getR2Client()
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: data.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })

    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 })
    const publicUrl = `${env.R2_PUBLIC_URL}/${key}`

    return { presignedUrl, key, publicUrl }
  })
