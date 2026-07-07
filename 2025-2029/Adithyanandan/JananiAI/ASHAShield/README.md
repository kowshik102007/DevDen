# 🛡 ASHA Shield — React Native Frontend

**AI-Powered Maternal & Neonatal Risk Flagging for ASHA Workers**

---

## 📁 Project Structure

```
ASHAShield/
├── App.js                          ← Root component + DB init splash
├── index.js                        ← Android entry point
├── app.json                        ← App name config
├── package.json                    ← All dependencies
├── babel.config.js                 ← Transpiler config
└── src/
    ├── navigation/
    │   └── AppNavigator.js         ← Tab + Stack navigation wiring
    ├── screens/
    │   ├── DashboardScreen.js      ← Home: stats, alerts, quick actions
    │   ├── PatientListScreen.js    ← All patients with search + risk badge
    │   ├── PatientRegistrationScreen.js  ← New patient form
    │   ├── VisitLoggingScreen.js   ← Vitals entry + risk computation
    │   ├── RiskCardScreen.js       ← Colour card + Hindi TTS + emergency dial
    │   ├── TrendGraphScreen.js     ← BP / Hb line charts across visits
    │   └── SupervisorScreen.js     ← Stats + WiFi sync to backend
    ├── db/
    │   └── database.js             ← SQLite schema + all CRUD helpers
    ├── ml/
    │   └── riskModel.js            ← XGBoost-equivalent rule engine + SHAP reasons
    └── utils/
        ├── theme.js                ← Colours, fonts, spacing
        ├── tts.js                  ← Hindi text-to-speech wrapper
        └── api.js                  ← FastAPI backend sync helpers
```

---

## 🧑‍💻 How to Run on Arch Linux (KDE Plasma)

Follow every step in order. This is written for a first-time React Native developer.

---

### STEP 1 — Install Java (JDK 17)

React Native's Android toolchain requires JDK 17.

```bash
sudo pacman -S jdk17-openjdk
```

Set it as the active Java version:

```bash
sudo archlinux-java set java-17-openjdk
java -version   # should print: openjdk 17...
```

---

### STEP 2 — Install Android Studio

Android Studio gives you the Android SDK, emulator, and build tools.

```bash
# Install from AUR using yay (install yay first if you don't have it)
sudo pacman -S --needed base-devel git
git clone https://aur.archlinux.org/yay.git
cd yay && makepkg -si
cd ..

# Now install Android Studio
yay -S android-studio
```

**Or** download the .tar.gz from https://developer.android.com/studio, extract it,
and run `studio.sh` from the `bin/` folder.

---

### STEP 3 — Set up Android SDK via Android Studio

1. Open Android Studio
2. Go to **More Actions → SDK Manager**
3. Under **SDK Platforms**, check **Android 13 (API 33)** or newer
4. Under **SDK Tools**, check:
   - Android SDK Build-Tools 34
   - Android Emulator
   - Android SDK Platform-Tools
5. Click **Apply** and let it download

---

### STEP 4 — Set Environment Variables

Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
```

Then reload your shell:

```bash
source ~/.bashrc   # or source ~/.zshrc
```

Verify:

```bash
adb --version   # should print Android Debug Bridge version ...
```

---

### STEP 5 — Install Node.js and npm

```bash
sudo pacman -S nodejs npm
node --version   # should be v18+ 
npm --version
```

---

### STEP 6 — Install React Native CLI globally

```bash
npm install -g react-native
```

---

### STEP 7 — Create the Android project scaffold

React Native CLI generates the native Android and iOS project files.
Run this ONCE in the parent folder (one level up from this README):

```bash
cd ~   # or wherever you want the project
npx react-native@0.73 init ASHAShield --version 0.73.6
```

This creates a full `ASHAShield/` folder with Android project files.

**Then REPLACE** the generated JS files with the ones from this codebase:
```bash
# Copy the src/ folder, App.js, index.js, app.json into the generated project
cp -r /path/to/downloaded/src   ASHAShield/src
cp /path/to/downloaded/App.js   ASHAShield/App.js
cp /path/to/downloaded/index.js ASHAShield/index.js
```

---

### STEP 8 — Install npm dependencies

```bash
cd ASHAShield
npm install
```

This downloads all the packages listed in package.json into `node_modules/`.

---

### STEP 9 — Android permissions for SQLite & TTS & Phone

Open `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

