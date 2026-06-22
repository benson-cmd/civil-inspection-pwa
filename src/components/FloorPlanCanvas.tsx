"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Eraser, LocateFixed, Magnet, Move, Pencil, RotateCcw, RotateCw, Slash, X } from "lucide-react";
import type { InspectionPoint, NoEntryZone } from "@/types/inspection";
import { PhotoPointMarker } from "./PhotoPointMarker";

interface FloorPlanCanvasProps {
  activeMode?: Mode;
  points: InspectionPoint[];
  activePointId?: string;
  planPaths: string[];
  noEntryZones: NoEntryZone[];
  onPlanChange: (paths: string[]) => void;
  onNoEntryZonesChange: (zones: NoEntryZone[]) => void;
  onAddPoint: (position: { x: number; y: number }) => void;
  onMovePoint: (pointId: string, position: { x: number; y: number }) => void;
  onRotatePoint: (pointId: string, directionAngle: number) => void;
  onSelectPoint: (pointId: string) => void;
  onClearPlan: () => void;
  onUndoPlan: () => void;
  onModeChange?: (mode: Mode) => void;
}

export type FloorPlanMode = "draw" | "line" | "erase" | "photo" | "move" | "noEntry";
type Mode = FloorPlanMode;

const viewBox = { width: 900, height: 620 };

