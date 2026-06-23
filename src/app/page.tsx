"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Home,
  ImagePlus,
  Loader2,
  LogIn,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { FloorPlanCanvas, serializePlanToSvg } from "@/components/FloorPlanCanvas";
import type { FloorPlanMode } from "@/components/FloorPlanCanvas";
import { AttachmentFiveEditor } from "@/components/AttachmentFiveEditor";
import { AttachmentSixEditor } from "@/components/AttachmentSixEditor";
import { InspectionForm } from "@/components/InspectionForm";
import { PdfExportButton } from "@/components/PdfExportButton";
import { PwaRegister } from "@/components/PwaRegister";
import { buildPhotoCaption, nextPhotoNo } from "@/lib/caption";
import {
  deleteManagedUser,
  deleteInspectionCase,
  clearLocalDraft,
  fetchInspectionCases,
  fetchManagedUsers,
  loadLocalDraft,
  resolveSignedInAppUser,
  saveInspectionCase,
  saveLocalDraft,
  saveManagedUser,
} from "@/lib/case-store";
import { createCase } from "@/lib/defaults";
import { defaultFloorNames, emptyFloorRecord, floorIdForTarget } from "@/lib/floors";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase-browser";
import { commonRoadNames, getDistricts, taiwanAddress } from "@/lib/tw-address";
import type {
  AppUser,
  AttachmentSlot,
  Floor,
  FloorPlan,
  FloorPlanData,
  FloorName,
  InspectionCase,
  InspectionPoint,
  NoEntryZone,
  Project,
  ProjectEngineer,
  ReportStatus,
  SitePhoto,
  Target,
} from "@/types/inspection";

