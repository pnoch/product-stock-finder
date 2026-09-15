CREATE INDEX `email_verification_tokens_expires_at` ON `email_verification_tokens` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_expires_at` ON `password_reset_tokens` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_price_history_date` ON `price_history` (`date`);--> statement-breakpoint
CREATE INDEX `revoked_devices_revoked_at` ON `revoked_devices` (`revokedAt`);