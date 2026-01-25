const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Brand = sequelize.define('Brand', {
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
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'brands',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['name'] },
    ],
  });

  Brand.associate = (models) => {
    if (models.Product) Brand.hasMany(models.Product, { foreignKey: 'brandId', as: 'products' });
  };

  Brand.beforeValidate((b) => {
    if (b.website && typeof b.website === 'string') b.website = b.website.trim();
    if (b.name && typeof b.name === 'string') b.name = b.name.trim();
  });

  return Brand;
};
