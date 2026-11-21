
const { Client } = require("pg");

async function main() {
  const client = new Client({
    host: process.env.PGHOST || "finanzapp-db",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "finanzapp",
    user: process.env.PGUSER || "finanzapp_user",
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log("CONEXION_POSTGRESQL_OK");

    const database = await client.query(
      "SELECT current_database() AS nombre"
    );
    console.log(`BASE_DATOS: ${database.rows[0].nombre}`);

    await client.query("BEGIN");

    await client.query(`
      CREATE TEMP TABLE ci_connection_test (
        id INTEGER PRIMARY KEY,
        mensaje TEXT NOT NULL
      )
    `);

    await client.query(
      "INSERT INTO ci_connection_test (id, mensaje) VALUES ($1, $2)",
      [1, "FINANZAPP CI - conexion y SQL correctos"]
    );

    const result = await client.query(
      "SELECT mensaje FROM ci_connection_test WHERE id = $1",
      [1]
    );

    if (
      result.rows.length !== 1 ||
      result.rows[0].mensaje !==
        "FINANZAPP CI - conexion y SQL correctos"
    ) {
      throw new Error("La verificacion SQL no coincide");
    }

    console.log("ESCRITURA_SQL_OK");
    console.log(`LECTURA_SQL_OK: ${result.rows[0].mensaje}`);

    await client.query("ROLLBACK");
    console.log("PRUEBA_INTEGRACION_POSTGRESQL_EXITOSA");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error("ERROR_EN_PRUEBA_DE_INTEGRACION:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
