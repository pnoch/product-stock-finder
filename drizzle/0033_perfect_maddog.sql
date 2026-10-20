CREATE TABLE `push_delivery_log` (
	`deviceId` varchar(128) NOT NULL,
	`status` varchar(16) NOT NULL,
	`error` varchar(64),
	`sentAt` bigint NOT NULL,
	`eventCount` bigint NOT NULL,
	`ticketId` varchar(64),
	CONSTRAINT `push_delivery_log_deviceId` PRIMARY KEY(`deviceId`)
);
