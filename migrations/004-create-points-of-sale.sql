IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'points_of_sale' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.points_of_sale (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(64) NULL,
    location NVARCHAR(255) NULL,
    address NVARCHAR(MAX) NULL,
    contact NVARCHAR(128) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2 NULL
  );

  CREATE INDEX idx_points_of_sale_name ON dbo.points_of_sale(name);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes ix JOIN sys.objects o ON ix.object_id = o.object_id WHERE o.name = 'points_of_sale' AND ix.name = 'ux_points_of_sale_code')
  BEGIN
    CREATE UNIQUE INDEX ux_points_of_sale_code ON dbo.points_of_sale(code) WHERE code IS NOT NULL;
  END
END
ELSE
BEGIN
  PRINT 'Table dbo.points_of_sale already exists, skipping migration.';
END
