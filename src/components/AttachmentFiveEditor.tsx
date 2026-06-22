"use client";

import { Plus, Trash2 } from "lucide-react";
import type { LevelMeasurement } from "@/types/inspection";

function createRow(): LevelMeasurement {
  return {
    id: crypto.randomUUID(),
    pointNo: "",
    location: "",
    initialElevation: "",
    repeatElevation: "",
    note: "",
  };
}

export function AttachmentFiveEditor({
  rows,
  onChange,
}: {
  rows: LevelMeasurement[];
  onChange: (rows: LevelMeasurement[]) => void;
}) {
  const displayRows = rows.length ? rows : [createRow()];

  function updateRow(rowId: string, patch: Partial<LevelMeasurement>) {
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
          <h2 className="text-lg font-bold">附件五 水準測量</h2>
          <p className="text-sm text-muted">先建立水準測量基本資料表，PDF 匯出後續開發。</p>
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
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#e7e5e4] text-left">
              <th className="border border-line p-2">測點編號</th>
              <th className="border border-line p-2">測點位置</th>
              <th className="border border-line p-2">初測高程 m</th>
              <th className="border border-line p-2">複測高程 m</th>
              <th className="border border-line p-2">高程差</th>
              <th className="border border-line p-2">備註</th>
              <th className="border border-line p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.id} className="bg-white">
                <td className="border border-line p-2">
                  <TableInput value={row.pointNo} onChange={(pointNo) => updateRow(row.id, { pointNo })} />
                </td>
                <td className="border border-line p-2">
                  <TableInput value={row.location} onChange={(location) => updateRow(row.id, { location })} />
                </td>
                <td className="border border-line p-2">
                  <TableInput type="number" inputMode="decimal" value={row.initialElevation} onChange={(initialElevation) => updateRow(row.id, { initialElevation })} />
                </td>
                <td className="border border-line p-2">
                  <TableInput type="number" inputMode="decimal" value={row.repeatElevation} onChange={(repeatElevation) => updateRow(row.id, { repeatElevation })} />
                </td>
                <td className="mono-data border border-line p-2 font-bold text-accent">
                  {formatDifference(row.initialElevation, row.repeatElevation)}
                </td>
                <td className="border border-line p-2">
                  <TableInput value={row.note} onChange={(note) => updateRow(row.id, { note })} />
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
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" disabled className="mt-4 min-h-11 rounded-md border border-line bg-stone-100 px-4 text-sm font-semibold text-muted">
        匯出附件五 PDF（待開發）
      </button>
    </section>
  );
}

function formatDifference(initial: string, repeat: string) {
  const initialValue = Number(initial);
  const repeatValue = Number(repeat);
  if (!Number.isFinite(initialValue) || !Number.isFinite(repeatValue) || initial === "" || repeat === "") return "";
  return (repeatValue - initialValue).toFixed(3);
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