export function FloorPlanCanvas({
  activeMode,
  points,
  activePointId,
  planPaths,
  noEntryZones = [],
  onPlanChange,
  onNoEntryZonesChange,
  onAddPoint,
  onMovePoint,
  onRotatePoint,
  onSelectPoint,
  onClearPlan,
  onUndoPlan,
  onModeChange,
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mode, setMode] = useState<Mode>("line");
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [draftPath, setDraftPath] = useState("");
  const [draftNoEntryZone, setDraftNoEntryZone] = useState<NoEntryZone | null>(null);
  const [movingPointId, setMovingPointId] = useState<string | null>(null);
  const [rotatingPointId, setRotatingPointId] = useState<string | null>(null);
  const [snapLine, setSnapLine] = useState(false);
  const [draggingNoEntryCorner, setDraggingNoEntryCorner] = useState<{ zoneId: string; cornerIndex: number } | null>(null);

  const allPaths = useMemo(() => (draftPath ? [...planPaths, draftPath] : planPaths), [draftPath, planPaths]);

  useEffect(() => {
    if (activeMode && activeMode !== mode) setMode(activeMode);
  }, [activeMode, mode]);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  function getSvgPoint(event: PointerEvent<SVGSVGElement> | PointerEvent<SVGGElement>) {
    return getSvgPointFromClient(event.clientX, event.clientY);
  }

  function getSvgPointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * viewBox.width,
      y: ((clientY - rect.top) / rect.height) * viewBox.height,
    };
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);
    if (mode === "photo") {
      onAddPoint(point);
      return;
    }

    if (mode === "move" || mode === "erase") return;

    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === "noEntry") {
      setLineStart(point);
      setDraftNoEntryZone(buildNoEntryZone("draft", point, point));
      return;
    }

    if (mode === "line") {
      const snappedStart = snapToExistingGeometry(point, planPaths, null);
      setLineStart(snappedStart);
      setDraftPath(buildLinePath(snappedStart, snappedStart));
      return;
    }

    setDraftPath(`M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);

    if (draggingNoEntryCorner) {
      onNoEntryZonesChange(
        noEntryZones.map((zone) =>
          zone.id === draggingNoEntryCorner.zoneId
            ? zoneFromCorners(
                zone.id,
                noEntryCorners(zone).map((corner, index) =>
                  index === draggingNoEntryCorner.cornerIndex ? point : corner,
                ),
              )
            : zone,
        ),
      );
      return;
    }

    if (mode === "noEntry" && lineStart && draftNoEntryZone) {
      setDraftNoEntryZone(buildNoEntryZone("draft", lineStart, point));
      return;
    }

    if (!draftPath) return;

    if (mode === "line" && lineStart) {
      const rawEnd = snapLine ? snapToEightDirections(lineStart, point) : point;
      const snappedEnd = snapToExistingGeometry(rawEnd, planPaths, lineStart);
      setDraftPath(buildLinePath(lineStart, snappedEnd));
      return;
    }

    if (mode === "draw") {
      setDraftPath((current) => `${current} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
    }
  }

  function handlePointerUp() {
    if (rotatingPointId) {
      setRotatingPointId(null);
      return;
    }

    if (draggingNoEntryCorner) {
      setDraggingNoEntryCorner(null);
      return;
    }

    if (movingPointId) {
      setMovingPointId(null);
      return;
    }

    if (mode === "noEntry" && draftNoEntryZone) {
      const zone = normalizeNoEntryZone(draftNoEntryZone);
      if (zone.width > 8 && zone.height > 8) {
        onNoEntryZonesChange([...noEntryZones, { ...zone, id: crypto.randomUUID() }]);
      }
      setDraftNoEntryZone(null);
      setLineStart(null);
      return;
    }

    if (!draftPath) return;
    onPlanChange([...planPaths, draftPath]);
    setDraftPath("");
    setLineStart(null);
  }

  return (
    <section className="workspace-panel rounded-lg border border-line bg-paper p-3 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">平面圖與照片位置</h2>
          <p className="text-sm text-muted">先畫示意格局，再切換「照片點位」點選拍照位置。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-nowrap items-center gap-2">
            <span className="text-xs font-bold text-muted">繪圖</span>
            <button
              type="button"
              onClick={() => changeMode("draw")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                mode === "draw" ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <Pencil size={18} /> 自由手繪
            </button>
            <button
              type="button"
              onClick={() => changeMode("line")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                mode === "line" ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <Slash size={18} /> 直線/斜線
            </button>
            <button
              type="button"
              onClick={() => changeMode("noEntry")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                mode === "noEntry" ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <X size={18} /> 不便進入
            </button>
          </div>
          <div className="h-8 w-px self-center bg-line mx-1" />
          <div className="flex flex-nowrap items-center gap-2">
            <span className="text-xs font-bold text-muted">輔助</span>
            <button
              type="button"
              onClick={() => setSnapLine((current) => !current)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                snapLine ? "border-accent bg-[#f5f5f4] text-accent" : "border-line bg-white"
              }`}
            >
              <Magnet size={18} /> {snapLine ? "吸附開" : "吸附關"}
            </button>
          </div>
          <div className="h-8 w-px self-center bg-line mx-1" />
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-muted">操作</span>
            <button
              type="button"
              onClick={() => changeMode("photo")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                mode === "photo" ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <LocateFixed size={18} /> 照片點位
            </button>
            <button
              type="button"
              onClick={() => changeMode("move")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                mode === "move" ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <Move size={18} /> 移動點位
            </button>
            <button
              type="button"
              onClick={() => changeMode("erase")}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                mode === "erase" ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <Eraser size={18} /> 橡皮擦
            </button>
            <button
              type="button"
              onClick={onUndoPlan}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
            >
              <RotateCcw size={18} /> 復原上一步
            </button>
            <button
              type="button"
              onClick={onClearPlan}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
            >
              <Eraser size={18} /> 全部清空
            </button>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="aspect-[90/62] w-full touch-none rounded-md border border-line bg-[#fafaf6]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#e7e5e4" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={viewBox.width} height={viewBox.height} fill="url(#grid)" />
        {allPaths.map((path, index) => (
          <path
            key={`${path}-${index}`}
            d={path}
            fill="none"
            stroke={mode === "erase" ? "#64748B" : "#202020"}
            strokeWidth={mode === "erase" ? 12 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={mode === "erase" ? "cursor-crosshair" : ""}
            onPointerDown={(event) => {
              if (mode !== "erase" || index >= planPaths.length) return;
              event.stopPropagation();
              onPlanChange(planPaths.filter((_, pathIndex) => pathIndex !== index));
            }}
          />
        ))}
        {[...noEntryZones, ...(draftNoEntryZone ? [normalizeNoEntryZone(draftNoEntryZone)] : [])].map((zone) => (
          <g
            key={zone.id}
            className={mode === "erase" ? "cursor-crosshair" : ""}
            onPointerDown={(event) => {
              if (mode !== "erase" || zone.id === "draft") return;
              event.stopPropagation();
              onNoEntryZonesChange(noEntryZones.filter((item) => item.id !== zone.id));
            }}
          >
            <polygon
              points={noEntryCorners(zone).map((point) => `${point.x},${point.y}`).join(" ")}
              fill="rgba(255,255,255,0.45)"
              stroke="#ff2a2a"
              strokeWidth="2"
            />
            {buildNoEntryXLines(zone).map((line, lineIndex) => (
              <line
                key={lineIndex}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#ff2a2a"
                strokeWidth="2"
              />
            ))}
            {mode === "noEntry" && zone.id !== "draft"
              ? noEntryCorners(zone).map((corner, cornerIndex) => (
                  <circle
                    key={cornerIndex}
                    cx={corner.x}
                    cy={corner.y}
                    r="10"
                    fill="#ffffff"
                    stroke="#ff2a2a"
                    strokeWidth="3"
                    className="cursor-move"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggingNoEntryCorner({ zoneId: zone.id, cornerIndex });
                    }}
                  />
                ))
              : null}
          </g>
        ))}
        {points.map((point) => (
          <PhotoPointMarker
            key={point.id}
            point={point}
            active={point.id === activePointId}
            onSelect={onSelectPoint}
            onMoveStart={(pointId) => {
              onSelectPoint(pointId);
              if (mode === "move") setMovingPointId(pointId);
            }}
            onMove={(pointId, event) => {
              if (mode !== "move" || movingPointId !== pointId) return;
              onMovePoint(pointId, getSvgPoint(event));
            }}
            onMoveEnd={() => setMovingPointId(null)}
            onRotateStart={(pointId) => {
              onSelectPoint(pointId);
              setRotatingPointId(pointId);
            }}
            onRotate={(pointId, event) => {
              if (rotatingPointId !== pointId) return;
              const rotatingPoint = points.find((point) => point.id === pointId);
              if (!rotatingPoint) return;
              const pointer = getSvgPointFromClient(event.clientX, event.clientY);
              const angle = normalizeAngle((Math.atan2(pointer.y - rotatingPoint.y, pointer.x - rotatingPoint.x) * 180) / Math.PI);
              onRotatePoint(pointId, angle);
            }}
            onRotateEnd={() => setRotatingPointId(null)}
          />
        ))}
      </svg>

      <div className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-3">
        <div className="inline-flex items-center gap-2">
          <Slash size={16} /> 直線/斜線預設自由角度，需要水平/垂直/45 度時可打開吸附。
        </div>
        <div className="inline-flex items-center gap-2">
          <Eraser size={16} /> 橡皮擦模式可點選單一筆線條或 X 區域刪除。
        </div>
        <div className="inline-flex items-center gap-2">
          <RotateCw size={16} /> 不便進入模式可拖曳 X 區域四個角點調整形狀。
        </div>
      </div>
    </section>
  );
}

function normalizeAngle(angle: number) {
  return Math.round((angle + 360) % 360);
}

function buildLinePath(start: { x: number; y: number }, end: { x: number; y: number }) {
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function buildNoEntryZone(id: string, start: { x: number; y: number }, end: { x: number; y: number }): NoEntryZone {
  return zoneFromCorners(id, [
    { x: start.x, y: start.y },
    { x: end.x, y: start.y },
    { x: end.x, y: end.y },
    { x: start.x, y: end.y },
  ]);
}

function normalizeNoEntryZone(zone: NoEntryZone): NoEntryZone {
  return zoneFromCorners(zone.id, noEntryCorners(zone));
}

function zoneFromCorners(id: string, points: Array<{ x: number; y: number }>): NoEntryZone {
  const normalizedPoints = orderNoEntryCorners(points);
  const xs = normalizedPoints.map((point) => point.x);
  const ys = normalizedPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points: normalizedPoints,
  };
}

function noEntryCorners(zone: NoEntryZone) {
  if (zone.points?.length === 4) return zone.points;
  const x1 = zone.width < 0 ? zone.x + zone.width : zone.x;
  const y1 = zone.height < 0 ? zone.y + zone.height : zone.y;
  const x2 = x1 + Math.abs(zone.width);
  const y2 = y1 + Math.abs(zone.height);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function orderNoEntryCorners(points: Array<{ x: number; y: number }>) {
  if (points.length !== 4) return points;
  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };

  return [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
}

function buildNoEntryXLines(zone: NoEntryZone) {
  const corners = noEntryCorners(zone);
  return [
    { x1: corners[0].x, y1: corners[0].y, x2: corners[2].x, y2: corners[2].y },
    { x1: corners[1].x, y1: corners[1].y, x2: corners[3].x, y2: corners[3].y },
  ];
}

function snapToExistingGeometry(
  point: { x: number; y: number },
  paths: string[],
  lineStart: { x: number; y: number } | null,
) {
  const snapDistance = 20;
  const segments = paths.flatMap(parsePathSegments);
  const endpoints = segments.flatMap((segment) => [segment.start, segment.end]);

  if (lineStart) {
    const draft = { start: lineStart, end: point };
    for (const segment of segments) {
      const intersection = getSegmentIntersection(draft.start, draft.end, segment.start, segment.end);
      if (intersection && distance(point, intersection) <= snapDistance * 1.6) {
        return intersection;
      }
    }
  }

  const nearest = endpoints
    .map((candidate) => ({ candidate, distance: distance(point, candidate) }))
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest && nearest.distance <= snapDistance ? nearest.candidate : point;
}

function parsePathSegments(path: string) {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index < numbers.length - 1; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }

  const segments: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({ start: points[index], end: points[index + 1] });
  }
  return segments;
}

function getSegmentIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
) {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denominator) < 0.001) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function snapToEightDirections(start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return end;

  const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: start.x + Math.cos(snappedAngle) * distance,
    y: start.y + Math.sin(snappedAngle) * distance,
  };
}

export function serializePlanToSvg(paths: string[], points: InspectionPoint[], noEntryZones: NoEntryZone[] = []) {
  const pathMarkup = paths
    .map((path) => `<path d="${path}" fill="none" stroke="#202020" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  const noEntryMarkup = noEntryZones
    .map((zone) => {
      const corners = noEntryCorners(zone);
      const polygonPoints = corners.map((point) => `${point.x},${point.y}`).join(" ");
      const lines = buildNoEntryXLines(zone)
        .map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#ff2a2a" stroke-width="2"/>`)
        .join("");
      return `<g><polygon points="${polygonPoints}" fill="rgba(255,255,255,0.45)" stroke="#ff2a2a" stroke-width="2"/>${lines}</g>`;
    })
    .join("");
  const markerMarkup = points
    .map((point) => {
      const angle = (point.directionAngle * Math.PI) / 180;
      const endX = point.x + Math.cos(angle) * 34;
      const endY = point.y + Math.sin(angle) * 34;
      return `<g><line x1="${point.x}" y1="${point.y}" x2="${endX}" y2="${endY}" stroke="#c5161d" stroke-width="4" stroke-linecap="round"/><circle cx="${point.x}" cy="${point.y}" r="15" fill="#fff" stroke="#c5161d" stroke-width="4"/><text x="${point.x}" y="${point.y + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#c5161d">${point.photoNo}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox.width} ${viewBox.height}">${pathMarkup}${noEntryMarkup}${markerMarkup}</svg>`;
}
