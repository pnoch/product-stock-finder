CREATE TABLE `product_images` (
	`productId` varchar(128) NOT NULL,
	`imageUrl` text NOT NULL,
	CONSTRAINT `product_images_productId` PRIMARY KEY(`productId`)
);
