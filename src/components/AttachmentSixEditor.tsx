"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TiltMeasurement } from "@/types/inspection";

function createRow(): TiltMeasurement {
  return {
    id: crypto.randomUUID(),
    lineNo: "",
    location: "",
    direction: "X向",
    upperDistance: "",
    lowerDistance: "",
    floorHeight: "",
  };
}

export function AttachmentSixEditor({
  rows,
  onChange,
}: {
  rows: TiltMeasurement[];
  onChange: (rows: TiltMeasurement[]) => void;
}) {
  const displayRows = rows.length ? rows : [createRow()];

  function updateRow(rowId: string, patch: Partial<TiltMeasurement>) {
    onChange(displayRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function removeRow(rowId: string) {
    const next = displayRows.filter((row) => row.id !== rowId);
    onChange(next.length ? next : [createRow()]);
  }

  return (
    <section className="workspace-panel rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">附件六 傾斜率測量</h2>
          <p className="text-sm text-muted">先建立傾斜率測量基本資料表，PDF 匯出後續開發。</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...displayRows, createRow()])}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 text-sm font-bold text-white"
        >
          <Plus size={18} /> 新增列
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#e7e5e4] text-left">
              <th className="border border-line p-2">測線編號</th>
              <th className="border border-line p-2">測點位置</th>
              <th className="border border-line p-2">方向</th>
              <th className="border border-line p-2">上測點距離 mm</th>
              <th className="border border-line p-2">下測點距離 mm</th>
              <th className="border border-line p-2">樓高 mm</th>
              <th className="border border-line p-2">位移量 mm</th>
              <th className="border border-line p-2">傾斜率</th>
              <th className="border border-line p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const displacement = calculateDisplacement(row);
              const ratio = calculateRatio(displacement, row.floorHeight);
              const warning = ratio !== null && ratio < 200;

              return (
                <tr key={row.id} className={warning ? "bg-orange-50" : "bg-white"}>
                  <td className="border border-line p-2">
                    <TableInput value={row.lineNo} onChange={(lineNo) => updateRow(row.id, { lineNo })} />
                  </td>
                  <td className="border border-line p-2">
                    <TableInput value={row.location} onChange={(location) => updateRow(row.id, { location })} />
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
                    <TableInput type="number" inputMode="decimal" value={row.upperDistance} onChange={(upperDistance) => updateRow(row.id, { upperDistance })} />
                  </td>
                  <td className="border border-line p-2">
                    <TableInput type="number" inputMode="decimal" value={row.lowerDistance} onChange={(lowerDistance) => updateRow(row.id, { lowerDistance })} />
                  </td>
                  <td className="border border-line p-2">
                    <TableInput type="number" inputMode="decimal" value={row.floorHeight} onChange={(floorHeight) => updateRow(row.id, { floorHeight })} />
                  </td>
                  <td className="mono-data border border-line p-2 font-bold text-accent">
                    {displacement === null ? "" : displacement.toFixed(1)}
                  </td>
                  <td className={`mono-data border border-line p-2 font-bold ${warning ? "text-orange-700" : "text-accent"}`}>
                    {ratio === null ? "" : `1/${Math.round(ratio)}`}
                  </td>
                  <td className="border border-line p-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-muted"
                      aria-label="刪除列"
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
      <button type="button" disabled className="mt-4 min-h-11 rounded-md border border-line bg-stone-100 px-4 text-sm font-semibold text-muted">
        匯出附件六 PDF（待開發）
      </button>
    </section>
  );
}

function calculateDisplacement(row: TiltMeasurement) {
  const upper = Number(row.upperDistance);
  const lower = Number(row.lowerDistance);
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || row.upperDistance === "" || row.lowerDistance === "") return null;
  return upper - lower;
}

function calculateRatio(displacement: number | null, floorHeight: string) {
  const height = Number(floorHeight);
  if (displacement === null || displacement === 0 || !Number.isFinite(height) || height === 0 || floorHeight === "") return null;
  return Math.abs(height / displacement);
}

function TableInput({
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 w-full rounded-md border border-line bg-white px-2 outline-none"
    />
  );
}
