"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import type { LevelMeasurement } from "@/types/inspection";
import { MeasurementPlanEditor } from "@/components/MeasurementPlanEditor";

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
  rows,
  planPaths,
  onRowsChange,
  onPlanPathsChange,
  onPhotoUpload,
}: {
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
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#e7e5e4] text-left">
                <th className="border border-line p-2">測點編號</th>
                <th className="border border-line p-2">位置</th>
                <th className="border border-line p-2">日期</th>
                <th className="border border-line p-2 whitespace-nowrap">初測高程 m</th>
                <th className="border border-line p-2 whitespace-nowrap">複測高程 m</th>
                <th className="border border-line p-2 whitespace-nowrap">高程差(m)</th>
                <th className="border border-line p-2">備註</th>
                <th className="border border-line p-2">測點照片</th>
                <th className="border border-line p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const initial = parseFloat(row.initialElevation) || 0;
                const repeat = parseFloat(row.repeatElevation) || 0;
                const diff = repeat - initial;
                const hasElevation = initial !== 0 || repeat !== 0;
                const isWarning = Math.abs(diff) > 0.01;

                return (
                  <tr
                    key={row.id}
                    className={row.id === activeRow?.id ? "bg-green-50" : "bg-white"}
                    onClick={() => setActiveRowId(row.id)}
                  >
                    <td className="border border-line p-2">
                      <TableInput value={row.pointNo} placeholder="BM1 / H1" onChange={(pointNo) => updateRow(row.id, { pointNo })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput
                        value={row.location}
                        placeholder={`詳水準測量位置示意圖及${row.pointNo || "測點"}現況照片`}
                        onChange={(location) => updateRow(row.id, { location })}
                      />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput type="date" value={row.measurementDate ?? ""} onChange={(measurementDate) => updateRow(row.id, { measurementDate })} />
                    </td>
                    <td className="border border-line p-2">
                      <TableInput
                        type="number"
                        inputMode="decimal"
                        value={row.initialElevation}
                        onChange={(initialElevation) => updateRow(row.id, { initialElevation, relativeElevation: initialElevation })}
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
                    <td className={`mono-data border border-line p-2 text-center ${isWarning ? "bg-orange-50 font-bold text-orange-700" : ""}`}>
                      {hasElevation ? `${diff >= 0 ? "+" : ""}${diff.toFixed(3)}` : "—"}
                      {isWarning ? " ⚠️" : ""}
                    </td>
                    <td className="border border-line p-2">
                      <TableInput value={row.note} onChange={(note) => updateRow(row.id, { note })} />
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
        {displayRows.some((row) => {
          const diff = (parseFloat(row.repeatElevation) || 0) - (parseFloat(row.initialElevation) || 0);
          return Math.abs(diff) > 0.01;
        }) ? (
          <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
            ⚠️ 高程差超過 10mm 的測點請確認是否需要說明。
          </p>
        ) : null}
      </div>
    </section>
  );
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
