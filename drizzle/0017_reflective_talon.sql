ALTER TABLE `price_cache` MODIFY COLUMN `price` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `price_history` MODIFY COLUMN `price` decimal(10,2) NOT NULL;