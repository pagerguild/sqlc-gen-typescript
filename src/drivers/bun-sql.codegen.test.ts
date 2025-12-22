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
import type { Column, Parameter } from "../gen/plugin/codegen_pb";

function print(node: unknown): string {
  const source = createSourceFile(
    "file.ts",
    "",
    ScriptTarget.Latest,
    false,
    ScriptKind.TS
  );
  const printer = createPrinter({ newLine: NewLineKind.LineFeed });
  // @ts-expect-error printer expects a ts.Node
  return printer.printNode(EmitHint.Unspecified, node, source);
}

describe("bun-sql driver codegen", () => {
  it("casts values() result to RowValues tuple array for :many", () => {
    const driver = new BunSqlDriver();

    const params: Parameter[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ column: { name: "organization_id", type: { name: "int8" } } } as unknown as Parameter),
    ];

    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ name: "id", type: { name: "int8" } } as unknown as Column),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ name: "created_at", type: { name: "timestamptz" } } as unknown as Column),
    ];

    const node = driver.manyDecl(
      "listThings",
      "listThingsQuery",
      "ListThingsArgs",
      "ListThingsRow",
      params,
      columns
    );

    const output = print(node);

    expect(output).toContain("as ListThingsRowValues[]");
    expect(output).toContain(".map(row =>");
  });

  it("casts values() result to RowValues tuple array for :one", () => {
    const driver = new BunSqlDriver();

    const params: Parameter[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ column: { name: "id", type: { name: "int8" } } } as unknown as Parameter),
    ];

    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ name: "id", type: { name: "int8" } } as unknown as Column),
    ];

    const node = driver.oneDecl(
      "getThing",
      "getThingQuery",
      "GetThingArgs",
      "GetThingRow",
      params,
      columns
    );

    const output = print(node);
    expect(output).toContain("as GetThingRowValues[]");
  });
});
