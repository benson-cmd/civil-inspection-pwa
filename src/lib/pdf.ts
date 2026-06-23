import type { Floor, InspectionPoint, LevelMeasurement, Project, ReportSection, SitePhoto, Target, TiltMeasurement } from "@/types/inspection";
import { buildPhotoCaption } from "./caption";

const usageOptions = ["商業", "住宅", "辦公室", "工業", "宗教", "其他"];
const wallFinishOptions = ["水泥粉光", "油漆", "壁紙", "磁磚", "裝飾品", "其他"];
const ceilingFinishOptions = ["水泥粉光", "油漆", "壁紙", "木架", "輕鋼架", "其他"];
const floorFinishOptions = ["塑膠地磚", "磨石子", "磁磚", "地毯", "木板", "其他"];
const surveyStatusOptions = ["部份隔間不便拍照", "拒絕鑑定", "屢次造訪無人", "本戶裝修"];

export function buildReportHtml(input: {
  project: Project;
  target: Target;
  floors: Floor[];
  points: InspectionPoint[];
  sitePhotos?: SitePhoto[];
  levelMeasurements?: LevelMeasurement[];
  levelPlanPaths?: string[];
  tiltMeasurements?: TiltMeasurement[];
  tiltPlanPaths?: string[];
  reportSections?: ReportSection[];
}) {
  const {
    project,
    target,
    floors,
    points,
    sitePhotos = [],
    levelMeasurements = [],
    levelPlanPaths = [],
    tiltMeasurements = [],
    tiltPlanPaths = [],
    reportSections = [],
  } = input;
  const floorsWithData = floors.filter((floor) => points.some((point) => point.floorId === floor.id));
  const photoPoints = points.filter((point) => point.photo?.imageUrl);
  const reportBody = [
    buildCoverPage(project),
    buildTableOfContentsPage(reportSections),
    ...buildMainReportPages(project, reportSections),
  ].join("");
  const attachmentBody = [
    buildLevelMeasurementPages(project, levelMeasurements, levelPlanPaths),
    buildTiltMeasurementPages(project, tiltMeasurements, tiltPlanPaths),
    ...floorsWithData.map((floor, index) => buildFloorPlanPage(project, target, floor, index + 1)),
    points.length ? buildInspectionTablePage(project, target, floors, points, floorsWithData.length + 1) : "",
    ...chunk(photoPoints, 2).map((cards, index) => buildPhotoPage(target.address, cards, floorsWithData.length + 2 + index, index + 1)),
    ...chunk(sitePhotos, 2).map((cards, index) =>
      buildSitePhotoPage(cards, floorsWithData.length + 2 + chunk(photoPoints, 2).length + index, index + 1),
    ),
  ].join("");

  return `<!doctype html>
  <html lang="zh-Hant">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(project.caseNo)} 現況鑑定附件</title>
      <style>${reportCss}</style>
    </head>
    <body>
      ${reportBody || attachmentBody ? `${reportBody}${attachmentBody}` : buildEmptyReportPage(project)}
    </body>
  </html>`;
}

function buildCoverPage(project: Project) {
  const engineers = parseEngineerNames(project);
  const workName = project.workName?.trim() || project.projectName || "工程名稱";
  const reportTitle = normalizeReportTitle(project.projectName, workName);
  return `
    <section class="page cover-page">
      <img class="cover-logo" src="/tcea-logo.png" alt="社團法人臺中市土木技師公會" />
      <div class="cover-association">社團法人臺中市土木技師公會</div>
      <div class="cover-main">
        <div class="cover-frame">
          <div class="cover-applicant">${escapeHtml(project.applicantName || "申請單位")}</div>
          <h1>${escapeHtml(workName)}</h1>
          <h2>${escapeHtml(reportTitle)}</h2>
          <div class="cover-case">(案件編號：${escapeHtml(project.caseNo || "")})</div>
          <div class="cover-volume">【全壹冊】</div>
        </div>
      </div>
      <div class="cover-meta">
        <div class="cover-meta-row"><span>鑑 定 人：${escapeHtml(engineers || "　　　　")}</span><span>土木技師</span></div>
        <div class="cover-meta-row"><span>日　　期：</span><span>年</span><span>月</span><span>日</span></div>
        <div class="cover-meta-row"><span>文　　號：(115)中土鑑發字第</span><span>號</span></div>
      </div>
      <div class="cover-contact">
        <div>會　　址：臺中市北區崇德路一段 629 號 B 棟 5 樓之 1</div>
        <div class="cover-contact-grid"><span>郵遞區號:40452</span><span>電話: (04)2237-8968</span></div>
        <div class="cover-contact-grid"><span></span><span>傳真: (04)2237-5789</span></div>
      </div>
    </section>`;
}

