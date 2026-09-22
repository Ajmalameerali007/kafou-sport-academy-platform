/** Offline Mindbody migration planning only. No database client, credentials or execution path. */
import { createHash } from "node:crypto";
import { open, lstat, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { z } from "zod";

export const LIMITS = Object.freeze({
  fileBytes: 10 * 1024 * 1024,
  manifestBytes: 256 * 1024,
  totalBytes: 25 * 1024 * 1024,
  rowsPerFile: 25000,
  totalRows: 50000,
  fieldChars: 4000,
  reportBytes: 32 * 1024 * 1024,
});
const entities = [
  "families",
  "children",
  "memberships",
  "opening_balances",
  "payment_history",
] as const;
type Entity = (typeof entities)[number];
const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const identifier = (v: unknown) => identity.parse(v);
const plain = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => s === s.trim() && !/[\x00-\x1f]/.test(s));
function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
  );
}
const date = z.string().refine(validDate);
const timestamp = z
  .string()
  .refine(
    (s) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s) &&
      validDate(s.slice(0, 10)) &&
      !Number.isNaN(Date.parse(s)),
  );
const money = z.string().refine((s) => {
  try {
    parseMoney(s);
    return true;
  } catch {
    return false;
  }
});
const columns = z.record(z.string().min(1).max(100));
const minor = z
  .string()
  .regex(/^-?(0|[1-9]\d*)$/)
  .max(40);
const fileSchema = z
  .object({
    entity: z.enum(entities),
    path: z.string().min(1).max(200),
    format: z.enum(["csv", "json"]),
    columns,
    ignoredColumns: z.record(z.string().trim().min(10).max(500)),
    expectedRows: z.number().int().min(0).max(LIMITS.rowsPerFile),
    expectedMinor: minor.optional(),
  })
  .strict();
const targetMap = z
  .record(z.string().uuid())
  .refine((m) => Object.keys(m).length <= 1000);
const manifestSchema = z
  .object({
    version: z.literal(1),
    sourceSystem: z.literal("mindbody"),
    sourceAccountId: identity,
    datasetId: identity,
    snapshotId: identity,
    mappingVersion: identity,
    exportedAt: timestamp,
    currency: z.literal("AED"),
    cutoverDate: date,
    targetMappings: z
      .object({ branches: targetMap, packages: targetMap })
      .strict(),
    files: z.array(fileSchema).min(1).max(5),
  })
  .strict();
type Manifest = z.infer<typeof manifestSchema>;
const rowSchemas = {
  families: z
    .object({
      source_id: identity,
      name: plain,
      email: z.union([z.string().email().max(254), z.literal("")]).optional(),
      mobile: z.string().max(30).optional(),
    })
    .strict(),
  children: z
    .object({
      source_id: identity,
      family_source_id: identity,
      name: plain,
      dob: date,
    })
    .strict(),
  memberships: z
    .object({
      source_id: identity,
      child_source_id: identity,
      branch_source_id: identity,
      package_source_id: identity,
      starts_on: date,
      ends_on: date,
      remaining_sessions: z.string().regex(/^(0|[1-9]\d{0,5})$/),
      status: z.enum(["active", "expired", "cancelled"]),
    })
    .strict(),
  opening_balances: z
    .object({
      source_id: identity,
      family_source_id: identity,
      as_of: date,
      amount: money,
      currency: z.literal("AED"),
    })
    .strict(),
  payment_history: z
    .object({
      source_id: identity,
      family_source_id: identity,
      occurred_at: timestamp,
      amount: money,
      currency: z.literal("AED"),
      kind: z.enum(["payment", "refund"]),
      method: z.enum(["cash", "card", "bank_transfer", "other"]),
      reference: z.string().max(200).optional(),
    })
    .strict(),
};
const required: Record<Entity, string[]> = {
  families: ["source_id", "name"],
  children: ["source_id", "family_source_id", "name", "dob"],
  memberships: [
    "source_id",
    "child_source_id",
    "branch_source_id",
    "package_source_id",
    "starts_on",
    "ends_on",
    "remaining_sessions",
    "status",
  ],
  opening_balances: [
    "source_id",
    "family_source_id",
    "as_of",
    "amount",
    "currency",
  ],
  payment_history: [
    "source_id",
    "family_source_id",
    "occurred_at",
    "amount",
    "currency",
    "kind",
    "method",
  ],
};

