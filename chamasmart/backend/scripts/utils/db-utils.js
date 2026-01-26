/**
 * Centralized Database Utilities
 * Eliminates code duplication across scripts
 */

require("dotenv").config();
const { Pool } = require("pg");
const logger = require("../utils/logger");

class DatabaseUtils {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });
  }

  /**
   * Execute query with error handling
   */
  async query(sql, params = []) {
    try {
      return await this.pool.query(sql, params);
    } catch (error) {
      logger.error("Query execution failed", { error: error.message, sql });
      throw error;
    }
  }

  /**
   * Execute transaction safely
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Transaction failed", { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName) {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )`,
      [tableName],
    );
    return result.rows[0].exists;
  }

  /**
   * Check if column exists
   */
  async columnExists(tableName, columnName) {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      )`,
      [tableName, columnName],
    );
    return result.rows[0].exists;
  }

  /**
   * Get table columns
   */
  async getTableColumns(tableName) {
    const result = await this.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns 
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    );
    return result.rows;
  }

  /**
   * Safe delete from table
   */
  async safeDelete(tableName) {
    try {
      const exists = await this.tableExists(tableName);
      if (!exists) {
        logger.warn(`Table ${tableName} does not exist, skipping`);
        return 0;
      }

      const result = await this.query(`DELETE FROM ${tableName}`);
      logger.info(`Deleted ${result.rowCount} rows from ${tableName}`);
      return result.rowCount;
    } catch (error) {
      logger.error(`Could not delete from ${tableName}`, {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Reset sequence
   */
  async resetSequence(sequenceName, startValue = 1) {
    try {
      await this.query(
        `ALTER SEQUENCE ${sequenceName} RESTART WITH ${startValue}`,
      );
      logger.info(`Sequence ${sequenceName} reset to ${startValue}`);
      return true;
    } catch (error) {
      logger.warn(`Could not reset sequence ${sequenceName}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Create index safely
   */
  async createIndexSafely(indexSQL, indexName) {
    try {
      await this.query(indexSQL);
      logger.info(`✅ ${indexName} created`);
      return true;
    } catch (error) {
      if (error.code === "42703") {
        logger.warn(`⚠️  ${indexName} - column doesn't exist, skipping`);
      } else if (error.code === "42P07") {
        logger.info(`ℹ️  ${indexName} - already exists`);
      } else {
        throw error;
      }
      return false;
    }
  }

  /**
   * Add column if not exists
   */
  async addColumnIfNotExists(tableName, columnName, columnDefinition) {
    const exists = await this.columnExists(tableName, columnName);
    if (exists) {
      logger.info(`Column ${tableName}.${columnName} already exists`);
      return false;
    }

    await this.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
    );
    logger.info(`Added column ${tableName}.${columnName}`);
    return true;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const stats = {};
    const tables = [
      "users",
      "chamas",
      "chama_members",
      "contributions",
      "loans",
      "meetings",
      "notifications",
      "join_requests",
    ];

    for (const table of tables) {
      try {
        const exists = await this.tableExists(table);
        if (exists) {
          const result = await this.query(
            `SELECT COUNT(*) as count FROM ${table}`,
          );
          stats[table] = parseInt(result.rows[0].count);
        } else {
          stats[table] = "N/A";
        }
      } catch (error) {
        stats[table] = "Error";
      }
    }

    return stats;
  }

  /**
   * Close connection pool
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = DatabaseUtils;
