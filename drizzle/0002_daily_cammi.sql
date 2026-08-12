CREATE TABLE `price_cache` (
	`distributorId` varchar(64) NOT NULL,
	`modelNumber` varchar(128) NOT NULL,
	`price` double NOT NULL,
	`currency` varchar(8) NOT NULL,
	`stockStatus` varchar(16) NOT NULL,
	`expectedDate` varchar(64),
	`url` text NOT NULL,
	`taxRate` double,
	`fetchedAt` bigint NOT NULL,
	CONSTRAINT `price_cache_distributorId_modelNumber_pk` PRIMARY KEY(`distributorId`,`modelNumber`)
);
