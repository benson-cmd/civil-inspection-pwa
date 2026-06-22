import type { PointerEvent } from "react";
import type { InspectionPoint } from "@/types/inspection";

interface PhotoPointMarkerProps {
  point: InspectionPoint;
  active?: boolean;
  onSelect?: (pointId: string) => void;
  onMoveStart?: (pointId: string) => void;
  onMove?: (pointId: string, event: PointerEvent<SVGGElement>) => void;
  onMoveEnd?: () => void;
  onRotateStart?: (pointId: string) => void;
  onRotate?: (pointId: string, event: PointerEvent<SVGCircleElement>) => void;
  onRotateEnd?: () => void;
}

export function PhotoPointMarker({
  point,
  active = false,
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onRotateStart,
  onRotate,
  onRotateEnd,
}: PhotoPointMarkerProps) {
  const arrowLength = 34;
  const angle = (point.directionAngle * Math.PI) / 180;
  const endX = point.x + Math.cos(angle) * arrowLength;
  const endY = point.y + Math.sin(angle) * arrowLength;

  return (
    <g
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(point.id)}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onMoveStart?.(point.id);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        onMove?.(point.id, event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onMoveEnd?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect?.(point.id);
      }}
      className="cursor-pointer"
    >
      <line
        x1={point.x}
        y1={point.y}
        x2={endX}
        y2={endY}
        stroke="#c5161d"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <polygon
        points={`${endX},${endY} ${endX - Math.cos(angle - 0.5) * 12},${endY - Math.sin(angle - 0.5) * 12} ${endX - Math.cos(angle + 0.5) * 12},${endY - Math.sin(angle + 0.5) * 12}`}
        fill="#c5161d"
      />
      <circle
        cx={endX}
        cy={endY}
        r="13"
        fill={active ? "rgba(197,22,29,0.18)" : "transparent"}
        stroke={active ? "#c5161d" : "transparent"}
        strokeWidth="2"
        className="cursor-grab"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          onRotateStart?.(point.id);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onRotate?.(point.id, event);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          event.currentTarget.releasePointerCapture(event.pointerId);
          onRotateEnd?.();
        }}
      />
      <circle cx={point.x} cy={point.y} r={active ? 18 : 15} fill="#fff" stroke="#c5161d" strokeWidth="4" />
      <text
        x={point.x}
        y={point.y + 5}
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="#c5161d"
      >
        {point.photoNo}
      </text>
    </g>
  );
}
