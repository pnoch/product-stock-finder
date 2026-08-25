-- Deduplicate existing notification_events rows before adding unique indexes.
-- Keeps the oldest event per (userId, dedupKey) and (deviceId, dedupKey).
DELETE n1 FROM notification_events n1
JOIN notification_events n2
  ON n1.userId <=> n2.userId
  AND n1.dedupKey = n2.dedupKey
  AND n1.id > n2.id;--> statement-breakpoint
DELETE n1 FROM notification_events n1
JOIN notification_events n2
  ON n1.deviceId <=> n2.deviceId
  AND n1.dedupKey = n2.dedupKey
  AND n1.id > n2.id;--> statement-breakpoint
-- Remove orphaned deliveries referencing deleted events.
DELETE d FROM notification_event_deliveries d
LEFT JOIN notification_events e ON d.eventId = e.id
WHERE e.id IS NULL;--> statement-breakpoint
ALTER TABLE `notification_events` ADD CONSTRAINT `notif_events_user_dedup` UNIQUE(`userId`,`dedupKey`);--> statement-breakpoint
ALTER TABLE `notification_events` ADD CONSTRAINT `notif_events_device_dedup` UNIQUE(`deviceId`,`dedupKey`);