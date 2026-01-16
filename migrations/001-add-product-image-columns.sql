-- Migration: add image_url and image_public_id to products table
ALTER TABLE products ADD image_url NVARCHAR(255) NULL;
ALTER TABLE products ADD image_public_id NVARCHAR(255) NULL;
