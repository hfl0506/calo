import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { userSettings } from '#/db/schema'
import { auth } from '#/lib/auth'

async function getSession() {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  return session
}

export const getUserSettingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const row = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.user.id),
    })

    return {
      dailyCalorieGoal: row?.dailyCalorieGoal ?? 2000,
    }
  })

const updateSettingsSchema = z.object({
  dailyCalorieGoal: z.number().int().min(500).max(10000),
})

export const updateUserSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateSettingsSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const existing = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.user.id),
    })

    if (existing) {
      await db
        .update(userSettings)
        .set({
          dailyCalorieGoal: data.dailyCalorieGoal,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, session.user.id))
    } else {
      await db.insert(userSettings).values({
        userId: session.user.id,
        dailyCalorieGoal: data.dailyCalorieGoal,
      })
    }

    return { success: true }
  })