export function parseMoney(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^-?(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) ||
    value.length > 24
  )
    throw new Error(
      "Money must be an exact decimal string with at most two decimal places.",
    );
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const result =
    (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))) *
    BigInt(negative ? -1 : 1);
  if (
    result > BigInt("9223372036854775807") ||
    result < -BigInt("9223372036854775807")
  )
    throw new Error("Money exceeds supported minor-unit range.");
  return result.toString();
}
function csvDocument(input: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const text = input.replace(/^\uFEFF/, "");
  if (Buffer.byteLength(text) > LIMITS.fileBytes)
    throw new Error("Source file limit exceeded.");
  const records: string[][] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  function cell() {
    if (field.length > LIMITS.fieldChars)
      throw new Error("CSV field limit exceeded.");
    cells.push(field);
    if (cells.length > 100) throw new Error("CSV column limit exceeded.");
    field = "";
    closed = false;
  }
  function row() {
    cell();
    records.push(cells);
    cells = [];
    if (records.length > LIMITS.rowsPerFile + 1)
      throw new Error("CSV row limit exceeded.");
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
    } else if (ch === '"') {
      if (field || closed) throw new Error("Malformed CSV quoting.");
      quoted = true;
    } else if (ch === ",") cell();
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row();
    } else {
      if (closed) throw new Error("Unexpected content after CSV quote.");
      field += ch;
    }
    if (field.length > LIMITS.fieldChars)
      throw new Error("CSV field limit exceeded.");
  }
  if (quoted) throw new Error("Unterminated CSV quote.");
  if (field || closed || cells.length) row();
  const headers = records.shift();
  if (
    !headers?.length ||
    headers.some(
      (h) => !h || h !== h.trim() || h.length > 100 || /[\x00-\x1f]/.test(h),
    ) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("Invalid or duplicate CSV headers.");
  return {
    headers,
    rows: records.map((values) => {
      if (values.length !== headers.length)
        throw new Error("CSV column count mismatch.");
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    }),
  };
}
export function parseCsv(input: string) {
  return csvDocument(input).rows;
}
function strictJson(input: string): unknown {
  const text = input.replace(/^\uFEFF/, "");
  const value: unknown = JSON.parse(text);
  let i = 0;
  function space() {
    while (/\s/.test(text[i] || "x")) i++;
  }
  function string() {
    const start = i++;
    while (i < text.length) {
      if (text[i] === "\\") {
        i += 2;
        continue;
      }
      if (text[i++] === '\"') break;
    }
    return text.slice(start, i);
  }
  function walk(depth: number) {
    if (depth > 20) throw new Error("JSON nesting limit exceeded.");
    space();
    if (text[i] === "{") {
      i++;
      space();
      const keys = new Set<string>();
      if (text[i] === "}") {
        i++;
        return;
      }
      while (true) {
        space();
        const key: string = JSON.parse(string());
        if (keys.has(key)) throw new Error("Duplicate JSON key.");
        keys.add(key);
        space();
        i++;
        walk(depth + 1);
        space();
        if (text[i++] === "}") break;
      }
    } else if (text[i] === "[") {
      i++;
      space();
      if (text[i] === "]") {
        i++;
        return;
      }
      while (true) {
        walk(depth + 1);
        space();
        if (text[i++] === "]") break;
      }
    } else if (text[i] === '\"') string();
    else {
      while (i < text.length && !/[\s,}\]]/.test(text[i])) i++;
    }
  }
  walk(0);
  return value;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function hash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
