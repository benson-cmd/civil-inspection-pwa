# 土木技師鄰房現況鑑定 PWA 第一版規格

## 範圍

第一版只處理附件七與附件八工作流：

- 建立案件。
- 建立鑑定標的物/住戶。
- 每戶建立 `1F`、`2F`、`3F`、`RF` 樓層。
- 每層樓手繪示意平面圖。
- 在平面圖點選照片位置，系統自動產生照片編號。
- 設定拍攝方向角度。
- 拍照或上傳照片。
- 勾選構件位置與現況/缺失。
- 裂縫可輸入裂縫寬度 mm。
- 輸入備註後形成一筆照片紀錄。
- 匯出附件 PDF。

## 第一版資料策略

- 前端 MVP 先以 React state 操作，方便確認現場流程與 PDF 格式。
- Supabase schema 已建立於 `supabase/schema.sql`。
- `component_type` 與 `condition_type` 使用 `text[]`，因需求是多選。
- `plan_svg_or_json` 使用 `jsonb`，可存 SVG path 陣列、Canvas JSON 或完整 SVG metadata。

## iPad Safari 操作原則

- 所有主要按鈕高度至少約 44px。
- Canvas/SVG 使用 Pointer Events，支援手指與 Apple Pencil。
- PWA manifest 與 service worker 已建立，可加入 iPad 主畫面。
- 拍照欄位使用 `accept="image/*"` 與 `capture="environment"`，讓 iPad 優先開啟相機。

## 後續版本

- 接 Supabase Auth，從單一帳號進化到多人權限。
- 案件、住戶、樓層、照片點位改為 Supabase 即時儲存。
- Supabase Storage 上傳照片，寫入 `photos.image_url`。
- 加入案件權限表，例如 `project_members(project_id, user_id, role)`。
- PDF 匯出改為伺服器端 HTML to PDF，避免瀏覽器列印差異。
