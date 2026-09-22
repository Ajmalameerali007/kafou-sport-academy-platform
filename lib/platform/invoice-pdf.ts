import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFHexString,
  StandardFonts,
  beginText,
  endText,
  rgb,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  showText,
} from "pdf-lib";

export interface InvoiceDocument {
  reference: string;
  issued_at: string;
  as_of: string;
  currency: "AED";
  family_name: string;
  branch_name: string;
  lines: {
    description: string;
    description_ar: string;
    quantity: number;
    unit_minor: number;
  }[];
  allocations: { reference: string; amount_minor: number }[];
  adjustments: { kind: "discount" | "writeoff" | "reversal"; amount_minor: number; reason: string }[];
}

const labels = {
  en: {
    title: "Invoice statement",
    demo: "DEMO / NOT A TAX DOCUMENT",
    family: "Family",
    branch: "Branch",
    issued: "Issued",
    description: "Description",
    quantity: "Qty",
    unit: "Unit price",
    lineTotal: "Line total",
    subtotal: "Subtotal",
    adjustments: "Adjustments",
    allocated: "Payments allocated",
    outstanding: "Outstanding balance",
    snapshot: "Accounting snapshot as of",
    paymentHistory: "Payment allocations and adjustments",
    noHistory: "No payment allocations or adjustments recorded.",
    discount: "Discount",
    writeoff: "Write-off",
    reversal: "Adjustment reversal",
    note: "Operational invoice statement generated from KAFOU demo records. It is not a tax invoice and does not prove payment-provider settlement.",
    dateNote: "All dates and times are in Dubai (UTC+4).",
  },
  ar: {
    title: "بيان فاتورة",
    demo: "عرض تجريبي / ليست وثيقة ضريبية",
    family: "العائلة",
    branch: "الفرع",
    issued: "تاريخ الإصدار",
    description: "البيان",
    quantity: "الكمية",
    unit: "سعر الوحدة",
    lineTotal: "إجمالي البند",
    subtotal: "المجموع الفرعي",
    adjustments: "التعديلات",
    allocated: "الدفعات المخصصة",
    outstanding: "الرصيد المستحق",
    snapshot: "البيانات المحاسبية حتى",
    paymentHistory: "تخصيصات الدفعات والتعديلات",
    noHistory: "لا توجد دفعات مخصصة أو تعديلات مسجلة.",
    discount: "خصم",
    writeoff: "شطب",
    reversal: "عكس التعديل",
    note: "بيان فاتورة تشغيلي مولد من سجلات كفو التجريبية. ليس فاتورة ضريبية ولا يثبت تسوية من مزود الدفع.",
    dateNote: "جميع التواريخ والأوقات بتوقيت دبي (UTC+4).",
  },
} as const;

function money(value: number) {
  const absolute = Math.abs(value);
  return `${value < 0 ? "-" : ""}AED ${Math.floor(absolute / 100).toLocaleString("en-US")}.${String(absolute % 100).padStart(2, "0")}`;
}

function dubai(value: string) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(date.getTime()))
    throw Error("Invoice date is invalid.");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function minor(value: number, signed = false) {
  if (!Number.isSafeInteger(value) || (!signed && value < 0) || Math.abs(value) > 1_000_000_000)
    throw Error("Invoice amounts must use valid integer minor units.");
}

function field(value: string, name: string, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error(`Invoice ${name} is invalid.`);
}

/** Reconcile the complete authorized invoice snapshot before rendering. */
export function invoiceSummary(invoice: InvoiceDocument) {
  field(invoice.reference, "reference", 150);
  field(invoice.family_name, "family", 200);
  field(invoice.branch_name, "branch", 200);
  dubai(invoice.issued_at);
  dubai(invoice.as_of);
  if (invoice.currency !== "AED" || new Date(invoice.as_of) < new Date(invoice.issued_at))
    throw Error("Invoice snapshot is inconsistent.");
  if (!invoice.lines.length || invoice.lines.length > 1000)
    throw Error("Invoice lines are incomplete.");
  const subtotal_minor = invoice.lines.reduce((sum, line) => {
    field(line.description, "line description");
    if (line.description_ar.length > 500 || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100)
      throw Error("Invoice line is invalid.");
    minor(line.unit_minor);
    const total = line.quantity * line.unit_minor;
    if (!Number.isSafeInteger(total)) throw Error("Invoice line total is invalid.");
    return sum + total;
  }, 0);
  const allocated_minor = invoice.allocations.reduce((sum, row) => {
    field(row.reference, "payment reference", 150);
    minor(row.amount_minor, true);
    return sum + row.amount_minor;
  }, 0);
  const adjusted_minor = invoice.adjustments.reduce((sum, row) => {
    if (!["discount", "writeoff", "reversal"].includes(row.kind)) throw Error("Invoice adjustment is invalid.");
    field(row.reason, "adjustment reason");
    minor(row.amount_minor, true);
    if ((row.kind === "reversal") !== (row.amount_minor < 0)) throw Error("Invoice adjustment sign is invalid.");
    return sum + row.amount_minor;
  }, 0);
  const outstanding_minor = subtotal_minor - allocated_minor - adjusted_minor;
  if (![subtotal_minor, allocated_minor, adjusted_minor, outstanding_minor].every(Number.isSafeInteger) || outstanding_minor < 0)
    throw Error("Invoice accounting does not reconcile.");
  return { subtotal_minor, allocated_minor, adjusted_minor, outstanding_minor };
}

