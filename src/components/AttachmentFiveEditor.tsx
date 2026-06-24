"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import type { LevelMeasurement, Project, Target } from "@/types/inspection";
import { MeasurementPlanEditor } from "@/components/MeasurementPlanEditor";
import { PdfExportButton } from "@/components/PdfExportButton";

function createRow(): LevelMeasurement {
  return {
    id: crypto.randomUUID(),
    pointNo: "",
    location: "",
    measurementDate: "",
    relativeElevation: "",
    initialElevation: "",
    repeatElevation: "",
    note: "",
  };
}

export function AttachmentFiveEditor({
  project,
  target,
  rows,
  planPaths,
  onRowsChange,
  onPlanPathsChange,
  onPhotoUpload,
}: {
  project: Project;
  target: Target;
  rows: LevelMeasurement[];
  planPaths: string[];
  onRowsChange: (rows: LevelMeasurement[]) => void;
  onPlanPathsChange: (paths: string[]) => void;
  onPhotoUpload: (row: LevelMeasurement, file: File) => Promise<{ imageUrl: string; storagePath?: string }>;
}) {
  const displayRows = rows.length ? rows : [createRow()];
  const [activeRowId, setActiveRowId] = useState(displayRows[0]?.id);
  const activeRow = displayRows.find((row) => row.id === activeRowId) ?? displayRows[0];
  const markers = useMemo(
    () =>
      displayRows.map((row) => ({
        id: row.id,
        label: row.pointNo || "測點",
        x: row.x,
        y: row.y,
      })),
    [displayRows],
  );

  function updateRow(rowId: string, patch: Partial<LevelMeasurement>) {
    onRowsChange(displayRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const next = [...displayRows, createRow()];
    onRowsChange(next);
    setActiveRowId(next[next.length - 1].id);
  }

  function addSeparatorRow() {
    const next = [...displayRows, { ...createRow(), note: "基準點分組" }];
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Level Survey</p>
          <h2 className="text-lg font-bold">附件五 水準測量</h2>
          <p className="text-sm text-muted">依範例建立水準測量紀錄表、測量位置示意圖與測點照片。</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 text-sm font-bold text-white"
        >
          <Plus size={18} /> 新增測點
        </button>
        <button
          type="button"
          onClick={addSeparatorRow}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-accent"
        >
          <Plus size={18} /> 新增基準點分組
        </button>
      </div>

      <div className="grid gap-4">
        <MeasurementPlanEditor
          title="水準測量位置示意圖"
          description="用線條畫出簡易位置關係，選取表格列後將 BM/H 測點標示在圖上。"
          paths={planPaths}
          markers={markers}
          activeMarkerId={activeRow?.id}
          onPathsChange={onPlanPathsChange}
          onActiveMarkerChange={setActiveRowId}
          onMarkerMove={(rowId, position) => updateRow(rowId, position)}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#e7e5e4] text-left">
                <th className="border border-line p-2">點位</th>
                <th className="border border-line p-2">後視點</th>
                <th className="border border-line p-2 whitespace-nowrap">標尺讀數-後視</th>
                <th className="border border-line p-2 whitespace-nowrap">標尺讀數-前視</th>
                <th className="border border-line p-2 whitespace-nowrap">相對高程(m)</th>
                <th className="border border-line p-2">備註</th>
                <th className="border border-line p-2">測點照片</th>
                <th className="border border-line p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const relativeElevation = calculateRelativeElevation(displayRows, row.id);
                const isSeparator = !row.pointNo && !row.location && row.note === "基準點分組";

                return (
                  <tr
                    key={row.id}
                    className={isSeparator ? "bg-stone-100" : row.id === activeRow?.id ? "bg-green-50" : "bg-white"}
                    onClick={() => setActiveRowId(row.id)}
                  >
                    <td className="border border-line p-2">
                      <TableInput value={row.pointNo} placeholder="BM1 / H1" onChange={(pointNo) => updateRow(row.id, { pointNo })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput
                        value={row.location}
                        placeholder="如 BM1 / H1 / 另一起算基準點"
                        onChange={(location) => updateRow(row.id, { location })}
                      />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput
                        type="number"
                        inputMode="decimal"
                        value={row.initialElevation}
                        onChange={(initialElevation) => updateRow(row.id, { initialElevation })}
                      />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput
                        type="number"
                        inputMode="decimal"
                        value={row.repeatElevation}
                        onChange={(repeatElevation) => updateRow(row.id, { repeatElevation })}
                      />
                    </td>
                    <td className="mono-data border border-line p-2 text-center font-bold">
                      {relativeElevation == null ? "—" : relativeElevation.toFixed(3)}
                    </td>
                    <td className="border border-line p-2">
                      <TableInput value={row.note} placeholder="如：基準點假設高程 10.000" onChange={(note) => updateRow(row.id, { note })} />
                    </td>
                    <td className="border border-line p-2">
                      <PhotoUploader
                        row={row}
                        onUpload={(file) => {
                          void onPhotoUpload(row, file).then((uploaded) =>
                            updateRow(row.id, {
                              photo: {
                                id: row.photo?.id ?? crypto.randomUUID(),
                                imageUrl: uploaded.imageUrl,
                                storagePath: uploaded.storagePath,
                                caption: `${row.pointNo || "測點"} 水準點現況`,
                                takenAt: new Date().toISOString(),
                              },
                            }),
                          );
                        }}
                      />
                    </td>
                    <td className="border border-line p-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRow(row.id);
                        }}
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-muted"
                        aria-label="刪除測點"
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
        <p className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-sm text-muted">
          相對高程以每一組第一列作為起算基準；若備註含「假設高程 10.000」會優先採該數值，後續列依「前一點相對高程 + 後視讀數 - 前視讀數」自動推算。
        </p>
        <section className="rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">附件五匯出預覽</h3>
              <p className="text-sm text-muted">先檢查水準測量位置示意圖、紀錄表與照片頁，再列印另存 PDF。</p>
            </div>
            <PdfExportButton
              project={project}
              target={target}
              floors={[]}
              points={[]}
              sitePhotos={[]}
              levelMeasurements={displayRows}
              levelPlanPaths={planPaths}
              reportSections={[]}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function calculateRelativeElevation(rows: LevelMeasurement[], rowId: string) {
  let currentElevation = 0;
  let hasElevation = false;

  for (const row of rows) {
    if (!row.pointNo && !row.location && row.note === "基準點分組") {
      currentElevation = 0;
      hasElevation = false;
      if (row.id === rowId) return null;
      continue;
    }

    const assumedElevation = parseAssumedElevation(row.note);
    const backSight = parseFloat(row.initialElevation);
    const foreSight = parseFloat(row.repeatElevation);

    if (assumedElevation != null) {
      currentElevation = assumedElevation;
      hasElevation = true;
    } else if (!hasElevation) {
      currentElevation = 0;
      hasElevation = true;
    } else if (Number.isFinite(backSight) && Number.isFinite(foreSight)) {
      currentElevation = currentElevation + backSight - foreSight;
    }

    if (row.id === rowId) return hasElevation ? currentElevation : null;
  }

  return null;
}

function parseAssumedElevation(note: string) {
  const match = note.match(/(?:假設高程|基準高程)\s*([+-]?\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function PhotoUploader({ row, onUpload }: { row: LevelMeasurement; onUpload: (file: File) => void }) {
  return (
    <div className="grid gap-2">
      {row.photo?.imageUrl ? (
        <img src={row.photo.imageUrl} alt={row.pointNo || "水準點照片"} className="h-24 w-36 rounded border border-line object-cover" />
      ) : null}
      <label className="relative inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border border-line bg-white px-3 text-sm font-semibold text-accent">
        <ImagePlus size={16} /> {row.photo?.imageUrl ? "更換照片" : "上傳照片"}
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
