import math

def get_pixel_coords(landmarks, frame_w, frame_h):
    """Convert normalized MediaPipe landmarks to pixel coordinates."""
    return [(int(lm.x * frame_w), int(lm.y * frame_h)) for lm in landmarks]

def landmark_dist(p1, p2):
    """Calculate Euclidean distance between two pixel coordinates."""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

def get_finger_states(points):
    """
    Determine whether each of the 5 fingers is extended (UP).
    points: List of 21 (x, y) pixel coordinates.
    Returns: A list of 5 booleans [Thumb, Index, Middle, Ring, Pinky].
    """
    if len(points) < 21:
        return [False] * 5

    fingers = [False] * 5

    fingers[1] = points[8][1] < points[6][1]

    fingers[2] = points[12][1] < points[10][1]

    fingers[3] = points[16][1] < points[14][1]

    fingers[4] = points[20][1] < points[18][1]

    dist_tip_to_pinky_base = landmark_dist(points[4], points[17])
    dist_joint_to_pinky_base = landmark_dist(points[2], points[17])
    fingers[0] = dist_tip_to_pinky_base > dist_joint_to_pinky_base * 1.1

    return fingers

def classify_gesture(points, config):
    """
    Classify the current hand gesture based on landmark points.
    Returns: (gesture_name, index_tip_coords)
    """
    if len(points) < 21:
        return "No Hand", None

    fingers = get_finger_states(points)
    
    pinch_threshold = config.get("pinch_threshold")
    click_threshold = config.get("click_threshold")
    right_click_spread = config.get("right_click_spread")

    thumb_tip = points[4]
    index_tip = points[8]
    middle_tip = points[12]

    d_thumb_index = landmark_dist(thumb_tip, index_tip)
    d_index_middle = landmark_dist(index_tip, middle_tip)

    if not any(fingers[1:]):
        return "Fist (Freeze)", None

    if all(fingers[1:]):
        return "Scroll", index_tip

    if d_thumb_index < pinch_threshold and not fingers[2]:
        return "Drag", index_tip

    if fingers[1] and fingers[2] and not fingers[3] and not fingers[4]:
        if d_index_middle < click_threshold:
            return "Left Click", index_tip

    if fingers[1] and fingers[2] and not fingers[3] and not fingers[4]:
        if d_index_middle >= right_click_spread:
            return "Right Click", index_tip

    if fingers[1] and not fingers[2] and not fingers[3] and not fingers[4]:
        return "Move Cursor", index_tip

    return "Unknown", None
