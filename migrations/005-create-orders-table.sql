IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'orders' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.orders (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    order_number NVARCHAR(64) NOT NULL,
    status NVARCHAR(32) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    is_paid BIT NOT NULL DEFAULT 0,
    notes NVARCHAR(MAX) NULL,
    point_of_sale_id UNIQUEIDENTIFIER NULL,
    created_by NVARCHAR(128) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2 NULL
  );

  CREATE UNIQUE INDEX ux_orders_order_number ON dbo.orders(order_number);
  CREATE INDEX idx_orders_status ON dbo.orders(status);

  IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'points_of_sale' AND schema_id = SCHEMA_ID('dbo'))
  BEGIN
    ALTER TABLE dbo.orders
      ADD CONSTRAINT fk_orders_point_of_sale FOREIGN KEY (point_of_sale_id) REFERENCES dbo.points_of_sale(id) ON DELETE SET NULL;
  END
END
ELSE
BEGIN
  PRINT 'Table dbo.orders already exists, skipping migration.';
END
