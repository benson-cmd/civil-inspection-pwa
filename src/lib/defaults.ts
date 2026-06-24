import type { AttachmentSlot, InspectionCase, Project, ReportSection, Target } from "@/types/inspection";
import { defaultFloorNames } from "@/lib/floors";

export function createCase(userId: string): InspectionCase {
  const projectId = crypto.randomUUID();
  const project: Project = {
    id: projectId,
    caseNo: "115鑑000號",
    projectName: "鄰房現況鑑定報告書",
    workName: "",
    applicantName: "OO營造有限公司",
    applicantAddress: "",
    applicantPhone: "",
    contactPerson: "",
    inspectionType: "施工前鄰房現況鑑定",
    inspectionDate: new Date().toISOString().slice(0, 10),
    reportStatus: "草稿",
    receivedDate: "",
    receivedNo: "",
    targetSummary: "",
    surveyDates: [],
    countyCity: "",
    siteStatusNote: "",
    processNote: "",
    targetList: [],
    attachmentFourPlanPaths: [],
    attachmentFourNote: "",
    engineers: [{ id: crypto.randomUUID(), name: "", memberNo: "" }],
    engineerNames: "",
    finalDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const target: Target = {
    id: crypto.randomUUID(),
    projectId: project.id,
    address: "臺中市○○區○○路○○號",
    usageType: "住宅",
    wallFinish: "油漆",
    ceilingFinish: "其他",
    floorFinish: "其他",
    surveyStatus: "",
    note: "",
  };

  return {
    id: projectId,
    project,
    target,
    sitePhotos: [],
    levelMeasurements: [],
    levelPlanPaths: [],
    tiltMeasurements: [],
    tiltPlanPaths: [],
    attachmentSeven: {
      targets: [target],
      floorNamesByTarget: {
        [target.id]: defaultFloorNames,
      },
      plansByTargetFloor: {},
      noEntryZonesByTargetFloor: {},
      points: [],
    },
    reportSections: createDefaultSections(project),
    attachments: createDefaultAttachments(),
    createdByUserId: userId,
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultSections(project: Project): ReportSection[] {
  const applicationDate = formatCompactRocDate(project.inspectionDate) || "民國○○○年○月○日";
  const receivedDate = formatCompactRocDate(project.receivedDate) || "○○○年○月○日";
  const receivedNo = project.receivedNo?.trim() || "鑑○○○";
  const workName = project.workName?.trim() || project.projectName;

  return [
    {
      id: "applicant",
      order: 1,
      title: "一、申請單位",
      source: "basic",
      fixedTitle: true,
      content: `申請單位：${project.applicantName}\n連絡地址：${project.applicantAddress ?? ""}\n連絡電話：${project.applicantPhone ?? ""}\n連絡人 ︰${project.contactPerson ?? ""}`,
    },
    {
      id: "application-date",
      order: 2,
      title: "二、申請日期",
      source: "basic",
      fixedTitle: true,
      content: `${applicationDate}\n(社團法人臺中市土木技師公會 ${receivedDate}收文號：${receivedNo})`,
    },
    {
      id: "target-location",
      order: 3,
      title: "三、標的物之坐落",
      source: "basic",
      fixedTitle: true,
      content: project.targetSummary ?? "",
    },
    {
      id: "purpose",
      order: 4,
      title: "四、鑑定要旨",
      source: "editable",
      fixedTitle: true,
      content: `申請單位${project.applicantName}將進行${workName}，為顧及日後施工若引起損鄰事件，可能引起之損鄰糾紛暨有關責任歸屬之釐清，於${applicationDate}，函請本公會辦理鄰房現況鑑定(詳附件一)。`,
    },
    {
      id: "basis",
      order: 5,
      title: "五、鑑定依據",
      source: "basic",
      fixedTitle: true,
      content: "鑑定依據：\n(一) 鑑定申請書(詳附件一)。\n(二) 本公會會勘通知函(詳附件二)。\n(三) 彰化縣建築物施工損壞鄰房事件處理自治條例。\n(四) 臺中市土木技師公會鑑定手冊。",
    },
    { id: "survey-dates", order: 6, title: "六、會勘日期", source: "basic", fixedTitle: true, content: "第一次：" },
    {
      id: "staff",
      order: 7,
      title: "七、會勘人員",
      source: "basic",
      fixedTitle: true,
      content: `申請單位代表：${project.applicantName}\n社團法人臺中市土木技師公會：${formatEngineerNames(project)} 技師\n所有權人代表：詳附件三。`,
    },
    {
      id: "process",
      order: 8,
      title: "八、鑑定過程",
      source: "editable",
      fixedTitle: true,
      content: `申請人於${applicationDate}向本會提出本案施工前之鄰房現況鑑定申請(本會收文號${receivedNo})，本會即指派${formatEngineerNames(project) || "○○○"}技師負責辦理本案建築物現況鑑定工作。本會鑑定技師依照會勘通知函時間前往現場進行會勘作業。\n\n鑑定技師將可見範圍內鑑定標的物之裂縫及瑕疵等現況拍照、繪製圖說並做成紀錄(詳附件七)。`,
    },
    { id: "site-status", order: 9, title: "九、工地現況", source: "editable", fixedTitle: true, content: "本案會勘時，工程尚未施工(詳附件八)。" },
    {
      id: "target-status",
      order: 10,
      title: "十、鑑定標的物之用途及現況",
      source: "attachment7",
      fixedTitle: true,
      content: "(一) 用途及現況：\n系統將抓取附件七各標的物住址與用途資料。\n\n(二) 現況調查記錄：\n工地及鄰房相關之水準測量成果詳附件五。\n鄰房相關之傾斜測量之成果詳附件六。\n各戶鑑定紀錄表、現況平面示意圖及照片詳附件七。",
    },
    {
      id: "attachments",
      order: 11,
      title: "十一、附件",
      source: "attachments",
      fixedTitle: true,
      content: "附件一：鑑定申請書\n附件二：會勘通知函\n附件三：會勘紀錄表\n附件四：工地及鑑定標的物位置圖\n附件五：水準測量\n附件六：傾斜測量\n附件七：鑑定標的物平面配置圖、現況調查紀錄表及照片\n附件八：基地現況照片",
    },
  ];
}

function formatCompactRocDate(date: string | undefined) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return `民國${parsed.getFullYear() - 1911}年${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}

export function createDefaultAttachments(): AttachmentSlot[] {
  return [
    { id: "att-1", no: 1, title: "鑑定申請書", mode: "upload", status: "empty" },
    { id: "att-2", no: 2, title: "會勘通知函", mode: "upload", status: "empty" },
    { id: "att-3", no: 3, title: "會勘紀錄表", mode: "upload", status: "empty" },
    { id: "att-4", no: 4, title: "工地及鑑定標的物位置圖", mode: "editor", status: "editing" },
    { id: "att-5", no: 5, title: "水準測量", mode: "editor", status: "editing" },
    { id: "att-6", no: 6, title: "傾斜測量", mode: "editor", status: "editing" },
    { id: "att-7", no: 7, title: "鑑定標的物平面配置圖、現況調查紀錄表及照片", mode: "editor", status: "editing" },
    { id: "att-8", no: 8, title: "基地現況照片", mode: "editor", status: "editing" },
  ];
}

function formatEngineerNames(project: Project) {
  return (project.engineers ?? [])
    .map((engineer) => engineer.name.trim())
    .filter(Boolean)
    .join("、");
}