---

### STEP 10 — Link native modules

Some packages need their native Android code linked:

```bash
# react-native-vector-icons: copy fonts
npx react-native-asset

# react-native-sqlite-storage: add to android/app/build.gradle
# Open android/app/build.gradle and add to dependencies{}:
#   implementation project(':react-native-sqlite-storage')
# Open android/settings.gradle and add:
#   include ':react-native-sqlite-storage'
#   project(':react-native-sqlite-storage').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-sqlite-storage/src/android')
```

For React Native 0.73+, most packages auto-link. If you hit a build error, google
"[package name] react native autolinking android" for that specific package.

---

### STEP 11 — Start an Android Emulator

In Android Studio:

1. Go to **Device Manager** (right side panel)
2. Click **Create Device**
3. Choose **Pixel 6** → Next
4. Download **Android 13 (API 33)** system image → Next → Finish
5. Click the **▶ Play** button to start the emulator

Wait until the Android home screen is visible.

---

### STEP 12 — Start Metro bundler (in Terminal 1)

```bash
cd ASHAShield
npx react-native start
```

Metro is the JavaScript bundler — keep this terminal running throughout development.

---

### STEP 13 — Build and run the app (in Terminal 2)

```bash
cd ASHAShield
npx react-native run-android
```

This compiles the Android app, installs it on the emulator, and launches it.
First build takes 3–5 minutes. Subsequent builds are much faster.

You should see the ASHA Shield splash screen on the emulator! 🎉

---

### STEP 14 — Run on a real Android phone (optional but recommended for demo)

1. On your phone: Settings → Developer Options → enable **USB Debugging**
2. Connect phone via USB
3. Run `adb devices` — your phone should appear
4. Then `npx react-native run-android` — it will install on your real phone

---

## 🔄 Development Workflow

After any code change:

- **JS changes**: Metro auto-reloads. Press `R` in the Metro terminal or shake the phone.
- **Native changes** (AndroidManifest, build.gradle): re-run `npx react-native run-android`

---

## 🐛 Common Issues on Arch Linux

| Error | Fix |
|-------|-----|
| `SDK location not found` | Make sure ANDROID_HOME is set and sourced |
| `Could not install Gradle distribution` | Check internet, or `cd android && ./gradlew build` to see full error |
| `error: package android.support.* not found` | Add `android.useAndroidX=true` to `android/gradle.properties` |
| Metro port already in use | `npx react-native start --port 8082` |
| `adb: not found` | `sudo pacman -S android-tools` |
| `JAVA_HOME is not set` | Export JAVA_HOME as shown in Step 4 |

---

## 📱 App Screens Walkthrough

| Screen | How to reach |
|--------|--------------|
| Dashboard | Opens on launch — shows stats + high-risk alerts |
| Patient List | Bottom tab "Patients" |
| Register Patient | FAB (+) on Patient List, or Quick Action on Dashboard |
| Log Visit | Tap any patient row |
| Risk Card | After saving a visit, or tap shield icon on patient row |
| Trend Graph | Tap "Trend" button on Risk Card |
| Supervisor | Bottom tab "Supervisor" |

---

## 🤝 Connecting to the Backend

Your teammate's FastAPI backend runs on `http://localhost:8000`.
In the emulator, `localhost` of your dev machine is `10.0.2.2`.

The `src/utils/api.js` file already uses `http://10.0.2.2:8000`.

When your teammate starts the FastAPI server:
```bash
uvicorn main:app --reload
```

The Supervisor screen's "Sync Now" button will push unsynced visits to it.

---

*ASHA Shield · Prevention over reaction. Intelligence at the last mile.*
