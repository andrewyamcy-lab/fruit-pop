# Fruit Pop — Shared scores setup

Your seven player names are Ada, Andrew, Esther, Jenny, Rain, Tom and Yaki. People can play on different iPhones concurrently. When a game ends, its score is submitted to Firestore, and every player can see the shared leaderboard in real time.

## One-time setup
1. Open https://console.firebase.google.com/ and create a Firebase project (for example, Fruit Pop).
2. In Project Overview, choose **Add app → Web (</>)** and register the web app.
3. Copy the **Firebase configuration object** (apiKey, authDomain, projectId, appId) from Project settings. These are public web configuration values; NEVER use service-account private keys.
4. On Firebase Console, open **Authentication → Sign-in method**. Enable **Anonymous**.
5. Open **Firestore Database → Create database**. Select production mode and a region. Then go to **Rules**, replace all rules with the content of **firestore.rules** from this repository and click **Publish**.
6. Edit **firebase-config.js** in GitHub and replace `null` with your project's real config object. Commit changes.
7. Visit https://andrewyamcy-lab.github.io/fruit-pop/ on two phones, refresh each. The scoreboard status should say **Live shared scores**. Start a new game on one device, end the game, and open the leaderboard on the other.

## How scoring works
- Players choose one of the seven fixed names before starting.
- Scores are stored as immutable, individual game results linked to an anonymous Firebase device ID.
- The scoreboard groups scores by chosen name. **Best** is the highest score for that name; **Last** is the score from the latest uploaded game.
- Every result is saved locally first. If internet access is temporarily unavailable, the game retries uploading on reconnection.
- Before Firebase setup is complete, the game continues working with a LOCAL scoreboard; these local scores are not automatically shared.
- **Important:** Players can pick any name, so names are not verified identities. If you need anti-cheat or player authentication, add sign-in or access codes before using this for formal competition.
- The Firestore collection allows public reads of the seven chosen names and their scores. Never add sensitive private data to score records.
- Static web applications cannot enforce anti-cheat scoring on their own. Database rules prevent changing others' records, but not dishonest score submissions by the device owner.

## Developer files
- `firebase-config.js`: one-time project config
- `cloud.js`: Firebase Authentication, real-time subscription and score uploads
- `firestore.rules`: publish these rules in Firebase Console
- `sw.js`: offline caching

For setup see: https://firebase.google.com/docs/web/setup and https://firebase.google.com/docs/auth/web/anonymous
