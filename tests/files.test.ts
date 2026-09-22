import test from "node:test";
import assert from "node:assert/strict";
import {
  fileUploadSchema,
  filesSchema,
  validateFileBytes,
} from "../lib/platform/files";
const id = "10000000-0000-4000-8000-000000000001";
const upload = {
  family_id: id,
  name: "شهادة تدريب.pdf",
  mime_type: "application/pdf",
  content: btoa("%PDF-1.7\n%%EOF"),
  key: id,
};
test("private upload accepts bounded supported types and Arabic filenames", () => {
  assert.equal(fileUploadSchema.safeParse(upload).success, true);
  assert.equal(
    validateFileBytes(
      new TextEncoder().encode("%PDF-1.7\n%%EOF"),
      "application/pdf",
    ),
    true,
  );
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    ),
    (x) => x.charCodeAt(0),
  );
  assert.equal(validateFileBytes(png, "image/png"), true);
  assert.equal(validateFileBytes(png, "image/jpeg"), false);
  assert.equal(
    validateFileBytes(
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      ),
      "image/png",
    ),
    false,
  );
  assert.equal(validateFileBytes(png, "image/svg+xml"), false);
});
test("byte checks enforce decoded size and reject empty or mismatched signatures", () => {
  const limit = new Uint8Array(524288);
  limit.set(new TextEncoder().encode("%PDF-1.7"));
  assert.equal(validateFileBytes(limit, "application/pdf"), true);
  const over = new Uint8Array(524289);
  over.set(limit);
  assert.equal(validateFileBytes(over, "application/pdf"), false);
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array([255, 216, 255]),
    new TextEncoder().encode("%PDX-"),
  ])
    assert.equal(validateFileBytes(bytes, "application/pdf"), false);
  assert.equal(
    validateFileBytes(new TextEncoder().encode("%PDF-1.7"), "image/jpeg"),
    false,
  );
});
test("upload schema rejects path, control characters, unsupported MIME and malformed base64", () => {
  for (const name of [
    "../file.pdf",
    "a/b.pdf",
    "a\\b.pdf",
    "bad\nname.pdf",
    "bad\u0000name.pdf",
    "",
  ])
    assert.equal(
      fileUploadSchema.safeParse({ ...upload, name }).success,
      false,
      name,
    );
  for (const content of [
    "",
    "A",
    "AAAA=",
    "AA=A",
    "data:application/pdf;base64,JVBERi0=",
    "A".repeat(700001),
  ])
    assert.equal(
      fileUploadSchema.safeParse({ ...upload, content }).success,
      false,
      `invalid content length ${content.length}`,
    );
  assert.equal(
    fileUploadSchema.safeParse({ ...upload, mime_type: "image/svg+xml" })
      .success,
    false,
  );
  assert.equal(
    fileUploadSchema.safeParse({ ...upload, family_id: "other-family" })
      .success,
    false,
  );
});
test("public product schema permits withdrawal only with a real file identifier", () => {
  assert.equal(
    filesSchema.safeParse({ action: "files.withdraw", data: { id } }).success,
    true,
  );
  assert.equal(
    filesSchema.safeParse({
      action: "files.withdraw",
      data: { id: "../../storage" },
    }).success,
    false,
  );
  for (const action of ["files.begin", "files.finish", "files.download"])
    assert.equal(
      filesSchema.safeParse({ action, data: { id } }).success,
      false,
    );
});
