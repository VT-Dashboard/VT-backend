import sql from "mssql";
import dotenv from "dotenv";  

dotenv.config();

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  server: process.env.SQL_SERVER, // localhost
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: "SQLEXPRESS"   // <- important!
  }
};

export const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✔ Connected to MSSQL using SQL Authentication");
    return pool;
  })
  .catch(err => {
    console.log("DB Connection Failed!", err);
  });

export { sql };
