-- Migration: create brands table and add brand_id to products

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'brands' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.brands (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_brands PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    website NVARCHAR(255) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(7) NULL
  );
  IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.brands') AND name = 'IX_brands_name')
    CREATE INDEX IX_brands_name ON dbo.brands(name);
  -- ensure brand name uniqueness
  IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.brands') AND name = 'UQ_brands_name')
    ALTER TABLE dbo.brands ADD CONSTRAINT UQ_brands_name UNIQUE (name);
END

IF COL_LENGTH('dbo.products','brand_id') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD brand_id UNIQUEIDENTIFIER NULL;
  IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.products') AND name = 'IX_products_brand_id')
    CREATE INDEX IX_products_brand_id ON dbo.products(brand_id);
  -- drop existing FK if present, then add with ON DELETE SET NULL, ON UPDATE CASCADE
  IF EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('dbo.products') AND name = 'FK_products_brand_id')
  BEGIN
    ALTER TABLE dbo.products DROP CONSTRAINT FK_products_brand_id;
  END
  ALTER TABLE dbo.products ADD CONSTRAINT FK_products_brand_id FOREIGN KEY (brand_id) REFERENCES dbo.brands(id) ON DELETE SET NULL ON UPDATE CASCADE;
END
