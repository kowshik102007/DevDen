import threading

class AppConfig:
    """
    Thread-safe configuration class that holds all virtual mouse settings.
    Allows parameters to be read by the processing thread and modified
    by the GUI thread concurrently.
    """
    def __init__(self):
        self._lock = threading.Lock()

        self._cam_id = 0
        self._frame_width = 640
        self._frame_height = 480
        
        self._active_zone_inset = 100  
        self._smoothing_factor = 7     
        self._click_cooldown = 0.4     
        
        self._pinch_threshold = 30      
        self._click_threshold = 35      
        self._right_click_spread = 60  
        self._scroll_speed = 5          
        
        self._show_overlay = True      
        self._min_detection_confidence = 0.5
        self._min_tracking_confidence = 0.5

    def get(self, name):
        """Thread-safe getter for config parameters."""
        with self._lock:
            private_name = f"_{name}"
            if hasattr(self, private_name):
                return getattr(self, private_name)
            raise AttributeError(f"AppConfig has no setting named '{name}'")

    def set(self, name, value):
        """Thread-safe setter for config parameters."""
        with self._lock:
            private_name = f"_{name}"
            if hasattr(self, private_name):
                setattr(self, private_name, value)
            else:
                raise AttributeError(f"AppConfig has no setting named '{name}'")
