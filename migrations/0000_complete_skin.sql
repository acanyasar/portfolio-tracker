CREATE TABLE "holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"shares" real NOT NULL,
	"avg_cost" real NOT NULL,
	"sector" text DEFAULT 'Other' NOT NULL,
	"notes" text DEFAULT '',
	"purchase_date" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"watchlist_item_id" integer,
	"ticker" text NOT NULL,
	"type" text NOT NULL,
	"price" real NOT NULL,
	"threshold" real NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_cache" (
	"ticker" text PRIMARY KEY NOT NULL,
	"price" real NOT NULL,
	"change" real DEFAULT 0 NOT NULL,
	"change_percent" real DEFAULT 0 NOT NULL,
	"high_52w" real,
	"low_52w" real,
	"market_cap" real,
	"volume" integer,
	"fetched_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"shares" real NOT NULL,
	"price" real NOT NULL,
	"total_value" real NOT NULL,
	"date" text NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dashboard_widgets" jsonb DEFAULT '{"sectorAllocation":true,"dividendIncome":true,"upcomingEvents":true,"performanceRanking":true,"portfolioHealth":true,"quickActions":true}'::jsonb NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"alert_low" real,
	"alert_high" real,
	"notes" text DEFAULT '',
	"added_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_watchlist_item_id_watchlist_id_fk" FOREIGN KEY ("watchlist_item_id") REFERENCES "public"."watchlist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;