import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createDefaultAttachments, createDefaultSections } from "@/lib/defaults";
import type {
  AppUser,
  AttachmentSlot,
  AttachmentSevenData,
  FloorName,
  InspectionCase,
  InspectionPoint,
  NoEntryZone,
  PhotoRecord,
  Project,
  ProjectEngineer,
  ReportSection,
  ReportStatus,
  Target,
} from "@/types/inspection";

type ProjectRow = {
  id: string;
  case_no: string;
  project_name: string;
  applicant_name: string | null;
  applicant_address: string | null;
  applicant_phone: string | null;
  contact_person: string | null;
  inspection_type: string | null;
  inspection_date: string | null;
  report_status: string | null;
  received_date: string | null;
  received_no: string | null;
  target_summary: string | null;
  engineer_names: string | null;
  association_engineers: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  ci_targets?: TargetRow[];
  ci_report_sections?: ReportSectionRow[];
  ci_attachments?: AttachmentRow[];
};

type TargetRow = {
  id: string;
  project_id: string;
  address: string;
  usage_type: string | null;
  wall_finish: string | null;
  ceiling_finish: string | null;
  floor_finish: string | null;
  survey_status: string | null;
  note: string | null;
  ci_floors?: FloorRow[];
};

type FloorRow = {
  id: string;
  target_id: string;
  floor_name: FloorName;
  plan_svg_or_json: string[] | null;
  no_entry_zones: NoEntryZone[] | null;
  ci_inspection_points?: InspectionPointRow[];
};

type InspectionPointRow = {
  id: string;
  floor_id: string;
  photo_no: string;
  x: number | string;
  y: number | string;
  direction_angle: number | string;
  component_type: InspectionPoint["componentType"] | null;
  condition_type: InspectionPoint["conditionType"] | null;
  crack_width_mm: number | string | null;
  note: string | null;
  created_at: string;
  ci_photos?: PhotoRow[];
};

type PhotoRow = {
  id: string;
  point_id: string;
  image_url: string;
  caption: string | null;
  taken_at: string;
};

type ReportSectionRow = {
  section_order: number;
  title: string;
  content: string | null;
  source: ReportSection["source"];
  fixed_title: boolean;
};

type AttachmentRow = {
  attachment_no: number;
  title: string;
  mode: AttachmentSlot["mode"];
  status: AttachmentSlot["status"];
  file_path: string | null;
};

const sectionIdsByOrder = [
  "applicant",
  "application-date",
  "target-location",
  "purpose",
  "basis",
  "inspection-dates",
  "staff",
  "process",
  "site-status",
  "target-status",
  "attachments",
];

export function appUserFromSupabaseUser(user: User): AppUser {
  return {
    id: user.id,
    name: user.user_metadata?.name ?? user.email ?? "Google 使用者",
    email: user.email ?? "",
    role: "admin",
  };
}

export async function ensureProfile(supabase: SupabaseClient, user: AppUser) {
  const { error } = await supabase.from("ci_profiles").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function fetchInspectionCases(supabase: SupabaseClient, userId: string): Promise<InspectionCase[]> {
  const { data, error } = await supabase
    .from("ci_projects")
    .select("*, ci_targets(*, ci_floors(*, ci_inspection_points(*, ci_photos(*)))), ci_report_sections(*), ci_attachments(*)")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as ProjectRow[]).map((row) => projectRowToCase(row, userId));
}

