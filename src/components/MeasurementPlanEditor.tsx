"use client";

import { useState } from "react";
import type { PointerEvent } from "react";
import type { ReactNode } from "react";
import { Eraser, LocateFixed, Move, Pencil, RotateCcw, Slash } from "lucide-react";

export interface MeasurementMarker {
  id: string;
  label: string;
  x?: number;
  y?: number;
}

type Mode = "draw" | "line" | "marker" | "move" | "erase";

const viewBox = { width: 900, height: 620 };

export function MeasurementPlanEditor({
  title,
  description,
  paths,
  markers,
  activeMarkerId,
  onPathsChange,
  onMarkerMove,
  onActiveMarkerChange,
}: {
  title: string;
  description: string;
  paths: string[];
  markers: MeasurementMarker[];
  activeMarkerId?: string;
  onPathsChange: (paths: string[]) => void;
  onMarkerMove: (markerId: string, position: { x: number; y: number }) => void;
  onActiveMarkerChange: (markerId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("line");
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [draftPath, setDraftPath] = useState("");
  const [movingMarkerId, setMovingMarkerId] = useState<string | null>(null);

  const drawablePaths = draftPath ? [...paths, draftPath] : paths;
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId);

  function getSvgPoint(event: PointerEvent<SVGSVGElement> | PointerEvent<SVGGElement>) {
    const rect = event.currentTarget.ownerSVGElement
      ? event.currentTarget.ownerSVGElement.getBoundingClientRect()
      : event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: ((event.clientY - rect.top) / rect.height) * viewBox.height,
    };
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);

    if (mode === "marker") {
      if (!activeMarker) return;
      onMarkerMove(activeMarker.id, point);
      return;
    }

    if (mode === "move" || mode === "erase") return;

    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === "line") {
      setLineStart(point);
      setDraftPath(linePath(point, point));
      return;
    }
    setDraftPath(`M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);
    if (!draftPath) return;
    if (mode === "line" && lineStart) {
      setDraftPath(linePath(lineStart, point));
      return;
    }
    if (mode === "draw") setDraftPath((current) => `${current} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }

  function handlePointerUp() {
    if (movingMarkerId) {
      setMovingMarkerId(null);
      return;
    }
    if (!draftPath) return;
    onPathsChange([...paths, draftPath]);
    setDraftPath("");
    setLineStart(null);
  }

  return (
    <section className="rounded-lg border border-line bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToolButton active={mode === "draw"} onClick={() => setMode("draw")} icon={<Pencil size={16} />} label="手繪" />
          <ToolButton active={mode === "line"} onClick={() => setMode("line")} icon={<Slash size={16} />} label="直線" />
          <ToolButton active={mode === "marker"} onClick={() => setMode("marker")} icon={<LocateFixed size={16} />} label="標示測點" />
          <ToolButton active={mode === "move"} onClick={() => setMode("move")} icon={<Move size={16} />} label="移動測點" />
          <ToolButton active={mode === "erase"} onClick={() => setMode("erase")} icon={<Eraser size={16} />} label="橡皮擦" />
          <button
            type="button"
            onClick={() => onPathsChange(paths.slice(0, -1))}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
          >
            <RotateCcw size={16} /> 復原
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="aspect-[90/62] w-full touch-none rounded-md border border-line bg-[#fafaf6]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <pattern id="measurement-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#e7e5e4" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={viewBox.width} height={viewBox.height} fill="url(#measurement-grid)" />
        {drawablePaths.map((path, index) => (
          <path
            key={`${path}-${index}`}
            d={path}
            fill="none"
            stroke={mode === "erase" ? "#64748B" : "#202020"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={mode === "erase" ? 12 : 4}
            onPointerDown={(event) => {
              if (mode !== "erase" || index >= paths.length) return;
              event.stopPropagation();
              onPathsChange(paths.filter((_, pathIndex) => pathIndex !== index));
            }}
          />
        ))}
        {markers
          .filter((marker) => marker.x != null && marker.y != null)
          .map((marker) => (
            <g
              key={marker.id}
              className={mode === "move" ? "cursor-move" : "cursor-pointer"}
              onPointerDown={(event) => {
                event.stopPropagation();
                onActiveMarkerChange(marker.id);
                if (mode === "move") {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setMovingMarkerId(marker.id);
                }
              }}
              onPointerMove={(event) => {
                if (mode !== "move" || movingMarkerId !== marker.id) return;
                onMarkerMove(marker.id, getSvgPoint(event));
              }}
              onPointerUp={() => setMovingMarkerId(null)}
            >
              <line x1={(marker.x ?? 0) - 12} y1={marker.y} x2={(marker.x ?? 0) + 12} y2={marker.y} stroke="#c5161d" strokeWidth="3" />
              <line x1={marker.x} y1={(marker.y ?? 0) - 12} x2={marker.x} y2={(marker.y ?? 0) + 12} stroke="#c5161d" strokeWidth="3" />
              <text
                x={(marker.x ?? 0) + 14}
                y={(marker.y ?? 0) - 8}
                fill="#c5161d"
                fontSize="24"
                fontWeight="700"
              >
                {marker.label}
              </text>
              {marker.id === activeMarkerId ? <circle cx={marker.x} cy={marker.y} r="19" fill="none" stroke="#2D6A4F" strokeWidth="3" /> : null}
            </g>
          ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>先在下方表格選取一列，再用「標示測點」點在圖上；已標示測點可用「移動測點」調整。</span>
        <button
          type="button"
          onClick={() => onPathsChange([])}
          className="rounded-md border border-line bg-white px-2 py-1 font-semibold"
        >
          清空示意線
        </button>
      </div>
    </section>
  );
}

export function serializeMeasurementPlanToSvg(paths: string[], markers: MeasurementMarker[]) {
  const pathMarkup = paths
    .map((path) => `<path d="${path}" fill="none" stroke="#202020" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  const markerMarkup = markers
    .filter((marker) => marker.x != null && marker.y != null)
    .map(
      (marker) =>
        `<g><line x1="${(marker.x ?? 0) - 12}" y1="${marker.y}" x2="${(marker.x ?? 0) + 12}" y2="${marker.y}" stroke="#c5161d" stroke-width="3"/><line x1="${marker.x}" y1="${(marker.y ?? 0) - 12}" x2="${marker.x}" y2="${(marker.y ?? 0) + 12}" stroke="#c5161d" stroke-width="3"/><text x="${(marker.x ?? 0) + 14}" y="${(marker.y ?? 0) - 8}" fill="#c5161d" font-size="24" font-weight="700">${escapeXml(marker.label)}</text></g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox.width} ${viewBox.height}">${pathMarkup}${markerMarkup}</svg>`;
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
        active ? "border-accent bg-accent text-white" : "border-line bg-white"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function linePath(start: { x: number; y: number }, end: { x: number; y: number }) {
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