function targetId(scope: string[], entity: Entity, sourceId: string) {
  const h = hash([...scope, entity, sourceId]);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function boundedFile(path: string, max: number, label: string) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.size > max)
      throw new Error(
        `${label} file limit or regular-file requirement failed.`,
      );
    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(max + 1);
      let size = 0;
      while (size < buffer.length) {
        const result = await handle.read(
          buffer,
          size,
          buffer.length - size,
          null,
        );
        if (!result.bytesRead) break;
        size += result.bytesRead;
      }
      if (size > max) throw new Error(`${label} file limit exceeded.`);
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        buffer.subarray(0, size),
      );
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof Error && /file limit|regular-file/.test(error.message))
      throw error;
    throw new Error(`${label} file could not be read as bounded UTF-8.`);
  }
}
export interface Exception {
  code: string;
  entity?: Entity;
  row?: number;
  sourceId?: string;
  fields?: string[];
  message: string;
}
export interface PlannedRow {
  entity: Entity;
  sourceId: string;
  targetId: string;
  fingerprint: string;
  references: Record<string, string>;
  intent:
    | "reference_record"
    | "membership_snapshot_only"
    | "opening_balance_only"
    | "historical_reference_only";
}
interface Control {
  expectedRows: number;
  actualRows: number;
  validatedRows: number;
  expectedMinor?: string;
  actualMinor?: string;
  deltaMinor?: string;
}
export interface Plan {
  version: 1;
  tool: "kafou-mindbody-dry-run";
  sourceSystem: "mindbody";
  sourceAccountId: string;
  datasetId: string;
  snapshotId: string;
  mappingVersion: string;
  currency: "AED";
  cutoverDate: string;
  exportedAt: string;
  mappingFingerprint: string;
  sourceFiles: { entity: Entity; sha256: string; bytes: number }[];
  planId: string;
  reportHash: string;
  status: "blocked" | "validated_dry_run";
  readyForImport: false;
  rows: PlannedRow[];
  exceptions: Exception[];
  reconciliation: Partial<Record<Entity, Control>>;
  comparison: {
    comparedTo: string | null;
    added: number;
    unchanged: number;
    changed: number;
    removed: number;
  };
}
function validatePrevious(value: unknown): Plan {
  const p = value as Plan;
  if (
    !p ||
    typeof p !== "object" ||
    p.version !== 1 ||
    p.tool !== "kafou-mindbody-dry-run" ||
    p.readyForImport !== false ||
    !Array.isArray(p.rows) ||
    p.rows.length > LIMITS.totalRows ||
    typeof p.reportHash !== "string"
  )
    throw new Error("Invalid previous plan.");
  const { reportHash, ...body } = p;
  if (
    reportHash !== hash(body) ||
    !/^[a-f0-9]{64}$/.test(p.planId) ||
    !identity.safeParse(p.sourceAccountId).success ||
    !identity.safeParse(p.datasetId).success ||
    p.rows.some(
      (r) =>
        !entities.includes(r.entity) ||
        !identity.safeParse(r.sourceId).success ||
        !z.string().uuid().safeParse(r.targetId).success ||
        !/^[a-f0-9]{64}$/.test(r.fingerprint),
    )
  )
    throw new Error("Invalid previous plan integrity.");
  return p;
}
export async function readPlan(path: string) {
  try {
    return validatePrevious(
      strictJson(await boundedFile(path, LIMITS.reportBytes, "Previous plan")),
    );
  } catch {
    throw new Error("Invalid previous plan file.");
  }
}
async function buildPlanInternal(
  manifestPath: string,
  previous?: unknown,
  materialize?: (rows: ImportRow[]) => void,
): Promise<Plan> {
  let m: Manifest;
  try {
    m = manifestSchema.parse(
      strictJson(
        await boundedFile(manifestPath, LIMITS.manifestBytes, "Manifest"),
      ),
    );
  } catch {
    throw new Error(
      "Invalid manifest; explicit source identity, supported entities, mappings and controls are required.",
    );
  }
  const entitySet = new Set(m.files.map((f) => f.entity));
  if (
    entitySet.size !== m.files.length ||
    !entitySet.has("families") ||
    (entitySet.has("memberships") && !entitySet.has("children"))
  )
    throw new Error("Invalid manifest entity dependency or duplicate entity.");
  for (const f of m.files) {
    const allowed = Object.keys(rowSchemas[f.entity].shape);
    const mapped = Object.values(f.columns);
    if (
      required[f.entity].some((k) => !f.columns[k]) ||
      Object.keys(f.columns).some((k) => !allowed.includes(k)) ||
      new Set(mapped).size !== mapped.length ||
      Object.keys(f.ignoredColumns).some((k) => mapped.includes(k))
    )
      throw new Error(
        "Invalid column mapping; map required fields once and explain every ignored column.",
      );
    const financial = ["opening_balances", "payment_history"].includes(
      f.entity,
    );
    if (financial !== (f.expectedMinor !== undefined))
      throw new Error("Invalid manifest financial reconciliation control.");
  }
  const prior = previous === undefined ? undefined : validatePrevious(previous);
  if (
    prior &&
    (prior.sourceAccountId !== m.sourceAccountId ||
      prior.datasetId !== m.datasetId ||
      prior.sourceSystem !== m.sourceSystem ||
      prior.cutoverDate !== m.cutoverDate)
  )
    throw new Error("Previous plan source scope or cutover does not match.");
  const scope = [m.sourceSystem, m.sourceAccountId, m.datasetId];
  const mappingFingerprint = hash({
    mappingVersion: m.mappingVersion,
    targetMappings: m.targetMappings,
    files: m.files
      .map((f) => ({
        entity: f.entity,
        columns: f.columns,
        ignoredColumns: f.ignoredColumns,
      }))
      .sort((a, b) => compare(a.entity, b.entity)),
  });
  const exceptions: Exception[] = [];
  const rows: PlannedRow[] = [];
  const sourceFiles: Plan["sourceFiles"] = [];
  const reconciliation: Plan["reconciliation"] = {};
  const records = new Map<
    Entity,
    { row: number; value: Record<string, string>; planned: PlannedRow }[]
  >();
  const base = await realpath(dirname(resolve(manifestPath)));
  let bytes = 0;
  let count = 0;
  for (const f of m.files) {
    const path = resolve(base, f.path);
    if (
      !path.startsWith(base + sep) ||
      f.path.startsWith("/") ||
      f.path.split(/[\\/]/).includes("..")
    )
      throw new Error("Source path must remain within the manifest directory.");
    // Reject parent-directory symlinks too; boundedFile rejects a final symlink.
    let parent: string;
    try {
      parent = await realpath(dirname(path));
    } catch {
      throw new Error("Source file directory cannot be read.");
    }
    if (parent !== base && !parent.startsWith(base + sep))
      throw new Error("Source path resolves outside manifest directory.");
    const raw = await boundedFile(path, LIMITS.fileBytes, "Source");
    bytes += Buffer.byteLength(raw);
    if (bytes > LIMITS.totalBytes)
      throw new Error("Total source file limit exceeded.");
    sourceFiles.push({
      entity: f.entity,
      sha256: createHash("sha256").update(raw).digest("hex"),
      bytes: Buffer.byteLength(raw),
    });
    let input: unknown[];
    try {
      if (f.format === "csv") {
        const doc = csvDocument(raw);
        input = doc.rows;
        if (
          doc.headers.some(
            (k) =>
              !Object.values(f.columns).includes(k) &&
              !Object.hasOwn(f.ignoredColumns, k),
          )
        )
          exceptions.push({
            entity: f.entity,
            code: "unmapped_column",
            message:
              "CSV header contains columns without a mapping or explicit exclusion.",
          });
        if (Object.values(f.columns).some((k) => !doc.headers.includes(k)))
          exceptions.push({
            entity: f.entity,
            code: "missing_column",
            message: "CSV header is missing a mapped source column.",
          });
      } else {
        const parsed: unknown = strictJson(raw);
        if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
        input = parsed;
      }
    } catch {
      throw new Error(
        `Malformed ${f.entity} source; expected strict ${f.format.toUpperCase()} rows.`,
      );
    }
    if (
      input.length > LIMITS.rowsPerFile ||
      (count += input.length) > LIMITS.totalRows
    )
      throw new Error("Source row limit exceeded.");
    const control: Control = {
      expectedRows: f.expectedRows,
      actualRows: input.length,
      validatedRows: 0,
      ...(f.expectedMinor !== undefined
        ? { expectedMinor: f.expectedMinor, actualMinor: "0", deltaMinor: "0" }
        : {}),
    };
    reconciliation[f.entity] = control;
    if (input.length !== f.expectedRows)
      exceptions.push({
        entity: f.entity,
        code: "row_count_mismatch",
        message: "Source row count differs from its independent control.",
      });
    const seen = new Set<string>();
    const normalized: {
      row: number;
      value: Record<string, string>;
      planned: PlannedRow;
    }[] = [];
    let total = BigInt(0);
    for (const [index, source] of input.entries()) {
      const location = { entity: f.entity, row: index + 1 };
      if (
        !source ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        Object.entries(source).some(
          ([k, v]) =>
            k.length > 100 ||
            typeof v !== "string" ||
            v.length > LIMITS.fieldChars,
        )
      ) {
        exceptions.push({
          ...location,
          code: "invalid_row",
          message:
            "Source row must contain bounded string fields; numeric IDs and money are not accepted.",
        });
        continue;
      }
      const src = source as Record<string, string>;
      const unexpected = Object.keys(src).filter(
        (k) =>
          !Object.values(f.columns).includes(k) &&
          !Object.hasOwn(f.ignoredColumns, k),
      );
      if (unexpected.length)
        exceptions.push({
          ...location,
          code: "unmapped_column",
          message:
            "Source row contains columns without a mapping or an explicit exclusion.",
        });
      const mapped = Object.fromEntries(
        Object.entries(f.columns).map(([target, key]) => [
          target,
          Object.hasOwn(src, key) ? src[key] : undefined,
        ]),
      );
      const parsed = rowSchemas[f.entity].safeParse(mapped);
      if (!parsed.success) {
        exceptions.push({
          ...location,
          code: "invalid_row",
          fields: [
            ...new Set(parsed.error.issues.map((i) => String(i.path[0]))),
          ],
          message: "Mapped row violates the normalized contract.",
        });
        continue;
      }
      const value = parsed.data as Record<string, string>;
      const sourceId = identifier(value.source_id);
      if (seen.has(sourceId))
        exceptions.push({
          ...location,
          sourceId,
          code: "duplicate_source_id",
          message:
            "Repeated source ID; no row was silently merged or selected.",
        });
      seen.add(sourceId);
      if (f.entity === "children" && value.dob >= m.cutoverDate)
        exceptions.push({
          ...location,
          sourceId,
          code: "invalid_row",
          message: "Birth date must precede cutover.",
        });
      if (f.entity === "memberships" && value.ends_on < value.starts_on)
        exceptions.push({
          ...location,
          sourceId,
          code: "invalid_row",
          message: "Membership end precedes start.",
        });
      if (
        f.entity === "opening_balances" &&
        value.as_of !==
          new Date(Date.parse(`${m.cutoverDate}T00:00:00Z`) - 86400000)
            .toISOString()
            .slice(0, 10)
      )
        exceptions.push({
          ...location,
          sourceId,
          code: "invalid_row",
          message:
            "Opening snapshot must be dated at the close of the day immediately before cutover.",
        });
      if (
        f.entity === "payment_history" &&
        value.occurred_at.slice(0, 10) >= m.cutoverDate
      )
        exceptions.push({
          ...location,
          sourceId,
          code: "invalid_row",
          message: "Historical payment must precede cutover.",
        });
      if (value.amount !== undefined) {
        const amount = BigInt(parseMoney(value.amount));
        if (amount > BigInt(1000000000) || amount < BigInt(-1000000000))
          exceptions.push({
            ...location,
            sourceId,
            code: "target_money_limit",
            message:
              "Source amount exceeds current commercial command limit; no rounding or splitting is inferred.",
          });
        if (f.entity === "payment_history" && amount <= BigInt(0))
          exceptions.push({
            ...location,
            sourceId,
            code: "invalid_row",
            message:
              "Payment/refund magnitude must be positive; kind supplies the sign.",
          });
        total += value.kind === "refund" ? -amount : amount;
      }
      const planned: PlannedRow = {
        entity: f.entity,
        sourceId,
        targetId: targetId(scope, f.entity, sourceId),
        fingerprint: hash(value),
        references: {},
        intent:
          f.entity === "opening_balances"
            ? "opening_balance_only"
            : f.entity === "payment_history"
              ? "historical_reference_only"
              : f.entity === "memberships"
                ? "membership_snapshot_only"
                : "reference_record",
      };
      rows.push(planned);
      normalized.push({ row: index + 1, value, planned });
      control.validatedRows++;
    }
    records.set(f.entity, normalized);
    if (f.expectedMinor !== undefined) {
      control.actualMinor = total.toString();
      control.deltaMinor = (total - BigInt(f.expectedMinor)).toString();
      if (control.deltaMinor !== "0")
        exceptions.push({
          entity: f.entity,
          code: "money_total_mismatch",
          message:
            "Exact signed minor-unit total differs from its independent source control.",
        });
    }
  }
  const referenceIndex = new Map<Entity, Map<string, PlannedRow[]>>();
  for (const [entity, group] of records) {
    const index = new Map<string, PlannedRow[]>();
    for (const record of group) {
      const matches = index.get(record.value.source_id) || [];
      matches.push(record.planned);
      index.set(record.value.source_id, matches);
    }
    referenceIndex.set(entity, index);
  }
  for (const [entity, group] of records) {
    for (const record of group) {
      const { value, planned, row } = record;
      const location = { entity, row, sourceId: planned.sourceId };
      for (const [field, target, key] of [
        ["family_source_id", "families", "family"],
        ["child_source_id", "children", "child"],
      ] as const) {
        if (!value[field]) continue;
        const matches = referenceIndex.get(target)?.get(value[field]) || [];
        if (matches.length !== 1)
          exceptions.push({
            ...location,
            code: "missing_reference",
            message: `Reference must resolve to exactly one ${target} source row.`,
          });
        else planned.references[key] = matches[0].targetId;
      }
      for (const [field, mapping, key] of [
        ["branch_source_id", "branches", "branch"],
        ["package_source_id", "packages", "package"],
      ] as const) {
        if (!value[field]) continue;
        const map = m.targetMappings[mapping];
        if (!Object.hasOwn(map, value[field]))
          exceptions.push({
            ...location,
            code: "unmapped_target",
            message: `An explicit reviewed ${mapping} target mapping is required.`,
          });
        else planned.references[key] = map[value[field]];
      }
    }
  }
  const contacts = new Set<string>();
  for (const { value, row } of records.get("families") || []) {
    const keys = [
      value.email ? `email:${value.email.toLowerCase()}` : "",
      value.mobile ? `mobile:${value.mobile.replace(/[ ()-]/g, "")}` : "",
    ].filter(Boolean);
    if (keys.some((k) => contacts.has(k)))
      exceptions.push({
        entity: "families",
        row,
        sourceId: value.source_id,
        code: "possible_duplicate_contact",
        message:
          "Shared contact requires source-owner review; identity is never merged or claimed from contact details.",
      });
    keys.forEach((k) => contacts.add(k));
  }
  const opening = new Set<string>();
  for (const { value, row } of records.get("opening_balances") || []) {
    const key = `${value.family_source_id}:${value.currency}`;
    if (opening.has(key))
      exceptions.push({
        entity: "opening_balances",
        row,
        sourceId: value.source_id,
        code: "duplicate_opening_balance",
        message:
          "Only one opening snapshot per family and currency is allowed.",
      });
    opening.add(key);
  }
  rows.sort((a, b) =>
    compare(`${a.entity}:${a.sourceId}`, `${b.entity}:${b.sourceId}`),
  );
  sourceFiles.sort((a, b) => compare(a.entity, b.entity));
  const comparison: Plan["comparison"] = {
    comparedTo: prior?.planId || null,
    added: 0,
    unchanged: 0,
    changed: 0,
    removed: 0,
  };
  if (prior && prior.mappingFingerprint !== mappingFingerprint)
    exceptions.push({
      code: "mapping_changed",
      message:
        "Mapping changed since previous plan; independently review before starting a new planning baseline.",
    });
  const oldRows = new Map(
    (prior?.rows || []).map((r) => [`${r.entity}:${r.sourceId}`, r]),
  );
  for (const row of rows) {
    const key = `${row.entity}:${row.sourceId}`;
    const old = oldRows.get(key);
    if (!old) comparison.added++;
    else if (
      old.fingerprint === row.fingerprint &&
      old.targetId === row.targetId &&
      canonical(old.references) === canonical(row.references)
    )
      comparison.unchanged++;
    else {
      comparison.changed++;
      exceptions.push({
        entity: row.entity,
        sourceId: row.sourceId,
        code: "source_changed",
        message:
          "Source row or reference changed since previous dry run; no overwrite is planned.",
      });
    }
    oldRows.delete(key);
  }
  for (const old of oldRows.values()) {
    comparison.removed++;
    exceptions.push({
      entity: old.entity,
      sourceId: old.sourceId,
      code: "source_removed",
      message:
        "Previously planned row is absent; no deletion or reversal is inferred.",
    });
  }
  const basis = {
    version: 1 as const,
    tool: "kafou-mindbody-dry-run" as const,
    sourceSystem: m.sourceSystem,
    sourceAccountId: m.sourceAccountId,
    datasetId: m.datasetId,
    snapshotId: m.snapshotId,
    mappingVersion: m.mappingVersion,
    currency: m.currency,
    cutoverDate: m.cutoverDate,
    exportedAt: m.exportedAt,
    mappingFingerprint,
    sourceFiles,
    rows,
    reconciliation,
  };
  const body = {
    ...basis,
    planId: hash(basis),
    status: exceptions.length
      ? ("blocked" as const)
      : ("validated_dry_run" as const),
    readyForImport: false as const,
    exceptions,
    comparison,
  };
  if (!exceptions.length && materialize)
    materialize(
      [...records.values()]
        .flat()
        .map((r) => ({ ...r.planned, value: r.value })),
    );
  return { ...body, reportHash: hash(body) };
}

export interface ImportRow extends PlannedRow {
  value: Record<string, string>;
}
export async function buildPlan(
  manifestPath: string,
  previous?: unknown,
): Promise<Plan> {
  return buildPlanInternal(manifestPath, previous);
}
/** Values are materialized from the same bounded, validated reads and never enter
 * the redacted planner report. No second read or changed-file race is possible. */
export async function buildImportBatch(manifestPath: string) {
  let rows: ImportRow[] = [];
  const plan = await buildPlanInternal(manifestPath, undefined, (r) => {
    rows = r;
  });
  if (plan.status !== "validated_dry_run")
    throw new Error(
      "Import blocked: resolve every planner exception and retain reviewed mapping evidence.",
    );
  return { plan, rows };
}
