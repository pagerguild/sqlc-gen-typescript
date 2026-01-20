import { describe, expect, it } from "bun:test";
import {
  createPrinter,
  createSourceFile,
  EmitHint,
  NewLineKind,
  ScriptKind,
  ScriptTarget,
} from "typescript";

import { Driver as BunSqlDriver } from "./bun-sql";
import { Driver as PostgresDriver } from "./postgres";
import { rowValuesDecl } from "../decls";
import type { Column, Parameter } from "../gen/plugin/codegen_pb";

function print(node: unknown): string {
  const source = createSourceFile("file.ts", "", ScriptTarget.Latest, false, ScriptKind.TS);
  const printer = createPrinter({ newLine: NewLineKind.LineFeed });
  // @ts-expect-error printer expects a ts.Node
  return printer.printNode(EmitHint.Unspecified, node, source);
}

describe("bun-sql driver codegen", () => {
  it("casts values() result to RowValues tuple array for :many", () => {
    const driver = new BunSqlDriver();

    const params: Parameter[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { column: { name: "organization_id", type: { name: "int8" } } } as unknown as Parameter,
    ];

    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "id", type: { name: "int8" } } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "created_at", type: { name: "timestamptz" } } as unknown as Column,
    ];

    const node = driver.manyDecl(
      "listThings",
      "listThingsQuery",
      "ListThingsArgs",
      "ListThingsRow",
      params,
      columns,
    );

    const output = print(node);

    expect(output).toContain("values() as any[]");
    expect(output).toContain(".map((row: any[]) =>");
  });

  it("casts values() result to RowValues tuple array for :one", () => {
    const driver = new BunSqlDriver();

    const params: Parameter[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { column: { name: "id", type: { name: "int8" } } } as unknown as Parameter,
    ];

    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "id", type: { name: "int8" } } as unknown as Column,
    ];

    const node = driver.oneDecl(
      "getThing",
      "getThingQuery",
      "GetThingArgs",
      "GetThingRow",
      params,
      columns,
    );

    const output = print(node);
    expect(output).toContain("values() as any[]");
  });

  it("wraps bigint columns with Number() in :many", () => {
    const driver = new BunSqlDriver();

    const params: Parameter[] = [];

    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "id", type: { name: "bigint" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "name", type: { name: "text" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "nullable_id", type: { name: "int8" }, notNull: false } as unknown as Column,
    ];

    const node = driver.manyDecl(
      "listThings",
      "listThingsQuery",
      undefined,
      "ListThingsRow",
      params,
      columns,
    );

    const output = print(node);

    // Non-nullable bigint: Number(row[0])
    expect(output).toContain("id: Number(row[0])");
    // Regular text column: row[1] (no conversion)
    expect(output).toContain("name: row[1]");
    // Nullable bigint: row[2] === null ? null : Number(row[2])
    expect(output).toContain("nullableId: row[2] === null ? null : Number(row[2])");
  });

  it("wraps bigint columns with Number() in :one", () => {
    const driver = new BunSqlDriver();

    const params: Parameter[] = [];

    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "id", type: { name: "bigserial" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "parent_id", type: { name: "serial8" }, notNull: false } as unknown as Column,
    ];

    const node = driver.oneDecl(
      "getThing",
      "getThingQuery",
      undefined,
      "GetThingRow",
      params,
      columns,
    );

    const output = print(node);

    // Non-nullable bigserial: Number(row[0])
    expect(output).toContain("id: Number(row[0])");
    // Nullable serial8: row[1] === null ? null : Number(row[1])
    expect(output).toContain("parentId: row[1] === null ? null : Number(row[1])");
  });

  it("maps common Postgres alias types", () => {
    const driver = new BunSqlDriver();
    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "a", type: { name: "int" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "b", type: { name: "integer" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "c", type: { name: "bigint" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "d", type: { name: "double precision" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "e", type: { name: "smallint" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "f", type: { name: "real" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "g", type: { name: "timestamp with time zone" }, notNull: true } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {
        name: "h",
        type: { name: "timestamp without time zone" },
        notNull: true,
      } as unknown as Column,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      { name: "i", type: { name: "character varying" }, notNull: true } as unknown as Column,
    ];

    const node = rowValuesDecl("AliasRowValues", driver, columns);
    const output = print(node);

    expect(output).toContain("export type AliasRowValues");
    // bigint is now mapped to number (with runtime Number() conversion)
    expect(output).toMatch(
      /\[\s*number,\s*number,\s*number,\s*number,\s*number,\s*number,\s*Date,\s*Date,\s*string\s*\]/,
    );
  });

  it("generates correct import statement", () => {
    const driver = new BunSqlDriver();

    const preamble = driver.preamble([]);
    const output = print(preamble[0]);

    expect(output).toContain('import type { SQL } from "bun"');
  });
});

describe("postgres driver codegen", () => {
  it("generates correct import statement", () => {
    const driver = new PostgresDriver();

    const preamble = driver.preamble([]);
    const output = print(preamble[0]);

    expect(output).toContain('import type { Sql } from "postgres"');
  });

  it("generates simpler code that casts directly to Row type", () => {
    const postgresDriver = new PostgresDriver();

    const params: Parameter[] = [
      { column: { name: "id", type: { name: "int8" } } } as unknown as Parameter,
    ];

    const columns: Column[] = [
      { name: "id", type: { name: "int8" }, notNull: true } as unknown as Column,
      { name: "name", type: { name: "text" }, notNull: true } as unknown as Column,
    ];

    const output = print(
      postgresDriver.oneDecl(
        "getThing",
        "getThingQuery",
        "GetThingArgs",
        "GetThingRow",
        params,
        columns,
      ),
    );

    // postgres.js driver casts directly to Row[] without .values()
    expect(output).toContain("as GetThingRow[]");
    expect(output).not.toContain(".values()");
    expect(output).toContain("rows[0] ?? null");
  });
});
