import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeWorkspaceRecords,
  recordContext,
  recordAccessLost,
  clearRecordUrl,
} from "../lib/platform/search-context";
test("targeted hydration replaces changed records without duplicates or mutating source", () => {
  const initial = {
    children: [
      { id: "a", name: "Before" },
      { id: "b", name: "Sibling" },
    ],
    pagination: [{ offset: 0 }],
  };
  const merged = mergeWorkspaceRecords(initial, {
    children: [
      { id: "a", name: "After" },
      { id: "c", name: "New" },
    ],
    pagination: [{ offset: 200 }],
  });
  assert.deepEqual(merged.children, [
    { id: "a", name: "After" },
    { id: "b", name: "Sibling" },
    { id: "c", name: "New" },
  ]);
  assert.deepEqual(merged.pagination, [{ offset: 200 }]);
  assert.equal(initial.children[0].name, "Before");
});
test("search deep links accept only supported kinds and record identifiers", () => {
  const id = "3fcdd32d-6747-4199-93f9-320be6895da4";
  assert.deepEqual(
    recordContext(new URLSearchParams({ record: id, recordKind: "child" })),
    { id, kind: "child", offset: 0 },
  );
  assert.equal(
    recordContext(new URLSearchParams({ record: id, recordKind: "finance" })),
    null,
  );
  assert.equal(
    recordContext(
      new URLSearchParams({ record: "<script>", recordKind: "child" }),
    ),
    null,
  );
  assert.equal(recordContext(new URLSearchParams()), null);
});

test("only lost authorization discards a selected deep-link target", () => {
  assert.equal(recordAccessLost("unavailable"), false);
  assert.equal(recordAccessLost("validation"), false);
  for (const code of ["unauthenticated", "forbidden", "not_found"])
    assert.equal(recordAccessLost(code), true);
});
test("clearing selected record preserves the section and child context", () => {
  const cleared = clearRecordUrl(
    "http://localhost:3100/parent?view=Family&record=abc&recordKind=child&child=child-id",
  );
  assert.equal(cleared.searchParams.get("record"), null);
  assert.equal(cleared.searchParams.get("recordKind"), null);
  assert.equal(cleared.searchParams.get("view"), "Family");
  assert.equal(cleared.searchParams.get("child"), "child-id");
});
