"use client";

import { FileText } from "lucide-react";
import type { Floor, InspectionPoint, LevelMeasurement, Project, SitePhoto, Target, TiltMeasurement } from "@/types/inspection";
import { buildReportHtml } from "@/lib/pdf";

interface PdfExportButtonProps {
  project: Project;
  target: Target;
  floors: Floor[];
  points: InspectionPoint[];
  sitePhotos?: SitePhoto[];
  levelMeasurements?: LevelMeasurement[];
  levelPlanPaths?: string[];
  tiltMeasurements?: TiltMeasurement[];
  tiltPlanPaths?: string[];
}

export function PdfExportButton({
  project,
  target,
  floors,
  points,
  sitePhotos = [],
  levelMeasurements = [],
  levelPlanPaths = [],
  tiltMeasurements = [],
  tiltPlanPaths = [],
}: PdfExportButtonProps) {
  const checklist = buildExportChecklist({
    project,
    target,
    floors,
    points,
    levelMeasurements,
    tiltMeasurements,
  });
  const failedItems = checklist.filter((item) => item.status !== "complete");

  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-white shadow-sm"
      onClick={() => {
        const checklistText = checklist
          .map((item) => `${item.status === "complete" ? "✓" : "⚠"} ${item.label}${item.detail ? `：${item.detail}` : ""}`)
          .join("\n");
        const shouldContinue =
          failedItems.length === 0 ||
          window.confirm(`匯出前檢查清單：\n\n${checklistText}\n\n仍要開啟 PDF 預覽嗎？`);

        if (!shouldContinue) return;

        const html = buildReportHtml({
          project,
          target,
          floors,
          points,
          sitePhotos,
          levelMeasurements,
          levelPlanPaths,
          tiltMeasurements,
          tiltPlanPaths,
        });
        const blob = new Blob([buildPreviewHtml(html, project.caseNo || "inspection-report")], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, "_blank");
        if (!printWindow) {
          const link = document.createElement("a");
          link.href = url;
          link.download = `${project.caseNo || "inspection-report"}.html`;
          link.click();
          window.alert("瀏覽器阻擋開新視窗，已改下載 HTML 檔。請開啟後列印另存 PDF。");
          return;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }}
    >
      <FileText size={18} /> PDF預覽 / 匯出
    </button>
  );
}

function buildExportChecklist({
  project,
  target,
  floors,
  points,
  levelMeasurements,
  tiltMeasurements,
}: {
  project: Project;
  target: Target;
  floors: Floor[];
  points: InspectionPoint[];
  levelMeasurements: LevelMeasurement[];
  tiltMeasurements: TiltMeasurement[];
}) {
  const basicFields = [project.caseNo, project.projectName, project.applicantName, project.inspectionDate];
  const missingPhotoPoints = points.filter((point) => !point.photo?.imageUrl);
  const missingCrackWidths = points.filter((point) => point.conditionType.includes("裂縫") && point.crackWidthMm == null);
  const missingCaptions = points.filter((point) => !point.photo?.caption && !point.note.trim());
  const levelRowsMissingPhotos = levelMeasurements.filter((row) => (row.pointNo || row.location || row.relativeElevation) && !row.photo?.imageUrl);
  const tiltRowsMissingPhotos = tiltMeasurements.filter(
    (row) => (row.lineNo || row.location || row.floorHeight) && (!row.upperPhoto?.imageUrl || !row.lowerPhoto?.imageUrl),
  );
  const floorsMissingPlans = floors.filter((floor) => !floor.planSvgOrJson.includes("<path"));

  return [
    {
      label: "基本資料是否完整",
      status: basicFields.every((value) => value?.trim()) ? "complete" : "missing",
      detail: "需填案件編號、案件名稱、申請單位、鑑定日期",
    },
    {
      label: "標的物是否有地址",
      status: target.address.trim() ? "complete" : "missing",
      detail: target.address.trim() ? "" : "標的物地址尚未填寫",
    },
    {
      label: "樓層是否有平面圖",
      status: floors.length === 0 || floorsMissingPlans.length === 0 ? "complete" : "missing",
      detail: floorsMissingPlans.length ? `${floorsMissingPlans.length} 個樓層尚未繪製平面圖` : "",
    },
    {
      label: "照片點是否已上傳照片",
      status: missingPhotoPoints.length === 0 ? "complete" : "missing",
      detail: missingPhotoPoints.length ? `${missingPhotoPoints.length} 個照片點未拍照` : "",
    },
    {
      label: "勾選裂縫是否已填裂縫寬度",
      status: missingCrackWidths.length === 0 ? "complete" : "missing",
      detail: missingCrackWidths.length ? `${missingCrackWidths.length} 個裂縫點缺裂縫寬` : "",
    },
    {
      label: "照片說明是否存在",
      status: missingCaptions.length === 0 ? "complete" : "missing",
      detail: missingCaptions.length ? `${missingCaptions.length} 個照片點缺說明` : "",
    },
    {
      label: "水準測量是否有測點但未上傳照片",
      status: levelRowsMissingPhotos.length === 0 ? "complete" : "missing",
      detail: levelRowsMissingPhotos.length ? `${levelRowsMissingPhotos.length} 個水準測點未上傳照片` : "",
    },
    {
      label: "傾斜測量是否有測線但未上傳照片",
      status: tiltRowsMissingPhotos.length === 0 ? "complete" : "missing",
      detail: tiltRowsMissingPhotos.length ? `${tiltRowsMissingPhotos.length} 個傾斜測線缺 A/B 照片` : "",
    },
  ] satisfies Array<{ label: string; status: "complete" | "missing"; detail: string }>;
}

function buildPreviewHtml(reportHtml: string, fileName: string) {
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fileName)} PDF 預覽</title>
    <style>
      html, body { height: 100%; margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif; background: #f0f4f0; }
      .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 16px; background: #0d2b1e; color: #f0faf4; }
      .toolbar strong { font-size: 14px; }
      .toolbar button { min-height: 40px; border: 0; border-radius: 10px; background: #2d6a4f; color: white; padding: 0 14px; font-weight: 700; cursor: pointer; }
      iframe { width: 100%; height: calc(100% - 64px); border: 0; background: white; }
      @media print { .toolbar { display: none; } iframe { height: 100vh; } }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <strong>PDF 預覽：${escapeHtml(fileName)}</strong>
      <button type="button" onclick="document.querySelector('iframe').contentWindow.print()">列印 / 另存 PDF</button>
    </div>
    <iframe title="PDF 預覽" srcdoc="${escapeHtml(reportHtml)}"></iframe>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
