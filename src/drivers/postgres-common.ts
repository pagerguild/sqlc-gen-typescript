/**
 * Shared PostgreSQL driver implementation for both Bun SQL and postgres.js
 *
 * Both drivers use the same API pattern:
 *   sql.unsafe(query, params).values()
 *
 * The only differences are:
 *   - Import statement
 *   - Type name (SQL vs Sql)
 *
 * This base class handles all the codegen; subclasses just configure the preamble.
 */

import { SyntaxKind, NodeFlags, TypeNode, factory, FunctionDeclaration } from "typescript";

import { Parameter, Column } from "../gen/plugin/codegen_pb";
import { argName, colName } from "./utlis";

// PostgreSQL types that Bun SQL returns as strings but we want as numbers.
// These are 64-bit integers which Bun returns as strings to avoid precision loss,
// but for typical use cases (auto-incrementing IDs), converting to JS number is safe.
const BIGINT_TYPES = new Set(["int8", "bigint", "bigserial", "serial8"]);

function isBigIntType(column?: Column): boolean {
  if (!column?.type?.name) return false;
  let typeName = column.type.name;
  const pgCatalog = "pg_catalog.";
  if (typeName.startsWith(pgCatalog)) {
    typeName = typeName.slice(pgCatalog.length);
  }
  return BIGINT_TYPES.has(typeName.toLowerCase());
}

// Creates an expression to access row[i], with Number() conversion for bigint types.
// For nullable bigint columns: row[i] === null ? null : Number(row[i])
// For non-nullable bigint columns: Number(row[i])
// For other columns: row[i]
function createRowAccessExpression(col: Column, index: number) {
  const rowAccess = factory.createElementAccessExpression(
    factory.createIdentifier("row"),
    factory.createNumericLiteral(`${index}`),
  );

  if (!isBigIntType(col)) {
    return rowAccess;
  }

  const numberCall = factory.createCallExpression(factory.createIdentifier("Number"), undefined, [
    rowAccess,
  ]);

  if (col.notNull) {
    return numberCall;
  }

  // row[i] === null ? null : Number(row[i])
  return factory.createConditionalExpression(
    factory.createBinaryExpression(
      rowAccess,
      factory.createToken(SyntaxKind.EqualsEqualsEqualsToken),
      factory.createNull(),
    ),
    factory.createToken(SyntaxKind.QuestionToken),
    factory.createNull(),
    factory.createToken(SyntaxKind.ColonToken),
    numberCall,
  );
}

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  let funcParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("sql"),
      undefined,
      factory.createTypeReferenceNode(factory.createIdentifier("SQL"), undefined),
      undefined,
    ),
  ];

  if (iface && params.length > 0) {
    funcParams.push(
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("args"),
        undefined,
        factory.createTypeReferenceNode(factory.createIdentifier(iface), undefined),
        undefined,
      ),
    );
  }

  return funcParams;
}

export interface PostgresDriverConfig {
  /** The module to import from (e.g., "bun" or "postgres") */
  importModule: string;
  /** The type name exported by the module (e.g., "SQL" or "Sql") */
  importType: string;
  /** Whether to use `import type` (recommended for better tree-shaking) */
  useTypeImport: boolean;
}

export class PostgresCommonDriver {
  private config: PostgresDriverConfig;

  constructor(config: PostgresDriverConfig) {
    this.config = config;
  }