function buildTableOfContentsPage(sections: ReportSection[]) {
  const effectiveSections = sections.length ? sections : defaultReportSections();
  return `
    <section class="page report-text-page toc-page">
      ${buildAssociationHeader()}
      <h1>目　錄</h1>
      <table class="toc-table">
        <tbody>
          ${effectiveSections
            .map(
              (section) => `
                <tr>
                  <td><span class="toc-line"><span>${escapeHtml(section.title)}</span><span class="toc-leader"></span></span></td>
                  <td>${mainSectionPage(section.order)}</td>
                </tr>`,
            )
            .join("")}
          <tr><td class="toc-attachment-title">附件一　鑑定申請書及建造執照</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件二　會勘通知函</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件三　會勘紀錄表</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件四　工地及鑑定標的物位置圖</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件五　水準測量</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件六　傾斜率測量</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件七　鑑定標的物平面配置圖、現況調查紀錄表及照片</td><td></td></tr>
          <tr><td class="toc-attachment-title">附件八　基地現況照片</td><td></td></tr>
        </tbody>
      </table>
    </section>`;
}

function buildMainReportPages(project: Project, sections: ReportSection[]) {
  const effectiveSections = sections.length ? sections : defaultReportSections();
  return groupMainSections(effectiveSections).map(
    (pageSections, pageIndex) => `
      <section class="page report-text-page main-report-page">
        ${buildAssociationHeader()}
        ${pageIndex === 0 ? buildMainTitleBlock(project) : ""}
        ${pageSections.map((section) => buildMainSection(section)).join("")}
        <div class="main-page-number">${pageIndex + 1}</div>
      </section>`,
  );
}

function groupMainSections(sections: ReportSection[]) {
  const orderedSections = [...sections].sort((a, b) => a.order - b.order);
  return [
    orderedSections.filter((section) => section.order >= 1 && section.order <= 4),
    orderedSections.filter((section) => section.order >= 5 && section.order <= 8),
    orderedSections.filter((section) => section.order >= 9 && section.order <= 11),
    orderedSections.filter((section) => section.order > 11),
  ].filter((pageSections) => pageSections.length);
}

function buildEmptyReportPage(project: Project) {
  return `
    <section class="page report-text-page main-report-page">
      ${buildAssociationHeader()}
      <h1>${escapeHtml(project.projectName || "現況鑑定報告書")}</h1>
      <div class="main-section-content">目前尚無可匯出的主文或附件資料，請先完成基本資料、主文或附件編輯。</div>
    </section>`;
}

function buildAssociationHeader() {
  return `
    <div class="association-header">
      <img src="/tcea-logo.png" alt="臺中市土木技師公會" />
      <div>
        <div class="association-header-title">社團法人臺中市土木技師公會</div>
        <div class="association-header-en">TAICHUNG PROFESSIONAL CIVIL ENGINEERS ASSOCIATION</div>
        <div class="association-header-address">會址：台中市北區崇德路一段 629 號 B 棟 5F 之 1</div>
        <div class="association-header-address">5F-1, No.629, Sec. 1, Chongde Rd., North Dist., Taichung City 404, Taiwan (R.O.C.)</div>
        <div class="association-header-contact">TEL：04-22378968　FAX：04-22375789　E-mail：tcce100521@gmail.com</div>
      </div>
    </div>`;
}

function buildMainTitleBlock(project: Project) {
  const workName = project.workName?.trim() || project.projectName || "";
  const reportTitle = normalizeReportTitle(project.projectName, workName);
  return `
    <div class="main-title-block">
      ${project.applicantName ? `<div>${escapeHtml(project.applicantName)}</div>` : ""}
      ${workName ? `<div>${escapeHtml(workName)}</div>` : ""}
      <div>${escapeHtml(reportTitle)}</div>
      ${project.caseNo ? `<div>(案件編號：${escapeHtml(project.caseNo)})</div>` : ""}
      <div>【全壹冊】</div>
    </div>`;
}

function buildMainSection(section: ReportSection) {
  return `
    <section class="main-section">
      <h2>${escapeHtml(section.title)}：</h2>
      <div class="main-section-content">${escapeHtml(section.content || "尚未填寫。").replaceAll("\n", "<br>")}</div>
    </section>`;
}

function normalizeReportTitle(projectName: string, workName: string) {
  const trimmed = projectName.trim();
  const withoutWorkName = trimmed.startsWith(workName) ? trimmed.slice(workName.length).trim() : trimmed;
  if (!withoutWorkName || withoutWorkName === workName) return "鄰房現況鑑定報告書";
  return withoutWorkName;
}

function mainSectionPage(order: number) {
  if (order <= 4) return 1;
  if (order <= 8) return 2;
  if (order <= 11) return 3;
  return 4;
}

