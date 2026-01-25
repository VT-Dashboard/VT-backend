const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sku: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    barcode: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    unit: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reorderLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'products',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['barcode'] },
      { fields: ['sku'] },
      { fields: ['category_id'] },
      { fields: ['brand_id'] },
      { unique: true, fields: ['barcode'] }
    ],
  });

  // Optional associations — call from index/models loader
  Product.associate = (models) => {
    if (models.Category) Product.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
    if (models.Supplier) Product.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    if (models.Brand) Product.belongsTo(models.Brand, { foreignKey: 'brandId', as: 'brand' });
  };

  // Normalize inputs
  Product.beforeValidate((product) => {
    if (product.barcode && typeof product.barcode === 'string') {
      product.barcode = product.barcode.trim();
    }
    if (product.sku && typeof product.sku === 'string') {
      product.sku = product.sku.trim().toUpperCase();
    }
  });

  return Product;
};