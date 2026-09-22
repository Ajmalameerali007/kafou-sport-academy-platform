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
export interface CertificateDocument {
  reference: string;
  recipient_name: string;
  sport: string;
  level_name: string;
  title: string;
  issued_at: string;
}
/**
 * Render only an authorized, unrevoked certificate row returned through RLS.
 * The API supplies the self-hosted licensed Arabic TTF bytes; no filesystem,
 * network, Buffer, or provider is used here. Fontkit shapes and positions marks.
 */
export async function certificatePdf(
  certificate: CertificateDocument,
  arabicFontBytes?: Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${certificate.title} — ${certificate.recipient_name}`);
  doc.setSubject(`Private academy certificate ${certificate.reference}`);
  doc.setAuthor("KAFOU Sport Academy");
  doc.setProducer("KAFOU");
  const issued = new Date(certificate.issued_at);
  if (!Number.isFinite(issued.getTime()))
    throw new Error("Certificate issue date is invalid.");
  doc.setCreationDate(issued);
  doc.setModificationDate(issued);
  const page = doc.addPage([842, 595]);
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arabic = arabicFontBytes ? fontkit.create(arabicFontBytes) : null;
  const arabicPdf = arabicFontBytes
    ? await doc.embedFont(arabicFontBytes, { subset: true })
    : null;
  const arabicKey = arabicPdf
    ? page.node.newFontDictionary("Arabic", arabicPdf.ref)
    : null;
  const navy = rgb(0.04, 0.15, 0.22),
    teal = rgb(0.01, 0.48, 0.47),
    ink = rgb(0.08, 0.2, 0.25);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color: rgb(0.98, 0.98, 0.96),
  });
  page.drawRectangle({ x: 0, y: 505, width: 842, height: 90, color: navy });
  page.drawRectangle({
    x: 40,
    y: 40,
    width: 762,
    height: 445,
    borderColor: teal,
    borderWidth: 2,
  });
  page.drawText("KAFOU SPORT ACADEMY", {
    x: 64,
    y: 538,
    size: 30,
    font: latinBold,
    color: rgb(1, 1, 1),
  });
  const line = (text: string, baseSize: number, y: number, bold = false) => {
    text = text.replace(/[\r\n\t]+/g, " ");
    const rtl = /\p{Script=Arabic}/u.test(text);
    if (!rtl) {
      const font = bold ? latinBold : latin;
      const width = font.widthOfTextAtSize(text, baseSize);
      const size = Math.min(baseSize, (baseSize * 710) / Math.max(width, 1));
      page.drawText(text, { x: 64, y, size, font, color: ink });
      return;
    }
    if (!arabic || !arabicPdf || !arabicKey)
      throw new Error("Arabic font bytes are required for this certificate.");
    // Keep Latin runs readable within an Arabic line; shape Arabic runs with GSUB+GPOS.
    const parts =
      text.match(
        /[\p{Script=Arabic}\p{Mark}\s]+|[^\p{Script=Arabic}\p{Mark}\s]+/gu,
      ) ?? [];
    const runs = parts
      .reverse()
      .map((part) =>
        /\p{Script=Arabic}/u.test(part)
          ? { text: part, shape: arabic.layout(part) }
          : { text: part, shape: null },
      );
    for (const run of runs)
      if (run.shape?.glyphs.some((g) => g.id === 0))
        throw new Error("Certificate font does not support this name.");
    const naturalWidth = runs.reduce(
      (sum, run) =>
        sum +
        (run.shape
          ? (run.shape.positions.reduce((total, p) => total + p.xAdvance, 0) /
              arabic.unitsPerEm) *
            baseSize
          : latin.widthOfTextAtSize(run.text, baseSize)),
      0,
    );
    const size = Math.min(
      baseSize,
      (baseSize * 710) / Math.max(naturalWidth, 1),
    );
    let x = 778 - (naturalWidth * size) / baseSize;
    for (const run of runs) {
      if (!run.shape) {
        page.drawText(run.text, { x, y, size, font: latin, color: ink });
        x += latin.widthOfTextAtSize(run.text, size);
        continue;
      }
      const encoded = arabicPdf.encodeText(run.text).asString();
      const scale = size / arabic.unitsPerEm;
      // Position each shaped glyph explicitly, including hamza and vowel marks.
      run.shape.positions.forEach((position, index) => {
        page.pushOperators(
          beginText(),
          setFillingColor(ink),
          setFontAndSize(arabicKey, size),
          setTextMatrix(
            1,
            0,
            0,
            1,
            x + position.xOffset * scale,
            y + position.yOffset * scale,
          ),
          showText(PDFHexString.of(encoded.slice(index * 4, index * 4 + 4))),
          endText(),
        );
        x += position.xAdvance * scale;
      });
    }
  };
  line("CERTIFICATE OF ACHIEVEMENT", 16, 452, true);
  line(certificate.title, 28, 405, true);
  line("Presented to", 13, 353);
  line(certificate.recipient_name, 34, 303, true);
  line(`${certificate.sport} | ${certificate.level_name}`, 19, 247);
  line(
    "Awarded for progress supported by a reviewed academy assessment.",
    12,
    202,
  );
  line(`Issued: ${certificate.issued_at.slice(0, 10)}`, 12, 135);
  line(`Reference: ${certificate.reference}`, 11, 110);
  line(
    "Private academy record. Status is available in your authenticated portal.",
    10,
    75,
  );
  return doc.save({ useObjectStreams: false });
}