function defaultReportSections(): ReportSection[] {
  return [
    { id: "applicant", order: 1, title: "一、申請單位", content: "", source: "basic", fixedTitle: true },
    { id: "application-date", order: 2, title: "二、申請日期", content: "", source: "basic", fixedTitle: true },
    { id: "target-location", order: 3, title: "三、標的物之坐落", content: "", source: "basic", fixedTitle: true },
    { id: "purpose", order: 4, title: "四、鑑定要旨", content: "", source: "editable", fixedTitle: true },
    { id: "basis", order: 5, title: "五、鑑定依據", content: "", source: "editable", fixedTitle: true },
    { id: "inspection-dates", order: 6, title: "六、會勘日期", content: "", source: "editable", fixedTitle: true },
    { id: "staff", order: 7, title: "七、會勘人員", content: "", source: "basic", fixedTitle: true },
    { id: "process", order: 8, title: "八、鑑定過程", content: "", source: "editable", fixedTitle: true },
    { id: "site-status", order: 9, title: "九、工地現況", content: "", source: "editable", fixedTitle: true },
    { id: "target-status", order: 10, title: "十、鑑定標的物之用途及現況", content: "", source: "attachment7", fixedTitle: true },
    { id: "attachments", order: 11, title: "十一、附件", content: "", source: "attachments", fixedTitle: true },
  ];
}

function buildLevelMeasurementPages(project: Project, rows: LevelMeasurement[], planPaths: string[]) {
  const effectiveRows = rows.filter((row) => row.pointNo || row.location || row.relativeElevation || row.initialElevation || row.photo?.imageUrl);
  if (!effectiveRows.length && !planPaths.length) return "";
  const photoRows = effectiveRows.filter((row) => row.photo?.imageUrl);
  return `
    ${effectiveRows.length ? buildLevelTablePage(project, effectiveRows, 1) : ""}
    ${planPaths.length || effectiveRows.some((row) => row.x != null && row.y != null) ? buildMeasurementPlanPage("水準測量位置示意圖", "附件五", 2, planPaths, effectiveRows.map((row) => ({ label: row.pointNo || "測點", x: row.x, y: row.y }))) : ""}
    ${chunk(photoRows, 2).map((cards, index) => buildLevelPhotoPage(cards, 3 + index)).join("")}
  `;
}

function buildLevelTablePage(project: Project, rows: LevelMeasurement[], attachmentPage: number) {
  const tableRows = [...rows, ...Array.from({ length: Math.max(0, 18 - rows.length) }, () => null)]
    .map((row) =>
      row
        ? `<tr><td>${escapeHtml(row.pointNo)}</td><td class="text-left">${escapeHtml(row.location || `詳水準測量位置示意圖及${row.pointNo}現況照片`)}</td><td>${escapeHtml(row.relativeElevation || row.initialElevation)}</td><td class="text-left">${escapeHtml(row.note)}</td></tr>`
        : `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`,
    )
    .join("");
  return `
    <section class="page measurement-table-page">
      <h2>社團法人臺中市土木技師公會　　鑑定報告書現況測量資料</h2>
      <h1>${escapeHtml(project.projectName)}</h1>
      <div class="measurement-subtitle"><span>時間：${formatRocDate(project.inspectionDate)}</span><span>水準測量紀錄表</span></div>
      <table class="measurement-table level-table">
        <tbody>
          <tr><th>測點<br>編號</th><th>位置</th><th>相對<br>高程</th><th>備　　註</th></tr>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">附件五-${attachmentPage}</div>
    </section>`;
}

function buildLevelPhotoPage(rows: LevelMeasurement[], attachmentPage: number) {
  return `
    <section class="page measurement-photo-page">
      <h1>社團法人臺中市土木技師公會　　鑑定報告書現況照片</h1>
      ${rows
        .map(
          (row, index) => `
            <article class="measurement-photo-card">
              <div class="measurement-photo-info">
                <div class="info-label">編號<br>${escapeHtml(String(index + 1))}</div>
                <div class="info-label">說　明</div>
                <div class="info-content">${escapeHtml(row.pointNo)} ${escapeHtml(row.photo?.caption || "水準點現況")}<br>(攝於 ${formatRocDate(row.measurementDate || row.photo?.takenAt || "")})</div>
              </div>
              <div class="measurement-photo-box"><img src="${escapeHtml(row.photo?.imageUrl ?? "")}" alt="${escapeHtml(row.pointNo)}" /></div>
            </article>`,
        )
        .join("")}
      <div class="footer">附件五-${attachmentPage}</div>
    </section>`;
}

function buildTiltMeasurementPages(project: Project, rows: TiltMeasurement[], planPaths: string[]) {
  const effectiveRows = rows.filter((row) => row.lineNo || row.location || row.floorHeight || row.upperPhoto?.imageUrl || row.lowerPhoto?.imageUrl);
  if (!effectiveRows.length && !planPaths.length) return "";
  const photoRows = effectiveRows.filter((row) => row.upperPhoto?.imageUrl || row.lowerPhoto?.imageUrl);
  return `
    ${effectiveRows.length ? buildTiltTablePage(project, effectiveRows, 1) : ""}
    ${planPaths.length || effectiveRows.some((row) => row.x != null && row.y != null) ? buildMeasurementPlanPage("傾斜測量位置示意圖", "附件六", 2, planPaths, effectiveRows.map((row) => ({ label: row.lineNo || "Z", x: row.x, y: row.y }))) : ""}
    ${chunk(photoRows, 2).map((cards, index) => buildTiltPhotoPage(cards, 3 + index)).join("")}
  `;
}

