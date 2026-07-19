import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return Uint8Array.from(Buffer.from(m[2], "base64"));
}

export async function buildContractPdfBase64(input: {
  body: string;
  signers: {
    full_name: string;
    signed_at: string | null;
    signature_typed_name: string | null;
    signature_data?: string | null;
  }[];
  firm?: {
    signature_data?: string | null;
    signature_typed_name?: string | null;
    signed_at?: string | null;
  } | null;
}): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontSize = 10;
  const margin = 50;
  let page = doc.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  function newPage() {
    page = doc.addPage();
    ({ width, height } = page.getSize());
    y = height - margin;
  }

  function writeLine(text: string, options?: { bold?: boolean; size?: number }) {
    const size = options?.size ?? fontSize;
    const f = options?.bold ? bold : font;
    const maxWidth = width - margin * 2;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        if (y < margin + 20) newPage();
        page.drawText(line, {
          x: margin,
          y,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= size + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < margin + 20) newPage();
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: f,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= size + 4;
    }
  }

  async function drawSignatureImage(dataUrl: string | null | undefined) {
    if (!dataUrl) return;
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) return;
    const sigH = 48;
    try {
      const png = await doc.embedPng(bytes);
      const maxW = 220;
      const scale = Math.min(maxW / png.width, sigH / png.height);
      const w = png.width * scale;
      const h = png.height * scale;
      if (y - h < margin) newPage();
      y -= h;
      page.drawImage(png, { x: margin, y, width: w, height: h });
      y -= 6;
    } catch {
      /* typed name only */
    }
  }

  writeLine("TUTTLE LAW FIRM", { bold: true, size: 14 });
  y -= 6;
  writeLine("CONTINGENT FEE CONTRACT", { bold: true, size: 12 });
  y -= 10;

  for (const para of input.body.split(/\n\n+/)) {
    const cleaned = para.replace(/\n/g, " ").trim();
    if (!cleaned) continue;
    writeLine(cleaned);
    y -= 8;
  }

  y -= 12;
  writeLine("SIGNATURES", { bold: true, size: 12 });
  y -= 6;

  for (const s of input.signers) {
    if (y < margin + 80) newPage();
    writeLine(`${s.full_name}`);
    await drawSignatureImage(s.signature_data);
    writeLine(
      `Signed: ${s.signature_typed_name ?? s.full_name} · ${s.signed_at ?? "—"}`,
    );
    y -= 10;
  }

  y -= 8;
  writeLine("For: TUTTLE LAW FIRM", { bold: true });
  if (input.firm?.signature_data || input.firm?.signature_typed_name) {
    await drawSignatureImage(input.firm.signature_data);
    writeLine(
      `By: ${input.firm.signature_typed_name ?? "Authorized signer"}${
        input.firm.signed_at ? ` · ${input.firm.signed_at}` : ""
      }`,
    );
  } else {
    writeLine("By: ________________________________");
  }

  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}
