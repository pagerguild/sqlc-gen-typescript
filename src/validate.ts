const NAMED_PARAMS_DOCS_URL = "https://docs.sqlc.dev/en/latest/howto/named_parameters.html";

export function assertUniqueNames(options: {
  kind: "argument" | "column";
  queryName: string;
  fileName: string;
  names: string[];
}) {
  const counts = new Map<string, number>();
  for (const name of options.names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();

  if (duplicates.length === 0) {
    return;
  }

  const duplicateList = duplicates.map((d) => `- ${d}`).join("\n");

  throw new Error(
    [
      `sqlc-gen-typescript: ambiguous ${options.kind} names for query '${options.queryName}' (${options.fileName})`,
      "",
      "The TypeScript generator produced duplicate identifier(s):",
      duplicateList,
      "",
      "Disambiguate using named parameters (sqlc.arg/sqlc.narg) or explicit column aliases.",
      `Docs: ${NAMED_PARAMS_DOCS_URL}`,
    ].join("\n"),
  );
}
