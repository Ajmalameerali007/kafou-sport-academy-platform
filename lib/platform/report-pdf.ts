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

export interface MonthlyReportDocument {
  id: string;
  child_id: string;
  recipient_name: string | null;
  sport: string;
  month: string;
  version: number;
  summary: string;
  published_at: string;
  reviewed: boolean;
  evidence: {
    id: string;
    summary: string;
    next_target: string;
    criteria_title: string;
    criteria_version: number;
    published_at: string;
    measurements: {
      label: string;
      label_ar: string;
      value: number;
      unit: string;
      measured_at: string;
    }[];
  }[];
  context: {
    as_of: string;
    certificates: {
      reference: string;
      title: string;
      version: number;
      revoked_at: string | null;
      revocation_reason: string | null;
    }[];
    progression_reversals: {
      assessment_id: string;
      reversed_at: string;
      reason: string;
    }[];
  };
}
const vocabulary = {
  en: {
    title: "Monthly development report",
    athlete: "Athlete",
    identity: "Athlete reference",
    month: "Reporting month",
    sport: "Sport",
    version: "Report version",
    status: "Reviewed and published",
    published: "Published",
    summary: "Monthly summary",
    evidence: "Published assessment evidence",
    criteria: "Criteria version",
    target: "Next training target",
    measurement: "Recorded measurements",
    context: "Current correction context",
    asOf: "Context checked at",
    none: "No related certificate withdrawals or progression reversals were recorded.",
    withdrawn: "Certificate withdrawn",
    current: "Certificate issued",
    reversed: "Progression decision reversed",
    note: "This is the exact published report version. Later corrections below do not rewrite its original evidence.",
    private:
      "Private academy report. Check the authenticated portal for current access and correction status.",
    continued: "Continued",
    swimming: "Swimming",
    football: "Football",
    basketball: "Basketball",
    badminton: "Badminton",
  },
  ar: {
    title: "تقرير التطور الشهري",
    athlete: "الرياضي",
    identity: "مرجع الرياضي",
    month: "شهر التقرير",
    sport: "الرياضة",
    version: "نسخة التقرير",
    status: "تمت المراجعة والنشر",
    published: "تاريخ النشر",
    summary: "الملخص الشهري",
    evidence: "أدلة التقييم المنشورة",
    criteria: "نسخة معايير التقييم",
    target: "الهدف التدريبي التالي",
    measurement: "القياسات المسجلة",
    context: "سياق التصحيحات الحالي",
    asOf: "تم التحقق من السياق في",
    none: "لم تسجل عمليات سحب شهادات أو عكس قرارات التقدم المرتبطة.",
    withdrawn: "شهادة مسحوبة",
    current: "شهادة صادرة",
    reversed: "تم عكس قرار التقدم",
    note: "هذه نسخة التقرير المنشورة كما هي. لا تعيد التصحيحات اللاحقة أدناه كتابة الأدلة الأصلية.",
    private:
      "تقرير أكاديمي خاص. راجع البوابة بعد تسجيل الدخول للتحقق من صلاحية الوصول والتصحيحات.",
    continued: "تابع",
    swimming: "السباحة",
    football: "كرة القدم",
    basketball: "كرة السلة",
    badminton: "الريشة الطائرة",
  },
};
function date(value: string) {
  const d = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(d.getTime()))
    throw Error("Published report date is invalid.");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}