export async function saveInspectionCase(supabase: SupabaseClient, inspectionCase: InspectionCase) {
  const project = inspectionCase.project;
  const now = new Date().toISOString();

  const projectPayload = {
    id: project.id,
    case_no: project.caseNo,
    project_name: project.projectName,
    applicant_name: project.applicantName,
    applicant_address: project.applicantAddress ?? "",
    applicant_phone: project.applicantPhone ?? "",
    contact_person: project.contactPerson ?? "",
    inspection_type: project.inspectionType,
    inspection_date: project.inspectionDate || null,
    report_status: project.reportStatus ?? "草稿",
    received_date: project.receivedDate || null,
    received_no: project.receivedNo ?? "",
    target_summary: project.targetSummary ?? "",
    engineer_names: JSON.stringify(project.engineers ?? []),
    association_engineers: project.associationEngineers ?? "",
    owner_id: inspectionCase.createdByUserId,
    updated_at: now,
  };

  const { error: projectError } = await supabase.from("ci_projects").upsert(projectPayload, { onConflict: "id" });

  if (projectError) {
    if (String(projectError.message).includes("report_status")) {
      const { report_status: _reportStatus, ...legacyProjectPayload } = projectPayload;
      const { error: legacyProjectError } = await supabase.from("ci_projects").upsert(legacyProjectPayload, { onConflict: "id" });
      if (legacyProjectError) throw legacyProjectError;
    } else {
      throw projectError;
    }
  }

  const { error: memberError } = await supabase.from("ci_project_members").upsert(
    {
      project_id: project.id,
      user_id: inspectionCase.createdByUserId,
      role: "admin",
    },
    { onConflict: "project_id,user_id" },
  );

  if (memberError) throw memberError;

  const { error: targetError } = await supabase.from("ci_targets").upsert(
    {
      id: inspectionCase.target.id,
      project_id: project.id,
      address: inspectionCase.target.address,
      usage_type: inspectionCase.target.usageType,
      wall_finish: inspectionCase.target.wallFinish,
      ceiling_finish: inspectionCase.target.ceilingFinish,
      floor_finish: inspectionCase.target.floorFinish,
      survey_status: inspectionCase.target.surveyStatus,
      note: inspectionCase.target.note,
    },
    { onConflict: "id" },
  );

  if (targetError) throw targetError;

  await saveAttachmentSevenData(supabase, inspectionCase);

  const sectionRows = inspectionCase.reportSections.map((section) => ({
    project_id: project.id,
    section_order: section.order,
    title: section.title,
    content: section.content,
    source: section.source,
    fixed_title: section.fixedTitle,
    updated_at: now,
  }));

  const { error: sectionsError } = await supabase
    .from("ci_report_sections")
    .upsert(sectionRows, { onConflict: "project_id,section_order" });

  if (sectionsError) throw sectionsError;

  const attachmentRows = inspectionCase.attachments.map((slot) => ({
    project_id: project.id,
    attachment_no: slot.no,
    title: slot.title,
    mode: slot.mode,
    status: slot.status,
    file_path: slot.fileName ?? null,
    updated_at: now,
  }));

  const { error: attachmentsError } = await supabase
    .from("ci_attachments")
    .upsert(attachmentRows, { onConflict: "project_id,attachment_no" });

  if (attachmentsError) throw attachmentsError;
}

