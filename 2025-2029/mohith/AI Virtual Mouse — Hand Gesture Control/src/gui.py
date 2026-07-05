import tkinter as tk
from tkinter import ttk
import queue

class VirtualMouseGUI:
    def __init__(self, config, on_close_callback=None):
        self.config = config
        self.on_close_callback = on_close_callback

        self.update_queue = queue.Queue()

        self.root = tk.Tk()
        self.root.title("AI Gesture Mouse Control Panel")
        self.root.geometry("450x760")
        self.root.resizable(False, False)

        self.bg_color = "#1e1e2e"        
        self.card_color = "#252538"     
        self.text_color = "#cdd6f4"       
        self.text_dim_color = "#a6adc8"   
        self.accent_color = "#89b4fa"      
        self.accent_green = "#a6e3a1"     
        self.accent_red = "#f38ba8"      

        self.root.configure(bg=self.bg_color)

        self.gesture_var = tk.StringVar(value="Initializing...")
        self.action_var = tk.StringVar(value="None")
        self.fps_var = tk.StringVar(value="0.0 FPS")
        self.overlay_var = tk.BooleanVar(value=self.config.get("show_overlay"))

        self._build_ui()

        self.root.after(100, self._process_queue)
    
        self.root.protocol("WM_DELETE_WINDOW", self.close)

    def _build_ui(self):
 
        title_label = tk.Label(
            self.root, 
            text="AI GESTURE VIRTUAL MOUSE", 
            font=("Helvetica", 16, "bold"), 
            bg=self.bg_color, 
            fg=self.accent_color
        )
        title_label.pack(pady=15)

        status_frame = tk.LabelFrame(
            self.root, 
            text=" System Status ", 
            font=("Helvetica", 10, "bold"), 
            bg=self.card_color, 
            fg=self.accent_color,
            bd=1,
            relief="solid",
            padx=15,
            pady=10
        )
        status_frame.pack(fill="x", padx=20, pady=5)

        fps_label = tk.Label(status_frame, textvariable=self.fps_var, font=("Helvetica", 10, "bold"), bg=self.card_color, fg=self.accent_green)
        fps_label.grid(row=0, column=0, sticky="w", pady=2)
        
        overlay_cb = tk.Checkbutton(
            status_frame, 
            text="Show Camera HUD Overlay", 
            variable=self.overlay_var, 
            command=self._on_overlay_toggle,
            bg=self.card_color, 
            fg=self.text_color,
            activebackground=self.card_color,
            activeforeground=self.accent_color,
            selectcolor=self.bg_color,
            font=("Helvetica", 9)
        )
        overlay_cb.grid(row=0, column=1, sticky="e", padx=20)

        tk.Label(status_frame, text="Detected Gesture:", font=("Helvetica", 10), bg=self.card_color, fg=self.text_dim_color).grid(row=1, column=0, sticky="w", pady=4)
        gesture_lbl = tk.Label(status_frame, textvariable=self.gesture_var, font=("Helvetica", 11, "bold"), bg=self.card_color, fg=self.text_color)
        gesture_lbl.grid(row=1, column=1, sticky="w", pady=4)

        tk.Label(status_frame, text="Active Action:", font=("Helvetica", 10), bg=self.card_color, fg=self.text_dim_color).grid(row=2, column=0, sticky="w", pady=4)
        action_lbl = tk.Label(status_frame, textvariable=self.action_var, font=("Helvetica", 11, "bold"), bg=self.card_color, fg=self.accent_color)
        action_lbl.grid(row=2, column=1, sticky="w", pady=4)

        settings_frame = tk.LabelFrame(
            self.root, 
            text=" Live Sensitivity Tuning ", 
            font=("Helvetica", 10, "bold"), 
            bg=self.card_color, 
            fg=self.accent_color,
            bd=1,
            relief="solid",
            padx=15,
            pady=10
        )
        settings_frame.pack(fill="both", expand=True, padx=20, pady=5)

        sliders_def = [
            ("smoothing_factor", "Cursor Smoothing Factor (EMA)", 1.0, 20.0, 1.0),
            ("active_zone_inset", "Active Zone Inset (px)", 0.0, 200.0, 5.0),
            ("min_detection_confidence", "Min Detection Confidence Threshold", 0.1, 0.9, 0.05),
            ("min_tracking_confidence", "Min Tracking Confidence Threshold", 0.1, 0.9, 0.05),
            ("click_cooldown", "Click Cooldown Duration (sec)", 0.1, 1.5, 0.05),
            ("pinch_threshold", "Drag Pinch Distance Threshold (px)", 10.0, 80.0, 1.0),
            ("click_threshold", "Left Click Close Distance Threshold (px)", 15.0, 80.0, 1.0),
            ("right_click_spread", "Right Click Spread Threshold (px)", 40.0, 120.0, 1.0),
            ("scroll_speed", "Scroll Speed Factor", 1.0, 15.0, 1.0)
        ]

        self.sliders = {}
        for idx, (key, label_text, min_v, max_v, res) in enumerate(sliders_def):
            lbl = tk.Label(settings_frame, text=label_text, font=("Helvetica", 9), bg=self.card_color, fg=self.text_dim_color)
            lbl.pack(anchor="w", pady=(3, 0))

            val = self.config.get(key)
            scale = tk.Scale(
                settings_frame, 
                from_=min_v, 
                to=max_v, 
                resolution=res, 
                orient="horizontal",
                bg=self.card_color,
                fg=self.accent_color,
                troughcolor=self.bg_color,
                activebackground=self.accent_color,
                highlightthickness=0,
                bd=0,
                font=("Helvetica", 8),
                command=lambda val, k=key: self._on_slider_change(k, val)
            )
            scale.set(val)
            scale.pack(fill="x", pady=(0, 3))
            self.sliders[key] = scale

        warn_lbl = tk.Label(
            self.root, 
            text="⚠️ EMERGENCY FAIL-SAFE: Move hand away or force cursor to screen corner to halt PyAutoGUI control.",
            font=("Helvetica", 8, "italic"),
            bg=self.bg_color,
            fg=self.accent_red,
            wraplength=400,
            justify="center"
        )
        warn_lbl.pack(pady=5)

        reset_btn = tk.Button(
            self.root,
            text="Reset Defaults",
            command=self._reset_defaults,
            bg=self.bg_color,
            fg=self.text_color,
            activebackground=self.card_color,
            activeforeground=self.accent_color,
            bd=1,
            relief="solid",
            padx=10,
            pady=5,
            font=("Helvetica", 9, "bold")
        )
        reset_btn.pack(side="left", padx=30, pady=5)

        exit_btn = tk.Button(
            self.root,
            text="Exit Application",
            command=self.close,
            bg=self.accent_red,
            fg=self.bg_color,
            activebackground=self.bg_color,
            activeforeground=self.accent_red,
            bd=0,
            padx=15,
            pady=5,
            font=("Helvetica", 9, "bold")
        )
        exit_btn.pack(side="right", padx=30, pady=5)

    def _on_slider_change(self, key, value):
        """Callback fired on slider movement."""
        self.config.set(key, float(value))

    def _on_overlay_toggle(self):
        """Callback fired on overlay checkbox toggle."""
        self.config.set("show_overlay", self.overlay_var.get())

    def _reset_defaults(self):
        """Reset values back to AppConfig defaults."""
        defaults = {
            "smoothing_factor": 7.0,
            "active_zone_inset": 100.0,
            "min_detection_confidence": 0.5,
            "min_tracking_confidence": 0.5,
            "click_cooldown": 0.4,
            "pinch_threshold": 30.0,
            "click_threshold": 35.0,
            "right_click_spread": 60.0,
            "scroll_speed": 5.0
        }
        for key, val in defaults.items():
            self.config.set(key, val)
            if key in self.sliders:
                self.sliders[key].set(val)

    def update_status(self, gesture, action, fps):
        """Thread-safe status publisher."""
        self.update_queue.put({"gesture": gesture, "action": action, "fps": fps})

    def _process_queue(self):
        """Pulls items from the queue and updates Tkinter variables."""
        try:
            while True:
                data = self.update_queue.get_nowait()
                if "gesture" in data:
                    self.gesture_var.set(data["gesture"])
                if "action" in data:
                    self.action_var.set(data["action"])
                if "fps" in data:
                    self.fps_var.set(f"{data['fps']:.1f} FPS")
        except queue.Empty:
            pass
        self.root.after(50, self._process_queue)

    def close(self):
        """Clean close of Tkinter UI."""
        if self.on_close_callback:
            self.on_close_callback()
        self.root.quit()
        self.root.destroy()

    def start(self):
        """Blocking call to start Tkinter event loop."""
        self.root.mainloop()
