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

export interface ReceiptDocument {
  reference: string;
  issued_at: string;
  payment: {
    amount_minor: number;
    currency: "AED";
    method: "cash" | "bank_transfer" | "external_terminal";
    reference: string;
    recorded_at: string;
  };
  /** Current net allocations, grouped by an authorized invoice. */
  allocations: { invoice_reference: string; amount_minor: number }[];
  refunded_minor: number;
  as_of: string;
}
const labels = {
  en: {
    title: "Payment receipt",
    recorded: "Payment recorded",
    issued: "Receipt issued",
    method: "Payment method",
    reference: "Payment reference",
    received: "Amount recorded",
    summary: "Current payment summary",
    allocated: "Allocated to invoices",
    refunded: "Refunds recorded",
    unallocated: "Unallocated balance",
    allocations: "Invoice allocations",
    none: "No invoice allocations recorded.",
    snapshot: "Summary as of",
    dateNote: "All dates and times are in Dubai (UTC+4).",
    note: "Offline payment acknowledgment. Not a tax invoice or provider settlement confirmation.",
    cash: "Cash",
    bank_transfer: "Bank transfer",
    external_terminal: "External payment terminal",
  },
  ar: {
    title: "إيصال دفع",
    recorded: "تاريخ تسجيل الدفعة",
    issued: "تاريخ إصدار الإيصال",
    method: "طريقة الدفع",
    reference: "مرجع الدفعة",
    received: "المبلغ المسجل",
    summary: "ملخص الدفعة الحالي",
    allocated: "المخصص للفواتير",
    refunded: "المبالغ المستردة المسجلة",
    unallocated: "الرصيد غير المخصص",
    allocations: "تخصيصات الفواتير",
    none: "لم تسجل تخصيصات للفواتير.",
    snapshot: "الملخص حتى",
    dateNote: "جميع التواريخ والأوقات بتوقيت دبي (UTC+4).",
    note: "إقرار بدفعة مسجلة يدوياً. ليس فاتورة ضريبية أو تأكيد تسوية من مزود الدفع.",
    cash: "نقداً",
    bank_transfer: "تحويل بنكي",
    external_terminal: "جهاز دفع خارجي",
  },
};
function amount(value: number) {
  return `AED ${Math.floor(value / 100).toLocaleString("en-US")}.${String(value % 100).padStart(2, "0")}`;
}
function dubai(value: string) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(date.getTime()))
    throw Error("Receipt date is invalid.");
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
function minor(value: number, positive = false) {
  if (
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0) ||
    value > 1_000_000_000
  )
    throw Error("Receipt amount must use valid integer minor units.");
}
function reference(value: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 150)
    throw Error("Receipt reference is invalid.");
}
/** Fail closed if an API supplies incomplete or inconsistent accounting. */
export function receiptSummary(receipt: ReceiptDocument) {
  minor(receipt.payment.amount_minor, true);
  minor(receipt.refunded_minor);
  if (
    receipt.payment.currency !== "AED" ||
    !["cash", "bank_transfer", "external_terminal"].includes(
      receipt.payment.method,
    )
  )
    throw Error("Receipt must describe an offline AED payment.");
  reference(receipt.reference);
  reference(receipt.payment.reference);
  dubai(receipt.issued_at);
  dubai(receipt.as_of);
  if (new Date(receipt.as_of) < new Date(receipt.issued_at))
    throw Error("Receipt summary predates its issue date.");
  const allocated_minor = receipt.allocations.reduce((sum, row) => {
    reference(row.invoice_reference);
    minor(row.amount_minor);
    return sum + row.amount_minor;
  }, 0);
  const unallocated_minor =
    receipt.payment.amount_minor - allocated_minor - receipt.refunded_minor;
  if (!Number.isSafeInteger(allocated_minor) || unallocated_minor < 0)
    throw Error("Receipt accounting does not reconcile.");
  return {
    allocated_minor,
    unallocated_minor,
    amount: amount(receipt.payment.amount_minor),
    recorded_date: dubai(receipt.payment.recorded_at),
  };
}