async function saveAttachmentSevenData(supabase: SupabaseClient, inspectionCase: InspectionCase) {
  const data = inspectionCase.attachmentSeven;
  if (!data) return;

  const targets = data.targets.length ? data.targets : [inspectionCase.target];
  const targetRows = targets.map((target) => ({
    id: target.id,
    project_id: inspectionCase.project.id,
    address: target.address,
    usage_type: target.usageType,
    wall_finish: target.wallFinish,
    ceiling_finish: target.ceilingFinish,
    floor_finish: target.floorFinish,
    survey_status: target.surveyStatus,
    note: target.note,
  }));

  const { error: targetsError } = await supabase.from("ci_targets").upsert(targetRows, { onConflict: "id" });
  if (targetsError) throw targetsError;

  const targetIds = targets.map((target) => target.id);
  const { data: existingTargets } = await supabase.from("ci_targets").select("id").eq("project_id", inspectionCase.project.id);
  const staleTargetIds = ((existingTargets ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !targetIds.includes(id));
  if (staleTargetIds.length) {
    const { error } = await supabase.from("ci_targets").delete().in("id", staleTargetIds);
    if (error) throw error;
  }

  const floorRows = targets.flatMap((target) =>
    floorNames.map((floorName) => ({
      id: floorIdForTarget(target.id, floorName),
      target_id: target.id,
      floor_name: floorName,
      plan_svg_or_json: data.plansByTargetFloor[target.id]?.[floorName] ?? [],
      no_entry_zones: data.noEntryZonesByTargetFloor[target.id]?.[floorName] ?? [],
    })),
  );

  const { error: floorsError } = await supabase.from("ci_floors").upsert(floorRows, { onConflict: "id" });
  if (floorsError) throw floorsError;

  const pointRows = data.points.map((point) => ({
    id: point.id,
    floor_id: point.floorId,
    photo_no: point.photoNo,
    x: point.x,
    y: point.y,
    direction_angle: point.directionAngle,
    component_type: point.componentType,
    condition_type: point.conditionType,
    crack_width_mm: point.crackWidthMm ?? null,
    note: point.note,
    created_at: point.createdAt,
  }));

  if (pointRows.length) {
    const { error: pointsError } = await supabase.from("ci_inspection_points").upsert(pointRows, { onConflict: "id" });
    if (pointsError) throw pointsError;
  }

  const floorIds = floorRows.map((floor) => floor.id);
  const { data: existingPoints } = await supabase.from("ci_inspection_points").select("id").in("floor_id", floorIds);
  const currentPointIds = data.points.map((point) => point.id);
  const stalePointIds = ((existingPoints ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !currentPointIds.includes(id));
  if (stalePointIds.length) {
    const { error } = await supabase.from("ci_inspection_points").delete().in("id", stalePointIds);
    if (error) throw error;
  }

  const photoRows = data.points
    .filter((point) => point.photo?.imageUrl)
    .map((point) => ({
      id: point.photo?.id,
      point_id: point.id,
      image_url: point.photo?.imageUrl ?? "",
      caption: point.photo?.caption ?? "",
      taken_at: point.photo?.takenAt ?? new Date().toISOString(),
    }));

  if (photoRows.length) {
    const { error: photosError } = await supabase.from("ci_photos").upsert(photoRows, { onConflict: "id" });
    if (photosError) throw photosError;
  }
}

function projectRowToCase(row: ProjectRow, userId: string): InspectionCase {
  const project: Project = {
    id: row.id,
    caseNo: row.case_no,
    projectName: row.project_name,
    applicantName: row.applicant_name ?? "",
    applicantAddress: row.applicant_address ?? "",
    applicantPhone: row.applicant_phone ?? "",
    contactPerson: row.contact_person ?? "",
    inspectionType: row.inspection_type ?? "",
    inspectionDate: row.inspection_date ?? "",
    reportStatus: normalizeReportStatus(row.report_status),
    receivedDate: row.received_date ?? "",
    receivedNo: row.received_no ?? "",
    targetSummary: row.target_summary ?? "",
    engineers: parseEngineers(row.engineer_names),
    engineerNames: "",
    associationEngineers: row.association_engineers ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const targetRow = row.ci_targets?.[0];
  const target: Target = targetRow
    ? {
        id: targetRow.id,
        projectId: targetRow.project_id,
        address: targetRow.address,
        usageType: targetRow.usage_type ?? "住宅",
        wallFinish: targetRow.wall_finish ?? "油漆",
        ceilingFinish: targetRow.ceiling_finish ?? "其他",
        floorFinish: targetRow.floor_finish ?? "其他",
        surveyStatus: targetRow.survey_status ?? "",
        note: targetRow.note ?? "",
      }
    : {
        id: crypto.randomUUID(),
        projectId: project.id,
        address: "",
        usageType: "住宅",
        wallFinish: "油漆",
        ceilingFinish: "其他",
        floorFinish: "其他",
        surveyStatus: "",
        note: "",
      };

  const attachmentSeven = buildAttachmentSevenData(row, target);
  const reportSections = mergeReportSections(project, row.ci_report_sections ?? []);
  const attachments = mergeAttachments(row.ci_attachments ?? []);

  return {
    id: row.id,
    project,
    target,
    attachmentSeven,
    reportSections,
    attachments,
    createdByUserId: row.owner_id || userId,
    updatedAt: row.updated_at,
  };
}

function buildAttachmentSevenData(row: ProjectRow, fallbackTarget: Target): AttachmentSevenData {
  const targets = row.ci_targets?.length
    ? row.ci_targets.map(targetRowToTarget)
    : [fallbackTarget];
  const plansByTargetFloor: AttachmentSevenData["plansByTargetFloor"] = {};
  const noEntryZonesByTargetFloor: AttachmentSevenData["noEntryZonesByTargetFloor"] = {};
  const points: InspectionPoint[] = [];

  const floors = (row.ci_targets ?? []).flatMap((target) => target.ci_floors ?? []);

  for (const floor of floors) {
    if (!plansByTargetFloor[floor.target_id]) plansByTargetFloor[floor.target_id] = emptyFloorRecord<string[]>();
    if (!noEntryZonesByTargetFloor[floor.target_id]) noEntryZonesByTargetFloor[floor.target_id] = emptyFloorRecord<NoEntryZone[]>();

    plansByTargetFloor[floor.target_id][floor.floor_name] = Array.isArray(floor.plan_svg_or_json) ? floor.plan_svg_or_json : [];
    noEntryZonesByTargetFloor[floor.target_id][floor.floor_name] = Array.isArray(floor.no_entry_zones) ? floor.no_entry_zones : [];

    for (const point of floor.ci_inspection_points ?? []) {
      points.push(inspectionPointRowToPoint(point));
    }
  }

  return {
    targets,
    plansByTargetFloor,
    noEntryZonesByTargetFloor,
    points,
  };
}

function targetRowToTarget(row: TargetRow): Target {
  return {
    id: row.id,
    projectId: row.project_id,
    address: row.address,
    usageType: row.usage_type ?? "住宅",
    wallFinish: row.wall_finish ?? "油漆",
    ceilingFinish: row.ceiling_finish ?? "其他",
    floorFinish: row.floor_finish ?? "其他",
    surveyStatus: row.survey_status ?? "",
    note: row.note ?? "",
  };
}

function inspectionPointRowToPoint(row: InspectionPointRow): InspectionPoint {
  const photoRow = row.ci_photos?.[0];
  return {
    id: row.id,
    floorId: row.floor_id,
    photoNo: row.photo_no,
    x: Number(row.x),
    y: Number(row.y),
    directionAngle: Number(row.direction_angle),
    componentType: row.component_type ?? [],
    conditionType: row.condition_type ?? [],
    crackWidthMm: row.crack_width_mm == null ? undefined : Number(row.crack_width_mm),
    note: row.note ?? "",
    photo: photoRow ? photoRowToRecord(photoRow) : undefined,
    createdAt: row.created_at,
  };
}

function photoRowToRecord(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    pointId: row.point_id,
    imageUrl: row.image_url,
    caption: row.caption ?? "",
    takenAt: row.taken_at,
  };
}

function mergeReportSections(project: Project, rows: ReportSectionRow[]): ReportSection[] {
  const defaults = createDefaultSections(project);
  return defaults.map((defaultSection) => {
    const row = rows.find((item) => item.section_order === defaultSection.order);
    if (!row) return defaultSection;
    return {
      ...defaultSection,
      id: sectionIdsByOrder[row.section_order - 1] ?? defaultSection.id,
      title: row.title,
      content: row.content ?? "",
      source: row.source ?? defaultSection.source,
      fixedTitle: row.fixed_title,
    };
  });
}

function mergeAttachments(rows: AttachmentRow[]): AttachmentSlot[] {
  return createDefaultAttachments().map((defaultSlot) => {
    const row = rows.find((item) => item.attachment_no === defaultSlot.no);
    if (!row) return defaultSlot;
    return {
      ...defaultSlot,
      title: row.title,
      mode: row.mode,
      status: row.status,
      fileName: row.file_path ?? undefined,
    };
  });
}

function parseEngineers(value: string | null): ProjectEngineer[] {
  if (!value) return [{ id: crypto.randomUUID(), name: "", memberNo: "" }];

  try {
    const parsed = JSON.parse(value) as ProjectEngineer[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // Older rows may contain names separated by "、".
  }

  const legacy = value
    .split("、")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: crypto.randomUUID(), name, memberNo: "" }));

  return legacy.length ? legacy : [{ id: crypto.randomUUID(), name: "", memberNo: "" }];
}

function normalizeReportStatus(value: string | null): ReportStatus {
  if (value === "審閱中" || value === "待補件" || value === "完稿" || value === "已歸檔") return value;
  return "草稿";
}

const floorNames: FloorName[] = ["1F", "2F", "3F", "RF"];

function floorIdForTarget(targetId: string, floorName: FloorName) {
  return `${targetId}__floor-${floorName}`;
}

function emptyFloorRecord<T>(): Record<FloorName, T> {
  return {
    "1F": [] as T,
    "2F": [] as T,
    "3F": [] as T,
    RF: [] as T,
  };
}
