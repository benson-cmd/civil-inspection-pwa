import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createDefaultAttachments, createDefaultSections } from "@/lib/defaults";
import { defaultFloorNames, emptyFloorRecord, floorIdForTarget } from "@/lib/floors";
import type {
  AppUser,
  AttachmentSlot,
  AttachmentSevenData,
  FloorPlan,
  FloorPlanData,
  FloorName,
  InspectionCase,
  InspectionPoint,
  LevelMeasurement,
  NoEntryZone,
  PhotoRecord,
  Project,
  ProjectEngineer,
  ReportSection,
  ReportStatus,
  SitePhoto,
  SurveyDate,
  Target,
  TargetListItem,
  TiltMeasurement,
} from "@/types/inspection";

type ProjectRow = {
  id: string;
  case_no: string;
  project_name: string;
  work_name: string | null;
  applicant_name: string | null;
  applicant_address: string | null;
  applicant_phone: string | null;
  contact_person: string | null;
  inspection_type: string | null;
  inspection_date: string | null;
  report_status: string | null;
  received_date: string | null;
  received_no: string | null;
  final_date: string | null;
  target_summary: string | null;
  survey_dates: SurveyDate[] | null;
  county_city: string | null;
  site_status_note: string | null;
  process_note: string | null;
  target_list: TargetListItem[] | null;
  engineer_names: string | null;
  association_engineers: string | null;
  level_plan_paths?: string[] | null;
  tilt_plan_paths?: string[] | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  ci_targets?: TargetRow[];
  ci_report_sections?: ReportSectionRow[];
  ci_attachments?: AttachmentRow[];
  ci_site_photos?: SitePhotoRow[];
  ci_level_measurements?: LevelMeasurementRow[];
  ci_tilt_measurements?: TiltMeasurementRow[];
};

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  role: AppUser["role"];
};

type AllowedUserRow = {
  email: string;
  name: string | null;
  role: AppUser["role"];
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
  plan_svg_or_json: FloorPlanData | null;
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
  inaccessible: boolean | null;
  note: string | null;
  created_at: string;
  ci_photos?: PhotoRow[];
};

type PhotoRow = {
  id: string;
  point_id: string;
  image_url: string;
  storage_path: string | null;
  caption: string | null;
  taken_at: string;
};

type SitePhotoRow = {
  id: string;
  project_id: string;
  photo_no: string;
  image_url: string;
  storage_path: string | null;
  caption: string | null;
  note: string | null;
  taken_at: string;
};

type LevelMeasurementRow = {
  id: string;
  point_no: string | null;
  location: string | null;
  measurement_date: string | null;
  relative_elevation: number | string | null;
  initial_elevation: number | string | null;
  repeat_elevation: number | string | null;
  x: number | string | null;
  y: number | string | null;
  image_url: string | null;
  storage_path: string | null;
  caption: string | null;
  taken_at: string | null;
  note: string | null;
  row_order: number | null;
};

type TiltMeasurementRow = {
  id: string;
  line_no: string | null;
  location: string | null;
  direction: TiltMeasurement["direction"] | null;
  measurement_date: string | null;
  x: number | string | null;
  y: number | string | null;
  upper_distance: number | string | null;
  lower_distance: number | string | null;
  floor_height: number | string | null;
  upper_image_url: string | null;
  upper_storage_path: string | null;
  upper_caption: string | null;
  upper_taken_at: string | null;
  lower_image_url: string | null;
  lower_storage_path: string | null;
  lower_caption: string | null;
  lower_taken_at: string | null;
  note: string | null;
  row_order: number | null;
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
  "survey-dates",
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
    role: "user",
  };
}

