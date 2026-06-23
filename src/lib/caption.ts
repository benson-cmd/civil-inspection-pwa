import type { ComponentType, ConditionType } from "@/types/inspection";

export function buildPhotoCaption(input: {
  componentType: ComponentType[];
  conditionType: ConditionType[];
  crackWidthMm?: number;
  inaccessible?: boolean;
  note?: string;
}) {
  if (input.inaccessible) {
    const note = input.note?.trim() ? `；${input.note.trim()}` : "";
    return `不便進入／拍照${note}`;
  }

  const component = input.componentType.join("、") || "未註明構件";
  const condition = input.conditionType.join("、") || "未註明現況";
  const crack = input.conditionType.includes("裂縫") && input.crackWidthMm
    ? `，裂縫寬 ${input.crackWidthMm}mm`
    : "";
  const note = input.note?.trim() ? `；${input.note.trim()}` : "";

  return `${component}${condition}${crack}${note}`;
}

export function nextPhotoNo(existingPhotoNos: string[]) {
  const max = existingPhotoNos
    .map((photoNo) => Number(photoNo.replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value))
    .reduce((highest, value) => Math.max(highest, value), 0);

  return String(max + 1).padStart(2, "0");
}
