import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { auth } from '#/lib/auth'

async function getSession() {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  return session
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

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
    const key = `meals/${session.user.id}/${data.date}/${data.fileName}.${ext}`

    const r2 = getR2Client()
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: data.contentType,
    })

    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 })
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

    return { presignedUrl, key, publicUrl }
  })
