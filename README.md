# 土木技師鄰房現況鑑定報告 PWA

目前已從「附件七與附件八工具」調整為「現況鑑定報告系統」骨架。附件七、附件八是案件底下的附件模組，後續完整報告匯出會包含封面、目錄、主文與附件。

## 技術

- Next.js + TypeScript
- Tailwind CSS
- PWA manifest + service worker
- Supabase PostgreSQL schema
- Supabase Storage 預留 bucket：`inspection-photos`
- SVG/Canvas 風格手繪平面圖
- HTML template 轉 PDF 工作流

## 啟動

```bash
npm install
npm run dev
```

開啟 `http://localhost:3000`。

## 環境變數

建立 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
```

## 資料庫

將 `supabase/schema.sql` 貼到 Supabase SQL Editor 執行。

## 目前 MVP 狀態

- 示意登入：管理者 / 使用者兩種角色。
- 案件列表：可新增案件、切換案件。
- 基本資料：封面與主文會用到的申請單位、連絡資料、案號、鑑定人、收文號、標的物摘要。
- 主文編輯：固定章節標題，內容可編輯。
- 附件管理：
  - 附件一、二、三、五、六：PDF 上傳槽。
  - 附件四、七、八：系統內編輯槽。
- 附件七：平面圖、照片點位、調查紀錄、現況照片。
- 附件八：基地現況照片。
- 目前附件七/八可用 HTML to PDF 方式預覽匯出。

## 報告章節

主文預設章節：

- 一、申請單位
- 二、申請日期
- 三、標的物之坐落
- 四、鑑定要旨
- 五、鑑定依據
- 六、會勘日期
- 七、會勘人員
- 八、鑑定過程
- 九、工地現況
- 十、鑑定標的物之用途及現況
- 十一、附件

## 下一步建議

1. 接 Supabase Auth Google OAuth。
2. 建立 `profiles` 與 `project_members`，完成管理者/使用者權限。
3. 將案件、主文章節、附件狀態、附件七/八資料接到 Supabase CRUD。
4. 加入 Supabase Storage，永久保存照片與上傳 PDF。
5. 建立完整 PDF 匯出：
   - 封面
   - 目錄，自動計算頁碼
   - 主文
   - 附件一至附件八
