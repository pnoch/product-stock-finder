CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` bigint NOT NULL,
	`usedAt` bigint,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`),
	CONSTRAINT `password_reset_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE `shared_watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'My Watchlist',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
	CONSTRAINT `shared_watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_watchlists_token_unique` UNIQUE(`token`),
	CONSTRAINT `shared_watchlists_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE `shared_watchlist_members` (
	`token` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`role` enum('viewer','editor') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_watchlist_members_token_userId` PRIMARY KEY(`token`,`userId`),
	CONSTRAINT `shared_watchlist_members_token_shared_watchlists_token_fk` FOREIGN KEY (`token`) REFERENCES `shared_watchlists`(`token`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `shared_watchlist_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX `idx_shared_watchlists_owner` ON `shared_watchlists` (`ownerId`);--> statement-breakpoint
CREATE INDEX `idx_shared_watchlists_expires` ON `shared_watchlists` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_shared_members_token` ON `shared_watchlist_members` (`token`);--> statement-breakpoint
CREATE INDEX `idx_shared_members_user` ON `shared_watchlist_members` (`userId`);
