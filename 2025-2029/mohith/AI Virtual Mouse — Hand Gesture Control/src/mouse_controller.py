import time
# pyrefly: ignore [missing-import]
import numpy as np
import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.0

class MouseController:
    def __init__(self, config):
        self.config = config
        self.screen_w, self.screen_h = pyautogui.size()
        
        # Smoothening states
        self.prev_x = None
        self.prev_y = None
        
        # Action states
        self.last_click_time = 0.0
        self.is_dragging = False
        
        # Scrolling states
        self.prev_scroll_y = None

    def reset_history(self):
        """Reset the smoothing history when hand tracking is lost."""
        self.prev_x = None
        self.prev_y = None
        self.prev_scroll_y = None
        
        # Safe release of drag
        if self.is_dragging:
            try:
                pyautogui.mouseUp()
            except pyautogui.FailSafeException:
                pass
            self.is_dragging = False

    def map_coordinates(self, pixel_x, pixel_y, frame_w, frame_h):
        """
        Map camera pixel coordinates (from active zone) to screen coordinates.
        Uses np.interp and clips boundaries to avoid cursor sticking.
        """
        inset = self.config.get("active_zone_inset")
        
        # Boundaries of the active zone
        x_min, x_max = inset, frame_w - inset
        y_min, y_max = inset, frame_h - inset
        
        # Map values using interpolation
        screen_x = np.interp(pixel_x, [x_min, x_max], [0, self.screen_w])
        screen_y = np.interp(pixel_y, [y_min, y_max], [0, self.screen_h])
        
        # Clip to ensure cursor stays inside the screen boundaries
        screen_x = np.clip(screen_x, 0, self.screen_w - 1)
        screen_y = np.clip(screen_y, 0, self.screen_h - 1)
        
        return screen_x, screen_y

    def smooth_coordinates(self, target_x, target_y):
        """Apply exponential moving average smoothing."""
        smoothing = self.config.get("smoothing_factor")
        # Ensure smoothing factor is at least 1 to avoid division by zero or negative
        smoothing = max(1.0, float(smoothing))
        
        if self.prev_x is None or self.prev_y is None:
            self.prev_x = target_x
            self.prev_y = target_y
            return target_x, target_y
            
        curr_x = self.prev_x + (target_x - self.prev_x) / smoothing
        curr_y = self.prev_y + (target_y - self.prev_y) / smoothing
        
        self.prev_x = curr_x
        self.prev_y = curr_y
        
        return curr_x, curr_y

    def perform_action(self, gesture, coords, frame_w, frame_h):
        """
        Execute mouse action based on classified gesture.
        Returns: Dict containing action status/info.
        """
        status = {"action": "None", "coords": (0, 0)}
        
        try:

            if gesture in ["Fist (Freeze)", "No Hand", "Unknown"]:
                self.reset_history()
                return {"action": gesture, "coords": None}

            if gesture != "Drag" and self.is_dragging:
                pyautogui.mouseUp()
                self.is_dragging = False
                status["action"] = "Release Drag"

            if coords is None:
                return status

            target_x, target_y = self.map_coordinates(coords[0], coords[1], frame_w, frame_h)
            smooth_x, smooth_y = self.smooth_coordinates(target_x, target_y)
            status["coords"] = (int(smooth_x), int(smooth_y))

            current_time = time.time()
            cooldown = self.config.get("click_cooldown")

            if gesture == "Move Cursor":
                pyautogui.moveTo(smooth_x, smooth_y)
                status["action"] = "Move"

            elif gesture == "Left Click":
                pyautogui.moveTo(smooth_x, smooth_y)
                if current_time - self.last_click_time > cooldown:
                    pyautogui.click()
                    self.last_click_time = current_time
                    status["action"] = "Left Click"
                else:
                    status["action"] = "Left Click (Cooldown)"

            elif gesture == "Right Click":
                pyautogui.moveTo(smooth_x, smooth_y)
                if current_time - self.last_click_time > cooldown:
                    pyautogui.rightClick()
                    self.last_click_time = current_time
                    status["action"] = "Right Click"
                else:
                    status["action"] = "Right Click (Cooldown)"

            elif gesture == "Drag":
                pyautogui.moveTo(smooth_x, smooth_y)
                if not self.is_dragging:
                    pyautogui.mouseDown()
                    self.is_dragging = True
                    status["action"] = "Start Drag"
                else:
                    status["action"] = "Drag"

            elif gesture == "Scroll":
                current_y = coords[1]
                if self.prev_scroll_y is not None:

                    delta_y = current_y - self.prev_scroll_y
                    scroll_speed = self.config.get("scroll_speed")
                    
                    scroll_amount = -int(delta_y * scroll_speed)
                    
                    if abs(scroll_amount) >= 1:
                        pyautogui.scroll(scroll_amount)
                        status["action"] = f"Scroll {'Up' if scroll_amount > 0 else 'Down'} ({scroll_amount})"
                else:
                    status["action"] = "Scroll Idle"
                    
                self.prev_scroll_y = current_y

            if gesture != "Scroll":
                self.prev_scroll_y = None

        except pyautogui.FailSafeException:

            raise
            
        return status
