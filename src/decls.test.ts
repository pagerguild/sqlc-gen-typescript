import { describe, expect, it } from "bun:test";
import {
  createPrinter,
  createSourceFile,
  EmitHint,
  NewLineKind,
  ScriptKind,
  ScriptTarget,
} from "typescript";

import { rowValuesDecl } from "./decls";
import { Driver as BunSqlDriver } from "./drivers/bun-sql";
import type { Column } from "./gen/plugin/codegen_pb";

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

describe("rowValuesDecl", () => {
  it("emits an exported tuple type", () => {
    const driver = new BunSqlDriver();
    const columns: Column[] = [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ name: "id", type: { name: "text" } } as unknown as Column),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ name: "created_at", type: { name: "timestamptz" } } as unknown as Column),
    ];

    const node = rowValuesDecl("ExampleRowValues", driver, columns);
    const output = print(node);

    expect(output).toContain("export type ExampleRowValues");
    expect(output).toContain("string | null");
    expect(output).toContain("Date | null");
  });
});