function buildTiltTablePage(project: Project, rows: TiltMeasurement[], attachmentPage: number) {
  const tableRows = rows
    .map((row) => {
      const displacement = tiltDisplacement(row);
      const ratio = tiltRatio(row);
      return `<tr><td>${escapeHtml(row.lineNo)}</td><td class="text-left">${escapeHtml(row.location)}</td><td>${formatRocDate(row.measurementDate || project.inspectionDate)}</td><td>${escapeHtml(row.floorHeight)} M</td><td>${displacement == null ? "" : `${(displacement / 1000).toFixed(5)} M`}</td><td>${ratio == null ? "" : formatTiltRatio(displacement, ratio)}</td></tr>`;
    })
    .join("");
  return `
    <section class="page measurement-table-page">
      <h2>社團法人臺中市土木技師公會　　鑑定報告書現況測量資料</h2>
      <h1>案名：${escapeHtml(project.projectName)}</h1>
      <div class="measurement-subtitle"><span></span><span>紀錄總表</span></div>
      <table class="measurement-table tilt-table">
        <tbody>
          <tr><th>編號</th><th>內容</th><th>日期</th><th>測量值H</th><th>傾斜值e</th><th>傾斜度</th></tr>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">附件六-${attachmentPage}</div>
    </section>`;
}

function buildTiltPhotoPage(rows: TiltMeasurement[], attachmentPage: number) {
  return `
    <section class="page measurement-photo-page">
      <h1>社團法人臺中市土木技師公會　　鑑定報告書現況照片</h1>
      ${rows.map((row) => buildTiltPhotoCard(row)).join("")}
      <div class="footer">附件六-${attachmentPage}</div>
    </section>`;
}

function buildTiltPhotoCard(row: TiltMeasurement) {
  const displacement = tiltDisplacement(row);
  const ratio = tiltRatio(row);
  return `
    <article class="tilt-photo-card">
      <div class="measurement-photo-info">
        <div class="info-label">編號<br>${escapeHtml(row.lineNo)}</div>
        <div class="info-label">說明</div>
        <div class="info-content">項目：建築物垂直測量<br>內容：${escapeHtml(row.location)}</div>
      </div>
      <div class="tilt-photo-grid">
        ${row.upperPhoto?.imageUrl ? `<img src="${escapeHtml(row.upperPhoto.imageUrl)}" alt="${escapeHtml(row.lineNo)}-A" />` : "<div></div>"}
        ${row.lowerPhoto?.imageUrl ? `<img src="${escapeHtml(row.lowerPhoto.imageUrl)}" alt="${escapeHtml(row.lineNo)}-B" />` : "<div></div>"}
      </div>
      <table class="tilt-card-table"><tbody><tr><th>測量點</th><th>日期</th><th>測量值 H</th><th>傾斜值 e</th><th>傾斜度</th></tr><tr><td>${escapeHtml(row.lineNo)}-A,${escapeHtml(row.lineNo)}-B</td><td>${formatRocDate(row.measurementDate || row.upperPhoto?.takenAt || "")}</td><td>${escapeHtml(row.floorHeight)}</td><td>${displacement == null ? "" : (displacement / 1000).toFixed(4)}</td><td>${ratio == null ? "" : formatTiltRatio(displacement, ratio)}</td></tr></tbody></table>
    </article>`;
}

function buildMeasurementPlanPage(title: string, attachmentName: string, attachmentPage: number, paths: string[], markers: Array<{ label: string; x?: number; y?: number }>) {
  return `
    <section class="page measurement-plan-page">
      <div class="vertical-title left">社團法人臺中市土木技師公會</div>
      <div class="vertical-title right">${escapeHtml(title)}</div>
      <div class="measurement-plan-frame">
        ${serializeMeasurementPlan(paths, markers)}
      </div>
      <div class="footer">${attachmentName}-${attachmentPage}</div>
    </section>`;
}

function buildFloorPlanPage(project: Project, target: Target, floor: Floor, attachmentPage: number) {
  return `
    <section class="page plan-page">
      <div class="top-row">
        <div>
          <div>案件編號：${escapeHtml(project.caseNo)}</div>
          <h1>鑑定標的物現況照片位置示意圖</h1>
        </div>
        <div class="date-box">鑑定日期:${formatDate(project.inspectionDate)}</div>
      </div>
      <div class="plan-frame">
        <div class="address-line">鑑定標的物:${escapeHtml(target.address)} ${escapeHtml(floor.floorName)}</div>
        <div class="plan-canvas">${floor.planSvgOrJson}</div>
        <div class="legend-block">
          <div>N.T.S</div>
          <div><span class="legend-circle">N</span> 代表照片位置</div>
          <div><span class="legend-arrow">→</span> 代表照片拍攝方向</div>
          <div><span class="legend-no-entry"></span> 代表不便進入</div>
        </div>
      </div>
      <div class="footer">附件七－${attachmentPage}</div>
      <div class="association">社團法人臺中市土木技師公會</div>
    </section>`;
}

