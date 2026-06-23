"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import type { MeasurementPhoto, TiltMeasurement } from "@/types/inspection";
import { MeasurementPlanEditor } from "@/components/MeasurementPlanEditor";

function createRow(): TiltMeasurement {
  return {
    id: crypto.randomUUID(),
    lineNo: "",
    location: "",
    direction: "X向",
    measurementDate: "",
    upperDistance: "",
    lowerDistance: "",
    floorHeight: "",
    note: "",
  };
}

export function AttachmentSixEditor({
  rows,
  planPaths,
  onRowsChange,
  onPlanPathsChange,
  onPhotoUpload,
}: {
  rows: TiltMeasurement[];
  planPaths: string[];
  onRowsChange: (rows: TiltMeasurement[]) => void;
  onPlanPathsChange: (paths: string[]) => void;
  onPhotoUpload: (row: TiltMeasurement, slot: "upper" | "lower", file: File) => Promise<{ imageUrl: string; storagePath?: string }>;
}) {
  const displayRows = rows.length ? rows : [createRow()];
  const [activeRowId, setActiveRowId] = useState(displayRows[0]?.id);
  const activeRow = displayRows.find((row) => row.id === activeRowId) ?? displayRows[0];
  const markers = useMemo(
    () =>
      displayRows.map((row) => ({
        id: row.id,
        label: row.lineNo || "Z",
        x: row.x,
        y: row.y,
      })),
    [displayRows],
  );

  function updateRow(rowId: string, patch: Partial<TiltMeasurement>) {
    onRowsChange(displayRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const next = [...displayRows, createRow()];
    onRowsChange(next);
    setActiveRowId(next[next.length - 1].id);
  }

  function removeRow(rowId: string) {
    const next = displayRows.filter((row) => row.id !== rowId);
    const safeNext = next.length ? next : [createRow()];
    onRowsChange(safeNext);
    if (activeRowId === rowId) setActiveRowId(safeNext[0]?.id);
  }

  return (
    <section className="workspace-panel rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Vertical Tilt Survey</p>
          <h2 className="text-lg font-bold">附件六 傾斜率測量</h2>
          <p className="text-sm text-muted">依範例建立傾斜率紀錄總表、測量位置示意圖與 A/B 測點照片。</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 text-sm font-bold text-white"
        >
          <Plus size={18} /> 新增測線
        </button>
      </div>

      <div className="grid gap-4">
        <MeasurementPlanEditor
          title="傾斜測量位置示意圖"
          description="畫出建物與測線位置，選取表格列後將 Z 測線標示在圖上。"
          paths={planPaths}
          markers={markers}
          activeMarkerId={activeRow?.id}
          onPathsChange={onPlanPathsChange}
          onActiveMarkerChange={setActiveRowId}
          onMarkerMove={(rowId, position) => updateRow(rowId, position)}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#e7e5e4] text-left">
                <th className="border border-line p-2">編號</th>
                <th className="border border-line p-2">內容</th>
                <th className="border border-line p-2">日期</th>
                <th className="border border-line p-2">方向</th>
                <th className="border border-line p-2">測量值 H m</th>
                <th className="border border-line p-2">上測點 mm</th>
                <th className="border border-line p-2">下測點 mm</th>
                <th className="border border-line p-2">位移量(mm)</th>
                <th className="border border-line p-2">傾斜率</th>
                <th className="border border-line p-2">照片 A/B</th>
                <th className="border border-line p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const displacementMm = calculateDisplacement(row);
                const ratio = calculateRatio(displacementMm, row.floorHeight);
                const warning = ratio !== null && ratio < 200;
                const hasDisplacement = displacementMm !== null && displacementMm !== 0;

                return (
                  <tr
                    key={row.id}
                    className={row.id === activeRow?.id ? "bg-green-50" : warning ? "bg-orange-50" : "bg-white"}
                    onClick={() => setActiveRowId(row.id)}
                  >
                    <td className="border border-line p-2">
                      <TableInput value={row.lineNo} placeholder="1 / Z1" onChange={(lineNo) => updateRow(row.id, { lineNo })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput value={row.location} placeholder="標的物地址或測線內容" onChange={(location) => updateRow(row.id, { location })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput type="date" value={row.measurementDate ?? ""} onChange={(measurementDate) => updateRow(row.id, { measurementDate })} />
                    </td>
                    <td className="border border-line p-2">
                      <select
                        value={row.direction}
                        onChange={(event) => updateRow(row.id, { direction: event.target.value as TiltMeasurement["direction"] })}
                        className="min-h-10 w-full rounded-md border border-line bg-white px-2 outline-none"
                      >
                        <option value="X向">X向</option>
                        <option value="Y向">Y向</option>
                      </select>
                    </td>
                    <td className="border border-line p-2">
                      <TableInput type="number" inputMode="decimal" value={row.floorHeight} onChange={(floorHeight) => updateRow(row.id, { floorHeight })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput type="number" inputMode="decimal" value={row.upperDistance} onChange={(upperDistance) => updateRow(row.id, { upperDistance })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput type="number" inputMode="decimal" value={row.lowerDistance} onChange={(lowerDistance) => updateRow(row.id, { lowerDistance })} />
                    </td>
                    <td className={`mono-data border border-line p-2 ${hasDisplacement ? "font-bold" : ""}`}>
                      {hasDisplacement ? displacementMm.toFixed(1) : "—"}
                    </td>
                    <td className={`mono-data border border-line p-2 ${warning ? "bg-orange-50 font-bold text-orange-700" : ""}`}>
                      {ratio !== null && hasDisplacement ? formatRatio(displacementMm, ratio) : "—"}
                      {warning ? " ⚠" : ""}
                    </td>
                    <td className="border border-line p-2">
                      <div className="grid gap-2">
                        <PhotoUploader
                          label={`${row.lineNo || "測線"}-A`}
                          photo={row.upperPhoto}
                          onUpload={(file) => uploadAndPatchPhoto(row, "upper", file, updateRow, onPhotoUpload)}
                        />
                        <PhotoUploader
                          label={`${row.lineNo || "測線"}-B`}
                          photo={row.lowerPhoto}
                          onUpload={(file) => uploadAndPatchPhoto(row, "lower", file, updateRow, onPhotoUpload)}
                        />
                      </div>
                    </td>
                    <td className="border border-line p-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRow(row.id);
                        }}
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-muted"
                        aria-label="刪除測線"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function uploadAndPatchPhoto(
  row: TiltMeasurement,
  slot: "upper" | "lower",
  file: File,
  updateRow: (rowId: string, patch: Partial<TiltMeasurement>) => void,
  onPhotoUpload: (row: TiltMeasurement, slot: "upper" | "lower", file: File) => Promise<{ imageUrl: string; storagePath?: string }>,
) {
  void onPhotoUpload(row, slot, file).then((uploaded) => {
    const currentPhoto = slot === "upper" ? row.upperPhoto : row.lowerPhoto;
    const suffix = slot === "upper" ? "A" : "B";
    updateRow(row.id, {
      [slot === "upper" ? "upperPhoto" : "lowerPhoto"]: {
        id: currentPhoto?.id ?? crypto.randomUUID(),
        imageUrl: uploaded.imageUrl,
        storagePath: uploaded.storagePath,
        caption: `${row.lineNo || "測線"}-${suffix}`,
        takenAt: new Date().toISOString(),
      },
    });
  });
}

function PhotoUploader({ label, photo, onUpload }: { label: string; photo?: MeasurementPhoto; onUpload: (file: File) => void }) {
  return (
    <div className="flex items-center gap-2">
      {photo?.imageUrl ? <img src={photo.imageUrl} alt={label} className="h-14 w-16 rounded border border-line object-cover" /> : null}
      <label className="relative inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border border-line bg-white px-3 text-xs font-semibold text-accent">
        <ImagePlus size={14} /> {label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function calculateDisplacement(row: TiltMeasurement) {
  const upper = Number(row.upperDistance);
  const lower = Number(row.lowerDistance);
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || row.upperDistance === "" || row.lowerDistance === "") return null;
  return upper - lower;
}

function calculateRatio(displacement: number | null, floorHeight: string) {
  const heightM = Number(floorHeight);
  if (displacement === null || displacement === 0 || !Number.isFinite(heightM) || heightM === 0 || floorHeight === "") return null;
  return Math.abs((heightM * 1000) / displacement);
}

function formatRatio(displacement: number | null, ratio: number) {
  const sign = displacement != null && displacement < 0 ? "-" : "";
  return `1/${sign}${Math.round(ratio)}`;
}

function TableInput({
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 w-full rounded-md border border-line bg-white px-2 outline-none placeholder:text-stone-300"
    />
  );
}
