ALTER TABLE `revoked_devices` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `revoked_devices` ADD `id` int AUTO_INCREMENT NOT NULL, ADD PRIMARY KEY(`id`), ADD `userId` int, ADD CONSTRAINT `revoked_devices_user_device` UNIQUE(`userId`,`deviceId`);