function buildInspectionTablePage(
  project: Project,
  target: Target,
  floors: Floor[],
  points: InspectionPoint[],
  attachmentPage: number,
) {
  const rows = [...points, ...Array.from({ length: Math.max(0, 20 - points.length) }, () => null)]
    .map((point) => {
      if (!point) {
        return `<tr>${Array.from({ length: 14 }, () => "<td>&nbsp;</td>").join("")}</tr>`;
      }

      const has = (label: string, values: string[]) => (values.includes(label) ? "✔" : "");
      const floorName = findFloorName(floors, point.floorId);
      const note = [
        floorName,
        point.inaccessible ? "不便進入／拍照" : "",
        point.note,
      ].filter(Boolean).join("；");
      return `
        <tr>
          <td>${escapeHtml(point.photoNo)}</td>
          <td>${has("全景", point.componentType)}</td>
          <td>${has("牆面", point.componentType)}</td>
          <td>${has("平頂", point.componentType)}</td>
          <td>${has("地坪", point.componentType)}</td>
          <td>${has("梁", point.componentType)}</td>
          <td>${has("柱", point.componentType)}</td>
          <td>${has("其他", point.componentType)}</td>
          <td>${has("現況", point.conditionType)}</td>
          <td>${has("裂縫", point.conditionType)}</td>
          <td>${point.crackWidthMm ?? ""}</td>
          <td>${has("滲水", point.conditionType)}</td>
          <td>${has("剝落", point.conditionType)}</td>
          <td>${escapeHtml(note)}</td>
        </tr>`;
    })
    .join("");

  return `
    <section class="page table-page">
      <h2>社團法人臺中市土木技師公會</h2>
      <h1>建築物鑑定（估）調查紀錄表及照片說明表</h1>
      <div class="roc-date">鑑定日期：${formatDate(project.inspectionDate)}</div>
      <table class="survey-table">
        <tbody>
          <tr>
            <th class="label-cell">標的物之座落</th>
            <td colspan="13" class="text-left">${escapeHtml(target.address)}</td>
          </tr>
          <tr>
            <th class="label-cell">用途</th>
            <td colspan="13" class="text-left">${renderChecks(usageOptions, target.usageType)}</td>
          </tr>
          <tr>
            <th class="label-cell">牆面</th>
            <td colspan="13" class="text-left">${renderChecks(wallFinishOptions, target.wallFinish)}</td>
          </tr>
          <tr>
            <th class="label-cell">平頂</th>
            <td colspan="13" class="text-left">${renderChecks(ceilingFinishOptions, target.ceilingFinish)}</td>
          </tr>
          <tr>
            <th class="label-cell">地坪</th>
            <td colspan="13" class="text-left">${renderChecks(floorFinishOptions, target.floorFinish)}</td>
          </tr>
          <tr>
            <th rowspan="2">照片<br>編號</th>
            <th colspan="7">位　　　　置</th>
            <th rowspan="2">現<br>況</th>
            <th rowspan="2">裂<br>縫</th>
            <th rowspan="2">裂縫寬<br>(mm)</th>
            <th rowspan="2">滲<br>水</th>
            <th rowspan="2">剝<br>落</th>
            <th rowspan="2">備<br>註</th>
          </tr>
          <tr>
            <th>全景</th><th>牆面</th><th>平頂</th><th>地坪</th><th>梁</th><th>柱</th><th>其他</th>
          </tr>
          ${rows}
          <tr>
            <td colspan="14" class="text-left status-line">★會 勘 狀 況：${renderChecks(surveyStatusOptions, target.surveyStatus, "■", "□")}</td>
          </tr>
          <tr>
            <td colspan="14" class="text-left note-box">※其 它 事 項：${escapeHtml(target.note)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">附件七－${attachmentPage}</div>
    </section>`;
}

function buildPhotoPage(address: string, points: InspectionPoint[], attachmentPage: number, photoPage: number) {
  return `
    <section class="page report-photo-page">
      <h1>臺中市土木技師公會　鑑定報告書現況照片</h1>
      ${points.map((point) => buildReportPhotoCard(address, point)).join("")}
      <div class="side-page">第<br>${photoPage}<br>頁</div>
      <div class="footer">附件七－${attachmentPage}</div>
    </section>`;
}

