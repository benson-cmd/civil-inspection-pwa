import type { FloorName } from "@/types/inspection";

export const defaultFloorNames: FloorName[] = ["1F", "2F", "3F", "RF"];

export function floorIdForTarget(targetId: string, floorName: FloorName) {
  return `${targetId}__floor-${floorName}`;
}

export function emptyFloorRecord<T>(): Record<FloorName, T> {
  return Object.fromEntries(defaultFloorNames.map((floorName) => [floorName, [] as T])) as Record<FloorName, T>;
}

