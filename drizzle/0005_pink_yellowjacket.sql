CREATE INDEX "meal_foods_meal_id_idx" ON "meal_foods" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "meals_user_logged_at_idx" ON "meals" USING btree ("user_id","logged_at");