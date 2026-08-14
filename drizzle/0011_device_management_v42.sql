CREATE TABLE `device_labels` (
	`deviceId` varchar(128) NOT NULL,
	`label` varchar(64) NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `device_labels_deviceId` PRIMARY KEY(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `revoked_devices` (
	`deviceId` varchar(128) NOT NULL,
	`revokedAt` bigint NOT NULL,
	CONSTRAINT `revoked_devices_deviceId` PRIMARY KEY(`deviceId`)
);