function buildReportPhotoCard(address: string, point: InspectionPoint) {
  const caption = point.photo?.caption || buildPhotoCaption(point);
  return `
    <article class="report-photo-card">
      <table>
        <tbody>
          <tr>
            <th rowspan="3">照片<br>編號<br><br>${escapeHtml(point.photoNo)}</th>
            <th rowspan="3">說明</th>
            <td>${escapeHtml(address)}</td>
          </tr>
          <tr><td>${escapeHtml(caption)}</td></tr>
          <tr><td>&nbsp;</td></tr>
        </tbody>
      </table>
      <div class="photo-box"><img src="${escapeHtml(point.photo?.imageUrl ?? "")}" alt="照片 ${escapeHtml(point.photoNo)}" /></div>
    </article>`;
}

function buildSitePhotoPage(photos: SitePhoto[], attachmentPage: number, photoPage: number) {
  return `
    <section class="page report-photo-page">
      <h1>臺中市土木技師公會　基地現況照片</h1>
      ${photos
        .map(
          (photo) => `
            <article class="report-photo-card">
              <table>
                <tbody>
                  <tr>
                    <th rowspan="3">照片<br>編號<br><br>${escapeHtml(photo.photoNo)}</th>
                    <th rowspan="3">說明</th>
                    <td>基地現況照片</td>
                  </tr>
                  <tr><td>${escapeHtml(photo.caption || photo.note || "基地現況")}</td></tr>
                  <tr><td>&nbsp;</td></tr>
                </tbody>
              </table>
              <div class="photo-box"><img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.photoNo)}" /></div>
            </article>`,
        )
        .join("")}
      <div class="side-page">第<br>${photoPage}<br>頁</div>
      <div class="footer">附件八－${attachmentPage}</div>
    </section>`;
}

