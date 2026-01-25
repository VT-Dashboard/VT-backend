const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    quantity: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 1,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      defaultValue: 0.00,
    },
    totalPrice: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      defaultValue: 0.00,
    }
  }, {
    tableName: 'order_items',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['product_id'] }
    ],
  });

  OrderItem.associate = (models) => {
    if (models.Order) OrderItem.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    if (models.Product) OrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  return OrderItem;
};
