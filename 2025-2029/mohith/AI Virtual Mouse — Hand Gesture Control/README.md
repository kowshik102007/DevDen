#  AI Virtual Mouse: Real-Time Hand Gesture Control

An advanced, high-performance virtual mouse system powered by **Mediapipe Hand Landmarking**, **OpenCV**, and **PyAutoGUI**. This application allows users to control their operating system's cursor and execute actions (clicks, drags, scrolls) entirely through hand gestures captured by a standard webcam. It also features a real-time **Tkinter-based live tuning dashboard** to adjust thresholds, smoothing, and sensitivity parameters on the fly.

---

##  Key Features

*   **Real-Time Tracking & Detection**: Leverages Google MediaPipe's lightweight Machine Learning pipelines to detect and track 21 3D hand landmarks at high frame rates.
*   **Smooth Cursor Navigation**: Employs an Exponential Moving Average (EMA) smoothing algorithm to eliminate hand tremors and mouse jitter.
*   **Intuitive Gesture Mappings**: Complete mouse control including movements, clicks (left and right), drag-and-drop, and scroll gestures.
*   **Live Sensitivity Dashboard**: A Tkinter GUI panel for on-the-fly customization of confidence limits, click thresholds, EMA smoothing factors, and active boundary zones.
*   **Dynamic Active Zone**: Configurable bounding box constraints to map webcam frame areas to the full screen resolution effortlessly.
*   **Emergency Fail-Safe Integration**: Automatically halts mouse control and shuts down safely when the user places the cursor in the screen corners or exits the camera view.
*   **Seamless Setup**: Automatically downloads the necessary MediaPipe landmark weights model file (`hand_landmarker.task`) upon the initial launch.

---

## 📂 Project Architecture

```text
AI-Virtual-Mouse-Hand-Gesture-Control/
│
├── models/
│   └── hand_landmarker.task      # Automatically downloaded ML model weights
│
├── scratch/
│   └── test_mouse.py             # Script to verify PyAutoGUI system permissions & fail-safes
│
├── src/
│   ├── config.py                 # Thread-safe configuration manager for settings
│   ├── gesture_recognizer.py     # Rule-based engine to classify finger configurations
│   ├── gui.py                    # Tkinter control panel for real-time parameter tuning
│   ├── main.py                   # Main processing loop connecting camera, detector, and action flows
│   └── mouse_controller.py       # Wrapper translating gestures to OS-level mouse commands
│
├── README.md                     # Project documentation & guidelines
└── requirements.txt              # Third-party python dependencies
```

---

## 🖐️ Gesture Reference Guide

The application uses rule-based finger state calculations to identify hand positions. Below is the mapping of hand configurations to cursor actions:

| Action / Gesture | Hand Visual State | Technical Criteria (Finger & Distance States) |
| :--- | :--- | :--- |
| **Move Cursor** | ☝️ Index extended | Index is **UP**; Middle, Ring, Pinky are **DOWN** |
| **Left Click** | ✌️ Index + Middle UP (Close) | Index & Middle are **UP**, Ring & Pinky are **DOWN**; distance between Index/Middle tip < `click_threshold` |
| **Right Click** | 🖖 Index + Middle UP (Spread) | Index & Middle are **UP**, Ring & Pinky are **DOWN**; distance between Index/Middle tip ≥ `right_click_spread` |
| **Drag & Drop** | 🤏 Index + Thumb Pinch | Index & Thumb distance < `pinch_threshold`; Middle is **DOWN** |
| **Scroll Mode** | ✋ 4 Fingers extended | Index, Middle, Ring, Pinky are all **UP**; scrolling speed is proportional to vertical index tip movement |
| **Fist (Freeze)**| ✊ Closed Fist | Index, Middle, Ring, Pinky are all **DOWN**; pauses cursor actions & resets history |

---

##  Installation & Setup

Follow these steps to run the application on your local machine:

### 1. Prerequisites
Ensure you have **Python 3.8+** installed on your system. A working webcam is required.

### 2. Clone the Repository
```bash
git clone https://github.com/Mohith1-stack/AI-Virtual-Mouse-Hand-Gesture-Control.git
cd "AI Virtual Mouse — Hand Gesture Control"
```

### 3. Create a Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 🚦 Usage

### Verify Mouse Control Permissions
Before launching the main gesture engine, run the verification script in the `scratch` folder. This tests your OS permissions and verifies PyAutoGUI fail-safes are working:
```bash
python scratch/test_mouse.py
```
*Note: Keep your hands on your physical mouse during this test. The cursor will move in a small square pattern.*

### Run the Virtual Mouse
Start the main application using:
```bash
python src/main.py
```
On first launch, the program will automatically download the ~5.6MB `hand_landmarker.task` file into the `models/` directory.

---

##  Live Sensitivity Tuning

The application launches with a dashboard panel containing live sliders. You can calibrate these to match your camera positioning and room lighting:

*   **Cursor Smoothing Factor (EMA)**: Higher values reduce mouse jitter but introduce small cursor follow delays. (Default: `7.0`)
*   **Active Zone Inset (px)**: Padding around the camera frame. Translating your hand within this smaller inset maps to the edges of your physical monitor. (Default: `100px`)
*   **Min Detection & Tracking Confidence**: Confidence thresholds for MediaPipe to detect your hand and keep tracking it. (Default: `0.5`)
*   **Click Cooldown Duration (sec)**: Prevents accidental rapid-fire double clicks when keeping fingers close together. (Default: `0.4s`)
*   **Drag Pinch / Left Click / Right Click Thresholds (px)**: Fine-tune the distance tolerances (in pixels) for triggering click and pinch-drag actions.

---

##  Important Safety & Failsafe Measures

This application takes system-level control of your mouse input using `PyAutoGUI`. To prevent accidental locked inputs:

1.  **Emergency Corner Escape**: PyAutoGUI has a built-in safety switch. Move your hand/cursor forcibly into any of the **four corners of your screen** to immediately trigger a `FailSafeException` and exit the program.
2.  **Webcam Close**: Press **`q`** while focusing on the camera feed window to release camera locks and shutdown the main worker threads cleanly.
3.  **Active Zone Overlay**: Toggle the **Show Camera HUD Overlay** box in the dashboard to overlay the camera stream. This allows you to verify if your hand is within the tracking boundaries.

---

##  License

This project is open-source and available under the [MIT License](LICENSE). Feel free to modify and adapt it for your own hardware configurations.