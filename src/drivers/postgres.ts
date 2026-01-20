/**
 * postgres.js driver for sqlc-gen-typescript
 *
 * Generates code using tagged template literals for the postgres npm package.
 * Assumes the connection is configured with:
 *   - transform: postgres.camel (for snake_case -> camelCase)
 *   - types.bigint.parse for bigint -> number conversion
 */

import { SyntaxKind, NodeFlags, TypeNode, factory, FunctionDeclaration } from "typescript";

import { Parameter, Column } from "../gen/plugin/codegen_pb";
import { argName } from "./utils";

export function columnType(column?: Column): TypeNode {
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
    case "bool":
    case "boolean":
      typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
      break;
    case "bytea":
      typ = factory.createTypeReferenceNode(factory.createIdentifier("Buffer"), undefined);
      break;
    case "date":
    case "timestamp":
    case "timestamp without time zone":
    case "timestamptz":
    case "timestamp with time zone":
      typ = factory.createTypeReferenceNode(factory.createIdentifier("Date"), undefined);
      break;
    case "float4":
    case "real":
    case "float8":
    case "float":
    case "double precision":
    case "int2":
    case "smallint":
    case "int4":
    case "int":
    case "integer":
    case "int8":
    case "bigint":
    case "bigserial":
    case "serial":
    case "serial2":
    case "serial4":
    case "serial8":
    case "smallserial":
    case "oid":
      typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
      break;
    case "json":
    case "jsonb":
      typ = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
      break;
    // All other types default to string (uuid, text, varchar, etc.)
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

export function preamble() {
  return [
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        true, // type-only import
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(false, undefined, factory.createIdentifier("Sql")),
        ]),
      ),
      factory.createStringLiteral("postgres"),
      undefined,
    ),
  ];
}

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  let funcParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("sql"),
      undefined,
      factory.createTypeReferenceNode(factory.createIdentifier("Sql"), undefined),
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

/**
 * Builds a tagged template literal from SQL text and parameters.
 *
 * Takes SQL like "SELECT * FROM foo WHERE id = $1 AND name = $2"
 * and params [{column: {name: "id"}}, {column: {name: "name"}}]
 * and produces: sql`SELECT * FROM foo WHERE id = ${args.id} AND name = ${args.name}`
 */
function buildTaggedTemplate(queryText: string, params: Parameter[]) {
  // Parse the SQL to find $1, $2, etc. and split into parts
  const parts: string[] = [];
  const expressions: ReturnType<typeof factory.createPropertyAccessExpression>[] = [];

  // Regex to match $1, $2, etc.
  const paramRegex = /\$(\d+)/g;
  let lastIndex = 0;

  for (const match of queryText.matchAll(paramRegex)) {
    // Add the text before this parameter
    parts.push(queryText.slice(lastIndex, match.index));

    // Get the parameter index (1-based in SQL, 0-based in array)
    const paramIndex = parseInt(match[1], 10) - 1;
    const param = params[paramIndex];

    if (param) {
      expressions.push(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("args"),
          factory.createIdentifier(argName(paramIndex, param.column)),
        ),
      );
    } else {
      // Fallback if param not found (shouldn't happen)
      expressions.push(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("args"),
          factory.createIdentifier(`arg${paramIndex}`),
        ),
      );
    }

    lastIndex = (match.index ?? 0) + match[0].length;
  }

  // Add any remaining text after the last parameter
  parts.push(queryText.slice(lastIndex));

  // Build the tagged template
  // sql`part0${expr0}part1${expr1}part2`
  const head = factory.createTemplateHead(parts[0], parts[0]);
  const spans = expressions.map((expr, i) => {
    const isLast = i === expressions.length - 1;
    const text = parts[i + 1];
    const literal = isLast
      ? factory.createTemplateTail(text, text)
      : factory.createTemplateMiddle(text, text);
    return factory.createTemplateSpan(expr, literal);
  });

  // If no parameters, use a no-substitution template
  if (expressions.length === 0) {
    return factory.createTaggedTemplateExpression(
      factory.createIdentifier("sql"),
      undefined,
      factory.createNoSubstitutionTemplateLiteral(queryText, queryText),
    );
  }

  return factory.createTaggedTemplateExpression(
    factory.createIdentifier("sql"),
    undefined,
    factory.createTemplateExpression(head, spans),
  );
}

export function execDecl(
  funcName: string,
  queryText: string,
  argIface: string | undefined,
  params: Parameter[],
) {
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
      [factory.createExpressionStatement(factory.createAwaitExpression(buildTaggedTemplate(queryText, params)))],
      true,
    ),
  );
}

export function manyDecl(
  funcName: string,
  queryText: string,
  argIface: string | undefined,
  returnIface: string,
  params: Parameter[],
  _columns: Column[],
) {
  const funcParams = funcParamsDecl(argIface, params);

  // Generate: return await sql<ReturnRow[]>`SELECT ...`
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
          factory.createAwaitExpression(
            addTypeArgument(buildTaggedTemplate(queryText, params), returnIface, true),
          ),
        ),
      ],
      true,
    ),
  );
}

export function oneDecl(
  funcName: string,
  queryText: string,
  argIface: string | undefined,
  returnIface: string,
  params: Parameter[],
  _columns: Column[],
) {
  const funcParams = funcParamsDecl(argIface, params);

  // Generate:
  //   const rows = await sql<ReturnRow[]>`SELECT ...`
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
        // const rows = await sql<ReturnRow[]>`...`
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier("rows"),
                undefined,
                undefined,
                factory.createAwaitExpression(
                  addTypeArgument(buildTaggedTemplate(queryText, params), returnIface, true),
                ),
              ),
            ],
            NodeFlags.Const,
          ),
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

/**
 * Add a type argument to a tagged template expression.
 * Transforms: sql`...` into sql<Type[]>`...`
 */
function addTypeArgument(
  taggedTemplate: ReturnType<typeof factory.createTaggedTemplateExpression>,
  typeName: string,
  isArray: boolean,
) {
  let typeArg: TypeNode = factory.createTypeReferenceNode(
    factory.createIdentifier(typeName),
    undefined,
  );
  if (isArray) {
    typeArg = factory.createArrayTypeNode(typeArg);
  }

  return factory.createTaggedTemplateExpression(
    taggedTemplate.tag,
    [typeArg],
    taggedTemplate.template,
  );
}

export function execlastidDecl(
  _funcName: string,
  _queryText: string,
  _argIface: string | undefined,
  _params: Parameter[],
): FunctionDeclaration {
  throw new Error("postgres driver does not support :execlastid");
}
