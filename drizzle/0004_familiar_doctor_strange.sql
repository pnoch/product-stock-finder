CREATE TABLE `price_insights` (
	`productId` varchar(128) NOT NULL,
	`insight` text NOT NULL,
	`generatedAt` bigint NOT NULL,
	CONSTRAINT `price_insights_productId` PRIMARY KEY(`productId`)
);