/** Render only the exact published row and complete evidence authorized by current RLS. */
export async function reportPdf(
  report: MonthlyReportDocument,
  arabicFontBytes?: Uint8Array,
  locale: "en" | "ar" = "en",
): Promise<Uint8Array> {
  if (
    !report.reviewed ||
    !Number.isInteger(report.version) ||
    report.version < 1 ||
    !report.summary.trim() ||
    !report.evidence.length
  )
    throw Error(
      "Reviewed published report and complete evidence are required.",
    );
  date(report.published_at);
  date(report.context.as_of);
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(report.month))
    throw Error("Report month is invalid.");
  for (const e of report.evidence) {
    date(e.published_at);
    if (!e.summary.trim() || !e.criteria_title.trim() || !e.measurements.length)
      throw Error("Report evidence is incomplete.");
    for (const m of e.measurements) {
      if (!Number.isFinite(m.value))
        throw Error("Report measurement is invalid.");
      date(m.measured_at);
    }
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(
    `${locale === "ar" ? "تقرير كفو الشهري" : "KAFOU monthly report"} ${report.month.slice(0, 7)} v${report.version}`,
  );
  doc.setSubject(
    `Published report ${report.id}; exact version ${report.version}`,
  );
  doc.setAuthor("KAFOU Sport Academy");
  doc.setProducer("KAFOU");
  doc.setCreationDate(new Date(report.published_at));
  doc.setModificationDate(new Date(report.context.as_of));
  const latin = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arabic = arabicFontBytes ? fontkit.create(arabicFontBytes) : null,
    arabicPdf = arabicFontBytes
      ? await doc.embedFont(arabicFontBytes, { subset: true })
      : null;
  const l = vocabulary[locale],
    ink = rgb(0.05, 0.19, 0.23),
    teal = rgb(0, 0.43, 0.43),
    muted = rgb(0.34, 0.4, 0.43);
  let page = doc.addPage([595, 842]),
    arabicKey = arabicPdf
      ? page.node.newFontDictionary("Arabic", arabicPdf.ref)
      : null,
    y = 680;
  function runs(value: string) {
    const parts: { text: string; kind: "arabic" | "number" | "latin" }[] = [];
    for (const char of value) {
      const kind = /\s/u.test(char)
        ? (parts.at(-1)?.kind ?? "latin")
        : /[\u0660-\u0669\u06F0-\u06F9]/.test(char)
          ? "number"
          : /[\p{Script=Arabic}\p{Mark}]/u.test(char)
            ? "arabic"
            : "latin";
      const last = parts.at(-1);
      if (last?.kind === kind) last.text += char;
      else parts.push({ text: char, kind });
    }
    const spaced = parts.flatMap((p) => {
      const trimmed = p.text.trim();
      if (!trimmed) return [{ text: p.text, kind: "latin" as const }];
      const leading = p.text.slice(0, p.text.indexOf(trimmed)),
        trailing = p.text.slice(p.text.indexOf(trimmed) + trimmed.length);
      return [
        ...(leading ? [{ text: leading, kind: "latin" as const }] : []),
        { ...p, text: trimmed },
        ...(trailing ? [{ text: trailing, kind: "latin" as const }] : []),
      ];
    });
    return spaced
      .reverse()
      .map((p) => ({
        ...p,
        shape: p.kind === "latin" ? null : arabic!.layout(p.text),
      }));
  }
  function width(value: string, size: number, strong = false) {
    if (!/\p{Script=Arabic}/u.test(value))
      return (strong ? bold : latin).widthOfTextAtSize(value, size);
    if (!arabic) throw Error("Arabic font bytes are required for this report.");
    return runs(value).reduce(
      (sum, r) =>
        sum +
        (r.shape
          ? (r.shape.positions.reduce((n, p) => n + p.xAdvance, 0) /
              arabic.unitsPerEm) *
            size
          : latin.widthOfTextAtSize(r.text, size)),
      0,
    );
  }
  function line(value: string, size = 11, strong = false, color = ink) {
    value = value.replace(/[\r\n\t]+/g, " ");
    const natural = width(value, size, strong),
      actual = Math.min(size, (size * 499) / Math.max(natural, 1));
    if (!/\p{Script=Arabic}/u.test(value)) {
      const font = strong ? bold : latin;
      page.drawText(value, {
        x: locale === "ar" ? 547 - font.widthOfTextAtSize(value, actual) : 48,
        y,
        size: actual,
        font,
        color,
      });
      return;
    }
    if (!arabic || !arabicPdf || !arabicKey)
      throw Error("Arabic font bytes are required for this report.");
    let x = 547 - (natural * actual) / size;
    for (const run of runs(value)) {
      if (!run.shape) {
        page.drawText(run.text, { x, y, size: actual, font: latin, color });
        x += latin.widthOfTextAtSize(run.text, actual);
        continue;
      }
      if (run.shape.glyphs.some((g) => g.id === 0))
        throw Error("Report font does not support this text.");
      const numeric = run.kind === "number",
        encoded = numeric
          ? [...run.text]
              .map((c) => arabicPdf.encodeText(c).asString())
              .join("")
          : arabicPdf.encodeText(run.text).asString();
      const positions = numeric
          ? [...run.text].flatMap((c) => arabic.layout(c).positions)
          : run.shape.positions,
        scale = actual / arabic.unitsPerEm;
      positions.forEach((p, i) => {
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
            y + p.yOffset * scale,
          ),
          showText(PDFHexString.of(encoded.slice(i * 4, i * 4 + 4))),
          endText(),
        );
        x += p.xAdvance * scale;
      });
    }
  }
  function header() {
    page.drawRectangle({ x: 0, y: 754, width: 595, height: 88, color: ink });
    const old = y;
    y = 795;
    line("KAFOU SPORT ACADEMY", 20, true, rgb(1, 1, 1));
    y = 726;
    line(l.title, 24, true);
    y = 704;
    line(`${report.month.slice(0, 7)} / v${report.version}`, 11, false, teal);
    y = 686;
    line(l.status, 10, false, teal);
    y = old;
  }
  function footer() {
    const old = y;
    page.drawLine({
      start: { x: 48, y: 75 },
      end: { x: 547, y: 75 },
      color: rgb(0.8, 0.85, 0.85),
    });
    y = 58;
    line(l.private, 8, false, muted);
    y = 42;
    line(`${report.id} / ${doc.getPageCount()}`, 8, false, muted);
    y = old;
  }
  function room(height: number) {
    if (y - height >= 98) return;
    footer();
    page = doc.addPage([595, 842]);
    arabicKey = arabicPdf
      ? page.node.newFontDictionary("Arabic", arabicPdf.ref)
      : null;
    header();
    y = 655;
  }
  function paragraph(value: string, size = 11, strong = false, color = ink) {
    for (const block of value.replace(/\r/g, "").split("\n")) {
      if (!block.trim()) {
        room(10);
        y -= 10;
        continue;
      }
      let current = "";
      for (const word of block.trim().split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (current && width(next, size, strong) > 499) {
          room(size * 1.65);
          line(current, size, strong, color);
          y -= size * 1.65;
          current = "";
        }
        if (width(word, size, strong) > 499) {
          for (const char of word) {
            if (width(current + char, size, strong) > 499) {
              room(size * 1.65);
              line(current, size, strong, color);
              y -= size * 1.65;
              current = "";
            }
            current += char;
          }
        } else current = current ? `${current} ${word}` : word;
      }
      if (current) {
        room(size * 1.65);
        line(current, size, strong, color);
        y -= size * 1.65;
      }
    }
  }
  function heading(value: string) {
    room(62);
    y -= 10;
    paragraph(value, 16, true, teal);
    y -= 7;
  }
  function field(label: string, value: string) {
    room(43);
    paragraph(label, 9, false, muted);
    paragraph(value, 12);
    y -= 8;
  }
  header();
  y = 655;
  field(
    report.recipient_name ? l.athlete : l.identity,
    report.recipient_name || report.child_id,
  );
  field(
    l.month,
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Dubai",
    }).format(new Date(`${report.month}T00:00:00Z`)),
  );
  field(l.sport, l[report.sport as "swimming"] || report.sport);
  field(l.published, date(report.published_at));
  heading(l.summary);
  paragraph(report.summary);
  y -= 8;
  paragraph(l.note, 9, false, muted);
  room(150);
  heading(l.evidence);
  report.evidence.forEach((e, index) => {
    room(94);
    paragraph(`${index + 1}. ${e.criteria_title}`, 13, true);
    paragraph(`${l.criteria}: ${e.criteria_version}`, 9, false, muted);
    paragraph(e.id, 8, false, muted);
    y -= 7;
    paragraph(e.summary);
    if (e.next_target) {
      y -= 5;
      paragraph(l.target, 10, true);
      paragraph(e.next_target);
    }
    y -= 6;
    paragraph(l.measurement, 10, true);
    for (const m of e.measurements) {
      paragraph(locale === "ar" && m.label_ar ? m.label_ar : m.label, 10);
      paragraph(`${m.value} ${m.unit}`);
      paragraph(date(m.measured_at), 9, false, muted);
    }
    y -= 14;
  });
  room(155);
  heading(l.context);
  field(l.asOf, date(report.context.as_of));
  if (
    !report.context.certificates.length &&
    !report.context.progression_reversals.length
  )
    paragraph(l.none);
  for (const c of report.context.certificates) {
    room(70);
    paragraph(c.revoked_at ? l.withdrawn : l.current, 11, true);
    paragraph(`${c.reference} / v${c.version}`, 10);
    paragraph(c.title);
    if (c.revoked_at) {
      paragraph(date(c.revoked_at), 9, false, muted);
      paragraph(c.revocation_reason || "");
    }
    y -= 12;
  }
  for (const reversal of report.context.progression_reversals) {
    room(70);
    paragraph(l.reversed, 11, true);
    paragraph(reversal.assessment_id, 8, false, muted);
    paragraph(date(reversal.reversed_at), 9, false, muted);
    paragraph(reversal.reason);
    y -= 12;
  }
  footer();
  return doc.save({ useObjectStreams: false });
}
