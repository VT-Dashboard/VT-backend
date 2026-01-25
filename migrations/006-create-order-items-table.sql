IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'order_items' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.order_items (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    order_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    product_name NVARCHAR(255) NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2 NULL
  );

  CREATE INDEX idx_order_items_order_id ON dbo.order_items(order_id);
  CREATE INDEX idx_order_items_product_id ON dbo.order_items(product_id);

  IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'orders' AND schema_id = SCHEMA_ID('dbo'))
  BEGIN
    ALTER TABLE dbo.order_items
      ADD CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE;
  END

  IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'products' AND schema_id = SCHEMA_ID('dbo'))
  BEGIN
    ALTER TABLE dbo.order_items
      ADD CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE NO ACTION;
  END
END
ELSE
BEGIN
  PRINT 'Table dbo.order_items already exists, skipping migration.';
END
