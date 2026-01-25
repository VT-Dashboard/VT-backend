const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PointOfSale = sequelize.define('PointOfSale', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contact: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'points_of_sale',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['code'] },
      { fields: ['name'] }
    ],
  });

  PointOfSale.associate = (models) => {
    // place-holder for future associations
  };

  return PointOfSale;
};
