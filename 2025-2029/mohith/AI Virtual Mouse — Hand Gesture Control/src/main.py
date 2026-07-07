import os
import sys
import time
import threading
import urllib.request
import cv2
import mediapipe as mp
import pyautogui

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.config import AppConfig
from src.gesture_recognizer import get_pixel_coords, classify_gesture
from src.mouse_controller import MouseController
from src.gui import VirtualMouseGUI

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (5, 6), (6, 7), (7, 8),
    (9, 10), (10, 11), (11, 12),
    (13, 14), (14, 15), (15, 16),
    (17, 18), (18, 19), (19, 20),
    (0, 5), (5, 9), (9, 13), (13, 17), (0, 17)
]

def download_model_if_missing():
    """Download the hand landmark model file if it is not present in local workspace."""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    model_dir = os.path.join(project_root, "models")
    model_path = os.path.join(model_dir, "hand_landmarker.task")
    if not os.path.exists(model_path):
        os.makedirs(model_dir, exist_ok=True)
        url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        print(f"[INFO] Downloading MediaPipe hand landmarker model from {url}...")
        try:

            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req) as response, open(model_path, 'wb') as out_file:
                out_file.write(response.read())
            print("[INFO] Model downloaded successfully!")
        except Exception as e:
            print(f"[ERROR] Failed to download model: {e}")
            print("[HELP] Please manually download the model file from:")
            print(url)
            print(f"and place it in the local folder: {os.path.abspath(model_dir)}")
            raise e
    return model_path

def draw_hand_landmarks(frame, points):
    """Draw hand connection lines and nodes with high-end pastel styling."""

    for start_idx, end_idx in HAND_CONNECTIONS:
        if start_idx < len(points) and end_idx < len(points):
            p1 = points[start_idx]
            p2 = points[end_idx]
            cv2.line(frame, p1, p2, (180, 190, 214), 2) 

    for idx, p in enumerate(points):
        if idx in [4, 8, 12, 16, 20]:

            cv2.circle(frame, p, 6, (250, 180, 137), -1) 
        else:

            cv2.circle(frame, p, 4, (166, 227, 161), -1)  

