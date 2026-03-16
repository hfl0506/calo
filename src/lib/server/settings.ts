import { createServerFn } from '@tanstack/react-start'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { userSettings } from '#/db/schema'
import { getSession } from '#/lib/server/session'

export const getUserSettingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const row = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.user.id),
    })

    return {
      dailyCalorieGoal: row?.dailyCalorieGoal ?? 2000,
      proteinGoal: row?.proteinGoal ?? null,
      carbsGoal: row?.carbsGoal ?? null,
      fatGoal: row?.fatGoal ?? null,
      fiberGoal: row?.fiberGoal ?? null,
    }
  })

const updateSettingsSchema = z.object({
  dailyCalorieGoal: z.number().int().min(500).max(10000),
  proteinGoal: z.number().int().min(0).max(1000).nullable().optional(),
  carbsGoal: z.number().int().min(0).max(2000).nullable().optional(),
  fatGoal: z.number().int().min(0).max(1000).nullable().optional(),
  fiberGoal: z.number().int().min(0).max(500).nullable().optional(),
})

export const updateUserSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateSettingsSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    await db
      .insert(userSettings)
      .values({
        userId: session.user.id,
        dailyCalorieGoal: data.dailyCalorieGoal,
        proteinGoal: data.proteinGoal ?? null,
        carbsGoal: data.carbsGoal ?? null,
        fatGoal: data.fatGoal ?? null,
        fiberGoal: data.fiberGoal ?? null,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          dailyCalorieGoal: data.dailyCalorieGoal,
          proteinGoal: data.proteinGoal ?? null,
          carbsGoal: data.carbsGoal ?? null,
          fatGoal: data.fatGoal ?? null,
          fiberGoal: data.fiberGoal ?? null,
          updatedAt: sql`now()`,
        },
      })

    return { success: true }
  })
