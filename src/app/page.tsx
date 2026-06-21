"use client";

import { useEffect, useMemo, useState } from "react";
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
  Trash2,
  Users,
} from "lucide-react";
import { FloorPlanCanvas, serializePlanToSvg } from "@/components/FloorPlanCanvas";
import { InspectionForm } from "@/components/InspectionForm";
import { PdfExportButton } from "@/components/PdfExportButton";
import { PwaRegister } from "@/components/PwaRegister";
import { buildPhotoCaption, nextPhotoNo } from "@/lib/caption";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase-browser";
import type {
  AppUser,
  AttachmentSlot,
  Floor,
  FloorName,
  InspectionCase,
  InspectionPoint,
  NoEntryZone,
  Project,
  ProjectEngineer,
  ReportSection,
  SitePhoto,
  Target,
} from "@/types/inspection";

type WorkspaceTab = "basic" | "main" | "attachments" | "attachment5" | "attachment6" | "attachment7" | "attachment8" | "export";

const floorNames: FloorName[] = ["1F", "2F", "3F", "RF"];
const usageOptions = ["商業", "住宅", "辦公室", "工業", "宗教", "其他"];
const wallFinishOptions = ["水泥粉光", "油漆", "壁紙", "磁磚", "裝飾品", "其他"];
const ceilingFinishOptions = ["水泥粉光", "油漆", "壁紙", "木架", "輕鋼架", "其他"];
const floorFinishOptions = ["塑膠地磚", "磨石子", "磁磚", "地毯", "木板", "其他"];
const surveyStatusOptions = ["部份隔間不便拍照", "拒絕鑑定", "屢次造訪無人", "本戶裝修"];

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cases, setCases] = useState<InspectionCase[]>(() => [createCase("user-admin")]);
  const [activeCaseId, setActiveCaseId] = useState(cases[0]?.id);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("basic");
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [managedUsers, setManagedUsers] = useState<AppUser[]>([]);

  const activeCase = cases.find((item) => item.id === activeCaseId) ?? cases[0];
  const supabaseEnabled = hasSupabaseEnv();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const signedInUser = {
          id: data.user.id,
          name: data.user.user_metadata?.name ?? data.user.email ?? "Google 使用者",
          email: data.user.email ?? "",
          role: "admin" as const,
        };
        setCurrentUser({
          ...signedInUser,
        });
        setManagedUsers((current) => upsertManagedUser(current, signedInUser));
      }
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        return;
      }

      const signedInUser = {
        id: session.user.id,
        name: session.user.user_metadata?.name ?? session.user.email ?? "Google 使用者",
        email: session.user.email ?? "",
        role: "admin" as const,
      };

      setCurrentUser(signedInUser);
      setManagedUsers((current) => upsertManagedUser(current, signedInUser));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setCurrentUser(null);
  }

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

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="rounded-lg border border-line bg-paper p-6 text-center shadow-sm">
          <div className="text-lg font-bold">載入登入狀態中</div>
          <p className="mt-2 text-sm text-muted">正在確認 Google OAuth session。</p>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 text-foreground">
        <PwaRegister />
        <section className="mx-auto grid min-h-[calc(100vh-48px)] max-w-5xl place-items-center">
          <div className="w-full rounded-lg border border-line bg-paper p-6 shadow-sm md:p-8">
            <p className="text-sm font-semibold tracking-[0.2em] text-accent">CIVIL INSPECTION REPORT</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">現況鑑定報告系統</h1>
            {supabaseEnabled ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-md bg-accent px-5 text-base font-bold text-white"
              >
                <LogIn size={20} /> 使用 Google 帳戶登入
              </button>
            ) : (
              <div className="mt-6 rounded-md border border-line bg-[#fff8e8] p-4 text-sm text-accent">
                尚未設定 Supabase 環境變數，請先設定 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
              </div>
            )}
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
          {currentUser.role === "admin" ? (
            <button
              type="button"
              onClick={() => setShowUserManagement((current) => !current)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                showUserManagement ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              <Users size={18} /> 使用者管理
            </button>
          ) : null}
          <button
            type="button"
            onClick={signOut}
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
        </aside>

        <section className="min-w-0">
          {showUserManagement && currentUser.role === "admin" ? (
            <UserManagementPanel users={managedUsers} onChange={setManagedUsers} currentUserId={currentUser.id} />
          ) : null}
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
          {activeTab === "attachment5" ? <AttachmentPlaceholder no={5} title="水準測量" description="附件五將建立測量成果資料輸入、PDF 上傳與報告合併功能。" /> : null}
          {activeTab === "attachment6" ? <AttachmentPlaceholder no={6} title="傾斜率測量" description="附件六將建立傾斜率測量成果資料輸入、照片或 PDF 上傳與報告合併功能。" /> : null}
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
  { id: "attachment5", label: "附件五" },
  { id: "attachment6", label: "附件六" },
  { id: "attachment7", label: "附件七" },
  { id: "attachment8", label: "附件八" },
  { id: "export", label: "匯出報告" },
];

