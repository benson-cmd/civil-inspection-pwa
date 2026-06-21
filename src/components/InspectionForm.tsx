"use client";

import { Trash2, Upload } from "lucide-react";
import type { ComponentType, ConditionType, InspectionPoint } from "@/types/inspection";
import { buildPhotoCaption } from "@/lib/caption";

const componentOptions: ComponentType[] = ["全景", "牆面", "平頂", "地坪", "梁", "柱", "其他"];
const conditionOptions: ConditionType[] = ["現況", "裂縫", "滲水", "剝落", "其他"];

interface InspectionFormProps {
  point?: InspectionPoint;
  onChange: (point: InspectionPoint) => void;
  onDelete: (pointId: string) => void;
}

export function InspectionForm({ point, onChange, onDelete }: InspectionFormProps) {
  if (!point) {
    return (
      <aside className="rounded-lg border border-dashed border-line bg-paper p-5 text-muted">
        點選平面圖新增或選取照片點位後，這裡會顯示該照片的紀錄表。
      </aside>
    );
  }

  const caption = point.photo?.caption || buildPhotoCaption(point);

  function toggleComponent(value: ComponentType) {
    if (!point) return;
    const exists = point.componentType.includes(value);
    onChange({
      ...point,
      componentType: exists ? point.componentType.filter((item) => item !== value) : [...point.componentType, value],
    });
  }

  function toggleCondition(value: ConditionType) {
    if (!point) return;
    const exists = point.conditionType.includes(value);
    onChange({
      ...point,
      conditionType: exists ? point.conditionType.filter((item) => item !== value) : [...point.conditionType, value],
    });
  }

  return (
    <aside className="rounded-lg border border-line bg-paper p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted">目前照片</div>
          <h2 className="text-2xl font-black text-accent">#{point.photoNo}</h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-md bg-ink px-3 text-sm font-semibold text-white">
            <Upload size={18} /> 拍照/上傳
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const imageUrl = URL.createObjectURL(file);
                onChange({
                  ...point,
                  photo: {
                    id: crypto.randomUUID(),
                    pointId: point.id,
                    imageUrl,
                    caption,
                    takenAt: new Date().toISOString(),
                  },
                });
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => onDelete(point.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-accent px-3 text-sm font-semibold text-accent"
          >
            <Trash2 size={18} /> 刪除
          </button>
        </div>
      </div>
      <p className="mb-4 rounded-md bg-[#E6FBF7] p-3 text-sm text-muted">
        上傳方式：按「拍照/上傳」後，iPad Safari 會跳出「拍照」或「照片圖庫」；目前 MVP 先暫存在瀏覽器畫面，接 Supabase Storage 後會永久保存。
      </p>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-semibold">拍攝方向角度</span>
        <input
          type="range"
          min="0"
          max="359"
          value={point.directionAngle}
          onChange={(event) => onChange({ ...point, directionAngle: Number(event.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
        <span className="text-sm text-muted">{point.directionAngle}°</span>
      </label>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">構件位置</legend>
        <div className="grid grid-cols-2 gap-2">
          {componentOptions.map((option) => (
            <CheckPill
              key={option}
              label={option}
              checked={point.componentType.includes(option)}
              onChange={() => toggleComponent(option)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">現況/缺失</legend>
        <div className="grid grid-cols-2 gap-2">
          {conditionOptions.map((option) => (
            <CheckPill
              key={option}
              label={option}
              checked={point.conditionType.includes(option)}
              onChange={() => toggleCondition(option)}
            />
          ))}
        </div>
      </fieldset>

      {point.conditionType.includes("裂縫") ? (
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">裂縫寬度 mm</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={point.crackWidthMm ?? ""}
            onChange={(event) =>
              onChange({ ...point, crackWidthMm: event.target.value ? Number(event.target.value) : undefined })
            }
            className="min-h-11 w-full rounded-md border border-line bg-white px-3"
          />
        </label>
      ) : null}

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-semibold">備註</span>
        <textarea
          value={point.note}
          onChange={(event) => onChange({ ...point, note: event.target.value })}
          rows={3}
          className="w-full rounded-md border border-line bg-white p-3"
        />
      </label>

      <div className="rounded-md border border-line bg-white p-3 text-sm">
        <div className="mb-1 font-semibold">自動說明</div>
        <p className="text-muted">{caption}</p>
      </div>

      {point.photo?.imageUrl ? (
        <img src={point.photo.imageUrl} alt={`照片 ${point.photoNo}`} className="mt-4 max-h-56 w-full rounded-md border border-line object-contain" />
      ) : null}
    </aside>
  );
}

function CheckPill({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold ${
        checked ? "border-accent bg-accent text-white" : "border-line bg-white text-foreground"
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