type WorkspaceTab = "basic" | "main" | "attachments" | "attachment5" | "attachment6" | "attachment7" | "attachment8" | "export";
type AppView = "workspace" | "users";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const usageOptions = ["商業", "住宅", "辦公室", "工業", "宗教", "其他"];
const wallFinishOptions = ["水泥粉光", "油漆", "壁紙", "磁磚", "裝飾品", "其他"];
const ceilingFinishOptions = ["水泥粉光", "油漆", "壁紙", "木架", "輕鋼架", "其他"];
const floorFinishOptions = ["塑膠地磚", "磨石子", "磁磚", "地毯", "木板", "其他"];
const surveyStatusOptions = ["部份隔間不便拍照", "拒絕鑑定", "屢次造訪無人", "本戶裝修"];
const reportStatusOptions: ReportStatus[] = ["草稿", "審閱中", "待補件", "完稿", "已歸檔"];

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cases, setCases] = useState<InspectionCase[]>(() => [createCase("user-admin")]);
  const [activeCaseId, setActiveCaseId] = useState(cases[0]?.id);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("basic");
  const [activeView, setActiveView] = useState<AppView>("workspace");
  const [managedUsers, setManagedUsers] = useState<AppUser[]>([]);
  const [caseSearch, setCaseSearch] = useState("");
  const [authError, setAuthError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const saveRequestId = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCase = cases.find((item) => item.id === activeCaseId) ?? cases[0];
  const filteredCases = cases.filter(
    (item) =>
      item.project.caseNo.includes(caseSearch) ||
      item.project.projectName.includes(caseSearch),
  );
  const supabaseEnabled = hasSupabaseEnv();
  const exportFloors = activeCase ? buildAttachmentSevenFloors(activeCase) : [];
  const exportPoints = activeCase?.attachmentSeven?.points ?? [];

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) {
          return loadSignedInUser(data.user);
        }
      })
      .catch((error) => {
        console.error("Failed to load Supabase user", error);
      })
      .finally(() => setAuthLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        return;
      }

      void loadSignedInUser(session.user);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    function syncLocalDrafts() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      const drafts = cases
        .map((inspectionCase) => loadLocalDraft(inspectionCase.id))
        .filter((draft): draft is InspectionCase => Boolean(draft));

      if (!drafts.length) return;
      setSaveStatus("saving");

      void Promise.all(
        drafts.map((draft) =>
          saveInspectionCase(supabase, draft).then(() => {
            clearLocalDraft(draft.id);
          }),
        ),
      )
        .then(() => {
          setSaveStatus("saved");
          setLastSavedAt(new Date().toISOString());
          setSaveError("");
        })
        .catch((error) => {
          console.error("Failed to sync local drafts after reconnect", error);
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "儲存失敗，已暫存至本機");
        });
    }

    window.addEventListener("online", syncLocalDrafts);
    return () => window.removeEventListener("online", syncLocalDrafts);
  }, [cases, currentUser]);

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
    const signedOutCase = createCase("user-admin");
    setCurrentUser(null);
    setCases([signedOutCase]);
    setActiveCaseId(signedOutCase.id);
    setActiveTab("basic");
    setActiveView("workspace");
    setSaveStatus("idle");
    setLastSavedAt(null);
    setSaveError("");
  }

  async function loadSignedInUser(user: Parameters<typeof resolveSignedInAppUser>[1]) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) return;

    try {
      const signedInUser = await resolveSignedInAppUser(supabase, user);
      setAuthError("");
      setCurrentUser(signedInUser);
      setManagedUsers(await fetchManagedUsers(supabase, signedInUser));
      const savedCases = await fetchInspectionCases(supabase, signedInUser.id);
      if (savedCases.length) {
        const resolvedCases = await restoreLocalDraftsIfNeeded(supabase, savedCases);
        setCases(resolvedCases);
        setActiveCaseId(resolvedCases[0].id);
        setSaveStatus("saved");
        setLastSavedAt(resolvedCases[0].updatedAt);
        setSaveError("");
        return;
      }

      const firstCase = createCase(signedInUser.id);
      setCases([firstCase]);
      setActiveCaseId(firstCase.id);
      await saveInspectionCase(supabase, firstCase);
      setSaveStatus("saved");
      setLastSavedAt(new Date().toISOString());
      setSaveError("");
    } catch (error) {
      console.error("Failed to load inspection cases from Supabase", error);
      const message = error instanceof Error ? error.message : "登入失敗，請確認此 Google 帳戶是否已被管理者授權。";
      setAuthError(message);
      await supabase.auth.signOut();
      setCurrentUser(null);
    }
  }

  const persistCase = useCallback((nextCase: InspectionCase) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !currentUser) return;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    const requestId = saveRequestId.current + 1;
    saveRequestId.current = requestId;
    persistTimer.current = setTimeout(() => {
      setSaveStatus("saving");
      setSaveError("");

      void saveInspectionCase(supabase, nextCase)
        .then(() => {
          if (saveRequestId.current !== requestId) return;
          clearLocalDraft(nextCase.id);
          setSaveStatus("saved");
          setLastSavedAt(new Date().toISOString());
        })
        .catch((error) => {
          if (saveRequestId.current !== requestId) return;
          console.error("Failed to save inspection case to Supabase", error);
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "儲存失敗，已暫存至本機");
          saveLocalDraft(nextCase);
        });
    }, 600);
  }, [currentUser]);

  async function restoreLocalDraftsIfNeeded(supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>, cloudCases: InspectionCase[]) {
    const resolvedCases: InspectionCase[] = [];

    for (const cloudCase of cloudCases) {
      const draft = loadLocalDraft(cloudCase.id);
      if (!draft) {
        resolvedCases.push(cloudCase);
        continue;
      }

      const confirmed = window.confirm(
        `案件「${cloudCase.project.caseNo} ${cloudCase.project.projectName}」偵測到本機有未同步的草稿資料，是否要還原？\n（選「取消」將使用雲端版本）`,
      );

      if (!confirmed) {
        clearLocalDraft(cloudCase.id);
        resolvedCases.push(cloudCase);
        continue;
      }

      resolvedCases.push(draft);
      void saveInspectionCase(supabase, draft)
        .then(() => {
          clearLocalDraft(draft.id);
          setSaveStatus("saved");
          setLastSavedAt(new Date().toISOString());
          setSaveError("");
        })
        .catch((error) => {
          console.error("Failed to sync restored local draft", error);
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "儲存失敗，已暫存至本機");
        });
    }

    return resolvedCases;
  }

  function updateCase(nextCase: InspectionCase) {
    const persistedCase = {
      ...nextCase,
      updatedAt: new Date().toISOString(),
      project: {
        ...nextCase.project,
        updatedAt: new Date().toISOString(),
      },
    };
    setCases((current) =>
      current.map((item) =>
        item.id === persistedCase.id ? persistedCase : item,
      ),
    );
    persistCase(persistedCase);
  }

  function addCase() {
    const nextCase = createCase(currentUser?.id ?? "user-admin");
    setCases((current) => [nextCase, ...current]);
    setActiveCaseId(nextCase.id);
    setActiveTab("basic");
    setActiveView("workspace");
    persistCase(nextCase);
  }

  function manualSaveCase() {
    if (!activeCase) return;
    persistCase(activeCase);
  }

  function selectCase(item: InspectionCase) {
    const draft = loadLocalDraft(item.id);
    let nextCase = item;

    if (draft && draft.updatedAt !== item.updatedAt) {
      const confirmed = window.confirm(
        `案件「${item.project.caseNo} ${item.project.projectName}」偵測到本機有未同步的草稿資料，是否要還原？\n（選「取消」將使用雲端版本）`,
      );

      if (confirmed) {
        nextCase = draft;
        setCases((current) => current.map((caseItem) => (caseItem.id === draft.id ? draft : caseItem)));
        const supabase = createSupabaseBrowserClient();
        if (supabase) {
          void saveInspectionCase(supabase, draft)
            .then(() => {
              clearLocalDraft(draft.id);
              setSaveStatus("saved");
              setLastSavedAt(new Date().toISOString());
              setSaveError("");
            })
            .catch((error) => {
              console.error("Failed to sync restored local draft", error);
              setSaveStatus("error");
              setSaveError(error instanceof Error ? error.message : "儲存失敗，已暫存至本機");
            });
        }
      } else {
        clearLocalDraft(item.id);
      }
    }

    setActiveCaseId(nextCase.id);
    setActiveTab("basic");
    setSaveStatus("saved");
    setLastSavedAt(nextCase.updatedAt);
    setSaveError("");
  }

  async function removeCase(targetCase: InspectionCase) {
    const confirmed = window.confirm(
      `確定要刪除案件「${targetCase.project.caseNo} ${targetCase.project.projectName}」嗎？\n\n刪除後此案件的基本資料、附件七/八與測量資料都會一併移除，且無法復原。`,
    );
    if (!confirmed) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await deleteInspectionCase(supabase, targetCase.id);
      clearLocalDraft(targetCase.id);
      setCases((current) => {
        const nextCases = current.filter((item) => item.id !== targetCase.id);
        const fallbackCase = nextCases[0] ?? createCase(currentUser?.id ?? "user-admin");
        setActiveCaseId(fallbackCase.id);
        setActiveTab("basic");
        return nextCases.length ? nextCases : [fallbackCase];
      });
    } catch (error) {
      console.error("Failed to delete inspection case", error);
      window.alert(error instanceof Error ? error.message : "案件刪除失敗，請稍後再試。");
    }
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
      <main className="flex min-h-screen items-center justify-center bg-[#f0f4f0] p-6 text-foreground">
        <PwaRegister />
        <div className="w-full max-w-[480px] overflow-hidden rounded-[20px] border border-line bg-paper shadow-sm">
          <div className="relative bg-[#0d2b1e] px-7 pb-6 pt-7">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(82,183,136,0.3)] bg-[rgba(82,183,136,0.18)] px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-[#52b788]">
              <FileText size={11} />
              Civil Inspection Report
            </div>
            <h1 className="mb-1 text-[28px] font-medium leading-tight text-[#f0faf4]">
              現況鑑定
              <br />
              報告系統
            </h1>
            <p className="text-[12px] leading-relaxed text-[rgba(240,250,244,0.45)]">
              土木技師 · 鄰房現況調查
            </p>
            <div className="absolute right-6 top-1/2 flex h-[60px] w-[60px] -translate-y-1/2 items-center justify-center rounded-[14px] border border-[rgba(82,183,136,0.2)] bg-[rgba(45,106,79,0.25)] text-[#52b788]">
              <Building2 size={26} />
            </div>
          </div>

          <div className="px-7 pb-7 pt-6">
            <div className="mb-5 grid grid-cols-2 gap-2">
              {[
                { icon: <Home size={15} />, label: "照片點位標記", desc: "平面圖直覺操作", delay: "0.3s" },
                { icon: <FileText size={15} />, label: "PDF 一鍵匯出", desc: "自動生成報告附件", delay: "0.48s" },
                { icon: <ClipboardList size={15} />, label: "iPad 現場適用", desc: "觸控優化介面", delay: "0.66s" },
                { icon: <Building2 size={15} />, label: "雲端同步", desc: "多裝置資料共用", delay: "0.84s" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-2 rounded-xl bg-surface-soft p-3"
                  style={{
                    opacity: 0,
                    animation: "fadeUp 0.4s ease forwards",
                    animationDelay: item.delay,
                  }}
                >
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(45,106,79,0.1)] text-accent">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium leading-snug">{item.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-line" />
              <span className="whitespace-nowrap text-[11px] text-muted">使用 Google 帳號登入</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            {supabaseEnabled ? (
              <>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#245a42]"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                  </svg>
                  使用 Google 帳戶登入
                </button>
                {authError ? (
                  <p className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-700">
                    {authError}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-6 rounded-md border border-line bg-[#f5f5f4] p-4 text-sm text-accent">
                尚未設定 Supabase 環境變數，請先設定 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
              </div>
            )}

            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
              登入即表示您同意本系統僅供授權技師使用
              <br />
              資料依 Supabase 儲存於安全雲端環境
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!activeCase) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground md:px-6 lg:px-8">
      <PwaRegister />
      <header className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1a3d2b] bg-[#0d2b1e] px-5 py-3 text-white shadow-sm">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#52b788]">
            {activeView === "users" ? "ADMIN CONSOLE" : "REPORT WORKSPACE"}
          </p>
          <h1 className="text-2xl font-medium text-[#f0faf4] md:text-3xl">
            {activeView === "users" ? "使用者管理" : "現況鑑定報告系統"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(82,183,136,0.3)] bg-[rgba(82,183,136,0.15)] px-3 py-1.5 text-sm font-medium text-[#52b788]">
            {currentUser.name} / {currentUser.role === "admin" ? "管理者" : "使用者"}
          </span>
          {currentUser.role === "admin" ? (
            <button
              type="button"
              onClick={() => setActiveView((current) => (current === "users" ? "workspace" : "users"))}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                activeView === "users"
                  ? "border-[rgba(82,183,136,0.5)] bg-[rgba(82,183,136,0.2)] text-[#52b788]"
                  : "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.07)] text-[rgba(240,250,244,0.7)] hover:bg-[rgba(255,255,255,0.12)]"
              }`}
            >
              <Users size={16} /> {activeView === "users" ? "報告工作台" : "使用者管理"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.07)] px-3 text-sm font-medium text-[rgba(240,250,244,0.7)] transition-colors hover:bg-[rgba(255,255,255,0.12)]"
          >
            <LogIn size={16} /> 切換帳號
          </button>
        </div>
      </header>

      {activeView === "users" && currentUser.role === "admin" ? (
        <section className="mx-auto max-w-7xl">
          <UserManagementPanel
            users={managedUsers}
            onChange={setManagedUsers}
            currentUserId={currentUser.id}
            onRefresh={async () => {
              const supabase = createSupabaseBrowserClient();
              if (!supabase || !currentUser) return;
              setManagedUsers(await fetchManagedUsers(supabase, currentUser));
            }}
          />
        </section>
      ) : (
        <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="workspace-panel rounded-lg border border-line bg-paper p-3 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
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
            <input
              type="search"
              placeholder="搜尋案件編號或名稱"
              value={caseSearch}
              onChange={(event) => setCaseSearch(event.target.value)}
              className="mb-3 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none"
            />
            <div className="grid gap-2">
              {filteredCases.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-md border p-3 text-left ${
                    item.id === activeCase.id ? "border-accent bg-[#f5f5f4]" : "border-line bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectCase(item)}
                    className="block w-full text-left"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="mono-data block font-bold">{item.project.caseNo}</span>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${reportStatusBadgeClass(item.project.reportStatus ?? "草稿")}`}>
                        {item.project.reportStatus ?? "草稿"}
                      </span>
                    </span>
                    <span className="block text-sm text-muted">{item.project.projectName}</span>
                    <span className="mt-2 block text-xs text-muted">更新：{item.updatedAt.slice(0, 10)}</span>
                  </button>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void removeCase(item)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700"
                    >
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
                </article>
              ))}
              {filteredCases.length === 0 ? (
                <div className="rounded-md border border-dashed border-line bg-white p-3 text-sm text-muted">
                  找不到符合的案件。
                </div>
              ) : null}
            </div>
          </aside>

          <section className="min-w-0">
            <CaseHeader activeCase={activeCase} onChange={updateCase} />
            <SaveStatusBar
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              errorMessage={saveError}
              onManualSave={manualSaveCase}
            />
            <nav className="workspace-panel mb-4 overflow-x-auto rounded-lg border border-[#1a3d2b] bg-[#0f3322] shadow-sm">
              <div className="flex min-w-max">
                {workspaceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex min-h-[44px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 text-[13px] font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-[#52b788] text-[#52b788]"
                        : "border-transparent text-[rgba(240,250,244,0.45)] hover:text-[rgba(240,250,244,0.7)]"
                    }`}
                  >
                    {tab.label}
                    {!tab.available ? (
                      <span className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[9px] text-[rgba(240,250,244,0.3)]">
                        待開發
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </nav>

            {activeTab === "basic" ? <BasicDataEditor activeCase={activeCase} onChange={updateCase} /> : null}
            {activeTab === "main" ? <ReportMainEditor activeCase={activeCase} onChange={updateCase} /> : null}
            {activeTab === "attachments" ? <AttachmentManager activeCase={activeCase} onChange={updateCase} /> : null}
            {activeTab === "attachment5" ? (
              <AttachmentFiveEditor
                rows={activeCase.levelMeasurements ?? []}
                planPaths={activeCase.levelPlanPaths ?? []}
                onRowsChange={(levelMeasurements) => updateCase({ ...activeCase, levelMeasurements })}
                onPlanPathsChange={(levelPlanPaths) => updateCase({ ...activeCase, levelPlanPaths })}
                onPhotoUpload={(row, file) => uploadInspectionPhoto(activeCase.project.id, `attachment-five/${row.id}`, file)}
              />
            ) : null}
            {activeTab === "attachment6" ? (
              <AttachmentSixEditor
                rows={activeCase.tiltMeasurements ?? []}
                planPaths={activeCase.tiltPlanPaths ?? []}
                onRowsChange={(tiltMeasurements) => updateCase({ ...activeCase, tiltMeasurements })}
                onPlanPathsChange={(tiltPlanPaths) => updateCase({ ...activeCase, tiltPlanPaths })}
                onPhotoUpload={(row, slot, file) => uploadInspectionPhoto(activeCase.project.id, `attachment-six/${row.id}/${slot}`, file)}
              />
            ) : null}
            {activeTab === "attachment7" ? <AttachmentSevenEditor activeCase={activeCase} onChange={updateCase} /> : null}
            {activeTab === "attachment8" ? <AttachmentEightEditor activeCase={activeCase} onChange={updateCase} /> : null}
            {activeTab === "export" ? <ExportPanel activeCase={activeCase} floors={exportFloors} points={exportPoints} /> : null}
          </section>
        </section>
      )}
    </main>
  );
}

const workspaceTabs: Array<{ id: WorkspaceTab; label: string; available: boolean }> = [
  { id: "basic", label: "基本資料", available: true },
  { id: "main", label: "封面/目錄/主文", available: true },
  { id: "attachments", label: "附件管理", available: true },
  { id: "attachment5", label: "附件五 水準測量", available: true },
  { id: "attachment6", label: "附件六 傾斜率", available: true },
  { id: "attachment7", label: "附件七 現況照片", available: true },
  { id: "attachment8", label: "附件八 基地照片", available: true },
  { id: "export", label: "匯出報告", available: true },
];

function SaveStatusBar({
  status,
  lastSavedAt,
  errorMessage: _errorMessage,
  onManualSave,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
  errorMessage: string;
  onManualSave: () => void;
}) {
  const statusContent = (() => {
    if (status === "saving") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted animate-pulse">
          <Loader2 size={13} className="animate-spin" /> 儲存中...
        </span>
      );
    }

    if (status === "error") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-orange-600">
          <AlertCircle size={13} /> 儲存失敗，已暫存至本機
        </span>
      );
    }

    if (status === "saved") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-accent">
          <CheckCircle2 size={13} /> 已儲存 {formatRelativeTime(lastSavedAt)}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Circle size={13} /> 修改後會自動儲存
      </span>
    );
  })();

  return (
    <div className="workspace-panel mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      {statusContent}
      <button
        type="button"
        onClick={onManualSave}
        disabled={status === "saving"}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-current bg-white/70 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save size={16} /> 手動儲存
      </button>
    </div>
  );
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return "剛剛";
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  return `${Math.floor(diff / 3600)} 小時前`;
}

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

function getInspectionPointWarnings(point: InspectionPoint) {
  const warnings: string[] = [];
  if (!point.photo?.imageUrl) warnings.push("未拍照");
  if (point.conditionType.includes("裂縫") && point.crackWidthMm == null) warnings.push("缺裂縫寬");
  if (!point.photo?.caption && !point.note.trim()) warnings.push("缺說明");
  return warnings;
}

function buildAttachmentSevenFloors(activeCase: InspectionCase): Floor[] {
  const data = activeCase.attachmentSeven;
  if (!data) return [];
  const targets = data.targets.length ? data.targets : [activeCase.target];

  return targets.flatMap((target) =>
    (data.floorNamesByTarget?.[target.id] ?? defaultFloorNames).map((floorName) => {
      const floorId = floorIdForTarget(target.id, floorName);
      const floorPoints = data.points?.filter((point) => point.floorId === floorId) ?? [];
      return {
        id: floorId,
        targetId: target.id,
        floorName,
        planSvgOrJson: serializePlanToSvg(
          normalizeFloorPlan(data.plansByTargetFloor[target.id]?.[floorName]).paths,
          floorPoints,
          data.noEntryZonesByTargetFloor[target.id]?.[floorName] ?? [],
        ),
      };
    }),
  );
}

function normalizeFloorPlan(plan?: FloorPlanData): FloorPlan {
  if (Array.isArray(plan)) return { paths: plan };
  return {
    paths: plan?.paths ?? [],
    backgroundImage: plan?.backgroundImage,
  };
}

function emptyFloorPlanRecord(): Record<FloorName, FloorPlanData> {
  return Object.fromEntries(defaultFloorNames.map((floorName) => [floorName, { paths: [] }])) as Record<FloorName, FloorPlanData>;
}

function formatEngineerNames(project: Project) {
  return getProjectEngineers(project)
    .map((engineer) => engineer.name.trim())
    .filter(Boolean)
    .join("、");
}

function reportStatusBadgeClass(status: ReportStatus) {
  if (status === "審閱中") return "bg-blue-100 text-blue-700";
  if (status === "待補件") return "bg-orange-100 text-orange-700";
  if (status === "完稿") return "bg-green-100 text-green-700";
  if (status === "已歸檔") return "bg-stone-100 text-stone-500";
  return "bg-gray-100 text-gray-500";
}

async function uploadInspectionPhoto(projectId: string, scope: string, file: File) {
  const uploadFile = await compressImageForUpload(file);
  const fallbackUrl = URL.createObjectURL(uploadFile);
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { imageUrl: fallbackUrl };

  const safeName = uploadFile.name.replace(/[^\w.-]+/g, "-");
  const storagePath = `${projectId}/${scope}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("ci-inspection-photos")
    .upload(storagePath, uploadFile, {
      contentType: uploadFile.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("Failed to upload inspection photo", uploadError);
    return { imageUrl: fallbackUrl };
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("ci-inspection-photos")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (signedError) console.error("Failed to create signed photo URL", signedError);

  return {
    imageUrl: signedData?.signedUrl ?? fallbackUrl,
    storagePath,
  };
}

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/heic" || file.type === "image/heif") return file;
  if (typeof window === "undefined") return file;

  const maxSize = 1600;
  const quality = 0.78;
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale >= 1 && file.size <= 900 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}-compressed.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Failed to compress photo before upload", error);
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片無法讀取，改以上傳原圖處理。"));
    image.src = src;
  });
}

function formatRocDate(date: string | undefined) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return `中 華 民 國 ${parsed.getFullYear() - 1911} 年 ${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`;
}

function formatCompactRocDate(date: string | undefined) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return `民國${parsed.getFullYear() - 1911}年${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}

function buildBasicReportSectionContent(activeCase: InspectionCase): Record<string, string> {
  const project = activeCase.project;
  const applicationDate = formatCompactRocDate(project.inspectionDate) || "民國○○○年○月○日";
  const receivedDate = formatCompactRocDate(project.receivedDate) || "○○○年○月○日";
  const receivedNo = project.receivedNo?.trim() || "鑑○○○";
  const targetLocation = project.targetSummary?.trim() || activeCase.target.address.trim() || "請輸入標的物之坐落。";

  return {
    applicant: `申請單位：${project.applicantName}\n連絡地址：${project.applicantAddress ?? ""}\n連絡電話：${project.applicantPhone ?? ""}\n連絡人 ︰${project.contactPerson ?? ""}`,
    "application-date": `${applicationDate}\n(社團法人臺中市土木技師公會 ${receivedDate}收文號：${receivedNo})`,
    "target-location": targetLocation,
  };
}

function UserManagementPanel({
  users,
  onChange,
  currentUserId,
  onRefresh,
}: {
  users: AppUser[];
  onChange: (users: AppUser[]) => void;
  currentUserId: string;
  onRefresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppUser["role"]>("user");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftUser, setDraftUser] = useState<AppUser | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function addUser() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    const nextUser = {
      id: `pending-${normalizedEmail}`,
      name: name.trim() || normalizedEmail,
      email: normalizedEmail,
      role,
    };
    await persistUser(nextUser);
    setEmail("");
    setName("");
    setRole("user");
  }

  async function persistUser(user: AppUser, previousEmail?: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusyUserId(user.id);
    setMessage("");
    try {
      const savedUser = await saveManagedUser(supabase, user, previousEmail);
      onChange(upsertManagedUser(users, savedUser));
      await onRefresh();
      setEditingUserId(null);
      setDraftUser(null);
      setMessage("使用者資料已儲存。");
    } catch (error) {
      console.error("Failed to save managed user", error);
      setMessage(error instanceof Error ? error.message : "使用者資料儲存失敗。");
    } finally {
      setBusyUserId(null);
    }
  }

  async function removeUser(user: AppUser) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusyUserId(user.id);
    setMessage("");
    try {
      await deleteManagedUser(supabase, user);
      onChange(users.filter((item) => item.id !== user.id));
      await onRefresh();
      setMessage("已移除該 Google 帳戶的登入授權。");
    } catch (error) {
      console.error("Failed to delete managed user", error);
      setMessage(error instanceof Error ? error.message : "使用者刪除失敗。");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="workspace-panel mb-4 rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users size={18} /> 使用者管理
          </h2>
          <p className="mt-1 text-sm text-muted">新增 Google Email 後，該帳戶登入時會自動套用這裡設定的姓名與角色。</p>
        </div>
        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted">{users.length} 位使用者</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
        <TextField label="Google Email" value={email} onChange={setEmail} />
        <TextField label="姓名" value={name} onChange={setName} />
        <SelectField label="角色" value={role} options={["admin", "user"]} onChange={(value) => setRole(value as AppUser["role"])} />
        <button
          type="button"
          onClick={addUser}
          disabled={!email.trim() || busyUserId !== null}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} /> 新增
        </button>
      </div>
      {message ? <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm font-semibold text-muted">{message}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#e7e5e4] text-left">
              <th className="border border-line p-2">使用者</th>
              <th className="border border-line p-2">Email</th>
              <th className="border border-line p-2">角色</th>
              <th className="border border-line p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isEditing = editingUserId === user.id && draftUser;
              const rowUser = isEditing ? draftUser : user;
              const isCurrentUser = user.id === currentUserId;
              return (
                <tr key={user.id} className="bg-white">
                  <td className="border border-line p-2 font-bold">
                    {isEditing ? (
                      <input
                        value={rowUser.name}
                        onChange={(event) => setDraftUser({ ...rowUser, name: event.target.value })}
                        className="min-h-10 w-full rounded-md border border-line bg-white px-2 outline-none"
                      />
                    ) : (
                      <span>{user.name}</span>
                    )}
                  </td>
                  <td className="border border-line p-2">
                    {isEditing ? (
                      <input
                        type="email"
                        value={rowUser.email}
                        onChange={(event) => setDraftUser({ ...rowUser, email: event.target.value })}
                        className="min-h-10 w-full rounded-md border border-line bg-white px-2 outline-none"
                      />
                    ) : (
                      <span>{user.email}</span>
                    )}
                    {user.id.startsWith("pending-") ? <div className="mt-1 text-xs font-semibold text-orange-700">尚未登入</div> : null}
                  </td>
                  <td className="border border-line p-2">
                    <select
                      value={rowUser.role}
                      disabled={!isEditing}
                      onChange={(event) => setDraftUser({ ...rowUser, role: event.target.value as AppUser["role"] })}
                      className="min-h-10 rounded-md border border-line bg-white px-2 disabled:opacity-70"
                    >
                      <option value="admin">管理者</option>
                      <option value="user">使用者</option>
                    </select>
                  </td>
                  <td className="border border-line p-2">
                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={!rowUser.email.trim() || busyUserId === user.id}
                            onClick={() => void persistUser(rowUser, user.email)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            儲存
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(null);
                              setDraftUser(null);
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(user.id);
                            setDraftUser(user);
                          }}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
                        >
                          編輯
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isCurrentUser || busyUserId === user.id}
                        onClick={() => void removeUser(user)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-accent px-3 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={16} /> 刪除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
      <div className="rounded-md border border-dashed border-accent bg-[#f5f5f4] p-4">
        <div className="text-base font-bold text-accent">待開發</div>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
    </Panel>
  );
}

function CaseHeader({ activeCase, onChange }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  function updateReportStatus(reportStatus: ReportStatus) {
    onChange({
      ...activeCase,
      project: {
        ...activeCase.project,
        reportStatus,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section className="workspace-panel mb-4 rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">目前案件</p>
          <h2 className="text-2xl font-black">{activeCase.project.projectName}</h2>
          <p className="mono-data mt-1 text-sm text-muted">
            {activeCase.project.caseNo} / {activeCase.project.applicantName} / {activeCase.project.inspectionDate}
          </p>
        </div>
        <label className="grid gap-1 rounded-md border border-line bg-white px-3 py-2 text-sm">
          <span className="font-semibold text-muted">報告狀態</span>
          <select
            value={activeCase.project.reportStatus ?? "草稿"}
            onChange={(event) => updateReportStatus(event.target.value as ReportStatus)}
            className="min-h-9 rounded-md border border-line bg-white px-2 font-bold text-foreground"
          >
            {reportStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
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
          <div className="md:col-span-2">
            <AddressBuilder
              title="連絡地址快速組合"
              address={project.applicantAddress ?? ""}
              onChange={(applicantAddress) => updateProject({ applicantAddress })}
            />
          </div>
          <TextField label="連絡地址" value={project.applicantAddress ?? ""} onChange={(applicantAddress) => updateProject({ applicantAddress })} className="md:col-span-2" />
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
          <div className="md:col-span-2">
            <AddressBuilder title="標的物地址快速組合" address={target.address} onChange={(address) => updateTarget({ address })} />
          </div>
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
  const basicSectionContent = buildBasicReportSectionContent(activeCase);

  function updateSection(sectionId: string, content: string) {
    onChange({
      ...activeCase,
      reportSections: activeCase.reportSections.map((section) =>
        section.id === sectionId ? { ...section, content } : section,
      ),
    });
  }

  function syncBasicSections() {
    onChange({
      ...activeCase,
      reportSections: activeCase.reportSections.map((section) =>
        basicSectionContent[section.id] ? { ...section, content: basicSectionContent[section.id] } : section,
      ),
    });
  }

  function syncSingleBasicSection(sectionId: string) {
    const content = basicSectionContent[sectionId];
    if (!content) return;
    updateSection(sectionId, content);
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-soft p-3">
            <div>
              <p className="text-sm font-semibold">基本資料同步</p>
              <p className="mt-1 text-xs text-muted">重新帶入一、二、三節，會覆蓋這三節目前文字；四以後手動內容不受影響。</p>
            </div>
            <button
              type="button"
              onClick={syncBasicSections}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-accent bg-white px-3 text-sm font-semibold text-accent transition-colors hover:bg-[#f0faf4]"
            >
              重新帶入基本資料
            </button>
          </div>
          {activeCase.reportSections.map((section) => (
            <label key={section.id} className="block">
              <span className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold">{section.title}</span>
                {basicSectionContent[section.id] ? (
                  <button
                    type="button"
                    onClick={() => syncSingleBasicSection(section.id)}
                    className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    帶入基本資料
                  </button>
                ) : null}
              </span>
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
              <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-accent bg-[#f5f5f4] px-3 text-sm font-semibold text-accent">
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
  const [targets, setTargets] = useState<Target[]>(() =>
    activeCase.attachmentSeven?.targets.length ? activeCase.attachmentSeven.targets : [{ ...activeCase.target }],
  );
  const [activeTargetId, setActiveTargetId] = useState(activeCase.target.id);
  const [activeFloorName, setActiveFloorName] = useState<FloorName>("1F");
  const [newFloorName, setNewFloorName] = useState("");
  const [floorNamesByTarget, setFloorNamesByTarget] = useState<Record<string, FloorName[]>>(
    () => activeCase.attachmentSeven?.floorNamesByTarget ?? { [activeCase.target.id]: defaultFloorNames },
  );
  const [plansByTargetFloor, setPlansByTargetFloor] = useState<Record<string, Record<FloorName, FloorPlanData>>>(
    () => activeCase.attachmentSeven?.plansByTargetFloor ?? {},
  );
  const [noEntryZonesByTargetFloor, setNoEntryZonesByTargetFloor] = useState<Record<string, Record<FloorName, NoEntryZone[]>>>(
    () => activeCase.attachmentSeven?.noEntryZonesByTargetFloor ?? {},
  );
  const [points, setPoints] = useState<InspectionPoint[]>(() => activeCase.attachmentSeven?.points ?? []);
  const [activePointId, setActivePointId] = useState<string | undefined>();
  const [floorPlanMode, setFloorPlanMode] = useState<FloorPlanMode>("line");

  const project = activeCase.project;
  const target = targets.find((item) => item.id === activeTargetId) ?? targets[0] ?? activeCase.target;
  const targetFloorNames = floorNamesByTarget[target.id] ?? defaultFloorNames;
  const activeFloorId = floorIdForTarget(target.id, activeFloorName);
  const activePlan = normalizeFloorPlan(plansByTargetFloor[target.id]?.[activeFloorName]);
  const activePlanPaths = activePlan.paths;
  const activeNoEntryZones = noEntryZonesByTargetFloor[target.id]?.[activeFloorName] ?? [];
  const floorPoints = points.filter((point) => point.floorId === activeFloorId);
  const activePoint = points.find((point) => point.id === activePointId);

  useEffect(() => {
    const nextTargets = activeCase.attachmentSeven?.targets.length ? activeCase.attachmentSeven.targets : [{ ...activeCase.target }];
    setTargets(nextTargets);
    setFloorNamesByTarget(activeCase.attachmentSeven?.floorNamesByTarget ?? { [nextTargets[0]?.id ?? activeCase.target.id]: defaultFloorNames });
    setPlansByTargetFloor(activeCase.attachmentSeven?.plansByTargetFloor ?? {});
    setNoEntryZonesByTargetFloor(activeCase.attachmentSeven?.noEntryZonesByTargetFloor ?? {});
    setPoints(activeCase.attachmentSeven?.points ?? []);
    setActiveTargetId(nextTargets[0]?.id ?? activeCase.target.id);
    setActiveFloorName("1F");
    setNewFloorName("");
    setActivePointId(undefined);
    setFloorPlanMode("line");
  }, [activeCase.id]);

  const floors: Floor[] = useMemo(
    () =>
      targetFloorNames.map((floorName) => {
        const floorId = floorIdForTarget(target.id, floorName);
        const floorSpecificPoints = points.filter((point) => point.floorId === floorId);
        return {
          id: floorId,
          targetId: target.id,
          floorName,
          planSvgOrJson: serializePlanToSvg(
            normalizeFloorPlan(plansByTargetFloor[target.id]?.[floorName]).paths,
            floorSpecificPoints,
            noEntryZonesByTargetFloor[target.id]?.[floorName] ?? [],
          ),
        };
      }),
    [noEntryZonesByTargetFloor, plansByTargetFloor, points, target.id, targetFloorNames],
  );

  function updateTarget(patch: Partial<Target>) {
    const nextTarget = { ...target, ...patch };
    const nextTargets = targets.map((item) => (item.id === target.id ? nextTarget : item));
    setTargets(nextTargets);
    persistAttachmentSeven({ targets: nextTargets });
  }

  function addTarget() {
    const newTarget: Target = {
      ...activeCase.target,
      id: crypto.randomUUID(),
      address: `新增標的物 ${targets.length + 1}`,
      note: "",
    };
    const nextTargets = [...targets, newTarget];
    const nextFloorNamesByTarget = {
      ...floorNamesByTarget,
      [newTarget.id]: defaultFloorNames,
    };
    setTargets(nextTargets);
    setFloorNamesByTarget(nextFloorNamesByTarget);
    setActiveTargetId(newTarget.id);
    setActiveFloorName("1F");
    setActivePointId(undefined);
    persistAttachmentSeven({ targets: nextTargets, floorNamesByTarget: nextFloorNamesByTarget });
  }

  function removeTarget(targetId: string) {
    if (targets.length <= 1) return;
    const nextTargets = targets.filter((item) => item.id !== targetId);
    const nextFloorNamesByTarget = { ...floorNamesByTarget };
    const nextPlans = { ...plansByTargetFloor };
    const nextNoEntryZones = { ...noEntryZonesByTargetFloor };
    const nextPoints = points.filter((point) => !point.floorId.startsWith(`${targetId}__`));
    delete nextFloorNamesByTarget[targetId];
    delete nextPlans[targetId];
    delete nextNoEntryZones[targetId];

    setTargets(nextTargets);
    setFloorNamesByTarget(nextFloorNamesByTarget);
    setPlansByTargetFloor(nextPlans);
    setNoEntryZonesByTargetFloor(nextNoEntryZones);
    setPoints(nextPoints);
    if (activeTargetId === targetId) {
      setActiveTargetId(nextTargets[0].id);
      setActiveFloorName("1F");
      setActivePointId(undefined);
    }
    persistAttachmentSeven({
      targets: nextTargets,
      floorNamesByTarget: nextFloorNamesByTarget,
      plansByTargetFloor: nextPlans,
      noEntryZonesByTargetFloor: nextNoEntryZones,
      points: nextPoints,
    });
  }

  function updateActivePlan(plan: FloorPlan) {
    const nextPlans = {
      ...plansByTargetFloor,
      [target.id]: {
        ...emptyFloorPlanRecord(),
        ...plansByTargetFloor[target.id],
        [activeFloorName]: plan,
      },
    };
    setPlansByTargetFloor(nextPlans);
    persistAttachmentSeven({ plansByTargetFloor: nextPlans });
  }

  function updateActiveNoEntryZones(zones: NoEntryZone[]) {
    const nextNoEntryZones = {
      ...noEntryZonesByTargetFloor,
      [target.id]: {
        ...emptyFloorRecord<NoEntryZone[]>(),
        ...noEntryZonesByTargetFloor[target.id],
        [activeFloorName]: zones,
      },
    };
    setNoEntryZonesByTargetFloor(nextNoEntryZones);
    persistAttachmentSeven({ noEntryZonesByTargetFloor: nextNoEntryZones });
  }

  function addFloor() {
    const normalizedName = newFloorName.trim();
    if (!normalizedName || targetFloorNames.includes(normalizedName)) return;
    const nextFloorNamesByTarget = {
      ...floorNamesByTarget,
      [target.id]: [...targetFloorNames, normalizedName],
    };
    setFloorNamesByTarget(nextFloorNamesByTarget);
    setActiveFloorName(normalizedName);
    setNewFloorName("");
    persistAttachmentSeven({ floorNamesByTarget: nextFloorNamesByTarget });
  }

  function removeFloor(floorName: FloorName) {
    if (defaultFloorNames.includes(floorName) || targetFloorNames.length <= 1) return;
    const nextFloorNames = targetFloorNames.filter((item) => item !== floorName);
    const nextPlans = {
      ...plansByTargetFloor,
      [target.id]: {
        ...(plansByTargetFloor[target.id] ?? {}),
      },
    };
    const nextNoEntryZones = {
      ...noEntryZonesByTargetFloor,
      [target.id]: {
        ...(noEntryZonesByTargetFloor[target.id] ?? {}),
      },
    };
    const nextPoints = points.filter((point) => point.floorId !== floorIdForTarget(target.id, floorName));
    const nextFloorNamesByTarget = { ...floorNamesByTarget, [target.id]: nextFloorNames };
    delete nextPlans[target.id][floorName];
    delete nextNoEntryZones[target.id][floorName];

    setFloorNamesByTarget(nextFloorNamesByTarget);
    setPlansByTargetFloor(nextPlans);
    setNoEntryZonesByTargetFloor(nextNoEntryZones);
    setPoints(nextPoints);
    if (activeFloorName === floorName) setActiveFloorName(nextFloorNames[0] ?? "1F");
    persistAttachmentSeven({
      floorNamesByTarget: nextFloorNamesByTarget,
      plansByTargetFloor: nextPlans,
      noEntryZonesByTargetFloor: nextNoEntryZones,
      points: nextPoints,
    });
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
    const nextPoints = [...points, newPoint];
    setPoints(nextPoints);
    setActivePointId(newPoint.id);
    persistAttachmentSeven({ points: nextPoints });
  }

  function updatePoint(nextPoint: InspectionPoint) {
    const nextPoints = points.map((point) => (point.id === nextPoint.id ? nextPoint : point));
    setPoints(nextPoints);
    persistAttachmentSeven({ points: nextPoints });
  }

  function deletePoint(pointId: string) {
    const nextPoints = points.filter((point) => point.id !== pointId);
    setPoints(nextPoints);
    persistAttachmentSeven({ points: nextPoints });
    if (activePointId === pointId) setActivePointId(undefined);
  }

  async function attachPhotoToPoint(point: InspectionPoint, file: File) {
    const uploaded = await uploadInspectionPhoto(project.id, `attachment-seven/${point.id}`, file);
    const caption = point.photo?.caption || buildPhotoCaption(point);
    updatePoint({
      ...point,
      photo: {
        id: point.photo?.id ?? crypto.randomUUID(),
        pointId: point.id,
        imageUrl: uploaded.imageUrl,
        storagePath: uploaded.storagePath,
        caption,
        takenAt: new Date().toISOString(),
      },
    });
    setActivePointId(point.id);
  }

  function persistAttachmentSeven(
    patch: Partial<NonNullable<InspectionCase["attachmentSeven"]>>,
  ) {
    const nextData = {
      targets,
      floorNamesByTarget,
      plansByTargetFloor,
      noEntryZonesByTargetFloor,
      points,
      ...patch,
    };
    onChange({
      ...activeCase,
      target: nextData.targets[0] ?? activeCase.target,
      attachmentSeven: nextData,
    });
  }

  return (
    <div className="grid gap-4">
      <section className="workspace-panel rounded-lg border border-line bg-paper p-3 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
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
        <div className="grid gap-3">
          <AddressBuilder address={target.address} onChange={(address) => updateTarget({ address })} />
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
        <section className="workspace-panel rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)] lg:col-span-3">
          <h2 className="mb-3 text-lg font-bold">★會勘狀況</h2>
          <div className="grid gap-2 md:grid-cols-4">
            {surveyStatusOptions.map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold ${
                  target.surveyStatus.split("、").includes(option)
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-line bg-white text-foreground hover:border-orange-200 hover:bg-orange-50/50"
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
              {targetFloorNames.map((floorName) => (
                <span key={floorName} className="inline-flex overflow-hidden rounded-md border border-line bg-white">
                  <button
                    type="button"
                    onClick={() => setActiveFloorName(floorName)}
                    className={`mono-data min-h-11 px-4 text-sm font-bold ${
                      floorName === activeFloorName ? "bg-accent text-white" : "bg-white"
                    }`}
                  >
                    {floorName}
                  </button>
                  {!defaultFloorNames.includes(floorName) ? (
                    <button
                      type="button"
                      onClick={() => removeFloor(floorName)}
                      className="min-h-11 border-l border-line px-2 text-xs font-bold text-muted"
                      title="刪除此自訂樓層"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={newFloorName}
                onChange={(event) => setNewFloorName(event.target.value)}
                placeholder="自訂樓層，如 B1、4F"
                className="mono-data min-h-11 w-44 rounded-md border border-line bg-white px-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={addFloor}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
              >
                <Plus size={18} /> 新增樓層
              </button>
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
            activeMode={floorPlanMode}
            points={floorPoints}
            activePointId={activePointId}
            plan={activePlan}
            noEntryZones={activeNoEntryZones}
            onPlanChange={updateActivePlan}
            onNoEntryZonesChange={updateActiveNoEntryZones}
            onAddPoint={addPoint}
            onMovePoint={(pointId, position) => {
              const movingPoint = points.find((point) => point.id === pointId);
              if (!movingPoint) return;
              updatePoint({ ...movingPoint, x: position.x, y: position.y });
            }}
            onRotatePoint={(pointId, directionAngle) => {
              const rotatingPoint = points.find((point) => point.id === pointId);
              if (!rotatingPoint) return;
              updatePoint({ ...rotatingPoint, directionAngle });
            }}
            onSelectPoint={setActivePointId}
            onModeChange={setFloorPlanMode}
            onClearPlan={() => updateActivePlan({ ...activePlan, paths: [] })}
            onUndoPlan={() => {
              const zones = activeNoEntryZones;
              if (zones.length > 0) {
                updateActiveNoEntryZones(zones.slice(0, -1));
                return;
              }
              updateActivePlan({ ...activePlan, paths: activePlanPaths.slice(0, -1) });
            }}
          />

          <section className="mt-4 rounded-lg border border-line bg-paper p-3">
            <h2 className="mb-2 text-lg font-bold">本層照片紀錄</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#e7e5e4] text-left">
                    <th className="border border-line p-2">照片編號</th>
                    <th className="border border-line p-2">狀態</th>
                    <th className="border border-line p-2">樓層</th>
                    <th className="border border-line p-2">位置</th>
                    <th className="border border-line p-2">現況/缺失</th>
                    <th className="border border-line p-2">裂縫寬(mm)</th>
                    <th className="border border-line p-2">照片</th>
                    <th className="border border-line p-2">備註</th>
                    <th className="border border-line p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {floorPoints.map((point) => {
                    const statusBadges = getInspectionPointWarnings(point);
                    return (
                      <tr
                        key={point.id}
                        onClick={() => setActivePointId(point.id)}
                        className={`cursor-pointer ${point.id === activePointId ? "bg-[#f5f5f4]" : "bg-white"}`}
                      >
                        <td className="mono-data border border-line p-2 font-bold text-accent">#{point.photoNo}</td>
                        <td className="border border-line p-2">
                          <div className="flex flex-wrap gap-1">
                            {statusBadges.length ? (
                              statusBadges.map((badge) => (
                                <span key={badge} className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                  {badge}
                                </span>
                              ))
                            ) : (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">完成</span>
                            )}
                          </div>
                        </td>
                        <td className="mono-data border border-line p-2">{activeFloorName}</td>
                        <td className="border border-line p-2">{point.componentType.join("、")}</td>
                        <td className="border border-line p-2">{point.conditionType.join("、")}</td>
                        <td className="mono-data border border-line p-2">{point.crackWidthMm ?? ""}</td>
                        <td className="border border-line p-2">
                          <label className="relative inline-flex min-h-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-accent bg-[#f5f5f4] px-3 text-xs font-semibold text-accent">
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
                                if (file) void attachPhotoToPoint(point, file);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        </td>
                        <td className="border border-line p-2">{point.note}</td>
                        <td className="border border-line p-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deletePoint(point.id);
                            }}
                            className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-2 text-muted"
                            aria-label={`刪除照片點位 ${point.photoNo}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <InspectionForm
          point={activePoint}
          onChange={updatePoint}
          onDelete={deletePoint}
          onComplete={() => setActivePointId(undefined)}
          onContinue={() => {
            setActivePointId(undefined);
            setFloorPlanMode("photo");
          }}
          onPhotoUpload={(point, file) => void attachPhotoToPoint(point, file)}
        />
      </section>

      <section className="workspace-panel rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">附件七匯出預覽</h2>
            <p className="text-sm text-muted">
              照片會先在瀏覽器端壓縮，再存入 Supabase Storage 的 ci-inspection-photos，並依案件、標的物、樓層與照片編號管理。
            </p>
          </div>
          <PdfExportButton project={project} target={target} floors={floors} points={points} sitePhotos={[]} />
        </div>
      </section>
    </div>
  );
}

