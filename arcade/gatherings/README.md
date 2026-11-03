# Gatherings｜朋友約聚會 — Firebase 一次性設定

網站：https://andrewyamcy-lab.github.io/fruit-pop/arcade/gatherings/

## 必須在 Firebase Console 發布新安全規則
GitHub 裏面的 firestore.rules 已合併舊有 Fruit Pop 規則及新聚會規則，但 GitHub commit **不會自動更新 Firebase Console**。在發布新規則前，Gatherings 不能讀取或儲存活動。

1. 開啟 https://console.firebase.google.com/project/fruit-pop-d1649/firestore/databases/-default-/rules
   （如無法直接開啟，進 Firebase → Firestore Database → Rules）。
2. 開啟本 repository 根目錄的 firestore.rules：
   https://github.com/andrewyamcy-lab/fruit-pop/blob/main/firestore.rules
3. 點 Copy raw file 複製**全部內容**，貼入 Firebase Console Rules 編輯器，取代舊規則，按 Publish。
4. 確保 Authentication → Sign-in method → Anonymous 已啟用；玩家仍然毋須登入。
5. 重新整理 Gatherings，頁面應顯示已連接 Firebase。可以建立聚會、分享連結及投票。
6. 建議用兩部手機選擇不同玩家，測試即時同步。

## 功能
- 任意玩家輸入聚會名稱和月份建立新活動。
- 其他朋友透過 Gatherings 主頁或分享連結，查看同一個活動。
- 七個固定玩家：Ada、Andrew、Esther、Jenny、Rain、Tom、Yaki。
- 點擊有空日期提交；空白日期亦可提交，代表整個月都沒有空。
- 每個聚會中每個玩家只有一份投票，原本匿名裝置可以修改。
- 日曆顯示每日 X/7 及有空、未能出席、未提交的名單。
- 全部 7 位都有空的日子標為 7/7；只有發起裝置可以確認共同日期。
- 聚會確認之後，投票會變成唯讀。
- 每個月份及聚會的記錄互相獨立。

## 私隱及限制
此版本為免登入朋友工具，而非真正私有系統。GitHub Pages 網站公開，聚會標題、月份、固定玩家名及可出席日期可被任何可存取資料的訪客讀取。請勿輸入敏感個人資料。

Anonymous Authentication 只是背景匿名身份，並不能核實朋友名字或防止別人冒名。第一個以某名字提交的匿名身份會得到當次聚會該名字的編輯權；如果清除 Safari 資料或改用另一部手機，可能無法修改原投票。建立活動的人亦要用原本裝置確認日期。

若之後需要真正防冒用、重設權限或更私密，應增加可靠身份驗證。