  columnType(column?: Column): TypeNode {
    if (column === undefined || column.type === undefined) {
      return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }
    // Some of the type names have the `pg_catalog.` prefix. Remove this.
    let typeName = column.type.name;
    const pgCatalog = "pg_catalog.";
    if (typeName.startsWith(pgCatalog)) {
      typeName = typeName.slice(pgCatalog.length);
    }

    typeName = typeName.toLowerCase();

    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
    switch (typeName) {
      case "aclitem": {
        // string
        break;
      }
      case "bigserial": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "bit": {
        // string
        break;
      }
      case "bool": {
        typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
        break;
      }
      case "boolean": {
        typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
        break;
      }
      case "box": {
        // string
        break;
      }
      case "bpchar": {
        // string
        break;
      }
      case "bytea": {
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Buffer"), undefined);
        break;
      }
      case "cid": {
        // string
        break;
      }
      case "cidr": {
        // string
        break;
      }
      case "circle": {
        // string
        break;
      }
      case "date": {
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      }
      case "float4": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "real": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "float8": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "float": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "double precision": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "inet": {
        // string
        break;
      }
      case "int2": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "smallint": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "int4": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "int": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "integer": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "int8": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "bigint": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "interval": {
        // string
        break;
      }
      case "json": {
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
      }
      case "jsonb": {
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
      }
      case "numeric": {
        // string
        break;
      }
      case "decimal": {
        // string
        break;
      }
      case "line": {
        // string
        break;
      }
      case "lseg": {
        // string
        break;
      }
      case "madaddr": {
        // string
        break;
      }
      case "madaddr8": {
        // string
        break;
      }
      case "money": {
        // string
        break;
      }
      case "oid": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "path": {
        // string
        break;
      }
      case "pg_node_tree": {
        // string
        break;
      }
      case "pg_snapshot": {
        // string
        break;
      }
      case "point": {
        // string
        break;
      }
      case "polygon": {
        // string
        break;
      }
      case "regproc": {
        // string
        break;
      }
      case "regrole": {
        // string
        break;
      }
      case "serial": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "serial2": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "serial4": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "serial8": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "smallserial": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "tid": {
        // string
        break;
      }
      case "text": {
        // string
        break;
      }
      case "character varying": {
        // string
        break;
      }
      case "character": {
        // string
        break;
      }
      case "time": {
        // string
        break;
      }
      case "timetz": {
        // string
        break;
      }
      case "timestamp": {
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      }
      case "timestamp without time zone": {
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      }
      case "timestamptz": {
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      }
      case "timestamp with time zone": {
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      }
      case "tsquery": {
        // string
        break;
      }
      case "tsvector": {
        // string
        break;
      }
      case "txid_snapshot": {
        // string
        break;
      }
      case "uuid": {
        // string
        break;
      }
      case "varbit": {
        // string
        break;
      }
      case "varchar": {
        // string
        break;
      }
      case "xid": {
        // string
        break;
      }
      case "xml": {
        // string
        break;
      }
      default: {
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
      }
    }
    if (column.isArray || column.arrayDims > 0) {
      let dims = Math.max(column.arrayDims || 1);
      for (let i = 0; i < dims; i++) {
        typ = factory.createArrayTypeNode(typ);
      }
    }
    if (column.notNull) {
      return typ;
    }
    return factory.createUnionTypeNode([typ, factory.createLiteralTypeNode(factory.createNull())]);
  }

