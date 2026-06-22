export type FloorName = "1F" | "2F" | "3F" | "RF";

export type ComponentType = "全景" | "牆面" | "平頂" | "地坪" | "梁" | "柱" | "其他";

export type ConditionType = "現況" | "裂縫" | "滲水" | "剝落" | "其他";

export interface Project {
  id: string;
  caseNo: string;
  projectName: string;
  applicantName: string;
  inspectionType: string;
  inspectionDate: string;
  reportStatus?: ReportStatus;
  applicantAddress?: string;
  applicantPhone?: string;
  contactPerson?: string;
  receivedDate?: string;
  receivedNo?: string;
  targetSummary?: string;
  engineers?: ProjectEngineer[];
  engineerNames?: string;
  associationEngineers?: string;
  finalDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectEngineer {
  id: string;
  name: string;
  memberNo: string;
}

export interface Target {
  id: string;
  projectId: string;
  address: string;
  usageType: string;
  wallFinish: string;
  ceilingFinish: string;
  floorFinish: string;
  surveyStatus: string;
  note: string;
}

export interface SitePhoto {
  id: string;
  photoNo: string;
  imageUrl: string;
  caption: string;
  note: string;
  takenAt: string;
}

export interface Floor {
  id: string;
  targetId: string;
  floorName: FloorName;
  planSvgOrJson: string;
}

export interface NoEntryZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

export interface InspectionPoint {
  id: string;
  floorId: string;
  photoNo: string;
  x: number;
  y: number;
  directionAngle: number;
  componentType: ComponentType[];
  conditionType: ConditionType[];
  crackWidthMm?: number;
  note: string;
  photo?: PhotoRecord;
  createdAt: string;
}

export interface PhotoRecord {
  id: string;
  pointId: string;
  imageUrl: string;
  caption: string;
  takenAt: string;
}

export type UserRole = "admin" | "user";

export type ReportStatus = "草稿" | "審閱中" | "待補件" | "完稿" | "已歸檔";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ReportSection {
  id: string;
  order: number;
  title: string;
  content: string;
  source: "basic" | "editable" | "attachment7" | "attachments";
  fixedTitle: boolean;
}

export interface AttachmentSlot {
  id: string;
  no: number;
  title: string;
  mode: "upload" | "editor";
  status: "empty" | "uploaded" | "editing" | "ready";
  fileName?: string;
}

export interface InspectionCase {
  id: string;
  project: Project;
  target: Target;
  attachmentSeven?: AttachmentSevenData;
  reportSections: ReportSection[];
  attachments: AttachmentSlot[];
  createdByUserId: string;
  updatedAt: string;
}

export interface AttachmentSevenData {
  targets: Target[];
  plansByTargetFloor: Record<string, Record<FloorName, string[]>>;
  noEntryZonesByTargetFloor: Record<string, Record<FloorName, NoEntryZone[]>>;
  points: InspectionPoint[];
}