function upsertManagedUser(users: AppUser[], nextUser: AppUser) {
  if (users.some((user) => user.id === nextUser.id || user.email === nextUser.email)) {
    return users.map((user) => (user.id === nextUser.id || user.email === nextUser.email ? { ...user, ...nextUser } : user));
  }
  return [nextUser, ...users];
}

function getProjectEngineers(project: Project): ProjectEngineer[] {
  if (project.engineers?.length) return project.engineers;
  if (project.engineerNames) {
    return project.engineerNames
      .split("、")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name, index) => ({ id: `legacy-engineer-${index}`, name, memberNo: "" }));
  }
  return [{ id: "engineer-default", name: "", memberNo: "" }];
}

function buildEngineerSignature(project: Project) {
  const engineers = getProjectEngineers(project).filter((engineer) => engineer.name || engineer.memberNo);
  const lines = engineers.length
    ? engineers.map((engineer, index) => {
        const prefix = index === 0 ? "鑑定人：" : "　　　　";
        const memberNo = engineer.memberNo ? `（會員編號第${engineer.memberNo}號）` : "";
        return `${prefix}${engineer.name || "OOO"} 技師${memberNo}`;
      })
    : ["鑑定人：OOO 技師（會員編號第OOO號）"];

  return ["社團法人臺中市土木技師公會", ...lines].join("\n");
}

function formatEngineerNames(project: Project) {
  return getProjectEngineers(project)
    .map((engineer) => engineer.name.trim())
    .filter(Boolean)
    .join("、");
}

function formatRocDate(date: string | undefined) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return `中 華 民 國 ${parsed.getFullYear() - 1911} 年 ${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`;
}

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

