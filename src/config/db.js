import dotenv from "dotenv";
dotenv.config();

import sql from "mssql";
import { Sequelize } from "sequelize";

const instanceName = process.env.SQL_INSTANCE || undefined;

const mssqlConfig = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASS || "YourPass123!",
  server: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "vt_db",
  options: {
    // Provide the SQL Server instance name for SQLEXPRESS
    instanceName: instanceName || undefined,
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

// mssql poolPromise (raw SQL fallback)
const poolPromise = new sql.ConnectionPool(mssqlConfig)
  .connect()
  .then((pool) => {
    console.log("mssql pool created");
    return pool;
  })
  .catch((err) => {
    console.error("mssql pool error", err);
    throw err;
  });

// Sequelize instance: either from full connection string or individual params.
// Ensure dialectOptions contains the instanceName for SQLEXPRESS.
let sequelize;
if (process.env.DB_CONNECTION_STRING && process.env.DB_CONNECTION_STRING.trim().length > 0) {
  sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
    dialect: "mssql",
    dialectOptions: {
      options: {
        instanceName: instanceName || undefined,
        trustServerCertificate: true,
      },
    },
    logging: false,
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || mssqlConfig.database,
    process.env.DB_USER || mssqlConfig.user,
    process.env.DB_PASS || mssqlConfig.password,
    {
      host: process.env.DB_HOST || mssqlConfig.server,
      dialect: "mssql",
      dialectOptions: {
        options: {
          instanceName: instanceName || undefined,
          trustServerCertificate: true,
        },
      },
      logging: false,
    }
  );
}

export { sql, poolPromise, sequelize };