  preamble(_queries: unknown) {
    const { importModule, importType, useTypeImport } = this.config;

    // If the import type differs from "SQL", we alias it: import { Sql as SQL }
    const needsAlias = importType !== "SQL";

    const importSpecifier = needsAlias
      ? factory.createImportSpecifier(
          false,
          factory.createIdentifier(importType),
          factory.createIdentifier("SQL"),
        )
      : factory.createImportSpecifier(false, undefined, factory.createIdentifier("SQL"));

    return [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          useTypeImport,
          undefined,
          factory.createNamedImports([importSpecifier]),
        ),
        factory.createStringLiteral(importModule),
        undefined,
      ),
    ];
  }

  execDecl(funcName: string, queryName: string, argIface: string | undefined, params: Parameter[]) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword), factory.createToken(SyntaxKind.AsyncKeyword)],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      ]),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createAwaitExpression(
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("sql"),
                  factory.createIdentifier("unsafe"),
                ),
                undefined,
                [
                  factory.createIdentifier(queryName),
                  factory.createArrayLiteralExpression(
                    params.map((param, i) =>
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("args"),
                        factory.createIdentifier(argName(i, param.column)),
                      ),
                    ),
                    false,
                  ),
                ],
              ),
            ),
          ),
        ],
        true,
      ),
    );
  }

  manyDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[],
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword), factory.createToken(SyntaxKind.AsyncKeyword)],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createArrayTypeNode(
          factory.createTypeReferenceNode(factory.createIdentifier(returnIface), undefined),
        ),
      ]),
      factory.createBlock(
        [
          factory.createReturnStatement(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createParenthesizedExpression(
                  factory.createAsExpression(
                    factory.createAwaitExpression(
                      factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                          factory.createCallExpression(
                            factory.createPropertyAccessExpression(
                              factory.createIdentifier("sql"),
                              factory.createIdentifier("unsafe"),
                            ),
                            undefined,
                            [
                              factory.createIdentifier(queryName),
                              factory.createArrayLiteralExpression(
                                params.map((param, i) =>
                                  factory.createPropertyAccessExpression(
                                    factory.createIdentifier("args"),
                                    factory.createIdentifier(argName(i, param.column)),
                                  ),
                                ),
                                false,
                              ),
                            ],
                          ),
                          factory.createIdentifier("values"),
                        ),
                        undefined,
                        undefined,
                      ),
                    ),
                    factory.createArrayTypeNode(
                      factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
                    ),
                  ),
                ),
                factory.createIdentifier("map"),
              ),
              undefined,
              [
                factory.createArrowFunction(
                  undefined,
                  undefined,
                  [
                    factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      "row",
                      undefined,
                      factory.createArrayTypeNode(
                        factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
                      ),
                      undefined,
                    ),
                  ],
                  undefined,
                  factory.createToken(SyntaxKind.EqualsGreaterThanToken),
                  factory.createObjectLiteralExpression(
                    columns.map((col, i) =>
                      factory.createPropertyAssignment(
                        factory.createIdentifier(colName(i, col)),
                        createRowAccessExpression(col, i),
                      ),
                    ),
                    true,
                  ),
                ),
              ],
            ),
          ),
        ],
        true,
      ),
    );
  }

  oneDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[],
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword), factory.createToken(SyntaxKind.AsyncKeyword)],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createUnionTypeNode([
          factory.createTypeReferenceNode(factory.createIdentifier(returnIface), undefined),
          factory.createLiteralTypeNode(factory.createNull()),
        ]),
      ]),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("rows"),
                  undefined,
                  undefined,
                  factory.createAsExpression(
                    factory.createAwaitExpression(
                      factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                          factory.createCallExpression(
                            factory.createPropertyAccessExpression(
                              factory.createIdentifier("sql"),
                              factory.createIdentifier("unsafe"),
                            ),
                            undefined,
                            [
                              factory.createIdentifier(queryName),
                              factory.createArrayLiteralExpression(
                                params.map((param, i) =>
                                  factory.createPropertyAccessExpression(
                                    factory.createIdentifier("args"),
                                    factory.createIdentifier(argName(i, param.column)),
                                  ),
                                ),
                                false,
                              ),
                            ],
                          ),
                          factory.createIdentifier("values"),
                        ),
                        undefined,
                        undefined,
                      ),
                    ),
                    factory.createArrayTypeNode(
                      factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
                    ),
                  ),
                ),
              ],
              NodeFlags.Const |
                // ts.NodeFlags.Constant |
                NodeFlags.AwaitContext |
                // ts.NodeFlags.Constant |
                NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags,
            ),
          ),
          factory.createIfStatement(
            factory.createBinaryExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("rows"),
                factory.createIdentifier("length"),
              ),
              factory.createToken(SyntaxKind.ExclamationEqualsEqualsToken),
              factory.createNumericLiteral("1"),
            ),
            factory.createBlock([factory.createReturnStatement(factory.createNull())], true),
            undefined,
          ),
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  "row",
                  undefined,
                  undefined,
                  factory.createElementAccessExpression(
                    factory.createIdentifier("rows"),
                    factory.createNumericLiteral("0"),
                  ),
                ),
              ],
              NodeFlags.Const,
            ),
          ),
          factory.createIfStatement(
            factory.createPrefixUnaryExpression(
              SyntaxKind.ExclamationToken,
              factory.createIdentifier("row"),
            ),
            factory.createBlock([factory.createReturnStatement(factory.createNull())], true),
            undefined,
          ),
          factory.createReturnStatement(
            factory.createObjectLiteralExpression(
              columns.map((col, i) =>
                factory.createPropertyAssignment(
                  factory.createIdentifier(colName(i, col)),
                  createRowAccessExpression(col, i),
                ),
              ),
              true,
            ),
          ),
        ],
        true,
      ),
    );
  }

  execlastidDecl(
    _funcName: string,
    _queryName: string,
    _argIface: string | undefined,
    _params: Parameter[],
  ): FunctionDeclaration {
    throw new Error("PostgreSQL drivers do not support :execlastid");
  }
}
