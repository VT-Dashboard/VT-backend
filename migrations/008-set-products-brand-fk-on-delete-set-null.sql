-- Migration: Make products.brand_id nullable and recreate FK to brands with ON DELETE SET NULL
-- Idempotent: checks for existence before dropping/adding constraints.

SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID('dbo.products','U') IS NULL
  BEGIN
    RAISERROR('Table dbo.products does not exist. Aborting migration.',16,1);
  END

  -- Make brand_id nullable if not already
  IF EXISTS(
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'products' AND c.name = 'brand_id' AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE dbo.products
    ALTER COLUMN brand_id UNIQUEIDENTIFIER NULL;
  END

  -- Find and drop any FK from products -> brands
  DECLARE @fkName NVARCHAR(128);
  SELECT TOP (1) @fkName = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.tables pt ON fk.parent_object_id = pt.object_id
  JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
  WHERE pt.name = 'products' AND rt.name = 'brands';

  IF @fkName IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE dbo.products DROP CONSTRAINT [' + @fkName + ']');
  END
  ELSE
  BEGIN
    PRINT 'No existing FK from products to brands found (skipping drop).';
  END

  -- Add FK with ON DELETE SET NULL if not present
  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    JOIN sys.tables pt ON fk.parent_object_id = pt.object_id
    JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
    WHERE pt.name = 'products' AND rt.name = 'brands'
  )
  BEGIN
    ALTER TABLE dbo.products
    ADD CONSTRAINT FK_products_brand_id
    FOREIGN KEY (brand_id) REFERENCES dbo.brands(id)
    ON DELETE SET NULL;
  END

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0
    ROLLBACK TRANSACTION;
  DECLARE @errMsg NVARCHAR(MAX) = ERROR_MESSAGE();
  THROW 50000, @errMsg, 1;
END CATCH;
