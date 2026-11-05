# 🎨 Friend Arcade — 猜猜畫畫 (Hybrid Draw & Guess)

網址：https://andrewyamcy-lab.github.io/fruit-pop/arcade/draw-and-guess/

## 開始使用 — 必須先啟用 Firestore Rules
**GitHub Pages 發布只會更新網站檔案，唔會自動部署 Firebase Rules。**
新遊戲第一次啟用前，要由 Firebase 專案擁有人做一次設定：

1. 開啟 https://github.com/andrewyamcy-lab/fruit-pop/blob/main/firestore.rules
2. Copy raw（複製**整份檔案**，當中保留 Fruit Pop、Gatherings、SameWord 原本規則）。
3. 開啟 https://console.firebase.google.com/project/fruit-pop-d1649/firestore/databases/-default-/rules
4. 將完整檔案貼到 Firebase Firestore → Rules，按 **Publish**。
5. Firebase → Authentication → Sign-in method，確保 **Anonymous** 已啟用。
6. 兩部手機開啟遊戲，分別選不同名字。一部建立房間，另一部加入同一個 6 位房號。測試房間即時同步、畫筆同猜測。
7. 正式使用時請七位朋友都加入；亦可以 2–7 人先試玩。

**重要：** 暫時無法由 GitHub Connector 直接發布 Firebase 安全規則，所以需要完成以上一次性操作。唔可以將資料庫直接設為公開讀寫。

## 遊戲規則
- 七個固定玩家：Ada、Andrew、Esther、Jenny、Rain、Tom、Yaki。
- 房主建立房間（6 位隨機房號），分享邀請連結。
- 房主最少有 2 人入房可以開始，最多 7 人；開始後名單固定。
- 每回合按英文名稱排序輪流畫畫，每人畫一次。
- 畫家選三題其中一題；題目只會存入由 Firebase Security Rules 限制讀取嘅私人子文件。
- 每回合 90 秒。0–30 秒自由輸入答中 +100；30–60 秒有類別及字數提示，答中 +70；60–90 秒自由輸入 +50，四選一答中 +30。
- 四選一每人限選一次。文字輸入可以重試，支援題庫預設嘅中英文同義詞。
- 每位朋友第一次猜中計一次分，畫家每令一個人猜中 +20 分。
- 全部猜中或時間到時，畫家結束並公布答案；房主按下一回合。
- 七位都畫過一輪後，顯示最終分數同冠軍。

## 技術
- HTML Canvas + Pointer Events：支援 iPhone 手指及電腦滑鼠。
- Cloud Firestore：房間文件、各回合筆跡分段、私人答案、私人猜測資料。
- 畫家瀏覽器負責私人判定及計分，其他玩家無權讀取當回合正確答案／其他人嘅私人猜測。
- 大量連續繪畫會產生 Firestore 寫入／讀取。已限制畫筆提交頻率及單段長度；可在 Firebase Usage 查看用量。

## 安全及限制
- **休閒朋友版**：匿名 Firebase UID 唔係真正姓名驗證，第一個領取玩家名字嘅裝置會佔用該房間嘅位置。
- 畫家瀏覽器屬信任方：判分和回合結束由畫家負責；無法完全防作弊。真正賽事應改用可信任後端判分。
- 畫家退出或手機休眠會令題目提示、判分或回合切換延遲。100 秒後房主可略過離線畫家，但答案不會曝光。
- 題庫公開喺前端，但每回合被揀中嘅答案係獨立私人資料；多人可以推測選項但唔可以直接讀取私人文件。
- 房間和猜測歷史暫時未自動刪除，長期運行應加 Firestore TTL / scheduled cleanup。
- 目前未完成真實七機同步測試，需要一組朋友一齊實測。
