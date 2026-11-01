# Fruit Pop — Your iPhone Fruit Merge Game 🍉

This is a self-contained HTML5 fruit-merging game. Original graphics are drawn inside the game, and it doesn't need paid services, a game engine, or an App Store account.

## Play it

- Drag inside the board to aim and release to drop a fruit.
- Match identical fruits to combine them into larger fruit.
- Keep your stack below the danger line.
- Tap the gear icon to change your game name or choose a different theme.
- Best score and preferences save in your browser on the device.

## Quick desktop test

Open `index.html` in a modern browser. On your phone, it works best from a website published over HTTPS.

## Put it on your iPhone with GitHub Pages (free)

1. Sign in to [GitHub](https://github.com) and create a new **public** repository named `fruit-pop`.
2. Upload **the contents of this folder** (including `index.html`, `sw.js`, `manifest.webmanifest`, and the PNG icons) to the root of your repository. Commit the files to the `main` branch.
3. Go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Visit the link shown by GitHub Pages when deployment is complete. It will have a format like `https://YOUR-USERNAME.github.io/fruit-pop/`.
5. On your iPhone, open that link in Safari, open the page's **Share** menu, choose **Add to Home Screen**, enable **Open as Web App** when available, then tap Add.
6. After the site has been opened online at least once, its service worker can cache the files for subsequent offline play.

### Notes

- If you only download `Fruit_Pop_Playable.html`, you have a single-file version for desktop testing. To get the icon and offline-capable Home Screen app, use **all the files in this folder**.
- Best scores are saved on the device/browser you play with, not synced across devices.
- The app's display name in your browser can be personalized using the gear button. To change the installed iPhone icon label, edit `manifest.webmanifest` and `apple-mobile-web-app-title` in `index.html`, then reinstall the Home Screen icon.

Sources: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site and https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
