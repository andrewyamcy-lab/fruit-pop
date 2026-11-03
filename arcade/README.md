# Friend Arcade — 朋友遊戲中心

現時主頁設於 https://andrewyamcy-lab.github.io/fruit-pop/arcade/ ，獨立放在 `arcade/` 目錄，不會取代 Fruit Pop。

## 已有功能
- 繁體中文手機／桌面主頁，具可加到 iPhone 主畫面嘅 PWA 設定
- 七位玩家：Ada、Andrew、Esther、Jenny、Rain、Tom、Yaki（無登入）
- Fruit Pop 入口，網址傳送所選玩家；Fruit Pop 亦會記得同一裝置嘅選擇
- Firebase Firestore 即時 Fruit Pop 排行榜（讀取 `fruitpop_games_v1`，冇獨立存分系統）
- 預留 Guess Who?、Memory Match 同未來功能位置，但尚未推出

## 未來搬到獨立主網站
GitHub 暫時未有建立 `andrewyamcy-lab.github.io` repository 嘅連接功能。將來可在 GitHub 新建該 public repository，然後把本目錄下的 `index.html`、`app.js`、`cloud.js`、`firebase-config.js`、`manifest.webmanifest`、`sw.js`、`icon-192.png` 放到新 repository 根目錄。這些檔案都使用相對路徑，所以可直接搬遷，而 Fruit Pop 遊戲仍保持在原本的 `/fruit-pop/`。

若新 PWA 安裝到主畫面前已有舊版 PWA，須為新網址重新加入主畫面。瀏覽器之間或不同安裝模式下，localStorage 可能互不共享；由主頁進入 Fruit Pop 時會用網址參數傳遞玩家名稱，因此仍然能正確選擇玩家。

## 數據及安全
- `firebase-config.js` 只包含公開 Web SDK 設定，絕不可存放服務帳號私鑰。
- 目前 Firestore 的 `fruitpop_games_v1` 集合允許公開讀取，並只顯示預設名字及遊戲分數。
- 選擇名稱並唔等於驗證玩家身份。
- 新增遊戲時，使用各自獨立的 Firestore collection、驗證規則與排行榜。
- 當成績資料持續變多，應考慮用雲端函數維護各玩家最高分的匯總資料，避免每次讀取全數遊戲紀錄。
