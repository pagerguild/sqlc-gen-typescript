import { SyntaxKind, TypeNode, factory } from "typescript";

import type { Column } from "./gen/plugin/codegen_pb";

export interface ColumnTyper {
  columnType: (c?: Column) => TypeNode;
}

export function rowValuesDecl(name: string, driver: ColumnTyper, columns: Column[]) {
  return factory.createTypeAliasDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(name),
    undefined,
    factory.createTupleTypeNode(columns.map((c) => driver.columnType(c)))
  );
}

export function arrayOfTypeRef(name: string) {
  return factory.createArrayTypeNode(
    factory.createTypeReferenceNode(factory.createIdentifier(name), undefined)
  );
}
