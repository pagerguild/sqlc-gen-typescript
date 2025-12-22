import { describe, expect, it } from "bun:test";

import { assertUniqueNames } from "./validate";

describe("assertUniqueNames", () => {
  it("throws with helpful message on duplicate argument names", () => {
    expect(() =>
      assertUniqueNames({
        kind: "argument",
        queryName: "GetJobRunStats",
        fileName: "scheduled_job_runs.sql",
        names: ["startedAt", "startedAt"],
      })
    ).toThrow(/sqlc\.arg|named parameters/i);
  });

  it("does not throw when names are unique", () => {
    expect(() =>
      assertUniqueNames({
        kind: "column",
        queryName: "ListUsers",
        fileName: "users.sql",
        names: ["id", "createdAt"],
      })
    ).not.toThrow();
  });

  it("throws with helpful message on duplicate column names", () => {
    expect(() =>
      assertUniqueNames({
        kind: "column",
        queryName: "ListJobRuns",
        fileName: "job_runs.sql",
        names: ["startedAt", "startedAt"],
      })
    ).toThrow(/sqlc\.arg|sqlc\.narg|column aliases|named parameters/i);
  });
});
