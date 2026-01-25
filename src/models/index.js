import { sequelize } from "../config/db.js";
import productDef from "./Product.js"; // product.js exports a function (module.exports = (sequelize) => {...})
import supplierDef from "./Supplier.js";
import brandDef from "./Brand.js";
import categoryDef from "./Category.js";
import pointOfSaleDef from "./PointOfSale.js";
import orderDef from "./Order.js";
import orderItemDef from "./OrderItem.js";

/**
 * If product.js uses CommonJS (module.exports = fn) dynamic import will give default.
 * productDef should be a function taking (sequelize) and returning a defined model.
 */
const Product = typeof productDef === "function" ? productDef(sequelize) : productDef.default(sequelize);
const Supplier = typeof supplierDef === "function" ? supplierDef(sequelize) : supplierDef.default(sequelize);
const Brand = typeof brandDef === "function" ? brandDef(sequelize) : brandDef.default(sequelize);
const Category = typeof categoryDef === "function" ? categoryDef(sequelize) : categoryDef.default(sequelize);
const PointOfSale = typeof pointOfSaleDef === "function" ? pointOfSaleDef(sequelize) : pointOfSaleDef.default(sequelize);
const Order = typeof orderDef === "function" ? orderDef(sequelize) : orderDef.default(sequelize);
const OrderItem = typeof orderItemDef === "function" ? orderItemDef(sequelize) : orderItemDef.default(sequelize);

// Run associations if any (your product/supplier models set .associate)
const models = { Product, Supplier, Brand, Category, PointOfSale, Order, OrderItem };
Object.values(models).forEach((m) => {
  if (m && typeof m.associate === "function") {
    m.associate(models);
  }
});

export default { sequelize, models, Product, Supplier, Brand, Category, PointOfSale, Order, OrderItem };
// also export named
export { sequelize as sequelizeInstance, Product, Supplier, Brand, Category, PointOfSale, Order, OrderItem, models };