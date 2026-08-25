ALTER TABLE `app_settings` ADD `clientUpdatedAtMs` bigint;--> statement-breakpoint
ALTER TABLE `back_order_reminders` ADD `clientUpdatedAtMs` bigint;--> statement-breakpoint
ALTER TABLE `price_alerts` ADD `clientUpdatedAtMs` bigint;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD `clientUpdatedAtMs` bigint;