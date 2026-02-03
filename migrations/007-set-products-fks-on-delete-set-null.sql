-- Migration: Set products.brand_id and products.category_id to allow NULL
-- and recreate foreign keys to use ON DELETE SET NULL.
-- Safe to run multiple times; wraps operations in a transaction.

SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;

  -- Ensure products table exists
  IF OBJECT_ID('dbo.products','U') IS NULL
  BEGIN
    RAISERROR('Table dbo.products does not exist. Aborting migration.',16,1);
  END

  -- Make brand_id nullable if it's not already
  IF EXISTS(
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'products' AND c.name = 'brand_id' AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE dbo.products
    ALTER COLUMN brand_id UNIQUEIDENTIFIER NULL;
  END

  -- Make category_id nullable if it's not already
  IF EXISTS(
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'products' AND c.name = 'category_id' AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE dbo.products
    ALTER COLUMN category_id UNIQUEIDENTIFIER NULL;
  END

  -- Drop any existing foreign keys from products -> brands/categories
  DECLARE @fkName NVARCHAR(128);
  DECLARE fk_cursor CURSOR FOR
  SELECT fk.name
  FROM sys.foreign_keys fk
  JOIN sys.tables pt ON fk.parent_object_id = pt.object_id
  JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
  WHERE pt.name = 'products' AND rt.name IN ('brands','categories');

  OPEN fk_cursor;
  FETCH NEXT FROM fk_cursor INTO @fkName;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC('ALTER TABLE dbo.products DROP CONSTRAINT [' + @fkName + ']');
    FETCH NEXT FROM fk_cursor INTO @fkName;
  END
  CLOSE fk_cursor;
  DEALLOCATE fk_cursor;

  -- Add FK to brands with ON DELETE SET NULL if not present
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

  -- Add FK to categories with ON DELETE SET NULL if not present
  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    JOIN sys.tables pt ON fk.parent_object_id = pt.object_id
    JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
    WHERE pt.name = 'products' AND rt.name = 'categories'
  )
  BEGIN
    ALTER TABLE dbo.products
    ADD CONSTRAINT FK_products_category_id
    FOREIGN KEY (category_id) REFERENCES dbo.categories(id)
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
