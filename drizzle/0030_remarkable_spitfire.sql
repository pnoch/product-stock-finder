DROP INDEX `idx_notif_email_sent` ON `notification_email_log`;--> statement-breakpoint
ALTER TABLE `notification_email_log` MODIFY COLUMN `dedupKey` varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_notif_email_user_sent` ON `notification_email_log` (`userId`,`sentAt`);