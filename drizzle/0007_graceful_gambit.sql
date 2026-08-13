CREATE TABLE `device_push_tokens` (
	`deviceId` varchar(128) NOT NULL,
	`token` varchar(255) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `device_push_tokens_deviceId` PRIMARY KEY(`deviceId`)
);
