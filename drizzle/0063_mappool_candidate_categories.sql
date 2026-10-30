ALTER TABLE "mappool_candidates" DROP CONSTRAINT "candidate_edition_bid_unique";--> statement-breakpoint
ALTER TABLE "mappool_candidates" ADD COLUMN "category" text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "mappool_candidates" ADD CONSTRAINT "candidate_edition_category_bid_unique" UNIQUE("edition_slug","category","beatmap_id");--> statement-breakpoint
ALTER TABLE "mappool_candidates" ADD CONSTRAINT "candidate_category_valid" CHECK ("mappool_candidates"."category" in ('unassigned', 'NM', 'HD', 'DT', 'HR', 'FM', 'TB'));