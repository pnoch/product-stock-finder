ALTER TABLE `price_cache` MODIFY COLUMN `price` decimal(12,4) NOT NULL;--> statement-breakpoint
ALTER TABLE `price_history` MODIFY COLUMN `price` decimal(12,4) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);
