/**
 * postgres.js driver for sqlc-gen-typescript
 *
 * Uses the postgres npm package (porsager/postgres): import type { Sql as SQL } from "postgres"
 *
 * This driver delegates to the shared PostgresCommonDriver which handles
 * all the actual codegen. The only difference from the bun-sql driver
 * is the import statement.
 *
 * By aliasing `Sql as SQL`, the generated function signatures are identical
 * to the bun-sql driver, minimizing churn when switching between drivers.
 */

import { PostgresCommonDriver } from "./postgres-common";

export class Driver extends PostgresCommonDriver {
  constructor() {
    super({
      importModule: "postgres",
      importType: "Sql",
      useTypeImport: true,
    });
  }
}