function AttachmentEightEditor({ activeCase, onChange }: { activeCase: InspectionCase; onChange: (nextCase: InspectionCase) => void }) {
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>(() => activeCase.sitePhotos ?? []);

  useEffect(() => {
    setSitePhotos(activeCase.sitePhotos ?? []);
  }, [activeCase.id, activeCase.sitePhotos]);

  function persistSitePhotos(nextPhotos: SitePhoto[]) {
    setSitePhotos(nextPhotos);
    onChange({ ...activeCase, sitePhotos: nextPhotos });
  }

  return (
    <section className="workspace-panel rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">附件八 基地現況照片</h2>
          <p className="text-sm text-muted">用於基地外觀、施工基地周邊、道路或鄰地現況照片。</p>
        </div>
        <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-accent bg-[#f5f5f4] px-3 text-sm font-semibold text-accent">
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
              const photoId = crypto.randomUUID();
              void uploadInspectionPhoto(activeCase.project.id, `attachment-eight/${photoId}`, file).then((uploaded) => {
                persistSitePhotos([
                  ...sitePhotos,
                  {
                    id: photoId,
                    photoNo,
                    imageUrl: uploaded.imageUrl,
                    storagePath: uploaded.storagePath,
                    caption: "基地現況",
                    note: "",
                    takenAt: new Date().toISOString(),
                  },
                ]);
              });
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
                onClick={() => persistSitePhotos(sitePhotos.filter((item) => item.id !== photo.id))}
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
                persistSitePhotos(sitePhotos.map((item) => (item.id === photo.id ? { ...item, caption } : item)))
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

function ExportPanel({
  activeCase,
  floors,
  points,
}: {
  activeCase: InspectionCase;
  floors: Floor[];
  points: InspectionPoint[];
}) {
  const checks = [
    {
      label: "案件編號已填寫",
      done: !!activeCase.project.caseNo.trim(),
    },
    {
      label: "鑑定技師已填寫",
      done: getProjectEngineers(activeCase.project).some((engineer) => !!engineer.name.trim()),
    },
    {
      label: "完稿日期已填寫",
      done: !!activeCase.project.finalDate?.trim(),
    },
    {
      label: "標的物坐落已填寫",
      done: !!activeCase.target?.address.trim(),
    },
    {
      label: "附件七已有照片點位",
      done: (activeCase.attachmentSeven?.points ?? []).length > 0,
    },
    {
      label: "附件五水準測量已輸入",
      done: (activeCase.levelMeasurements ?? []).length > 0,
    },
    {
      label: "附件六傾斜率測量已輸入",
      done: (activeCase.tiltMeasurements ?? []).length > 0,
    },
  ];
  const doneCount = checks.filter((check) => check.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  return (
    <div className="grid gap-4">
      <Panel title="匯出前完成度檢查" icon={<FileText size={18} />}>
        <div className="mb-5 rounded-xl border border-line bg-surface-soft p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">報告完成度</p>
            <span className={`text-sm font-bold ${pct === 100 ? "text-accent" : "text-orange-600"}`}>
              {pct}%
            </span>
          </div>

          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-accent" : "bg-orange-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className="space-y-2">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center gap-2 text-sm">
                {check.done ? (
                  <CheckCircle2 size={16} className="shrink-0 text-accent" />
                ) : (
                  <Circle size={16} className="shrink-0 text-muted" />
                )}
                <span className={check.done ? "text-foreground" : "text-muted"}>{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
      <Panel title="目前可匯出" icon={<FileText size={18} />}>
        <p className="mb-3 text-sm text-muted">目前可匯出附件五、附件六、附件七與附件八的 HTML to PDF 預覽；完整封面/目錄/主文合併會在下一階段納入。</p>
        <PdfExportButton
          project={activeCase.project}
          target={activeCase.target}
          floors={floors}
          points={points}
          sitePhotos={activeCase.sitePhotos ?? []}
          levelMeasurements={activeCase.levelMeasurements ?? []}
          levelPlanPaths={activeCase.levelPlanPaths ?? []}
          tiltMeasurements={activeCase.tiltMeasurements ?? []}
          tiltPlanPaths={activeCase.tiltPlanPaths ?? []}
          completionWarning={{ pct, doneCount, total: checks.length }}
        />
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="workspace-panel rounded-lg border border-line bg-paper p-4 shadow-[0_1px_2px_rgba(28,25,23,0.05)]">
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
  const hint = fieldHint(label);
  const useMono = shouldUseMonoField(label, type);

  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
        {label}
        {hint ? <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">{hint}</span> : null}
      </span>
      <span className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full bg-transparent outline-none ${useMono ? "mono-data" : ""}`}
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
  const hint = fieldHint(label);

  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
        {label}
        {hint ? <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">{hint}</span> : null}
      </span>
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

function AddressBuilder({
  title = "地址快速組合",
  address,
  onChange,
}: {
  title?: string;
  address: string;
  onChange: (address: string) => void;
}) {
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [road, setRoad] = useState("");
  const [lane, setLane] = useState("");
  const [alley, setAlley] = useState("");
  const [numberAndFloor, setNumberAndFloor] = useState("");
  const [roadOptions, setRoadOptions] = useState(commonRoadNames);
  const datalistId = useMemo(() => `road-options-${crypto.randomUUID()}`, []);
  const districts = getDistricts(city);

  useEffect(() => {
    if (!city || !district) {
      setRoadOptions(commonRoadNames);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ city, district });
    if (road) params.set("q", road);

    fetch(`/api/address/roads?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { roads?: string[] } | null) => {
        const officialRoads = payload?.roads ?? [];
        setRoadOptions(officialRoads.length ? officialRoads : commonRoadNames);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRoadOptions(commonRoadNames);
      });

    return () => controller.abort();
  }, [city, district, road]);

  function compose(next: { city?: string; district?: string; road?: string; lane?: string; alley?: string; numberAndFloor?: string }) {
    const nextCity = next.city ?? city;
    const nextDistrict = next.district ?? district;
    const nextRoad = next.road ?? road;
    const nextLane = next.lane ?? lane;
    const nextAlley = next.alley ?? alley;
    const nextNumberAndFloor = next.numberAndFloor ?? numberAndFloor;
    const laneText = nextLane ? `${nextLane}巷` : "";
    const alleyText = nextAlley ? `${nextAlley}弄` : "";
    const composed = `${nextCity}${nextDistrict}${nextRoad}${laneText}${alleyText}${nextNumberAndFloor}`.trim();
    if (composed) onChange(composed);
  }

  return (
    <section className="rounded-md border border-line bg-[#fafaf6] p-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-bold">{title}</div>
        <div className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">County / District / Road / Lane / Alley / No.</div>
      </div>
      <div className="grid gap-3 md:grid-cols-6">
        <label className="block">
          <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
            縣市 <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">County</span>
          </span>
          <select
            value={city}
            onChange={(event) => {
              const nextCity = event.target.value;
              setCity(nextCity);
              setDistrict("");
              setRoad("");
              compose({ city: nextCity, district: "", road: "" });
            }}
            className="min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none"
          >
            <option value="">選擇縣市</option>
            {taiwanAddress.map((item) => (
              <option key={item.city} value={item.city}>
                {item.city}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
            鄉鎮市區 <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">District</span>
          </span>
          <select
            value={district}
            disabled={!city}
            onChange={(event) => {
              const nextDistrict = event.target.value;
              setDistrict(nextDistrict);
              setRoad("");
              compose({ district: nextDistrict, road: "" });
            }}
            className="min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none disabled:bg-stone-100"
          >
            <option value="">選擇行政區</option>
            {districts.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
            路街段 <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">Road</span>
          </span>
          <input
            list={datalistId}
            value={road}
            onChange={(event) => {
              const nextRoad = event.target.value;
              setRoad(nextRoad);
              compose({ road: nextRoad });
            }}
            placeholder="路、街、段"
            className="min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none"
          />
          <datalist id={datalistId}>
            {roadOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
            巷 <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">Lane</span>
          </span>
          <input
            inputMode="numeric"
            value={lane}
            onChange={(event) => {
              const nextLane = event.target.value.replace(/[^\dA-Za-z-]/g, "");
              setLane(nextLane);
              compose({ lane: nextLane });
            }}
            placeholder="可空白"
            className="mono-data min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
            弄 <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">Alley</span>
          </span>
          <input
            inputMode="numeric"
            value={alley}
            onChange={(event) => {
              const nextAlley = event.target.value.replace(/[^\dA-Za-z-]/g, "");
              setAlley(nextAlley);
              compose({ alley: nextAlley });
            }}
            placeholder="可空白"
            className="mono-data min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted">
            號樓 <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">No./Floor</span>
          </span>
          <input
            inputMode="numeric"
            value={numberAndFloor}
            onChange={(event) => {
              const nextNumberAndFloor = event.target.value;
              setNumberAndFloor(nextNumberAndFloor);
              compose({ numberAndFloor: nextNumberAndFloor });
            }}
            placeholder="例如：18號3樓"
            className="mono-data min-h-11 w-full rounded-md border border-line bg-white px-3 outline-none"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        縣市與鄉鎮市區為內建清單；路街段會優先查詢正式地址資料表，尚未匯入資料時可先手動輸入。
      </p>
      {address ? <div className="mono-data mt-2 rounded border border-line bg-white px-3 py-2 text-xs text-muted">目前地址：{address}</div> : null}
    </section>
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
      <div className="flex items-baseline gap-2 text-xs font-semibold text-muted">
        {label}
        {fieldHint(label) ? <span className="mono-data text-[10px] uppercase tracking-[0.16em] text-stone-400">{fieldHint(label)}</span> : null}
      </div>
      <div className={`mt-1 font-bold ${shouldUseMonoField(label) ? "mono-data" : ""}`}>{value || "尚未填寫"}</div>
    </div>
  );
}

function fieldHint(label: string) {
  const hints: Record<string, string> = {
    案件編號: "Case No.",
    案件名稱: "Project",
    申請單位: "Applicant",
    連絡人: "Contact",
    連絡地址: "Address",
    連絡電話: "Phone",
    申請日期: "Apply Date",
    公會收文日期: "Received",
    收文號: "Doc No.",
    鑑定類型: "Type",
    完稿日期: "Final Date",
    標的物地址: "Location",
    標的物之坐落: "Location",
    用途: "Usage",
    備註: "Note",
    鑑定技師: "Engineer",
    會員編號: "Member No.",
    申請人: "Applicant",
  };

  return hints[label] ?? "";
}

function shouldUseMonoField(label: string, type = "text") {
  return (
    type === "date" ||
    label.includes("編號") ||
    label.includes("案號") ||
    label.includes("日期") ||
    label.includes("電話") ||
    label.includes("收文")
  );
}

function toChineseNumber(value: number) {
  return ["零", "一", "二", "三", "四", "五", "六", "七", "八"][value] ?? String(value);
}
