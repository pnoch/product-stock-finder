CREATE TABLE `trendingProducts` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`brand` varchar(100),
	`category` varchar(100),
	`estimatedPrice` decimal(10,2),
	`currency` varchar(3) DEFAULT 'USD',
	`reason` text,
	`source` varchar(255),
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `trendingProducts_id` PRIMARY KEY(`id`)
);
