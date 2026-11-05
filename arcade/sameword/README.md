# SameWord — Friend Arcade (2–7 players)

Game URL: https://andrewyamcy-lab.github.io/fruit-pop/arcade/sameword/

## Features
- Create a room and invite 1–6 other friends by link or a **unique 3-letter uppercase room code** (e.g. CAT).
- New rooms keep an internal 20-character document ID while offering a short three-letter code through the `friendarcade_sameword_codes_v1` index. Firestore transactions claim the code and room atomically, preventing duplicates.
- Older invitation links using 20-character room IDs still work, though those existing rooms do not automatically receive a short code.
- **Important**: Three letters offer just 17,576 combinations. These codes are convenient join references, **not secret passwords**; do not enter sensitive words.
- Fixed selectable players: Ada, Andrew, Esther, Jenny, Rain, Tom, Yaki.
- One-time anonymous Firebase identity is maintained by the browser. No manual account login.
- Only the room creator can start; 2–7 players required. Membership is frozen after start.
- Every round has **30 seconds from a Firestore server timestamp**.
- Answers are stored in separate Firestore docs with read restrictions until **all players submit** or the server-authoritative deadline expires and a client changes the stage to review.
- One word per person per round. After input ends, every participant sees the reveal, can vote Agree/Disagree, and see historical rounds.
- A unanimous Agree vote **and** answers from every participant wins. If all have voted but consensus is absent, another 30-second round automatically begins.
- Timed-out players are marked as such; the round cannot be won if anyone failed to submit.
- Refreshing preserves the room via query parameters, and the browser's anonymous Firebase identity is retained if its storage is intact.

## REQUIRED Firebase setup before multiplayer works

**Pushing code to GitHub DOES NOT publish Firestore Security Rules to Firebase.**

1. This update adds a `friendarcade_sameword_codes_v1` collection. Re-publish the full Firestore rules even if you already enabled the earlier SameWord rules.
2. Open the complete root [firestore.rules](https://github.com/andrewyamcy-lab/fruit-pop/blob/main/firestore.rules) file.
3. In [Firebase Console → Firestore Database → Rules](https://console.firebase.google.com/project/fruit-pop-d1649/firestore/databases/-default-/rules), replace the **entire existing rules text** with this file (it preserves Fruit Pop and Gatherings) and click Publish.
4. Confirm Firebase → Authentication → Sign-in method → **Anonymous** is enabled.
5. Open the game on two different phones or browsers, create a room on the first, use the invitation on the second, and confirm realtime join/submit/reveal/vote.
6. Test the deadline with an intentional non-response and a rejected answer after 30 seconds.

## Security design and caveats
- Never store the answer text on the public room document during the input phase.
- Each protected answer doc can only be created for the anonymous UID that claimed the corresponding player in the room. Room.submitted is updated in the **same atomic batch** as the answer, checked by Firestore getAfter() rules.
- Other clients cannot read or list unrevealed answers under the saved rules. After the room stage changes to review, answers become readable.
- The room's start timestamp is a server timestamp; rules reject submissions received after 30 seconds. Browser countdown assumes device time is reasonably accurate; server permission checks are authoritative.
- Players can still **impersonate a friend when choosing an unclaimed name**. Anonymous auth protects only the claimed name from another anonymous UID within that room. This does not constitute verified identity.
- Anyone with a valid room link can view that room's membership and revealed words using anonymous auth. Don't enter sensitive data.
- No Cloud Functions or additional server was used. Room-stage transitions are driven by connected clients, so if every client closes the browser while a round expires, reveal waits until a participant returns.
- If a participant disconnects before voting, other players may wait until they return; a host-managed timeout or game recovery flow can be added later.
- Security rules were reviewed against Firebase documentation, but MUST still be validated in the Firebase Emulator Suite and via a live Firebase multi-device test before relying on them.
- Firestore data is currently not automatically deleted; archival/cleanup can be added in a future release.