/** The caller must load every row through current RLS and verify invoice scope. */
export async function invoicePdf(
  invoice: InvoiceDocument,
  arabicFontBytes?: Uint8Array,
  locale: "en" | "ar" = "en",
): Promise<Uint8Array> {
  const summary = invoiceSummary(invoice);
  const l = labels[locale];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${locale === "ar" ? "بيان فاتورة كفو" : "KAFOU invoice statement"} ${invoice.reference}`);
  doc.setSubject("Operational invoice statement; not a tax invoice or provider settlement proof.");
  doc.setAuthor("KAFOU Sport Academy");
  doc.setProducer("KAFOU");
  doc.setCreationDate(new Date(invoice.issued_at));
  doc.setModificationDate(new Date(invoice.as_of));
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arabic = arabicFontBytes ? fontkit.create(arabicFontBytes) : null;
  const arabicPdf = arabicFontBytes ? await doc.embedFont(arabicFontBytes, { subset: true }) : null;
  const ink = rgb(0.04, 0.16, 0.2), teal = rgb(0, 0.44, 0.42), muted = rgb(0.34, 0.4, 0.43), warning = rgb(0.72, 0.28, 0.08);
  let page = doc.addPage([595, 842]);
  let arabicKey = arabicPdf ? page.node.newFontDictionary("Arabic", arabicPdf.ref) : null;
  let y = 650;
  function text(value: string, atY: number, size = 10, options: { bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; right?: boolean } = {}) {
    value = value.replace(/[\r\n\t]+/g, " ");
    const x0 = options.x ?? 48, width = options.width ?? 499, color = options.color ?? ink;
    const rtl = /\p{Script=Arabic}/u.test(value);
    if (!rtl) {
      const font = options.bold ? bold : latin;
      const actual = Math.min(size, (size * width) / Math.max(1, font.widthOfTextAtSize(value, size)));
      page.drawText(value, { x: options.right ? x0 + width - font.widthOfTextAtSize(value, actual) : x0, y: atY, size: actual, font, color });
      return;
    }
    if (!arabic || !arabicPdf || !arabicKey) throw Error("Arabic font bytes are required for this invoice.");
    const runs = (value.match(/[\u0660-\u0669\u06F0-\u06F9]+|(?:(?![\u0660-\u0669\u06F0-\u06F9])[\p{Script=Arabic}\p{Mark}\s])+|[^\p{Script=Arabic}\p{Mark}\s]+/gu) ?? []).reverse().map((part) => ({ text: part, numeric: /^[\u0660-\u0669\u06F0-\u06F9]+$/.test(part), shape: /\p{Script=Arabic}/u.test(part) ? arabic.layout(part) : null }));
    if (runs.some((run) => run.shape?.glyphs.some((g) => g.id === 0))) throw Error("Invoice font does not support this text.");
    const natural = runs.reduce((sum, run) => sum + (run.shape ? (run.shape.positions.reduce((n, p) => n + p.xAdvance, 0) / arabic.unitsPerEm) * size : latin.widthOfTextAtSize(run.text, size)), 0);
    const actual = Math.min(size, (size * width) / Math.max(1, natural));
    let x = x0 + width - (natural * actual) / size;
    for (const run of runs) {
      if (!run.shape) { page.drawText(run.text, { x, y: atY, size: actual, font: latin, color }); x += latin.widthOfTextAtSize(run.text, actual); continue; }
      const encoded = run.numeric ? [...run.text].map((char) => arabicPdf.encodeText(char).asString()).join("") : arabicPdf.encodeText(run.text).asString();
      const positions = run.numeric ? [...run.text].flatMap((char) => arabic.layout(char).positions) : run.shape.positions;
      const scale = actual / arabic.unitsPerEm;
      positions.forEach((position, index) => {
        page.pushOperators(beginText(), setFillingColor(color), setFontAndSize(arabicKey!, actual), setTextMatrix(1, 0, 0, 1, x + position.xOffset * scale, atY + position.yOffset * scale), showText(PDFHexString.of(encoded.slice(index * 4, index * 4 + 4))), endText());
        x += position.xAdvance * scale;
      });
    }
  }
  function header() {
    page.drawRectangle({ x: 0, y: 754, width: 595, height: 88, color: ink });
    text("KAFOU SPORT ACADEMY", 795, 20, { bold: true, color: rgb(1, 1, 1) });
    text(l.title, 720, 25, { bold: true });
    text(invoice.reference, 699, 10, { color: muted, right: locale === "ar" });
    text(l.demo, 674, 10, { bold: true, color: warning, right: locale === "ar" });
    page.drawLine({ start: { x: 48, y: 662 }, end: { x: 547, y: 662 }, color: teal, thickness: 2 });
  }
  function footer() {
    page.drawLine({ start: { x: 48, y: 76 }, end: { x: 547, y: 76 }, color: rgb(0.8, 0.85, 0.85) });
    text(l.note, 59, 7.5, { color: muted });
    text(l.dateNote, 44, 7.5, { color: muted, width: 420 });
    text(String(doc.getPageCount()), 44, 8, { right: true, color: muted });
  }
  function room(height: number) {
    if (y - height >= 98) return;
    footer();
    page = doc.addPage([595, 842]);
    arabicKey = arabicPdf ? page.node.newFontDictionary("Arabic", arabicPdf.ref) : null;
    header();
    y = 632;
  }
  function pair(label: string, value: string) {
    room(34);
    text(label, y, 8.5, {
      color: muted,
      x: locale === "ar" ? 397 : 48,
      width: 150,
      right: locale === "ar",
    });
    text(value, y, 10.5, {
      x: locale === "ar" ? 48 : 205,
      width: 342,
      right: locale === "ar",
    });
    y -= 28;
  }
  function total(label: string, value: number, strong = false) {
    room(24);
    text(label, y, 10.5, {
      bold: strong,
      x: locale === "ar" ? 242 : 240,
      width: locale === "ar" ? 305 : 170,
      right: locale === "ar",
    });
    text(money(value), y, strong ? 13 : 11, {
      bold: strong,
      x: locale === "ar" ? 48 : 410,
      width: locale === "ar" ? 181 : 137,
      right: locale !== "ar",
      color: strong ? teal : ink,
    });
    y -= strong ? 30 : 22;
  }
  header();
  pair(l.family, invoice.family_name);
  pair(l.branch, invoice.branch_name);
  pair(l.issued, dubai(invoice.issued_at));
  y -= 6;
  room(32);
  text(l.description, y, 8.5, { bold: true, color: muted, x: locale === "ar" ? 277 : 48, width: 270, right: locale === "ar" });
  text(l.quantity, y, 8.5, { bold: true, color: muted, x: locale === "ar" ? 223 : 330, width: 42, right: true });
  text(l.unit, y, 8.5, { bold: true, color: muted, x: locale === "ar" ? 141 : 382, width: 72, right: true });
  text(l.lineTotal, y, 8.5, { bold: true, color: muted, x: locale === "ar" ? 48 : 462, width: 85, right: true });
  y -= 18;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, color: rgb(0.78, 0.84, 0.84) });
  y -= 18;
  for (const line of invoice.lines) {
    room(28);
    text(locale === "ar" && line.description_ar ? line.description_ar : line.description, y, 10, { x: locale === "ar" ? 277 : 48, width: 270, right: locale === "ar" });
    text(String(line.quantity), y, 10, { x: locale === "ar" ? 223 : 330, width: 42, right: true });
    text(money(line.unit_minor), y, 10, { x: locale === "ar" ? 141 : 382, width: 72, right: true });
    text(money(line.quantity * line.unit_minor), y, 10, { x: locale === "ar" ? 48 : 462, width: 85, right: true });
    y -= 26;
  }
  y -= 6;
  total(l.subtotal, summary.subtotal_minor);
  total(l.adjustments, summary.adjusted_minor);
  total(l.allocated, summary.allocated_minor);
  total(l.outstanding, summary.outstanding_minor, true);
  pair(l.snapshot, dubai(invoice.as_of));
  y -= 4;
  room(34);
  text(l.paymentHistory, y, 14, { bold: true });
  y -= 25;
  if (!invoice.allocations.length && !invoice.adjustments.length) {
    text(l.noHistory, y, 10);
    y -= 22;
  }
  for (const allocation of invoice.allocations) {
    room(23);
    text(allocation.reference, y, 10, { x: locale === "ar" ? 217 : 48, width: 330, right: locale === "ar" });
    text(money(allocation.amount_minor), y, 10, { x: locale === "ar" ? 48 : 390, width: 157, right: locale !== "ar" });
    y -= 22;
  }
  for (const adjustment of invoice.adjustments) {
    room(23);
    text(`${l[adjustment.kind]} · ${adjustment.reason}`, y, 9.5, { x: locale === "ar" ? 217 : 48, width: 330, right: locale === "ar" });
    text(money(adjustment.amount_minor), y, 10, { x: locale === "ar" ? 48 : 390, width: 157, right: locale !== "ar" });
    y -= 22;
  }
  footer();
  return doc.save({ useObjectStreams: false });
}
