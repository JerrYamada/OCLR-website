CREATE TABLE "mappool_candidate_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"edition_slug" text NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" bigint NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_comment_request_unique" UNIQUE("candidate_id","author_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "mappool_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"beatmap_id" bigint NOT NULL,
	"metadata" jsonb NOT NULL,
	"metadata_fetched_at" timestamp with time zone NOT NULL,
	"author_id" bigint NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_edition_bid_unique" UNIQUE("edition_slug","beatmap_id"),
	CONSTRAINT "candidate_id_edition_unique" UNIQUE("id","edition_slug")
);
--> statement-breakpoint
ALTER TABLE "mappool_candidate_comments" ADD CONSTRAINT "mappool_candidate_comments_candidate_id_edition_slug_mappool_candidates_id_edition_slug_fk" FOREIGN KEY ("candidate_id","edition_slug") REFERENCES "public"."mappool_candidates"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mappool_candidates" ADD CONSTRAINT "mappool_candidates_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_comment_target_idx" ON "mappool_candidate_comments" USING btree ("candidate_id","created_at");