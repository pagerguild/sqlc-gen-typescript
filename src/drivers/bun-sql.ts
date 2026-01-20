/**
 * Bun SQL driver for sqlc-gen-typescript
 *
 * Uses Bun's built-in SQL client: import type { SQL } from "bun"
 *
 * This driver delegates to the shared PostgresCommonDriver which handles
 * all the actual codegen. The only difference from the postgres.js driver
 * is the import statement.
 */

import { PostgresCommonDriver } from "./postgres-common";

export class Driver extends PostgresCommonDriver {
  constructor() {
    super({
      importModule: "bun",
      importType: "SQL",
      useTypeImport: true,
    });
  }
}
