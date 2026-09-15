CREATE INDEX `device_notification_configs_user` ON `device_notification_configs` (`userId`);--> statement-breakpoint
CREATE INDEX `device_push_tokens_user` ON `device_push_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `revoked_devices_device` ON `revoked_devices` (`deviceId`);