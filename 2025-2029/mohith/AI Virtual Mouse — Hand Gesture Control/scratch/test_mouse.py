import time
import pyautogui

def test_pyautogui_control():
    print("--- PyAutoGUI Permissions and Safety Verification ---")
    
    w, h = pyautogui.size()
    print(f"[INFO] Screen Resolution detected: {w}x{h}")
    
    print("[INFO] PyAutoGUI FAILSAFE is set to:", pyautogui.FAILSAFE)
    print("[INFO] Starting mouse test in 3 seconds. Keep hand on physical mouse!")
    print("[INFO] Pro-tip: Move your mouse pointer to the TOP-LEFT corner of the screen to abort if anything goes wrong.")
    time.sleep(3.0)

    try:

        start_x, start_y = w // 2, h // 2
        print(f"[ACTION] Moving cursor to screen center: {start_x}, {start_y}")
        pyautogui.moveTo(start_x, start_y, duration=0.5)

        square_offsets = [
            (100, 0),    
            (100, 100),  
            (0, 100),   
            (0, 0)      
        ]

        for idx, (ox, oy) in enumerate(square_offsets):
            target_x = start_x + ox
            target_y = start_y + oy
            print(f"[ACTION] Step {idx+1}: Moving to {target_x}, {target_y}")
            pyautogui.moveTo(target_x, target_y, duration=0.4)

        print("[SUCCESS] PyAutoGUI successfully controlled the cursor in a square pattern!")

    except pyautogui.FailSafeException:
        print("[ABORT] Fail-safe triggered successfully by moving mouse to a corner!")
    except Exception as e:
        print(f"[ERROR] PyAutoGUI test failed: {e}")

if __name__ == "__main__":
    test_pyautogui_control()
