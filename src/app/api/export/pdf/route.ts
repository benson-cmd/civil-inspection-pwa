import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";
export const maxDuration = 60;

type ExportAttachment = {
  no: number;
  title: string;
  url: string;
};

type ExportRequest = {
  html: string;
  fileName?: string;
  baseUrl?: string;
  attachments?: ExportAttachment[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequest;
    if (!body.html) {
      return NextResponse.json({ error: "缺少報告 HTML。" }, { status: 400 });
    }

    const reportPdf = await renderHtmlToPdf(withBaseUrl(body.html, body.baseUrl));
    const mergedPdf = await PDFDocument.create();
    await appendPdf(mergedPdf, reportPdf);

    for (const attachment of body.attachments ?? []) {
      if (!attachment.url) continue;
      const attachmentPdf = await fetchPdf(attachment.url);
      await appendPdf(mergedPdf, attachmentPdf);
    }

    const bytes = await mergedPdf.save();
    const safeFileName = encodeURIComponent(`${body.fileName || "inspection-report"}.pdf`);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename*=UTF-8''${safeFileName}`,
      },
    });
  } catch (error) {
    console.error("Failed to export merged PDF", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF 匯出失敗。" },
      { status: 500 },
    );
  }
}

function withBaseUrl(html: string, baseUrl?: string) {
  if (!baseUrl) return html;
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return html.replace("<head>", `<head><base href="${escapeHtml(normalizedBaseUrl)}">`);
}

async function renderHtmlToPdf(html: string) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}

async function fetchPdf(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`附件 PDF 讀取失敗：${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf") && !url.toLowerCase().includes(".pdf")) {
    throw new Error("附件檔案不是 PDF。");
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function appendPdf(target: PDFDocument, sourceBytes: Uint8Array) {
  const source = await PDFDocument.load(sourceBytes);
  const pages = await target.copyPages(source, source.getPageIndices());
  pages.forEach((page) => target.addPage(page));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
