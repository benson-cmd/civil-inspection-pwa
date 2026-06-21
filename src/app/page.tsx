"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  ImagePlus,
  LogIn,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { FloorPlanCanvas, serializePlanToSvg } from "@/components/FloorPlanCanvas";
import { InspectionForm } from "@/components/InspectionForm";
import { PdfExportButton } from "@/components/PdfExportButton";
import { PwaRegister } from "@/components/PwaRegister";
import { buildPhotoCaption, nextPhotoNo } from "@/lib/caption";
import type {
  AppUser,
  AttachmentSlot,
  Floor,
  FloorName,
  InspectionCase,
  InspectionPoint,
  NoEntryZone,
  Project,
  ReportSection,
  SitePhoto,
  Target,
} from "@/types/inspection";

type WorkspaceTab = "basic" | "main" | "attachments" | "attachment7" | "attachment8" | "export";

const floorNames: FloorName[] = ["1F", "2F", "3F", "RF"];
const usageOptions = ["商業", "住宅", "辦公室", "工業", "宗教", "其他"];
const wallFinishOptions = ["水泥粉光", "油漆", "壁紙", "磁磚", "裝飾品", "其他"];
const ceilingFinishOptions = ["水泥粉光", "油漆", "壁紙", "木架", "輕鋼架", "其他"];
const floorFinishOptions = ["塑膠地磚", "磨石子", "磁磚", "地毯", "木板", "其他"];
const surveyStatusOptions = ["部份隔間不便拍照", "拒絕鑑定", "屢次造訪無人", "本戶裝修"];

