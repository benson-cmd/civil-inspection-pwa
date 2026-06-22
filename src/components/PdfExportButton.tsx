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
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-white shadow-sm"
      onClick={() => {
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
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
      <FileText size={18} /> 匯出附件 PDF
    </button>
  );
}