export async function resolveSignedInAppUser(supabase: SupabaseClient, user: User): Promise<AppUser> {
  const baseUser = appUserFromSupabaseUser(user);
  const allowedUser = await fetchAllowedUserByEmail(supabase, baseUser.email);

  if (!allowedUser.allowed) {
    throw new Error("此 Google 帳戶尚未被管理者加入使用者名單。");
  }

  const nextUser = {
    ...baseUser,
    name: allowedUser.user?.name || baseUser.name,
    role: allowedUser.user?.role ?? baseUser.role,
  };

  await ensureProfile(supabase, nextUser);

  const { data } = await supabase
    .from("ci_profiles")
    .select("id, email, name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as ProfileRow | null;
  return profile
    ? {
        id: profile.id,
        email: profile.email,
        name: profile.name || profile.email,
        role: profile.role,
      }
    : nextUser;
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

export async function fetchManagedUsers(supabase: SupabaseClient, currentUser: AppUser): Promise<AppUser[]> {
  const { data: allowedRows, error: allowedError } = await supabase
    .from("ci_allowed_users")
    .select("email, name, role")
    .order("created_at", { ascending: true });

  if (allowedError && !isMissingTableError(allowedError)) throw allowedError;

  const { data: profileRows, error: profileError } = await supabase
    .from("ci_profiles")
    .select("id, email, name, role")
    .order("created_at", { ascending: true });

  if (profileError) throw profileError;

  const profiles = ((profileRows ?? []) as ProfileRow[]).map(profileRowToAppUser);
  const profileByEmail = new Map(profiles.map((profile) => [profile.email.toLowerCase(), profile]));

  if (allowedError && isMissingTableError(allowedError)) {
    return profiles.length ? profiles : [currentUser];
  }

  const allowedUsers = ((allowedRows ?? []) as AllowedUserRow[]).map((row) => {
    const profile = profileByEmail.get(row.email.toLowerCase());
    return {
      id: profile?.id ?? `pending-${row.email.toLowerCase()}`,
      email: row.email.toLowerCase(),
      name: row.name || profile?.name || row.email,
      role: row.role,
    };
  });

  return upsertManagedUserList(allowedUsers, currentUser);
}

export async function saveManagedUser(supabase: SupabaseClient, user: AppUser, previousEmail?: string) {
  const normalizedEmail = user.email.trim().toLowerCase();
  const normalizedUser = {
    ...user,
    email: normalizedEmail,
    name: user.name.trim() || normalizedEmail,
  };

  const { error: allowedError } = await supabase.from("ci_allowed_users").upsert(
    {
      email: normalizedUser.email,
      name: normalizedUser.name,
      role: normalizedUser.role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  if (allowedError && !isMissingTableError(allowedError)) throw allowedError;

  if (previousEmail && previousEmail.toLowerCase() !== normalizedUser.email && !(allowedError && isMissingTableError(allowedError))) {
    const { error } = await supabase.from("ci_allowed_users").delete().eq("email", previousEmail.toLowerCase());
    if (error) throw error;
  }

  if (!normalizedUser.id.startsWith("pending-")) {
    const { error: profileError } = await supabase
      .from("ci_profiles")
      .update({
        email: normalizedUser.email,
        name: normalizedUser.name,
        role: normalizedUser.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", normalizedUser.id);
    if (profileError) throw profileError;
  }

  return normalizedUser;
}

export async function deleteManagedUser(supabase: SupabaseClient, user: AppUser) {
  const { error } = await supabase.from("ci_allowed_users").delete().eq("email", user.email.toLowerCase());
  if (error && !isMissingTableError(error)) throw error;
}

function profileRowToAppUser(row: ProfileRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name || row.email,
    role: row.role,
  };
}

async function fetchAllowedUserByEmail(supabase: SupabaseClient, email: string): Promise<{ allowed: boolean; user?: Omit<AppUser, "id"> }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { allowed: false };

  const { data, error } = await supabase
    .from("ci_allowed_users")
    .select("email, name, role")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return { allowed: true };
    throw error;
  }

  if (!data) return { allowed: false };
  const row = data as AllowedUserRow;
  return {
    allowed: true,
    user: {
      email: row.email,
      name: row.name || row.email,
      role: row.role,
    },
  };
}

function upsertManagedUserList(users: AppUser[], nextUser: AppUser) {
  if (users.some((user) => user.id === nextUser.id || user.email === nextUser.email)) {
    return users.map((user) => (user.id === nextUser.id || user.email === nextUser.email ? { ...user, ...nextUser } : user));
  }
  return [nextUser, ...users];
}

export async function fetchInspectionCases(supabase: SupabaseClient, userId: string): Promise<InspectionCase[]> {
  let { data, error } = await supabase
    .from("ci_projects")
    .select("*, ci_targets(*, ci_floors(*, ci_inspection_points(*, ci_photos(*)))), ci_report_sections(*), ci_attachments(*), ci_site_photos(*), ci_level_measurements(*), ci_tilt_measurements(*)")
    .order("updated_at", { ascending: false });

  if (error && isMissingTableError(error)) {
    const fallback = await supabase
      .from("ci_projects")
      .select("*, ci_targets(*, ci_floors(*, ci_inspection_points(*, ci_photos(*)))), ci_report_sections(*), ci_attachments(*), ci_site_photos(*)")
      .order("updated_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  return Promise.all(((data ?? []) as ProjectRow[]).map((row) => projectRowToCase(supabase, row, userId)));
}

export async function saveInspectionCase(supabase: SupabaseClient, inspectionCase: InspectionCase) {
  const project = inspectionCase.project;
  const now = new Date().toISOString();

  const projectPayload = {
    id: project.id,
    case_no: project.caseNo,
    project_name: project.projectName,
    work_name: project.workName ?? "",
    applicant_name: project.applicantName,
    applicant_address: project.applicantAddress ?? "",
    applicant_phone: project.applicantPhone ?? "",
    contact_person: project.contactPerson ?? "",
    inspection_type: project.inspectionType,
    inspection_date: project.inspectionDate || null,
    report_status: project.reportStatus ?? "草稿",
    received_date: project.receivedDate || null,
    received_no: project.receivedNo ?? "",
    final_date: project.finalDate || null,
    target_summary: project.targetSummary ?? "",
    survey_dates: project.surveyDates ?? [],
    county_city: project.countyCity ?? "",
    site_status_note: project.siteStatusNote ?? "",
    process_note: project.processNote ?? "",
    target_list: project.targetList ?? [],
    engineer_names: JSON.stringify(project.engineers ?? []),
    association_engineers: project.associationEngineers ?? "",
    level_plan_paths: inspectionCase.levelPlanPaths ?? [],
    tilt_plan_paths: inspectionCase.tiltPlanPaths ?? [],
    owner_id: inspectionCase.createdByUserId,
    updated_at: now,
  };

  const { error: projectError } = await supabase.from("ci_projects").upsert(projectPayload, { onConflict: "id" });

  if (projectError) {
    if (
      String(projectError.message).includes("report_status") ||
      String(projectError.message).includes("level_plan_paths") ||
      String(projectError.message).includes("tilt_plan_paths") ||
      String(projectError.message).includes("work_name") ||
      String(projectError.message).includes("final_date") ||
      String(projectError.message).includes("survey_dates") ||
      String(projectError.message).includes("county_city") ||
      String(projectError.message).includes("site_status_note") ||
      String(projectError.message).includes("process_note") ||
      String(projectError.message).includes("target_list")
    ) {
      const {
        report_status: _reportStatus,
        level_plan_paths: _levelPlanPaths,
        tilt_plan_paths: _tiltPlanPaths,
        work_name: _workName,
        final_date: _finalDate,
        survey_dates: _surveyDates,
        county_city: _countyCity,
        site_status_note: _siteStatusNote,
        process_note: _processNote,
        target_list: _targetList,
        ...legacyProjectPayload
      } = projectPayload;
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

  await saveSitePhotos(supabase, inspectionCase);
  await saveLevelMeasurements(supabase, inspectionCase);
  await saveTiltMeasurements(supabase, inspectionCase);
}

export function saveLocalDraft(inspectionCase: InspectionCase): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `draft_${inspectionCase.id}`,
      JSON.stringify({ data: inspectionCase, savedAt: new Date().toISOString() }),
    );
  } catch {
    console.warn("localStorage 暫存失敗");
  }
}

export function loadLocalDraft(caseId: string): InspectionCase | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`draft_${caseId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: InspectionCase; savedAt: string };
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearLocalDraft(caseId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`draft_${caseId}`);
}

export async function deleteInspectionCase(supabase: SupabaseClient, projectId: string) {
  const { error } = await supabase.from("ci_projects").delete().eq("id", projectId);
  if (error) throw error;
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
    (data.floorNamesByTarget?.[target.id] ?? defaultFloorNames).map((floorName) => ({
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
    inaccessible: point.inaccessible ?? false,
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
      storage_path: point.photo?.storagePath ?? null,
      caption: point.photo?.caption ?? "",
      taken_at: point.photo?.takenAt ?? new Date().toISOString(),
    }));

  if (photoRows.length) {
    const { error: photosError } = await supabase.from("ci_photos").upsert(photoRows, { onConflict: "id" });
    if (photosError) throw photosError;
  }
}

async function saveSitePhotos(supabase: SupabaseClient, inspectionCase: InspectionCase) {
  const photos = inspectionCase.sitePhotos ?? [];
  const rows = photos.map((photo) => ({
    id: photo.id,
    project_id: inspectionCase.project.id,
    photo_no: photo.photoNo,
    image_url: photo.imageUrl,
    storage_path: photo.storagePath ?? null,
    caption: photo.caption,
    note: photo.note,
    taken_at: photo.takenAt,
  }));

  if (rows.length) {
    const { error } = await supabase.from("ci_site_photos").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  const { data: existingRows } = await supabase.from("ci_site_photos").select("id").eq("project_id", inspectionCase.project.id);
  const currentIds = photos.map((photo) => photo.id);
  const staleIds = ((existingRows ?? []) as Array<{ id: string }>).map((row) => row.id).filter((id) => !currentIds.includes(id));
  if (staleIds.length) {
    const { error } = await supabase.from("ci_site_photos").delete().in("id", staleIds);
    if (error) throw error;
  }
}

async function saveLevelMeasurements(supabase: SupabaseClient, inspectionCase: InspectionCase) {
  const measurements = inspectionCase.levelMeasurements ?? [];
  const rows = measurements.map((row, index) => ({
    id: row.id,
    project_id: inspectionCase.project.id,
    row_order: index + 1,
    point_no: row.pointNo,
    location: row.location,
    measurement_date: row.measurementDate || null,
    relative_elevation: (row.relativeElevation ?? row.initialElevation) === "" ? null : Number(row.relativeElevation ?? row.initialElevation),
    initial_elevation: row.initialElevation === "" ? null : Number(row.initialElevation),
    repeat_elevation: row.repeatElevation === "" ? null : Number(row.repeatElevation),
    x: row.x ?? null,
    y: row.y ?? null,
    image_url: row.photo?.imageUrl ?? null,
    storage_path: row.photo?.storagePath ?? null,
    caption: row.photo?.caption ?? null,
    taken_at: row.photo?.takenAt ?? null,
    note: row.note,
  }));

  if (rows.length) {
    const { error } = await supabase.from("ci_level_measurements").upsert(rows, { onConflict: "id" });
    if (error) {
      if (isMissingTableError(error)) return;
      throw error;
    }
  }

  const { data: existingRows, error: existingRowsError } = await supabase.from("ci_level_measurements").select("id").eq("project_id", inspectionCase.project.id);
  if (existingRowsError) {
    if (isMissingTableError(existingRowsError)) return;
    throw existingRowsError;
  }
  const currentIds = measurements.map((row) => row.id);
  const staleIds = ((existingRows ?? []) as Array<{ id: string }>).map((row) => row.id).filter((id) => !currentIds.includes(id));
  if (staleIds.length) {
    const { error } = await supabase.from("ci_level_measurements").delete().in("id", staleIds);
    if (error) throw error;
  }
}

async function saveTiltMeasurements(supabase: SupabaseClient, inspectionCase: InspectionCase) {
  const measurements = inspectionCase.tiltMeasurements ?? [];
  const rows = measurements.map((row, index) => ({
    id: row.id,
    project_id: inspectionCase.project.id,
    row_order: index + 1,
    line_no: row.lineNo,
    location: row.location,
    direction: row.direction,
    measurement_date: row.measurementDate || null,
    x: row.x ?? null,
    y: row.y ?? null,
    upper_distance: row.upperDistance === "" ? null : Number(row.upperDistance),
    lower_distance: row.lowerDistance === "" ? null : Number(row.lowerDistance),
    floor_height: row.floorHeight === "" ? null : Number(row.floorHeight),
    upper_image_url: row.upperPhoto?.imageUrl ?? null,
    upper_storage_path: row.upperPhoto?.storagePath ?? null,
    upper_caption: row.upperPhoto?.caption ?? null,
    upper_taken_at: row.upperPhoto?.takenAt ?? null,
    lower_image_url: row.lowerPhoto?.imageUrl ?? null,
    lower_storage_path: row.lowerPhoto?.storagePath ?? null,
    lower_caption: row.lowerPhoto?.caption ?? null,
    lower_taken_at: row.lowerPhoto?.takenAt ?? null,
    note: row.note ?? "",
  }));

  if (rows.length) {
    const { error } = await supabase.from("ci_tilt_measurements").upsert(rows, { onConflict: "id" });
    if (error) {
      if (isMissingTableError(error)) return;
      throw error;
    }
  }

  const { data: existingRows, error: existingRowsError } = await supabase.from("ci_tilt_measurements").select("id").eq("project_id", inspectionCase.project.id);
  if (existingRowsError) {
    if (isMissingTableError(existingRowsError)) return;
    throw existingRowsError;
  }
  const currentIds = measurements.map((row) => row.id);
  const staleIds = ((existingRows ?? []) as Array<{ id: string }>).map((row) => row.id).filter((id) => !currentIds.includes(id));
  if (staleIds.length) {
    const { error } = await supabase.from("ci_tilt_measurements").delete().in("id", staleIds);
    if (error) throw error;
  }
}

async function projectRowToCase(supabase: SupabaseClient, row: ProjectRow, userId: string): Promise<InspectionCase> {
  const project: Project = {
    id: row.id,
    caseNo: row.case_no,
    projectName: row.project_name,
    workName: row.work_name ?? "",
    applicantName: row.applicant_name ?? "",
    applicantAddress: row.applicant_address ?? "",
    applicantPhone: row.applicant_phone ?? "",
    contactPerson: row.contact_person ?? "",
    inspectionType: row.inspection_type ?? "",
    inspectionDate: row.inspection_date ?? "",
    reportStatus: normalizeReportStatus(row.report_status),
    receivedDate: row.received_date ?? "",
    receivedNo: row.received_no ?? "",
    finalDate: row.final_date ?? "",
    targetSummary: row.target_summary ?? "",
    surveyDates: normalizeSurveyDates(row.survey_dates),
    countyCity: row.county_city ?? "",
    siteStatusNote: row.site_status_note ?? "",
    processNote: row.process_note ?? "",
    targetList: normalizeTargetList(row.target_list),
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

  const attachmentSeven = await buildAttachmentSevenData(supabase, row, target);
  const reportSections = mergeReportSections(project, row.ci_report_sections ?? []);
  const attachments = mergeAttachments(row.ci_attachments ?? []);

  return {
    id: row.id,
    project,
    target,
    sitePhotos: await Promise.all((row.ci_site_photos ?? []).map((photoRow) => sitePhotoRowToPhoto(supabase, photoRow))),
    levelMeasurements: await Promise.all(
      (row.ci_level_measurements ?? [])
        .sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0))
        .map((measurementRow) => levelMeasurementRowToMeasurement(supabase, measurementRow)),
    ),
    levelPlanPaths: Array.isArray(row.level_plan_paths) ? row.level_plan_paths : [],
    tiltMeasurements: await Promise.all(
      (row.ci_tilt_measurements ?? [])
        .sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0))
        .map((measurementRow) => tiltMeasurementRowToMeasurement(supabase, measurementRow)),
    ),
    tiltPlanPaths: Array.isArray(row.tilt_plan_paths) ? row.tilt_plan_paths : [],
    attachmentSeven,
    reportSections,
    attachments,
    createdByUserId: row.owner_id || userId,
    updatedAt: row.updated_at,
  };
}

async function buildAttachmentSevenData(supabase: SupabaseClient, row: ProjectRow, fallbackTarget: Target): Promise<AttachmentSevenData> {
  const targets = row.ci_targets?.length
    ? row.ci_targets.map(targetRowToTarget)
    : [fallbackTarget];
  const floorNamesByTarget: AttachmentSevenData["floorNamesByTarget"] = {};
  const plansByTargetFloor: AttachmentSevenData["plansByTargetFloor"] = {};
  const noEntryZonesByTargetFloor: AttachmentSevenData["noEntryZonesByTargetFloor"] = {};
  const points: InspectionPoint[] = [];

  const floors = (row.ci_targets ?? []).flatMap((target) => target.ci_floors ?? []);

  for (const floor of floors) {
    if (!floorNamesByTarget[floor.target_id]) floorNamesByTarget[floor.target_id] = [];
    if (!floorNamesByTarget[floor.target_id].includes(floor.floor_name)) floorNamesByTarget[floor.target_id].push(floor.floor_name);
    if (!plansByTargetFloor[floor.target_id]) plansByTargetFloor[floor.target_id] = emptyFloorRecord<FloorPlanData>();
    if (!noEntryZonesByTargetFloor[floor.target_id]) noEntryZonesByTargetFloor[floor.target_id] = emptyFloorRecord<NoEntryZone[]>();

    plansByTargetFloor[floor.target_id][floor.floor_name] = normalizeStoredFloorPlan(floor.plan_svg_or_json);
    noEntryZonesByTargetFloor[floor.target_id][floor.floor_name] = Array.isArray(floor.no_entry_zones) ? floor.no_entry_zones : [];

    for (const point of floor.ci_inspection_points ?? []) {
      points.push(await inspectionPointRowToPoint(supabase, point));
    }
  }

  return {
    targets,
    floorNamesByTarget: Object.fromEntries(
      targets.map((target) => [target.id, floorNamesByTarget[target.id]?.length ? floorNamesByTarget[target.id] : defaultFloorNames]),
    ),
    plansByTargetFloor,
    noEntryZonesByTargetFloor,
    points,
  };
}

function normalizeStoredFloorPlan(plan: FloorPlanData | null): FloorPlanData {
  if (Array.isArray(plan)) return plan.filter((path): path is string => typeof path === "string");
  if (isFloorPlan(plan)) return plan;
  return [];
}

function isFloorPlan(value: unknown): value is FloorPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { paths?: unknown; backgroundImage?: unknown };
  return (
    Array.isArray(candidate.paths) &&
    candidate.paths.every((path) => typeof path === "string") &&
    (candidate.backgroundImage === undefined || typeof candidate.backgroundImage === "string")
  );
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

async function inspectionPointRowToPoint(supabase: SupabaseClient, row: InspectionPointRow): Promise<InspectionPoint> {
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
    inaccessible: row.inaccessible ?? false,
    note: row.note ?? "",
    photo: photoRow ? await photoRowToRecord(supabase, photoRow) : undefined,
    createdAt: row.created_at,
  };
}

async function photoRowToRecord(supabase: SupabaseClient, row: PhotoRow): Promise<PhotoRecord> {
  return {
    id: row.id,
    pointId: row.point_id,
    imageUrl: await signedStorageUrl(supabase, row.storage_path, row.image_url),
    storagePath: row.storage_path ?? undefined,
    caption: row.caption ?? "",
    takenAt: row.taken_at,
  };
}

async function sitePhotoRowToPhoto(supabase: SupabaseClient, row: SitePhotoRow): Promise<SitePhoto> {
  return {
    id: row.id,
    photoNo: row.photo_no,
    imageUrl: await signedStorageUrl(supabase, row.storage_path, row.image_url),
    storagePath: row.storage_path ?? undefined,
    caption: row.caption ?? "",
    note: row.note ?? "",
    takenAt: row.taken_at,
  };
}

async function levelMeasurementRowToMeasurement(supabase: SupabaseClient, row: LevelMeasurementRow): Promise<LevelMeasurement> {
  return {
    id: row.id,
    pointNo: row.point_no ?? "",
    location: row.location ?? "",
    measurementDate: row.measurement_date ?? "",
    relativeElevation: row.relative_elevation == null ? "" : String(row.relative_elevation),
    initialElevation: row.initial_elevation == null ? "" : String(row.initial_elevation),
    repeatElevation: row.repeat_elevation == null ? "" : String(row.repeat_elevation),
    x: row.x == null ? undefined : Number(row.x),
    y: row.y == null ? undefined : Number(row.y),
    photo: row.image_url
      ? {
          id: row.id,
          imageUrl: await signedStorageUrl(supabase, row.storage_path, row.image_url),
          storagePath: row.storage_path ?? undefined,
          caption: row.caption ?? "",
          takenAt: row.taken_at ?? new Date().toISOString(),
        }
      : undefined,
    note: row.note ?? "",
  };
}

async function tiltMeasurementRowToMeasurement(supabase: SupabaseClient, row: TiltMeasurementRow): Promise<TiltMeasurement> {
  return {
    id: row.id,
    lineNo: row.line_no ?? "",
    location: row.location ?? "",
    direction: row.direction ?? "X向",
    measurementDate: row.measurement_date ?? "",
    x: row.x == null ? undefined : Number(row.x),
    y: row.y == null ? undefined : Number(row.y),
    upperDistance: row.upper_distance == null ? "" : String(row.upper_distance),
    lowerDistance: row.lower_distance == null ? "" : String(row.lower_distance),
    floorHeight: row.floor_height == null ? "" : String(row.floor_height),
    upperPhoto: row.upper_image_url
      ? {
          id: `${row.id}-upper`,
          imageUrl: await signedStorageUrl(supabase, row.upper_storage_path, row.upper_image_url),
          storagePath: row.upper_storage_path ?? undefined,
          caption: row.upper_caption ?? "",
          takenAt: row.upper_taken_at ?? new Date().toISOString(),
        }
      : undefined,
    lowerPhoto: row.lower_image_url
      ? {
          id: `${row.id}-lower`,
          imageUrl: await signedStorageUrl(supabase, row.lower_storage_path, row.lower_image_url),
          storagePath: row.lower_storage_path ?? undefined,
          caption: row.lower_caption ?? "",
          takenAt: row.lower_taken_at ?? new Date().toISOString(),
        }
      : undefined,
    note: row.note ?? "",
  };
}

async function signedStorageUrl(supabase: SupabaseClient, storagePath: string | null, fallbackUrl: string) {
  if (!storagePath) return fallbackUrl;
  const { data, error } = await supabase.storage
    .from("ci-inspection-photos")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error) return fallbackUrl;
  return data.signedUrl;
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

function normalizeSurveyDates(value: SurveyDate[] | null): SurveyDate[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is SurveyDate => {
      return (
        item != null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.date === "string" &&
        typeof item.timeRange === "string"
      );
    })
    .map((item) => ({
      id: item.id,
      date: item.date,
      timeRange: item.timeRange,
    }));
}

function normalizeTargetList(value: TargetListItem[] | null): TargetListItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is TargetListItem => {
      return (
        item != null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.address === "string" &&
        typeof item.usage === "string"
      );
    })
    .map((item) => ({
      id: item.id,
      address: item.address,
      usage: item.usage,
    }));
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

function isMissingTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || String(error.message ?? "").includes("does not exist");
}