/** The caller must load every row through current RLS and verify family/branch matches. */
export async function receiptPdf(
  receipt: ReceiptDocument,
  arabicFontBytes?: Uint8Array,
  locale: "en" | "ar" = "en",
): Promise<Uint8Array> {
  const summary = receiptSummary(receipt);
  const l = labels[locale];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(
    `${locale === "ar" ? "إيصال دفع كفو" : "KAFOU payment receipt"} ${receipt.reference}`,
  );
  doc.setSubject(
    "Offline payment acknowledgment; not provider settlement or a tax invoice.",
  );
  doc.setAuthor("KAFOU Sport Academy");
  doc.setProducer("KAFOU");
  doc.setCreationDate(new Date(receipt.issued_at));
  doc.setModificationDate(new Date(receipt.as_of));
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arabic = arabicFontBytes ? fontkit.create(arabicFontBytes) : null;
  const arabicPdf = arabicFontBytes
    ? await doc.embedFont(arabicFontBytes, { subset: true })
    : null;
  const ink = rgb(0.05, 0.19, 0.23),
    teal = rgb(0.0, 0.43, 0.43),
    muted = rgb(0.34, 0.4, 0.43);
  let page = doc.addPage([595, 842]);
  let arabicKey = arabicPdf
    ? page.node.newFontDictionary("Arabic", arabicPdf.ref)
    : null;
  let y = 704;
  function text(
    value: string,
    atY: number,
    size = 11,
    options: {
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      right?: boolean;
    } = {},
  ) {
    value = value.replace(/[\r\n\t]+/g, " ");
    const x0 = options.x ?? 48,
      width = options.width ?? 499,
      color = options.color ?? ink;
    const rtl = /\p{Script=Arabic}/u.test(value);
    if (!rtl) {
      const font = options.bold ? bold : latin;
      const actual = Math.min(
        size,
        (size * width) / Math.max(1, font.widthOfTextAtSize(value, size)),
      );
      page.drawText(value, {
        x: options.right
          ? x0 + width - font.widthOfTextAtSize(value, actual)
          : x0,
        y: atY,
        size: actual,
        font,
        color,
      });
      return;
    }
    if (!arabic || !arabicPdf || !arabicKey)
      throw Error("Arabic font bytes are required for this receipt.");
    const runs = (
      value.match(
        /[\u0660-\u0669\u06F0-\u06F9]+|(?:(?![\u0660-\u0669\u06F0-\u06F9])[\p{Script=Arabic}\p{Mark}\s])+|[^\p{Script=Arabic}\p{Mark}\s]+/gu,
      ) ?? []
    )
      .reverse()
      .map((part) => ({
        text: part,
        numeric: /^[\u0660-\u0669\u06F0-\u06F9]+$/.test(part),
        shape: /\p{Script=Arabic}/u.test(part) ? arabic.layout(part) : null,
      }));
    if (runs.some((run) => run.shape?.glyphs.some((g) => g.id === 0)))
      throw Error("Receipt font does not support this text.");
    const natural = runs.reduce(
      (sum, run) =>
        sum +
        (run.shape
          ? (run.shape.positions.reduce((n, p) => n + p.xAdvance, 0) /
              arabic.unitsPerEm) *
            size
          : latin.widthOfTextAtSize(run.text, size)),
      0,
    );
    const actual = Math.min(size, (size * width) / Math.max(1, natural));
    let x = x0 + width - (natural * actual) / size;
    for (const run of runs) {
      if (!run.shape) {
        page.drawText(run.text, {
          x,
          y: atY,
          size: actual,
          font: latin,
          color,
        });
        x += latin.widthOfTextAtSize(run.text, actual);
        continue;
      }
      // Numeric runs keep their left-to-right order inside right-to-left text.
      const encoded = run.numeric
        ? [...run.text]
            .map((char) => arabicPdf.encodeText(char).asString())
            .join("")
        : arabicPdf.encodeText(run.text).asString();
      const positions = run.numeric
        ? [...run.text].flatMap((char) => arabic.layout(char).positions)
        : run.shape.positions;
      const scale = actual / arabic.unitsPerEm;
      positions.forEach((p, index) => {
        page.pushOperators(
          beginText(),
          setFillingColor(color),
          setFontAndSize(arabicKey!, actual),
          setTextMatrix(
            1,
            0,
            0,
            1,
            x + p.xOffset * scale,
            atY + p.yOffset * scale,
          ),
          showText(PDFHexString.of(encoded.slice(index * 4, index * 4 + 4))),
          endText(),
        );
        x += p.xAdvance * scale;
      });
    }
  }
  function header() {
    page.drawRectangle({ x: 0, y: 754, width: 595, height: 88, color: ink });
    text("KAFOU SPORT ACADEMY", 795, 20, { bold: true, color: rgb(1, 1, 1) });
    text(l.title, 726, 25, { bold: true });
    text(receipt.reference, 704, 10, { color: muted, right: locale === "ar" });
    page.drawLine({
      start: { x: 48, y: 686 },
      end: { x: 547, y: 686 },
      color: teal,
      thickness: 2,
    });
  }
  function footer() {
    page.drawLine({
      start: { x: 48, y: 76 },
      end: { x: 547, y: 76 },
      color: rgb(0.8, 0.85, 0.85),
    });
    text(l.note, 59, 8, { color: muted });
    text(l.dateNote, 44, 8, { color: muted, width: 420 });
    text(String(doc.getPageCount()), 44, 8, { right: true, color: muted });
  }
  function room(height: number) {
    if (y - height >= 98) return;
    footer();
    page = doc.addPage([595, 842]);
    arabicKey = arabicPdf
      ? page.node.newFontDictionary("Arabic", arabicPdf.ref)
      : null;
    header();
    y = 658;
  }
  function field(label: string, value: string) {
    room(44);
    text(label, y, 9, { color: muted });
    text(value, y - 18, 12, { right: locale === "ar" });
    y -= 44;
  }
  function total(label: string, value: number) {
    room(25);
    text(label, y, 11, { x: locale === "ar" ? 242 : 48, width: 305 });
    text(amount(value), y, 12, {
      bold: true,
      x: locale === "ar" ? 48 : 366,
      width: 181,
      right: locale !== "ar",
    });
    y -= 25;
  }
  header();
  y = 656;
  field(l.received, summary.amount);
  field(l.method, l[receipt.payment.method]);
  field(l.reference, receipt.payment.reference);
  field(l.recorded, summary.recorded_date);
  field(l.issued, dubai(receipt.issued_at));
  y -= 6;
  text(l.summary, y, 16, { bold: true });
  y -= 26;
  total(l.allocated, summary.allocated_minor);
  total(l.refunded, receipt.refunded_minor);
  total(l.unallocated, summary.unallocated_minor);
  field(l.snapshot, dubai(receipt.as_of));
  y -= 6;
  text(l.allocations, y, 15, { bold: true });
  y -= 25;
  if (!receipt.allocations.length) {
    text(l.none, y, 11);
    y -= 24;
  }
  for (const allocation of receipt.allocations) {
    room(24);
    text(allocation.invoice_reference, y, 11, {
      x: locale === "ar" ? 242 : 48,
      width: 305,
      right: locale === "ar",
    });
    text(amount(allocation.amount_minor), y, 11, {
      x: locale === "ar" ? 48 : 366,
      width: 181,
      right: locale !== "ar",
    });
    y -= 24;
  }
  footer();
  return doc.save({ useObjectStreams: false });
}
