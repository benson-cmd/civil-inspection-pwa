import type { Floor, InspectionPoint, Project, SitePhoto, Target } from "@/types/inspection";
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
}) {
  const { project, target, floors, points, sitePhotos = [] } = input;
  const floorsWithData = floors.filter((floor) => points.some((point) => point.floorId === floor.id));
  const photoPoints = points.filter((point) => point.photo?.imageUrl);

  return `<!doctype html>
  <html lang="zh-Hant">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(project.caseNo)} 現況鑑定附件</title>
      <style>${reportCss}</style>
    </head>
    <body>
      ${floorsWithData.map((floor, index) => buildFloorPlanPage(project, target, floor, index + 1)).join("")}
      ${points.length ? buildInspectionTablePage(project, target, floors, points, floorsWithData.length + 1) : ""}
      ${chunk(photoPoints, 2)
        .map((cards, index) => buildPhotoPage(target.address, cards, floorsWithData.length + 2 + index, index + 1))
        .join("")}
      ${chunk(sitePhotos, 2)
        .map((cards, index) => buildSitePhotoPage(cards, floorsWithData.length + 2 + chunk(photoPoints, 2).length + index, index + 1))
        .join("")}
    </body>
  </html>`;
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
        return `<tr>${Array.from({ length: 15 }, () => "<td>&nbsp;</td>").join("")}</tr>`;
      }

      const has = (label: string, values: string[]) => (values.includes(label) ? "✔" : "");
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
          <td>${escapeHtml(point.note)}</td>
          <td>${escapeHtml(findFloorName(floors, point.floorId))}</td>
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
            <td colspan="14" class="text-left">${escapeHtml(target.address)}</td>
          </tr>
          <tr>
            <th class="label-cell">用途</th>
            <td colspan="14" class="text-left">${renderChecks(usageOptions, target.usageType)}</td>
          </tr>
          <tr>
            <th class="label-cell">牆面</th>
            <td colspan="14" class="text-left">${renderChecks(wallFinishOptions, target.wallFinish)}</td>
          </tr>
          <tr>
            <th class="label-cell">平頂</th>
            <td colspan="14" class="text-left">${renderChecks(ceilingFinishOptions, target.ceilingFinish)}</td>
          </tr>
          <tr>
            <th class="label-cell">地坪</th>
            <td colspan="14" class="text-left">${renderChecks(floorFinishOptions, target.floorFinish)}</td>
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
            <th rowspan="2">樓層</th>
          </tr>
          <tr>
            <th>全景</th><th>牆面</th><th>平頂</th><th>地坪</th><th>梁</th><th>柱</th><th>其他</th>
          </tr>
          ${rows}
          <tr>
            <td colspan="15" class="text-left status-line">★會 勘 狀 況：${renderChecks(surveyStatusOptions, target.surveyStatus, "■", "□")}</td>
          </tr>
          <tr>
            <td colspan="15" class="text-left note-box">※其 它 事 項：${escapeHtml(target.note)}</td>
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
