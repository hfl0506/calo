ALTER TABLE "meal_foods" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meal_foods" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "logged_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "logged_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "created_at" SET DEFAULT now();