class VirtualMouseApp:
    def __init__(self):

        self.config = AppConfig()
        self.mouse_controller = MouseController(self.config)

        self.running_event = threading.Event()
        self.running_event.set()
        
        self.gui = VirtualMouseGUI(self.config, on_close_callback=self.stop)

        self.capture_thread = threading.Thread(target=self._run_webcam_loop, daemon=True)

    def start(self):
        print("[INFO] Starting webcam worker thread...")
        self.capture_thread.start()
        print("[INFO] Launching live tuning GUI panel...")
        self.gui.start()

    def stop(self):
        print("[INFO] Shutdown signal received. Stopping worker thread...")
        self.running_event.clear()
        if self.capture_thread.is_alive():
            self.capture_thread.join(timeout=2.0)
        cv2.destroyAllWindows()
        print("[INFO] Application closed successfully.")

    def _run_webcam_loop(self):

        try:
            downloaded_path = download_model_if_missing()
            
            import tempfile
            import shutil
            temp_dir = tempfile.gettempdir()
            safe_model_path = os.path.join(temp_dir, "hand_landmarker.task")
            
            if not os.path.exists(safe_model_path) or os.path.getsize(safe_model_path) != os.path.getsize(downloaded_path):
                print(f"[INFO] Copying model to safe ASCII path: {safe_model_path}")
                shutil.copy2(downloaded_path, safe_model_path)
                
            model_path = safe_model_path
        except Exception as e:
            print(f"[ERROR] Failed to set up model file: {e}")
            self.running_event.clear()
            self.gui.update_status("Model Error", "Setup Fail", 0.0)
            return

        cam_id = int(self.config.get("cam_id"))
        cap = cv2.VideoCapture(cam_id)
        if not cap.isOpened():
            print(f"[ERROR] Could not open webcam with index {cam_id}.")
            self.running_event.clear()
            self.gui.update_status("Cam Error", "Stop", 0.0)
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.get("frame_width"))
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.get("frame_height"))

        base_options = mp.tasks.BaseOptions(model_asset_path=model_path)
        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=self.config.get("min_detection_confidence"),
            min_hand_presence_confidence=self.config.get("min_tracking_confidence"),
            min_tracking_confidence=self.config.get("min_tracking_confidence")
        )
        detector = mp.tasks.vision.HandLandmarker.create_from_options(options)
        
        last_det_confidence = self.config.get("min_detection_confidence")
        last_track_confidence = self.config.get("min_tracking_confidence")
        
        prev_time = time.time()
        window_name = "AI Virtual Mouse Camera Feed"
        window_opened = False

        while self.running_event.is_set():

            curr_det_confidence = self.config.get("min_detection_confidence")
            curr_track_confidence = self.config.get("min_tracking_confidence")
            
            if abs(curr_det_confidence - last_det_confidence) > 0.01 or abs(curr_track_confidence - last_track_confidence) > 0.01:
                print(f"[INFO] Re-configuring HandLandmarker: Det={curr_det_confidence:.2f}, Track={curr_track_confidence:.2f}")
                last_det_confidence = curr_det_confidence
                last_track_confidence = curr_track_confidence

                options = mp.tasks.vision.HandLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_hands=1,
                    min_hand_detection_confidence=curr_det_confidence,
                    min_hand_presence_confidence=curr_track_confidence,
                    min_tracking_confidence=curr_track_confidence
                )
                detector = mp.tasks.vision.HandLandmarker.create_from_options(options)

            ret, frame = cap.read()
            if not ret:
                time.sleep(0.01)
                continue

            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            results = detector.detect(mp_image)

            show_overlay = self.config.get("show_overlay")
            inset = int(self.config.get("active_zone_inset"))

            if show_overlay:
                cv2.rectangle(frame, (inset, inset), (w - inset, h - inset), (166, 227, 161), 2)
                cv2.putText(
                    frame, "ACTIVE ZONE", (inset + 10, inset + 25), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (166, 227, 161), 1
                )

            gesture = "No Hand"
            action = "None"
            coords = None

            if results.hand_landmarks:
                for hand_landmarks in results.hand_landmarks:
                    points = get_pixel_coords(hand_landmarks, w, h)

                    if show_overlay:
                        draw_hand_landmarks(frame, points)
                    
                    gesture, coords = classify_gesture(points, self.config)

                    try:
                        status = self.mouse_controller.perform_action(gesture, coords, w, h)
                        action = status.get("action", "None")

                        if coords and show_overlay:
                            cv2.circle(frame, coords, 8, (137, 180, 250), -1)  # Soft Blue dot
                    except pyautogui.FailSafeException:
                        print("[WARNING] PyAutoGUI Fail-Safe Triggered! Stopping Virtual Mouse.")
                        self.running_event.clear()
                        self.gui.root.after(0, self.gui.close)
                        break
            else:
                self.mouse_controller.reset_history()
                self.mouse_controller.perform_action("No Hand", None, w, h)

            curr_time = time.time()
            fps = 1.0 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0.0
            prev_time = curr_time

            self.gui.update_status(gesture, action, fps)

            if show_overlay:
                cv2.putText(frame, f"Gesture: {gesture}", (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (205, 214, 244), 2)
                cv2.putText(frame, f"Action: {action}", (15, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (137, 180, 250), 2)
                cv2.imshow(window_name, frame)
                window_opened = True

                if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1:
                    self.config.set("show_overlay", False)
            else:
                if window_opened:
                    try:
                        cv2.destroyWindow(window_name)
                    except cv2.error:
                        pass
                    window_opened = False

            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.running_event.clear()
                self.gui.root.after(0, self.gui.close)
                break

        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    app = VirtualMouseApp()
    app.start()
