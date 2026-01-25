const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contactPerson: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'suppliers',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['name'] },
      { fields: ['email'] },
    ],
  });

  Supplier.associate = (models) => {
    if (models.Product) Supplier.hasMany(models.Product, { foreignKey: 'supplierId', as: 'products' });
  };

  Supplier.beforeValidate((s) => {
    if (s.email && typeof s.email === 'string') s.email = s.email.trim().toLowerCase();
    if (s.phone && typeof s.phone === 'string') s.phone = s.phone.trim();
  });

  return Supplier;
};
