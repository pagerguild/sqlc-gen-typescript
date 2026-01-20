/**
 * postgres.js driver for sqlc-gen-typescript
 *
 * Uses the postgres npm package (porsager/postgres).
 * Unlike Bun.SQL which uses .values() to return tuples, postgres.js returns
 * objects with column names as keys. We cast the result directly to the Row type.
 */

import { SyntaxKind, NodeFlags, TypeNode, factory, FunctionDeclaration } from "typescript";

import { Parameter, Column } from "../gen/plugin/codegen_pb";
import { argName } from "./utlis";

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

export class Driver {
  columnType(column?: Column): TypeNode {
    if (column === undefined || column.type === undefined) {
      return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }
    let typeName = column.type.name;
    const pgCatalog = "pg_catalog.";
    if (typeName.startsWith(pgCatalog)) {
      typeName = typeName.slice(pgCatalog.length);
    }

    typeName = typeName.toLowerCase();

    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
    switch (typeName) {
      case "aclitem":
        break;
      case "bigserial":
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      case "bit":
        break;
      case "bool":
      case "boolean":
        typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
        break;
      case "box":
      case "bpchar":
        break;
      case "bytea":
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Buffer"), undefined);
        break;
      case "cid":
      case "cidr":
      case "circle":
        break;
      case "date":
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      case "float4":
      case "real":
      case "float8":
      case "float":
      case "double precision":
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      case "inet":
        break;
      case "int2":
      case "smallint":
      case "int4":
      case "int":
      case "integer":
      case "int8":
      case "bigint":
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      case "interval":
        break;
      case "json":
      case "jsonb":
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
      case "numeric":
      case "decimal":
      case "line":
      case "lseg":
      case "madaddr":
      case "madaddr8":
      case "money":
        break;
      case "oid":
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      case "path":
      case "pg_node_tree":
      case "pg_snapshot":
      case "point":
      case "polygon":
      case "regproc":
      case "regrole":
        break;
      case "serial":
      case "serial2":
      case "serial4":
      case "serial8":
      case "smallserial":
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      case "tid":
      case "text":
      case "character varying":
      case "character":
      case "time":
      case "timetz":
        break;
      case "timestamp":
      case "timestamp without time zone":
      case "timestamptz":
      case "timestamp with time zone":
        typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
        break;
      case "tsquery":
      case "tsvector":
      case "txid_snapshot":
      case "uuid":
      case "varbit":
      case "varchar":
      case "xid":
      case "xml":
        break;
      default:
        typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        break;
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
    // Import Sql and alias to SQL for consistency with bun-sql generated code
    return [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          true, // type-only import
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              factory.createIdentifier("Sql"),
              factory.createIdentifier("SQL"),
            ),
          ]),
        ),
        factory.createStringLiteral("postgres"),
        undefined,
      ),
    ];
  }

  execDecl(funcName: string, queryName: string, argIface: string | undefined, params: Parameter[]) {
    const funcParams = funcParamsDecl(argIface, params);

    // Generate: await sql.unsafe(query, [args...])
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
    _columns: Column[],
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    // Generate: return await sql.unsafe(query, [args...]) as ReturnRow[]
    // postgres.js returns objects with column names, so we cast directly
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
            factory.createAsExpression(
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
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode(factory.createIdentifier(returnIface), undefined),
              ),
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
    _columns: Column[],
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    // Generate:
    //   const rows = await sql.unsafe(query, [args...]) as ReturnRow[]
    //   if (rows.length !== 1) return null
    //   return rows[0] ?? null
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
          // const rows = await sql.unsafe(...) as ReturnRow[]
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
                    factory.createArrayTypeNode(
                      factory.createTypeReferenceNode(
                        factory.createIdentifier(returnIface),
                        undefined,
                      ),
                    ),
                  ),
                ),
              ],
              NodeFlags.Const,
            ),
          ),
          // if (rows.length !== 1) return null
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
          // return rows[0] ?? null
          factory.createReturnStatement(
            factory.createBinaryExpression(
              factory.createElementAccessExpression(
                factory.createIdentifier("rows"),
                factory.createNumericLiteral("0"),
              ),
              factory.createToken(SyntaxKind.QuestionQuestionToken),
              factory.createNull(),
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
    throw new Error("postgres driver does not support :execlastid");
  }
}
