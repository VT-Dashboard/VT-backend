const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
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
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'categories',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['name'] },
      { fields: ['parent_id'] },
    ],
  });

  Category.associate = (models) => {
    if (models.Product) Category.hasMany(models.Product, { foreignKey: 'categoryId', as: 'products' });
    if (models.Category) {
      Category.hasMany(models.Category, { foreignKey: 'parentId', as: 'children' });
      Category.belongsTo(models.Category, { foreignKey: 'parentId', as: 'parent' });
    }
  };

  Category.beforeValidate((c) => {
    if (c.name && typeof c.name === 'string') c.name = c.name.trim();
  });

  return Category;
};