const reportCss = `
@page { size: A4; margin: 0; }
body { margin: 0; color: #111; font-family: "DFKai-SB", "BiauKai", "標楷體", "Microsoft JhengHei", serif; }
.page { width: 210mm; min-height: 297mm; break-after: page; position: relative; padding: 14mm 18mm 16mm; box-sizing: border-box; background: white; overflow: hidden; }
.cover-page { padding: 16mm 22mm; text-align: center; }
.cover-logo { display: block; width: 31mm; height: 31mm; object-fit: contain; margin: 18mm auto 5mm; }
.cover-association { font-size: 24px; letter-spacing: 3px; }
.cover-main { margin-top: 18mm; line-height: 1.65; }
.cover-frame { width: 124mm; min-height: 62mm; margin: 0 auto; padding: 11mm 8mm 8mm; border: 3px dotted #111; box-sizing: border-box; }
.cover-applicant { font-size: 18px; font-weight: 700; }
.cover-main h1 { margin: 4mm 0 0; font-size: 18px; font-weight: 700; line-height: 1.45; }
.cover-main h2 { margin: 2mm 0; font-size: 19px; font-weight: 700; line-height: 1.45; }
.cover-case, .cover-volume { font-size: 18px; font-weight: 700; }
.cover-meta { position: absolute; left: 47mm; right: 38mm; bottom: 74mm; display: grid; gap: 6mm; text-align: left; font-size: 19px; line-height: 1.7; }
.cover-meta-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16mm; white-space: nowrap; }
.cover-contact { position: absolute; left: 45mm; right: 34mm; bottom: 24mm; display: grid; gap: 6mm; text-align: left; font-size: 16px; line-height: 1.4; }
.cover-contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
.report-text-page { padding: 15mm 23mm 20mm; overflow: hidden; font-size: 18px; line-height: 1.75; }
.association-header { display: grid; grid-template-columns: 22mm 1fr; align-items: center; column-gap: 5mm; color: #e00; text-align: center; margin-bottom: 12mm; }
.association-header img { width: 18mm; height: 18mm; object-fit: contain; justify-self: end; }
.association-header-title { font-size: 26px; font-weight: 700; letter-spacing: 2px; line-height: 1.15; }
.association-header-en { font-family: "Times New Roman", serif; font-size: 13px; font-weight: 700; line-height: 1.2; }
.association-header-address, .association-header-contact { font-size: 10px; line-height: 1.15; }
.main-report-page { font-size: 17px; line-height: 1.75; }
.main-title-block { margin: -4mm 0 6mm; text-align: center; font-size: 16px; line-height: 1.45; }
.main-section { margin: 0 0 6mm; page-break-inside: avoid; }
.main-section h2 { margin: 0 0 2mm; font-size: 18px; font-weight: 700; line-height: 1.4; }
.main-section-content { padding-left: 10mm; white-space: normal; text-align: justify; }
.main-section-content br { line-height: 1.7; }
.main-page-number { position: absolute; bottom: 9mm; left: 0; right: 0; text-align: center; font-size: 12px; }
.toc-page h1 { margin: 0 0 8mm; text-align: center; font-size: 24px; letter-spacing: 8px; }
.toc-table { width: 100%; border-collapse: collapse; margin-top: 7mm; font-size: 16px; line-height: 1.25; }
.toc-table td { padding: 2.1mm 0; vertical-align: top; }
.toc-table td:last-child { width: 12mm; text-align: right; }
.toc-line { display: flex; align-items: center; gap: 2mm; }
.toc-leader { flex: 1; height: 0; border-bottom: 1px dashed #111; transform: translateY(-0.8mm); }
.toc-attachment-title { padding-left: 13mm !important; font-size: 14px; }
.footer { position: absolute; left: 0; right: 0; bottom: 8mm; text-align: center; font-size: 12px; }
.top-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 19px; }
.top-row h1 { margin: 8mm 0 6mm 10mm; font-size: 20px; font-weight: 400; }
.date-box { border: 1px solid #111; padding: 4mm; }
.plan-frame { border: 1px solid #111; height: 238mm; position: relative; }
.address-line { border-bottom: 1px solid #111; padding: 5mm; font-size: 18px; }
.plan-canvas { height: 176mm; display: grid; place-items: center; }
.plan-canvas svg { max-width: 160mm; max-height: 168mm; }
.legend-block { position: absolute; left: 4mm; bottom: 4mm; font-size: 18px; line-height: 2.1; }
.legend-circle { display: inline-grid; place-items: center; width: 7mm; height: 7mm; border: 1px solid #ff2a2a; border-radius: 50%; color: #ff2a2a; font-size: 10px; }
.legend-arrow { color: #ff2a2a; font-size: 24px; padding: 0 3mm; }
.legend-no-entry { display: inline-block; width: 10mm; height: 7mm; border: 1px solid #111; background: linear-gradient(to bottom right, transparent 48%, #ff8a8a 49%, #ff8a8a 51%, transparent 52%), linear-gradient(to top right, transparent 48%, #ff8a8a 49%, #ff8a8a 51%, transparent 52%); vertical-align: middle; }
.association { position: absolute; right: 18mm; bottom: 2mm; font-size: 18px; }
.table-page h2 { margin: 8mm 0 1mm; text-align: center; font-size: 21px; font-weight: 400; }
.table-page h1 { margin: 0 0 2mm; text-align: center; font-size: 18px; font-weight: 400; }
.roc-date { margin: 0 0 2mm; text-align: right; font-size: 14px; padding-right: 14mm; }
.survey-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 15px; }
.survey-table th, .survey-table td { border: 1px solid #111; padding: 1.7mm 1mm; text-align: center; vertical-align: middle; line-height: 1.25; }
.survey-table .label-cell { width: 31mm; font-weight: 400; }
.survey-table .text-left { text-align: left; }
.survey-table .status-line { font-size: 15px; padding: 2mm 1mm; }
.survey-table .note-box { height: 28mm; vertical-align: top; }
.check-item { display: inline-block; margin-right: 7mm; white-space: nowrap; }
.report-photo-page { padding: 18mm 20mm 15mm; color: #d00; }
.report-photo-page h1 { margin: 0 0 5mm; text-align: center; font-size: 24px; font-weight: 400; letter-spacing: 1px; }
.report-photo-card { border: 2px solid #f00; margin-bottom: 3mm; height: 125mm; box-sizing: border-box; page-break-inside: avoid; }
.report-photo-card table { width: 100%; border-collapse: collapse; table-layout: fixed; color: #d00; font-size: 21px; }
.report-photo-card th, .report-photo-card td { border: 2px solid #f00; text-align: center; vertical-align: middle; font-weight: 400; }
.report-photo-card th:first-child { width: 18mm; }
.report-photo-card th:nth-child(2) { width: 32mm; font-size: 22px; }
.report-photo-card td { height: 11mm; color: #111; }
.photo-box { height: 88mm; display: grid; place-items: center; overflow: hidden; }
.photo-box img { width: 100%; height: 100%; object-fit: contain; }
.side-page { position: absolute; right: 9mm; bottom: 33mm; text-align: center; color: #d00; font-size: 22px; line-height: 1.9; }
.measurement-table-page h2 { margin: 8mm 0 5mm; text-align: center; font-size: 20px; font-weight: 400; }
.measurement-table-page h1 { margin: 0 0 6mm; font-size: 18px; font-weight: 400; line-height: 1.5; }
.measurement-subtitle { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 17px; }
.measurement-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 16px; }
.measurement-table th, .measurement-table td { border: 1px solid #111; padding: 2mm 1.5mm; text-align: center; vertical-align: middle; line-height: 1.35; }
.measurement-table .text-left { text-align: left; }
.level-table th:first-child, .level-table td:first-child { width: 18mm; }
.level-table th:nth-child(3), .level-table td:nth-child(3) { width: 24mm; }
.level-table th:nth-child(4), .level-table td:nth-child(4) { width: 58mm; }
.tilt-table th:first-child, .tilt-table td:first-child { width: 14mm; }
.tilt-table th:nth-child(3), .tilt-table td:nth-child(3) { width: 27mm; }
.tilt-table th:nth-child(4), .tilt-table td:nth-child(4), .tilt-table th:nth-child(5), .tilt-table td:nth-child(5), .tilt-table th:nth-child(6), .tilt-table td:nth-child(6) { width: 27mm; }
.measurement-plan-page { padding: 20mm 24mm 16mm; }
.measurement-plan-frame { position: absolute; left: 32mm; top: 30mm; right: 26mm; bottom: 22mm; border: 1px solid #111; display: grid; place-items: center; }
.measurement-plan-frame svg { width: 100%; height: 100%; }
.vertical-title { position: absolute; top: 88mm; writing-mode: vertical-rl; font-size: 26px; letter-spacing: 5px; }
.vertical-title.left { left: 17mm; }
.vertical-title.right { right: 9mm; }
.measurement-photo-page { padding: 18mm 20mm 15mm; }
.measurement-photo-page h1 { margin: 0 0 4mm; text-align: center; font-size: 20px; font-weight: 400; }
.measurement-photo-card { margin-bottom: 5mm; height: 122mm; page-break-inside: avoid; }
.measurement-photo-info { display: grid; grid-template-columns: 20mm 26mm 1fr; border: 1px solid #111; border-bottom: 0; font-size: 16px; }
.measurement-photo-info > div { border-right: 1px solid #111; min-height: 18mm; padding: 2mm; display: grid; place-items: center; text-align: center; }
.measurement-photo-info > div:last-child { border-right: 0; justify-items: start; text-align: left; }
.measurement-photo-box { height: 95mm; border: 1px solid #111; display: grid; place-items: center; overflow: hidden; }
.measurement-photo-box img { width: 100%; height: 100%; object-fit: contain; }
.tilt-photo-card { margin-bottom: 4mm; height: 124mm; page-break-inside: avoid; }
.tilt-photo-grid { height: 78mm; border-left: 1px solid #111; border-right: 1px solid #111; display: grid; place-items: center; gap: 2mm; padding: 2mm; }
.tilt-photo-grid img { max-width: 100%; max-height: 36mm; object-fit: contain; }
.tilt-card-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.tilt-card-table th, .tilt-card-table td { border: 1px solid #111; text-align: center; padding: 1.5mm; }
`;

