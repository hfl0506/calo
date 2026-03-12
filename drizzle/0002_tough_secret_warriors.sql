TRUNCATE TABLE "meal_foods", "meals" CASCADE;--> statement-breakpoint
ALTER TABLE "meal_foods" DROP COLUMN "meal_id";--> statement-breakpoint
ALTER TABLE "meals" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_foods" ADD COLUMN "meal_id" uuid NOT NULL REFERENCES "meals"("id") ON DELETE CASCADE;
