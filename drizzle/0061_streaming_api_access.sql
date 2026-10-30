CREATE TABLE "streaming_api_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" bigint,
	"access_id" uuid NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streaming_api_events_action" CHECK ("streaming_api_events"."action" IN ('create', 'revoke'))
);
--> statement-breakpoint
CREATE TABLE "streaming_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"session_hash" text NOT NULL,
	"user_id" bigint NOT NULL,
	"origin" text NOT NULL,
	"edition_slug" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "streaming_api_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "streaming_api_tokens_hash" CHECK ("streaming_api_tokens"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "streaming_api_tokens_expiry" CHECK ("streaming_api_tokens"."expires_at" > "streaming_api_tokens"."created_at" AND "streaming_api_tokens"."last_used_at" >= "streaming_api_tokens"."created_at" AND "streaming_api_tokens"."expires_at" <= "streaming_api_tokens"."last_used_at" + interval '1 hour'),
	CONSTRAINT "streaming_api_tokens_scopes" CHECK (jsonb_typeof("streaming_api_tokens"."scopes") = 'array' AND jsonb_array_length("streaming_api_tokens"."scopes") = 1 AND "streaming_api_tokens"."scopes" <@ '["streaming:read"]'::jsonb)
);
--> statement-breakpoint
ALTER TABLE "streaming_api_events" ADD CONSTRAINT "streaming_api_events_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_api_tokens" ADD CONSTRAINT "streaming_api_tokens_session_hash_sessions_token_hash_fk" FOREIGN KEY ("session_hash") REFERENCES "public"."sessions"("token_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_api_tokens" ADD CONSTRAINT "streaming_api_tokens_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_api_tokens" ADD CONSTRAINT "streaming_api_tokens_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "streaming_api_tokens_user_idx" ON "streaming_api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "streaming_api_tokens_session_idx" ON "streaming_api_tokens" USING btree ("session_hash");