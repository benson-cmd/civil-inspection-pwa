export type FloorName = string;

export type ComponentType = "全景" | "牆面" | "平頂" | "地坪" | "梁" | "柱" | "其他";

export type ConditionType = "現況" | "裂縫" | "滲水" | "剝落" | "其他";

export interface Project {
  id: string;
  caseNo: string;
  projectName: string;
  workName?: string;
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
  surveyDates?: SurveyDate[];
  countyCity?: string;
  siteStatusNote?: string;
  processNote?: string;
  targetList?: TargetListItem[];
  engineers?: ProjectEngineer[];
  engineerNames?: string;
  associationEngineers?: string;
  finalDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SurveyDate {
  id: string;
  date: string;
  timeRange: string;
}

export interface TargetListItem {
  id: string;
  address: string;
  usage: string;
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
  storagePath?: string;
  caption: string;
  note: string;
  takenAt: string;
}

export interface LevelMeasurement {
  id: string;
  pointNo: string;
  location: string;
  measurementDate?: string;
  relativeElevation?: string;
  initialElevation: string;
  repeatElevation: string;
  x?: number;
  y?: number;
  photo?: MeasurementPhoto;
  note: string;
}

export interface TiltMeasurement {
  id: string;
  lineNo: string;
  location: string;
  direction: "左傾" | "右傾";
  measurementDate?: string;
  x?: number;
  y?: number;
  upperDistance: string;
  lowerDistance: string;
  floorHeight: string;
  upperPhoto?: MeasurementPhoto;
  lowerPhoto?: MeasurementPhoto;
  note?: string;
}

export interface MeasurementPhoto {
  id: string;
  imageUrl: string;
  storagePath?: string;
  caption: string;
  takenAt: string;
}

export interface Floor {
  id: string;
  targetId: string;
  floorName: FloorName;
  planSvgOrJson: string;
}

export interface FloorPlan {
  paths: string[];
  backgroundImage?: string;
}

export type FloorPlanData = string[] | FloorPlan;

export interface NoEntryZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  points?: Array<{ x: number; y: number }>;
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
  inaccessible?: boolean;
  note: string;
  photo?: PhotoRecord;
  createdAt: string;
}

export interface PhotoRecord {
  id: string;
  pointId: string;
  imageUrl: string;
  storagePath?: string;
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
  sitePhotos?: SitePhoto[];
  levelMeasurements?: LevelMeasurement[];
  levelPlanPaths?: string[];
  tiltMeasurements?: TiltMeasurement[];
  tiltPlanPaths?: string[];
  attachmentSeven?: AttachmentSevenData;
  reportSections: ReportSection[];
  attachments: AttachmentSlot[];
  createdByUserId: string;
  updatedAt: string;
}

export interface AttachmentSevenData {
  targets: Target[];
  floorNamesByTarget: Record<string, FloorName[]>;
  plansByTargetFloor: Record<string, Record<FloorName, FloorPlanData>>;
  noEntryZonesByTargetFloor: Record<string, Record<FloorName, NoEntryZone[]>>;
  points: InspectionPoint[];
}
