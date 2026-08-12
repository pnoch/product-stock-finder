CREATE TABLE `price_history` (
	`distributorId` varchar(64) NOT NULL,
	`modelNumber` varchar(128) NOT NULL,
	`date` varchar(10) NOT NULL,
	`price` double NOT NULL,
	`currency` varchar(8) NOT NULL,
	`stockStatus` varchar(16) NOT NULL,
	`fetchedAt` bigint NOT NULL,
	CONSTRAINT `price_history_distributorId_modelNumber_date_pk` PRIMARY KEY(`distributorId`,`modelNumber`,`date`)
);