function renderChecks(options: string[], value: string, checked = "■", unchecked = "□") {
  const values = value ? value.split("、") : [];
  return options
    .map((option) => `<span class="check-item">${values.includes(option) ? checked : unchecked}${escapeHtml(option)}</span>`)
    .join("");
}

function formatDate(date: string) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(date);
  const year = parsed.getFullYear() - 1911;
  return `中華民國 ${year} 年 ${String(parsed.getMonth() + 1).padStart(2, "0")} 月 ${String(parsed.getDate()).padStart(2, "0")} 日`;
}

function formatRocDate(date: string) {
  if (!date) return "";
  const value = date.includes("T") ? date.slice(0, 10) : date;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(date);
  return `${parsed.getFullYear() - 1911}.${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

function parseEngineerNames(project: Project) {
  const names = (project.engineers ?? [])
    .map((engineer) => engineer.name.trim())
    .filter(Boolean);
  if (names.length) return names.join("、");
  return project.engineerNames ?? "";
}

function tiltDisplacement(row: TiltMeasurement) {
  const upper = Number(row.upperDistance);
  const lower = Number(row.lowerDistance);
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || row.upperDistance === "" || row.lowerDistance === "") return null;
  return upper - lower;
}

function tiltRatio(row: TiltMeasurement) {
  const displacement = tiltDisplacement(row);
  const heightM = Number(row.floorHeight);
  if (displacement === null || displacement === 0 || !Number.isFinite(heightM) || row.floorHeight === "") return null;
  return Math.abs((heightM * 1000) / displacement);
}

function formatTiltRatio(displacement: number | null, ratio: number) {
  const sign = displacement != null && displacement < 0 ? "-" : "";
  return `1/${sign}${Math.round(ratio)}`;
}

function serializeMeasurementPlan(paths: string[], markers: Array<{ label: string; x?: number; y?: number }>) {
  const pathMarkup = paths
    .map((path) => `<path d="${escapeHtml(path)}" fill="none" stroke="#202020" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  const markerMarkup = markers
    .filter((marker) => marker.x != null && marker.y != null)
    .map(
      (marker) =>
        `<g><line x1="${(marker.x ?? 0) - 12}" y1="${marker.y}" x2="${(marker.x ?? 0) + 12}" y2="${marker.y}" stroke="#c5161d" stroke-width="3"/><line x1="${marker.x}" y1="${(marker.y ?? 0) - 12}" x2="${marker.x}" y2="${(marker.y ?? 0) + 12}" stroke="#c5161d" stroke-width="3"/><text x="${(marker.x ?? 0) + 14}" y="${(marker.y ?? 0) - 8}" fill="#c5161d" font-size="24" font-weight="700">${escapeHtml(marker.label)}</text></g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620">${pathMarkup}${markerMarkup}</svg>`;
}

function findFloorName(floors: Floor[], floorId: string) {
  return floors.find((floor) => floor.id === floorId)?.floorName ?? "";
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