const demoUsers: AppUser[] = [
  { id: "user-admin", name: "Benson", email: "benson@example.com", role: "admin" },
  { id: "user-staff", name: "現場使用者", email: "staff@example.com", role: "user" },
];

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [cases, setCases] = useState<InspectionCase[]>(() => [createCase("user-admin")]);
  const [activeCaseId, setActiveCaseId] = useState(cases[0]?.id);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("basic");

  const activeCase = cases.find((item) => item.id === activeCaseId) ?? cases[0];

  function updateCase(nextCase: InspectionCase) {
    setCases((current) =>
      current.map((item) =>
        item.id === nextCase.id
          ? {
              ...nextCase,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function addCase() {
    const nextCase = createCase(currentUser?.id ?? "user-admin");
    setCases((current) => [nextCase, ...current]);
    setActiveCaseId(nextCase.id);
    setActiveTab("basic");
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 text-foreground">
        <PwaRegister />
        <section className="mx-auto grid min-h-[calc(100vh-48px)] max-w-5xl place-items-center">
          <div className="w-full rounded-lg border border-line bg-paper p-6 shadow-sm md:p-8">
            <p className="text-sm font-semibold tracking-[0.2em] text-accent">CIVIL INSPECTION REPORT</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">現況鑑定報告系統</h1>
            <p className="mt-3 max-w-2xl text-muted">
              第一階段先建立完整產品骨架：Google 帳戶登入、案件管理、報告主文、附件管理、附件七與附件八編輯。現在使用示意登入，下一步可接 Supabase Auth Google OAuth。
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setCurrentUser(user)}
                  className="flex min-h-24 items-center gap-4 rounded-lg border border-line bg-white p-4 text-left shadow-sm"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-[#fff1d7] text-accent">
                    {user.role === "admin" ? <ShieldCheck size={24} /> : <UserRound size={24} />}
                  </span>
                  <span>
                    <span className="block text-lg font-bold">{user.name}</span>
                    <span className="block text-sm text-muted">{user.email}</span>
                    <span className="mt-1 inline-flex rounded-full border border-line px-2 py-1 text-xs font-semibold">
                      {user.role === "admin" ? "管理者：可管理使用者與全部案件" : "使用者：編輯授權案件"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-md border border-line bg-white p-4 text-sm text-muted">
              <div className="mb-1 font-bold text-foreground">正式版登入建議</div>
              使用 Supabase Auth 的 Google OAuth，登入後由 `profiles.role` 判斷管理者或使用者，再由 `project_members` 控制案件權限。
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!activeCase) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground md:px-6 lg:px-8">
      <PwaRegister />
      <header className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-accent">REPORT WORKSPACE</p>
          <h1 className="text-2xl font-black md:text-3xl">現況鑑定報告系統</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line bg-paper px-3 py-2 text-sm font-semibold">
            {currentUser.name} / {currentUser.role === "admin" ? "管理者" : "使用者"}
          </span>
          <button
            type="button"
            onClick={() => setCurrentUser(null)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
          >
            <LogIn size={18} /> 切換帳號
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-line bg-paper p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">案件列表</h2>
            <button
              type="button"
              onClick={addCase}
              className="inline-flex min-h-10 items-center gap-1 rounded-md bg-accent px-3 text-sm font-bold text-white"
            >
              <Plus size={16} /> 新增
            </button>
          </div>
          <div className="grid gap-2">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveCaseId(item.id);
                  setActiveTab("basic");
                }}
                className={`rounded-md border p-3 text-left ${
                  item.id === activeCase.id ? "border-accent bg-[#fff1d7]" : "border-line bg-white"
                }`}
              >
                <span className="block font-bold">{item.project.caseNo}</span>
                <span className="block text-sm text-muted">{item.project.projectName}</span>
                <span className="mt-2 block text-xs text-muted">更新：{item.updatedAt.slice(0, 10)}</span>
              </button>
            ))}
          </div>
          {currentUser.role === "admin" ? (
            <div className="mt-4 rounded-md border border-line bg-white p-3 text-sm">
              <div className="font-bold">使用者管理</div>
              <p className="mt-1 text-muted">正式版會在這裡新增使用者、設定管理者/使用者角色與案件權限。</p>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0">
          <CaseHeader activeCase={activeCase} />
          <nav className="mb-4 flex flex-wrap gap-2 rounded-lg border border-line bg-paper p-2 shadow-sm">
            {workspaceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-11 rounded-md px-3 text-sm font-bold ${
                  activeTab === tab.id ? "bg-accent text-white" : "bg-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "basic" ? <BasicDataEditor activeCase={activeCase} onChange={updateCase} /> : null}
          {activeTab === "main" ? <ReportMainEditor activeCase={activeCase} onChange={updateCase} /> : null}
          {activeTab === "attachments" ? <AttachmentManager activeCase={activeCase} onChange={updateCase} /> : null}
          {activeTab === "attachment7" ? <AttachmentSevenEditor activeCase={activeCase} onChange={updateCase} /> : null}
          {activeTab === "attachment8" ? <AttachmentEightEditor activeCase={activeCase} onChange={updateCase} /> : null}
          {activeTab === "export" ? <ExportPanel activeCase={activeCase} /> : null}
        </section>
      </section>
    </main>
  );
}

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "basic", label: "基本資料" },
  { id: "main", label: "封面/目錄/主文" },
  { id: "attachments", label: "附件管理" },
  { id: "attachment7", label: "附件七" },
  { id: "attachment8", label: "附件八" },
  { id: "export", label: "匯出報告" },
];

function CaseHeader({ activeCase }: { activeCase: InspectionCase }) {
  return (
    <section className="mb-4 rounded-lg border border-line bg-paper p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">目前案件</p>
          <h2 className="text-2xl font-black">{activeCase.project.projectName}</h2>
          <p className="mt-1 text-sm text-muted">
            {activeCase.project.caseNo} / {activeCase.project.applicantName} / {activeCase.project.inspectionDate}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          報告狀態：草稿
        </div>
      </div>
    </section>
  );
}

function BasicDataEditor({ activeCase, onChange }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  const project = activeCase.project;
  const target = activeCase.target;

  function updateProject(patch: Partial<Project>) {
    onChange({ ...activeCase, project: { ...project, ...patch } });
  }

  function updateTarget(patch: Partial<Target>) {
    onChange({ ...activeCase, target: { ...target, ...patch } });
  }

  return (
    <div className="grid gap-4">
      <Panel title="案件基本資料" icon={<ClipboardList size={18} />}>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="案件編號" value={project.caseNo} onChange={(caseNo) => updateProject({ caseNo })} />
          <TextField label="案件名稱" value={project.projectName} onChange={(projectName) => updateProject({ projectName })} />
          <TextField label="申請單位" value={project.applicantName} onChange={(applicantName) => updateProject({ applicantName })} />
          <TextField label="連絡人" value={project.contactPerson ?? ""} onChange={(contactPerson) => updateProject({ contactPerson })} />
          <TextField label="連絡地址" value={project.applicantAddress ?? ""} onChange={(applicantAddress) => updateProject({ applicantAddress })} />
          <TextField label="連絡電話" value={project.applicantPhone ?? ""} onChange={(applicantPhone) => updateProject({ applicantPhone })} />
          <TextField label="申請日期" type="date" value={project.inspectionDate} onChange={(inspectionDate) => updateProject({ inspectionDate })} icon={<CalendarDays size={16} />} />
          <TextField label="公會收文日期" type="date" value={project.receivedDate ?? ""} onChange={(receivedDate) => updateProject({ receivedDate })} />
          <TextField label="收文號" value={project.receivedNo ?? ""} onChange={(receivedNo) => updateProject({ receivedNo })} />
          <TextField label="鑑定人姓名" value={project.engineerNames ?? ""} onChange={(engineerNames) => updateProject({ engineerNames })} />
          <TextField label="公會技師" value={project.associationEngineers ?? ""} onChange={(associationEngineers) => updateProject({ associationEngineers })} />
          <TextField label="鑑定類型" value={project.inspectionType} onChange={(inspectionType) => updateProject({ inspectionType })} />
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-muted">標的物之坐落摘要</span>
            <textarea
              value={project.targetSummary ?? ""}
              onChange={(event) => updateProject({ targetSummary: event.target.value })}
              rows={3}
              className="w-full rounded-md border border-line bg-white p-3"
            />
          </label>
        </div>
      </Panel>

      <Panel title="主要標的物預設資料" icon={<Home size={18} />}>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="標的物地址" value={target.address} onChange={(address) => updateTarget({ address })} className="md:col-span-2" />
          <SelectField label="用途" value={target.usageType} options={usageOptions} onChange={(usageType) => updateTarget({ usageType })} />
          <TextField label="備註" value={target.note} onChange={(note) => updateTarget({ note })} />
        </div>
      </Panel>
    </div>
  );
}

function ReportMainEditor({ activeCase, onChange }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  function updateSection(sectionId: string, content: string) {
    onChange({
      ...activeCase,
      reportSections: activeCase.reportSections.map((section) =>
        section.id === sectionId ? { ...section, content } : section,
      ),
    });
  }

  return (
    <div className="grid gap-4">
      <Panel title="封面自動帶入欄位" icon={<FileText size={18} />}>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <InfoLine label="申請人" value={activeCase.project.applicantName} />
          <InfoLine label="案件名稱" value={activeCase.project.projectName} />
          <InfoLine label="案件編號" value={activeCase.project.caseNo} />
          <InfoLine label="鑑定人姓名" value={activeCase.project.engineerNames ?? "尚未填寫"} />
        </div>
      </Panel>

      <Panel title="目錄" icon={<ClipboardList size={18} />}>
        <p className="text-sm text-muted">目錄章節固定，頁碼會在完整 PDF 匯出時計算後自動生成；編輯頁先顯示章節順序。</p>
        <ol className="mt-3 grid gap-2 text-sm">
          {activeCase.reportSections.map((section) => (
            <li key={section.id} className="rounded-md border border-line bg-white p-3">
              {section.title}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="主文編輯" icon={<FileText size={18} />}>
        <div className="grid gap-4">
          {activeCase.reportSections.map((section) => (
            <label key={section.id} className="block">
              <span className="mb-1 block text-base font-bold">{section.title}</span>
              <textarea
                value={section.content}
                onChange={(event) => updateSection(section.id, event.target.value)}
                rows={section.id === "attachments" ? 8 : 5}
                className="w-full rounded-md border border-line bg-white p-3 leading-7"
              />
            </label>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AttachmentManager({ activeCase, onChange }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  function updateAttachment(nextSlot: AttachmentSlot) {
    onChange({
      ...activeCase,
      attachments: activeCase.attachments.map((slot) => (slot.id === nextSlot.id ? nextSlot : slot)),
    });
  }

  return (
    <Panel title="附件管理" icon={<ClipboardList size={18} />}>
      <div className="grid gap-3">
        {activeCase.attachments.map((slot) => (
          <article key={slot.id} className="grid gap-3 rounded-md border border-line bg-white p-3 md:grid-cols-[1fr_auto]">
            <div>
              <div className="font-bold">附件{toChineseNumber(slot.no)}：{slot.title}</div>
              <div className="mt-1 text-sm text-muted">
                {slot.mode === "upload" ? "使用者上傳 PDF 資料" : "系統內編輯產生"}
              </div>
              {slot.fileName ? <div className="mt-1 text-sm text-accent">已選擇：{slot.fileName}</div> : null}
            </div>
            {slot.mode === "upload" ? (
              <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-accent bg-[#fff8e8] px-3 text-sm font-semibold text-accent">
                上傳 PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    updateAttachment({ ...slot, fileName: file.name, status: "uploaded" });
                    event.target.value = "";
                  }}
                />
              </label>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm font-semibold">
                {slot.status === "ready" ? "已完成" : "編輯中"}
              </span>
            )}
          </article>
        ))}
      </div>
    </Panel>
  );
}

function AttachmentSevenEditor({ activeCase, onChange }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  const [activeFloorName, setActiveFloorName] = useState<FloorName>("1F");
  const [plansByFloor, setPlansByFloor] = useState<Record<FloorName, string[]>>({
    "1F": [],
    "2F": [],
    "3F": [],
    RF: [],
  });
  const [noEntryZonesByFloor, setNoEntryZonesByFloor] = useState<Record<FloorName, NoEntryZone[]>>({
    "1F": [],
    "2F": [],
    "3F": [],
    RF: [],
  });
  const [points, setPoints] = useState<InspectionPoint[]>([]);
  const [activePointId, setActivePointId] = useState<string | undefined>();

  const project = activeCase.project;
  const target = activeCase.target;
  const activeFloorId = `floor-${activeFloorName}`;
  const floorPoints = points.filter((point) => point.floorId === activeFloorId);
  const activePoint = points.find((point) => point.id === activePointId);

  const floors: Floor[] = useMemo(
    () =>
      floorNames.map((floorName) => {
        const floorId = `floor-${floorName}`;
        const floorSpecificPoints = points.filter((point) => point.floorId === floorId);
        return {
          id: floorId,
          targetId: target.id,
          floorName,
          planSvgOrJson: serializePlanToSvg(plansByFloor[floorName], floorSpecificPoints, noEntryZonesByFloor[floorName]),
        };
      }),
    [noEntryZonesByFloor, plansByFloor, points, target.id],
  );

  function updateTarget(patch: Partial<Target>) {
    onChange({ ...activeCase, target: { ...target, ...patch } });
  }

  function addPoint(position: { x: number; y: number }) {
    const photoNo = nextPhotoNo(points.map((point) => point.photoNo));
    const newPoint: InspectionPoint = {
      id: crypto.randomUUID(),
      floorId: activeFloorId,
      photoNo,
      x: position.x,
      y: position.y,
      directionAngle: 0,
      componentType: ["牆面"],
      conditionType: ["現況"],
      note: "",
      createdAt: new Date().toISOString(),
    };
    setPoints((current) => [...current, newPoint]);
    setActivePointId(newPoint.id);
  }

  function updatePoint(nextPoint: InspectionPoint) {
    setPoints((current) => current.map((point) => (point.id === nextPoint.id ? nextPoint : point)));
  }

  function attachPhotoToPoint(point: InspectionPoint, file: File) {
    const imageUrl = URL.createObjectURL(file);
    const caption = point.photo?.caption || buildPhotoCaption(point);
    updatePoint({
      ...point,
      photo: {
        id: point.photo?.id ?? crypto.randomUUID(),
        pointId: point.id,
        imageUrl,
        caption,
        takenAt: new Date().toISOString(),
      },
    });
    setActivePointId(point.id);
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 lg:grid-cols-3">
        <Panel title="牆面" icon={<Building2 size={18} />}>
          <OptionGroup value={target.wallFinish} options={wallFinishOptions} onChange={(wallFinish) => updateTarget({ wallFinish })} />
        </Panel>
        <Panel title="平頂" icon={<Building2 size={18} />}>
          <OptionGroup value={target.ceilingFinish} options={ceilingFinishOptions} onChange={(ceilingFinish) => updateTarget({ ceilingFinish })} />
        </Panel>
        <Panel title="地坪" icon={<Building2 size={18} />}>
          <OptionGroup value={target.floorFinish} options={floorFinishOptions} onChange={(floorFinish) => updateTarget({ floorFinish })} />
        </Panel>
        <section className="rounded-lg border border-line bg-paper p-4 shadow-sm lg:col-span-3">
          <h2 className="mb-3 text-lg font-bold">★會勘狀況</h2>
          <div className="grid gap-2 md:grid-cols-4">
            {surveyStatusOptions.map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold ${
                  target.surveyStatus.split("、").includes(option)
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={target.surveyStatus.split("、").includes(option)}
                  onChange={() => {
                    const current = target.surveyStatus ? target.surveyStatus.split("、") : [];
                    const next = current.includes(option)
                      ? current.filter((item) => item !== option)
                      : [...current, option];
                    updateTarget({ surveyStatus: next.join("、") });
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3">
            <div className="flex items-center gap-2 font-bold">
              <Building2 size={18} /> 樓層
            </div>
            <div className="flex flex-wrap gap-2">
              {floorNames.map((floorName) => (
                <button
                  key={floorName}
                  type="button"
                  onClick={() => setActiveFloorName(floorName)}
                  className={`min-h-11 rounded-md border px-4 text-sm font-bold ${
                    floorName === activeFloorName ? "border-accent bg-accent text-white" : "border-line bg-white"
                  }`}
                >
                  {floorName}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addPoint({ x: 120 + floorPoints.length * 48, y: 120 })}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
            >
              <Plus size={18} /> 新增照片點
            </button>
          </div>

          <FloorPlanCanvas
            points={floorPoints}
            activePointId={activePointId}
            planPaths={plansByFloor[activeFloorName]}
            noEntryZones={noEntryZonesByFloor[activeFloorName]}
            onPlanChange={(paths) => setPlansByFloor((current) => ({ ...current, [activeFloorName]: paths }))}
            onNoEntryZonesChange={(zones) => setNoEntryZonesByFloor((current) => ({ ...current, [activeFloorName]: zones }))}
            onAddPoint={addPoint}
            onMovePoint={(pointId, position) =>
              setPoints((current) =>
                current.map((point) => (point.id === pointId ? { ...point, x: position.x, y: position.y } : point)),
              )
            }
            onSelectPoint={setActivePointId}
            onClearPlan={() => setPlansByFloor((current) => ({ ...current, [activeFloorName]: [] }))}
            onUndoPlan={() => {
              const zones = noEntryZonesByFloor[activeFloorName];
              if (zones.length > 0) {
                setNoEntryZonesByFloor((current) => ({
                  ...current,
                  [activeFloorName]: current[activeFloorName].slice(0, -1),
                }));
                return;
              }
              setPlansByFloor((current) => ({ ...current, [activeFloorName]: current[activeFloorName].slice(0, -1) }));
            }}
          />

          <section className="mt-4 rounded-lg border border-line bg-paper p-3">
            <h2 className="mb-2 text-lg font-bold">本層照片紀錄</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#efe6d8] text-left">
                    <th className="border border-line p-2">照片編號</th>
                    <th className="border border-line p-2">樓層</th>
                    <th className="border border-line p-2">位置</th>
                    <th className="border border-line p-2">現況/缺失</th>
                    <th className="border border-line p-2">裂縫寬(mm)</th>
                    <th className="border border-line p-2">照片</th>
                    <th className="border border-line p-2">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {floorPoints.map((point) => (
                    <tr
                      key={point.id}
                      onClick={() => setActivePointId(point.id)}
                      className={`cursor-pointer ${point.id === activePointId ? "bg-[#fff1d7]" : "bg-white"}`}
                    >
                      <td className="border border-line p-2 font-bold text-accent">#{point.photoNo}</td>
                      <td className="border border-line p-2">{activeFloorName}</td>
                      <td className="border border-line p-2">{point.componentType.join("、")}</td>
                      <td className="border border-line p-2">{point.conditionType.join("、")}</td>
                      <td className="border border-line p-2">{point.crackWidthMm ?? ""}</td>
                      <td className="border border-line p-2">
                        <label className="relative inline-flex min-h-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-accent bg-[#fff8e8] px-3 text-xs font-semibold text-accent">
                          {point.photo?.imageUrl ? "更換照片" : "上傳照片"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              event.stopPropagation();
                              const file = event.target.files?.[0];
                              if (file) attachPhotoToPoint(point, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </td>
                      <td className="border border-line p-2">{point.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <InspectionForm
          point={activePoint}
          onChange={updatePoint}
          onDelete={(pointId) => {
            setPoints((current) => current.filter((point) => point.id !== pointId));
            setActivePointId(undefined);
          }}
        />
      </section>

      <section className="rounded-lg border border-line bg-paper p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">附件七匯出預覽</h2>
            <p className="text-sm text-muted">目前附件七資料仍是前端暫存；接資料庫後會依案件永久保存。</p>
          </div>
          <PdfExportButton project={project} target={target} floors={floors} points={points} sitePhotos={[]} />
        </div>
      </section>
    </div>
  );
}

function AttachmentEightEditor({ activeCase }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);

  return (
    <section className="rounded-lg border border-line bg-paper p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">附件八 基地現況照片</h2>
          <p className="text-sm text-muted">用於基地外觀、施工基地周邊、道路或鄰地現況照片。</p>
        </div>
        <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-accent bg-[#fff8e8] px-3 text-sm font-semibold text-accent">
          <ImagePlus size={18} /> 新增基地照片
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const photoNo = `基地-${String(sitePhotos.length + 1).padStart(2, "0")}`;
              setSitePhotos((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  photoNo,
                  imageUrl: URL.createObjectURL(file),
                  caption: "基地現況",
                  note: "",
                  takenAt: new Date().toISOString(),
                },
              ]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sitePhotos.map((photo) => (
          <article key={photo.id} className="rounded-md border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong>{photo.photoNo}</strong>
              <button
                type="button"
                onClick={() => setSitePhotos((current) => current.filter((item) => item.id !== photo.id))}
                className="rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent"
              >
                刪除
              </button>
            </div>
            <img src={photo.imageUrl} alt={photo.photoNo} className="mb-2 max-h-56 w-full rounded border border-line object-contain" />
            <TextField
              label="說明"
              value={photo.caption}
              onChange={(caption) =>
                setSitePhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, caption } : item)))
              }
            />
          </article>
        ))}
        {sitePhotos.length === 0 ? <p className="text-sm text-muted">尚未新增基地現況照片。</p> : null}
      </div>
      <div className="mt-4">
        <PdfExportButton project={activeCase.project} target={activeCase.target} floors={[]} points={[]} sitePhotos={sitePhotos} />
      </div>
    </section>
  );
}

function ExportPanel({ activeCase }: { activeCase: InspectionCase }) {
  return (
    <div className="grid gap-4">
      <Panel title="完整報告匯出流程" icon={<FileText size={18} />}>
        <ol className="grid gap-2 text-sm">
          <li className="rounded-md border border-line bg-white p-3">1. 封面：由基本資料自動生成。</li>
          <li className="rounded-md border border-line bg-white p-3">2. 目錄：正式 PDF 匯出時計算頁碼。</li>
          <li className="rounded-md border border-line bg-white p-3">3. 主文：固定章節標題，內容可編輯。</li>
          <li className="rounded-md border border-line bg-white p-3">4. 附件：上傳 PDF 與系統編輯附件合併。</li>
        </ol>
      </Panel>
      <Panel title="目前可匯出" icon={<FileText size={18} />}>
        <p className="mb-3 text-sm text-muted">目前先保留附件七/八 HTML to PDF 匯出。完整報告 PDF 需要下一階段加入封面/目錄/主文模板與附件 PDF 合併。</p>
        <PdfExportButton project={activeCase.project} target={activeCase.target} floors={[]} points={[]} sitePhotos={[]} />
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-paper p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  icon,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-muted">{label}</span>
      <span className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent outline-none"
        />
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function OptionGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <label
          key={option}
          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold ${
            value === option ? "border-accent bg-accent text-white" : "border-line bg-white"
          }`}
        >
          <input type="radio" className="sr-only" checked={value === option} onChange={() => onChange(option)} />
          {option}
        </label>
      ))}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-1 font-bold">{value || "尚未填寫"}</div>
    </div>
  );
}

function createCase(userId: string): InspectionCase {
  const project: Project = {
    id: crypto.randomUUID(),
    caseNo: "115鑑000號",
    projectName: "鄰房現況鑑定報告書",
    applicantName: "申請單位",
    applicantAddress: "",
    applicantPhone: "",
    contactPerson: "",
    inspectionType: "施工前鄰房現況鑑定",
    inspectionDate: new Date().toISOString().slice(0, 10),
    receivedDate: "",
    receivedNo: "",
    targetSummary: "",
    engineerNames: "",
    associationEngineers: "",
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
    id: crypto.randomUUID(),
    project,
    target,
    reportSections: createDefaultSections(project),
    attachments: createDefaultAttachments(),
    createdByUserId: userId,
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultSections(project: Project): ReportSection[] {
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
      content: `民國○○○年○月○日\n(社團法人臺中市土木技師公會 ○○○年○月○日收文號：鑑○○○)`,
    },
    {
      id: "target-location",
      order: 3,
      title: "三、標的物之坐落",
      source: "basic",
      fixedTitle: true,
      content: project.targetSummary ?? "",
    },
    { id: "purpose", order: 4, title: "四、鑑定要旨", source: "editable", fixedTitle: true, content: "請輸入鑑定要旨。" },
    {
      id: "basis",
      order: 5,
      title: "五、鑑定依據",
      source: "editable",
      fixedTitle: true,
      content: "鑑定依據：\n(一) 鑑定申請書(詳附件一)。\n(二) 本公會會勘通知函(詳附件二)。\n(三) 彰化縣建築物施工損壞鄰房事件處理自治條例。\n(四) 臺中市土木技師公會鑑定手冊。",
    },
    { id: "inspection-dates", order: 6, title: "六、會勘日期", source: "editable", fixedTitle: true, content: "第一次：" },
    {
      id: "staff",
      order: 7,
      title: "七、會勘人員",
      source: "basic",
      fixedTitle: true,
      content: `申請單位代表：${project.applicantName}\n社團法人臺中市土木技師公會：${project.associationEngineers ?? ""} 技師\n所有權人代表：詳附件三。`,
    },
    { id: "process", order: 8, title: "八、鑑定過程", source: "editable", fixedTitle: true, content: "請輸入鑑定過程。" },
    { id: "site-status", order: 9, title: "九、工地現況", source: "editable", fixedTitle: true, content: "請輸入工地現況。" },
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
      content: "附件一：鑑定申請書\n附件二：會勘通知函\n附件三：會勘紀錄表\n附件四：工地及鑑定標的物位置圖\n附件五：水準測量\n附件六：傾斜率測量\n附件七：鑑定標的物平面配置圖、現況調查紀錄表及照片\n附件八：基地現況照片",
    },
  ];
}

function createDefaultAttachments(): AttachmentSlot[] {
  return [
    { id: "att-1", no: 1, title: "鑑定申請書", mode: "upload", status: "empty" },
    { id: "att-2", no: 2, title: "會勘通知函", mode: "upload", status: "empty" },
    { id: "att-3", no: 3, title: "會勘紀錄表", mode: "upload", status: "empty" },
    { id: "att-4", no: 4, title: "工地及鑑定標的物位置圖", mode: "editor", status: "editing" },
    { id: "att-5", no: 5, title: "水準測量", mode: "upload", status: "empty" },
    { id: "att-6", no: 6, title: "傾斜率測量", mode: "upload", status: "empty" },
    { id: "att-7", no: 7, title: "鑑定標的物平面配置圖、現況調查紀錄表及照片", mode: "editor", status: "editing" },
    { id: "att-8", no: 8, title: "基地現況照片", mode: "editor", status: "editing" },
  ];
}

function toChineseNumber(value: number) {
  return ["零", "一", "二", "三", "四", "五", "六", "七", "八"][value] ?? String(value);
}
