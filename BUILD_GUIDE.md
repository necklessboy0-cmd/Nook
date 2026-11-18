# NOOK — how to get the app on your phone

This folder is the complete source code of **NOOK**, a photo and video gallery app built with
Expo / React Native (package id `com.nook.gallery`).

It was **not** built into an installable file here. An Android or iOS app has to be compiled and
signed by a build service, and that build belongs to your own free Expo account.

You need a computer (Windows, macOS or Linux) with **Node.js 20 or newer**
(https://nodejs.org) for the steps below. No Android Studio, no Java, no Mac required.

---

## Part 1 — Try it on your phone in 5 minutes (no build)

1. Install **Expo Go** from the Play Store (Android) or the App Store (iPhone).
2. On your computer, in this folder, run:

   ```bash
   npm install
   npx expo start
   ```

3. A QR code appears in the terminal. Scan it with Expo Go on Android, or with the iPhone
   Camera app. NOOK opens on your phone.

The app asks for photo access the first time — allow it, or the grid stays empty.

> Expo Go is only for trying the app. The installable APK comes from Part 2.

---

## Part 2 — Build the installable APK (free)

1. Create a free account at https://expo.dev/signup.
2. In this folder, run:

   ```bash
   npm install
   npm install -g eas-cli
   eas login
   eas init
   eas build --platform android --profile preview
   ```

   - `eas init` links this project to your account the first time. Answer **Yes**.
   - When it asks to generate a new Android keystore, answer **Yes**. Expo stores that key for
     you, so every later build is signed with the same one and installs as an update over the
     previous version.
   - Choose **Android** if it asks which platform.

3. The build runs in Expo's cloud, not on your computer. Free accounts wait in a low-priority
   queue — at busy times this can take over an hour. You can close the terminal; the build
   continues.
4. When it finishes, the terminal prints a link and a QR code (also on expo.dev under your
   project → **Builds**). Open the link on your Android phone, download the `.apk`, and install
   it. Android will ask you to allow "install unknown apps" for your browser — allow it.

The free plan includes a limited number of builds per month (about 15 Android builds; see
https://expo.dev/pricing).

### If the build fails

Copy the **last 30 lines** of the error from your terminal or the build page on expo.dev and
send them back. Most failures are one of:

- **"eas: command not found"** → the global install did not finish. Run
  `npm install -g eas-cli` again, or `npx eas-cli build --platform android --profile preview`.
- **Not logged in** → run `eas login` first.
- **Node is too old** → run `node --version`. It must print v20 or higher.

---

## Part 3 — iPhone and the app stores (optional)

- **iPhone**: needs an Apple Developer Program membership (99 USD/year). Then:

  ```bash
  eas build --platform ios --profile production
  eas submit --platform ios
  ```

  Install it through TestFlight. Details: https://docs.expo.dev/submit/ios/

- **Google Play**: needs a developer account (one-time 25 USD). Then:

  ```bash
  eas build --platform android --profile production
  eas submit --platform android
  ```

  Details: https://docs.expo.dev/submit/android/

---

## What is in the app

| Tab | What it does |
| --- | --- |
| **Gallery** | Every photo and video on the phone in one flat grid. Newest first. No folders, no filenames. Pinch to change the number of columns. Pull down from the top strip to open the hidden vault. Long-press for batch select (favourite, share, delete, vault). Search by filename, filter photos/videos, sort by newest, oldest or largest. "On this day" memories. |
| **Favourites** | Folders you name yourself. Hearting an item moves it here and removes it from the main grid. Long-press a folder to delete it (the photos stay on the phone). |
| **Compress** | Pick any photos and videos, then set the target size (up to 8192 px, so 8K stays 8K), resize by longest side / width / height / percentage, photo quality and format (JPEG, WebP, PNG), video bitrate, and whether to strip audio. Presses through a queue with progress, then reports before/after size and percentage saved, and saves the results back to your gallery. |
| **Settings** | **Theme** (auto, light, dark), **accent colour** (7 choices), **tile shape** (square, rounded, circle), **grid columns** (2–6), **corner radius**, **text size** (90–125%), compact grid, video length badges, haptic feedback, and a reset button. Storage counts for favourites, vault and trash. |

Also included:

- **Viewer** — full-screen photo, or a video player with native controls and fullscreen.
  Bottom bar: Favourite, Share, Info, Adjust, Vault, Delete.
- **Adjust** — brightness, contrast, saturation, warmth, fade and HDR (all applied live through a
  real colour matrix), six colour schemes, smoothing, and finger drawing. Save as a new copy or
  replace.
- **Hidden vault** — reached by pulling down at the top of the gallery, behind a PIN stored in
  the phone's secure keystore plus fingerprint/face unlock.
- **Trash** — 30-day retention with a countdown per item, restore, and empty (with an option to
  also delete from the phone).
- **On this day** — memories from earlier years, on the same calendar date.

Everything stays on the phone. NOOK has no account, no server and no analytics.

---

## Settings you may want to change

- `app.json` → `name` (the label under the icon), `version`, and the images in `assets/images/`
  (`icon.png` is 1024×1024).
- Once you have installed the app on a phone, **never change** `android.package` or
  `ios.bundleIdentifier` — a new package id is a different app, and the old one stops updating.

---

## What was checked, and what was not

**Checked here:** the TypeScript compiles with no errors, and the JavaScript bundle for Android
compiles (`npx expo export --platform android`). The app config, permissions and native module
versions were validated against Expo SDK 57.

**Not checked:** the app has never been run on a real phone or built into an APK — there is no
phone and no Android toolchain in the environment where this was written. Test the installed app
before sharing it, and report anything that misbehaves together with a screenshot.
