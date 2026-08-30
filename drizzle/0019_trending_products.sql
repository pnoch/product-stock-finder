CREATE TABLE IF NOT EXISTS `trendingProducts` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `brand` VARCHAR(100),
  `category` VARCHAR(100),
  `estimatedPrice` DECIMAL(10,2),
  `currency` VARCHAR(3) DEFAULT 'USD',
  `reason` TEXT,
  `source` VARCHAR(255),
  `fetchedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` TIMESTAMP NOT NULL
);