function UserManagementPanel({
  users,
  onChange,
  currentUserId,
}: {
  users: AppUser[];
  onChange: (users: AppUser[]) => void;
  currentUserId: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppUser["role"]>("user");

  function addUser() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    onChange(
      upsertManagedUser(users, {
        id: `pending-${normalizedEmail}`,
        name: name.trim() || normalizedEmail,
        email: normalizedEmail,
        role,
      }),
    );
    setEmail("");
    setName("");
    setRole("user");
  }

  return (
    <section className="mb-4 rounded-lg border border-line bg-paper p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users size={18} /> 使用者管理
        </h2>
        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted">
          {users.length} 位使用者
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
        <TextField label="Google Email" value={email} onChange={setEmail} />
        <TextField label="姓名" value={name} onChange={setName} />
        <SelectField label="角色" value={role} options={["admin", "user"]} onChange={(value) => setRole(value as AppUser["role"])} />
        <button
          type="button"
          onClick={addUser}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-white"
        >
          <Plus size={18} /> 新增
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#efe6d8] text-left">
              <th className="border border-line p-2">使用者</th>
              <th className="border border-line p-2">Email</th>
              <th className="border border-line p-2">角色</th>
              <th className="border border-line p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-white">
                <td className="border border-line p-2 font-bold">{user.name}</td>
                <td className="border border-line p-2">{user.email}</td>
                <td className="border border-line p-2">
                  <select
                    value={user.role}
                    onChange={(event) =>
                      onChange(users.map((item) => (item.id === user.id ? { ...item, role: event.target.value as AppUser["role"] } : item)))
                    }
                    className="min-h-10 rounded-md border border-line bg-white px-2"
                  >
                    <option value="admin">管理者</option>
                    <option value="user">使用者</option>
                  </select>
                </td>
                <td className="border border-line p-2">
                  <button
                    type="button"
                    disabled={user.id === currentUserId}
                    onClick={() => onChange(users.filter((item) => item.id !== user.id))}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-accent px-3 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={16} /> 刪除
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr className="bg-white">
                <td className="border border-line p-3 text-muted" colSpan={4}>
                  尚未建立使用者名單。登入帳號會自動加入此清單。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AttachmentPlaceholder({ no, title, description }: { no: number; title: string; description: string }) {
  return (
    <Panel title={`附件${toChineseNumber(no)} ${title}`} icon={<FileText size={18} />}>
      <div className="rounded-md border border-dashed border-accent bg-[#fff8e8] p-4">
        <div className="text-base font-bold text-accent">待開發</div>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
    </Panel>
  );
}

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
  const engineers = getProjectEngineers(project);

  function updateProject(patch: Partial<Project>) {
    onChange({ ...activeCase, project: { ...project, ...patch } });
  }

  function updateTarget(patch: Partial<Target>) {
    onChange({ ...activeCase, target: { ...target, ...patch } });
  }

  function updateEngineer(engineerId: string, patch: Partial<ProjectEngineer>) {
    updateProject({
      engineers: engineers.map((engineer) => (engineer.id === engineerId ? { ...engineer, ...patch } : engineer)),
    });
  }

  function addEngineer() {
    updateProject({
      engineers: [
        ...engineers,
        {
          id: crypto.randomUUID(),
          name: "",
          memberNo: "",
        },
      ],
    });
  }

  function removeEngineer(engineerId: string) {
    const next = engineers.filter((engineer) => engineer.id !== engineerId);
    updateProject({
      engineers: next.length
        ? next
        : [
            {
              id: crypto.randomUUID(),
              name: "",
              memberNo: "",
            },
          ],
    });
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
          <TextField label="鑑定類型" value={project.inspectionType} onChange={(inspectionType) => updateProject({ inspectionType })} />
          <TextField label="完稿日期" type="date" value={project.finalDate ?? ""} onChange={(finalDate) => updateProject({ finalDate })} />
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
        <section className="mt-4 rounded-md border border-line bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">鑑定技師</h3>
            <button
              type="button"
              onClick={addEngineer}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
            >
              <Plus size={16} /> 新增技師
            </button>
          </div>
          <div className="grid gap-3">
            {engineers.map((engineer, index) => (
              <div key={engineer.id} className="grid gap-3 rounded-md border border-line bg-paper p-3 md:grid-cols-[1fr_1fr_auto]">
                <TextField
                  label={`鑑定技師 ${index + 1}`}
                  value={engineer.name}
                  onChange={(name) => updateEngineer(engineer.id, { name })}
                />
                <TextField
                  label="會員編號"
                  value={engineer.memberNo}
                  onChange={(memberNo) => updateEngineer(engineer.id, { memberNo })}
                />
                <button
                  type="button"
                  onClick={() => removeEngineer(engineer.id)}
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent px-3 text-sm font-semibold text-accent"
                >
                  <Trash2 size={16} /> 刪除
                </button>
              </div>
            ))}
          </div>
        </section>
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
  const engineerSignature = buildEngineerSignature(activeCase.project);
  const finalDateText = formatRocDate(activeCase.project.finalDate);

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
          <InfoLine label="鑑定技師" value={getProjectEngineers(activeCase.project).map((engineer) => engineer.name).filter(Boolean).join("、") || "尚未填寫"} />
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
              {section.id === "attachments" ? (
                <div className="mt-3 rounded-md border border-line bg-white p-4 leading-8">
                  <div className="whitespace-pre-wrap font-bold">{engineerSignature}</div>
                  <div className="mt-3 text-right font-bold">{finalDateText || "中 華 民 國　　年　　月　　日"}</div>
                </div>
              ) : null}
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
  const [targets, setTargets] = useState<Target[]>(() => [{ ...activeCase.target }]);
  const [activeTargetId, setActiveTargetId] = useState(activeCase.target.id);
  const [activeFloorName, setActiveFloorName] = useState<FloorName>("1F");
  const [plansByTargetFloor, setPlansByTargetFloor] = useState<Record<string, Record<FloorName, string[]>>>({});
  const [noEntryZonesByTargetFloor, setNoEntryZonesByTargetFloor] = useState<Record<string, Record<FloorName, NoEntryZone[]>>>({});
  const [points, setPoints] = useState<InspectionPoint[]>([]);
  const [activePointId, setActivePointId] = useState<string | undefined>();

  const project = activeCase.project;
  const target = targets.find((item) => item.id === activeTargetId) ?? targets[0] ?? activeCase.target;
  const activeFloorId = floorIdForTarget(target.id, activeFloorName);
  const activePlanPaths = plansByTargetFloor[target.id]?.[activeFloorName] ?? [];
  const activeNoEntryZones = noEntryZonesByTargetFloor[target.id]?.[activeFloorName] ?? [];
  const floorPoints = points.filter((point) => point.floorId === activeFloorId);
  const activePoint = points.find((point) => point.id === activePointId);

  const floors: Floor[] = useMemo(
    () =>
      floorNames.map((floorName) => {
        const floorId = floorIdForTarget(target.id, floorName);
        const floorSpecificPoints = points.filter((point) => point.floorId === floorId);
        return {
          id: floorId,
          targetId: target.id,
          floorName,
          planSvgOrJson: serializePlanToSvg(
            plansByTargetFloor[target.id]?.[floorName] ?? [],
            floorSpecificPoints,
            noEntryZonesByTargetFloor[target.id]?.[floorName] ?? [],
          ),
        };
      }),
    [noEntryZonesByTargetFloor, plansByTargetFloor, points, target.id],
  );

  function updateTarget(patch: Partial<Target>) {
    const nextTarget = { ...target, ...patch };
    setTargets((current) => current.map((item) => (item.id === target.id ? nextTarget : item)));
    if (target.id === activeCase.target.id) {
      onChange({ ...activeCase, target: nextTarget });
    }
  }

  function addTarget() {
    const newTarget: Target = {
      ...activeCase.target,
      id: crypto.randomUUID(),
      address: `新增標的物 ${targets.length + 1}`,
      note: "",
    };
    setTargets((current) => [...current, newTarget]);
    setActiveTargetId(newTarget.id);
    setActiveFloorName("1F");
    setActivePointId(undefined);
  }

  function removeTarget(targetId: string) {
    if (targets.length <= 1) return;
    const nextTargets = targets.filter((item) => item.id !== targetId);
    setTargets(nextTargets);
    setPoints((current) => current.filter((point) => !point.floorId.startsWith(`${targetId}__`)));
    if (activeTargetId === targetId) {
      setActiveTargetId(nextTargets[0].id);
      setActiveFloorName("1F");
      setActivePointId(undefined);
    }
  }

  function updateActivePlan(paths: string[]) {
    setPlansByTargetFloor((current) => ({
      ...current,
      [target.id]: {
        ...emptyFloorRecord<string[]>(),
        ...current[target.id],
        [activeFloorName]: paths,
      },
    }));
  }

  function updateActiveNoEntryZones(zones: NoEntryZone[]) {
    setNoEntryZonesByTargetFloor((current) => ({
      ...current,
      [target.id]: {
        ...emptyFloorRecord<NoEntryZone[]>(),
        ...current[target.id],
        [activeFloorName]: zones,
      },
    }));
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
      <section className="rounded-lg border border-line bg-paper p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">標的物之坐落</h2>
          <button
            type="button"
            onClick={addTarget}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-3 text-sm font-bold text-white"
          >
            <Plus size={16} /> 新增標的物
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {targets.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTargetId(item.id);
                setActiveFloorName("1F");
                setActivePointId(undefined);
              }}
              className={`min-h-11 rounded-md border px-3 text-sm font-bold ${
                item.id === target.id ? "border-accent bg-accent text-white" : "border-line bg-white"
              }`}
            >
              標的物 {index + 1}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextField label="標的物之坐落" value={target.address} onChange={(address) => updateTarget({ address })} />
          <button
            type="button"
            disabled={targets.length <= 1}
            onClick={() => removeTarget(target.id)}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent px-3 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} /> 刪除此標的物
          </button>
        </div>
      </section>

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
            planPaths={activePlanPaths}
            noEntryZones={activeNoEntryZones}
            onPlanChange={updateActivePlan}
            onNoEntryZonesChange={updateActiveNoEntryZones}
            onAddPoint={addPoint}
            onMovePoint={(pointId, position) =>
              setPoints((current) =>
                current.map((point) => (point.id === pointId ? { ...point, x: position.x, y: position.y } : point)),
              )
            }
            onSelectPoint={setActivePointId}
            onClearPlan={() => updateActivePlan([])}
            onUndoPlan={() => {
              const zones = activeNoEntryZones;
              if (zones.length > 0) {
                updateActiveNoEntryZones(zones.slice(0, -1));
                return;
              }
              updateActivePlan(activePlanPaths.slice(0, -1));
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
    applicantName: "OO營造有限公司",
    applicantAddress: "",
    applicantPhone: "",
    contactPerson: "",
    inspectionType: "施工前鄰房現況鑑定",
    inspectionDate: new Date().toISOString().slice(0, 10),
    receivedDate: "",
    receivedNo: "",
    targetSummary: "",
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
      content: `申請單位代表：${project.applicantName}\n社團法人臺中市土木技師公會：${formatEngineerNames(project)} 技師\n所有權人代表：詳附件三。`,
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
