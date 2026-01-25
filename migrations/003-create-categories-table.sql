IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'categories' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.categories (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    parent_id UNIQUEIDENTIFIER NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2 NULL
  );

  CREATE INDEX idx_categories_name ON dbo.categories(name);
  CREATE INDEX idx_categories_parent_id ON dbo.categories(parent_id);

  ALTER TABLE dbo.categories
    ADD CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES dbo.categories(id) ON DELETE SET NULL;
END
ELSE
BEGIN
  PRINT 'Table dbo.categories already exists, skipping migration.';
END
