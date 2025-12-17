import { SQL } from "bun";

import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "./db/query_sql";

// Simple test assertion helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Connecting to database...");
  const sql = new SQL(databaseUrl);

  try {
    // Test 1: List authors (should be empty initially)
    console.log("\n--- Test 1: List authors (empty) ---");
    const initialAuthors = await listAuthors(sql);
    assert(initialAuthors.length === 0, "Database should start empty");
    console.log("OK: Database is empty");

    // Test 2: Create an author
    console.log("\n--- Test 2: Create author ---");
    const author1 = await createAuthor(sql, {
      name: "Douglas Adams",
      bio: "Author of The Hitchhiker's Guide to the Galaxy",
    });
    assert(author1 !== null, "Author should be created");
    if (author1 === null) throw new Error("Author1 is null");
    assert(author1.name === "Douglas Adams", "Name should match");
    console.log("OK: Created author:", author1);

    // Test 3: Create another author
    console.log("\n--- Test 3: Create another author ---");
    const author2 = await createAuthor(sql, {
      name: "Terry Pratchett",
      bio: "Author of the Discworld series",
    });
    assert(author2 !== null, "Second author should be created");
    if (author2 === null) throw new Error("Author2 is null");
    console.log("OK: Created author:", author2);

    // Test 4: List authors (should have 2)
    console.log("\n--- Test 4: List authors (2 entries) ---");
    const allAuthors = await listAuthors(sql);
    assert(allAuthors.length === 2, "Should have 2 authors");
    console.log("OK: Found", allAuthors.length, "authors");

    // Test 5: Get author by ID
    console.log("\n--- Test 5: Get author by ID ---");
    const fetchedAuthor = await getAuthor(sql, { id: author1.id });
    assert(fetchedAuthor !== null, "Should find author by ID");
    if (fetchedAuthor === null) throw new Error("Fetched author is null");
    assert(fetchedAuthor.name === "Douglas Adams", "Name should match");
    console.log("OK: Fetched author:", fetchedAuthor);

    // Test 6: Get non-existent author
    console.log("\n--- Test 6: Get non-existent author ---");
    const nonExistent = await getAuthor(sql, { id: "99999" });
    assert(nonExistent === null, "Should return null for non-existent author");
    console.log("OK: Non-existent author returns null");

    // Test 7: Delete an author
    console.log("\n--- Test 7: Delete author ---");
    await deleteAuthor(sql, { id: author1.id });
    const afterDelete = await listAuthors(sql);
    assert(afterDelete.length === 1, "Should have 1 author after delete");
    console.log("OK: Deleted author, remaining:", afterDelete.length);

    // Test 8: Verify deleted author is gone
    console.log("\n--- Test 8: Verify deletion ---");
    const deletedAuthor = await getAuthor(sql, { id: author1.id });
    assert(deletedAuthor === null, "Deleted author should not be found");
    console.log("OK: Deleted author is gone");

    // Cleanup: Delete remaining author
    await deleteAuthor(sql, { id: author2.id });

    console.log("\n========================================");
    console.log("All tests passed successfully!");
    console.log("========================================\n");
  } finally {
    sql.close();
  }
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.error("\nTest failed:", e);
    process.exit(1);
  }
})();
