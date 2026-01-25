const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      defaultValue: 0.00,
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pointOfSaleId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING(128),
      allowNull: true,
    }
  }, {
    tableName: 'orders',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['order_number'] },
      { fields: ['status'] }
    ],
  });

  Order.associate = (models) => {
    if (models.PointOfSale) Order.belongsTo(models.PointOfSale, { foreignKey: 'pointOfSaleId', as: 'pos' });
    if (models.OrderItem) Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
  };

  return Order;
};
