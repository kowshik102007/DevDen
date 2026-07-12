# Guardian Path 🛡️

Guardian Path is a professional-grade, safety-first navigation application designed to prioritize user security over just speed. Powered by an intelligent **Night Agent**, the app evaluates real-time hazards and provides optimized routing to keep users safe, especially during late-night travel.

##  About
Guardian Path is more than just a navigation tool; it is a personal safety companion. In a world where standard navigation apps focus solely on the fastest route, Guardian Path introduces a secondary, critical layer: **Environmental Security**. By analyzing known danger zones, crime hotspots, and poorly lit areas, the application ensures that your journey home is as safe as it is efficient.

##  The Idea
The concept for Guardian Path was born from the need for "Protective Navigation." We realized that many people feel unsafe traveling through certain areas at specific times (like walking alone at night). Our idea was to build an autonomous **Agent** that acts as a virtual guardian, scanning the path ahead and making safety-critical decisions—like diverting you away from a dark alleyway or a high-risk neighborhood—even if it means taking a slightly longer road.

##  Key Features

### 1. Intelligent Safety Routing (Night Agent)
- **Safe-First Navigation**: The routing engine doesn't just look for the fastest path; it analyzes the "Danger Score" of every alternative.
- **Automatic Diversion**: If a primary route is flagged as high-risk at night, the Agent automatically diverts the user to a safer, well-lit, or high-traffic alternative.
- **Contextual Messages**: Dynamic status updates from the Agent (e.g., *"Night Agent: Primary route is safe and fast"*).

### 2. High-Fidelity Navigation UI
- **Top Instruction Bar**: Real-time guidance with next-turn instructions.
- **Right Sidebar Controls**: Quick access to Compass, Search, Volume, and Hazard reporting.
- **Bottom Stats Panel**: Professional layout showing ETA, Distance, and estimated Arrival Time.
- **Speedometer Overlay**: Real-time speed tracking in km/h.

### 3. Hazard Detection & Visualization
- **Risk Circling**: High-risk and medium-risk areas are highlighted with red and orange pulses on the map.
- **Emergency Alert System**: Immediate visual and audio warnings if a user accidentally enters a known danger zone, with one-touch "I am Safe" or "Call Police" buttons.

### 4. Interactive City Intelligence
- **Smart Search**: Search for any city or address globally.
- **Knowledge Cards**: Integrated Wikipedia API to fetch historical and demographic info about your destination.
- **Multi-Mode ETA**: Comparative arrival times for Driving, Cycling, and Walking.

### 5. Advanced Map Controls
- **Map Layers**: Seamlessly toggle between **Normal**, **Satellite**, and **Terrain** views.
- **3D Buildings**: Enhanced spatial awareness with 3D structural rendering.

## 📂 Project Structure
The project follows a modular Android architecture for scalability and performance:

```text
GuardianPath/
├── app/
│   ├── src/main/java/com/example/guardianpath/
│   │   ├── MapActivity.kt      # Main UI controller & Map interaction
│   │   ├── RouteManager.kt     # OSRM Routing & Agent Decision Logic
│   │   └── SafetyEngine.kt     # Danger Zone Database & Risk Calculation
│   ├── src/main/res/
│   │   ├── layout/             # XML UI Layouts (Professional Dashboard)
│   │   └── drawable/           # Custom Safety Icons & UI Assets
│   └── AndroidManifest.xml     # Permissions & API Key Config
├── build.gradle                # Dependency Management
└── README.md                   # Project Documentation
```

##  Technical Stack
- **Language**: Kotlin (Android)
- **Maps SDK**: Google Maps Platform
- **Routing Engine**: OSRM (Open Source Routing Machine)
- **Location Services**: Google FusedLocationProviderClient
- **Networking**: OkHttp3
- **UI Components**: Google Material Design 3

##  Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/GuardianPath.git
   ```
2. **Add API Keys**:
   - Open `AndroidManifest.xml`.
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API Key.
3. **Build & Run**:
   - Open the project in **Android Studio**.
   - Sync Gradle and run on a physical device or emulator.

## 🛡️ Safety Disclaimer
Guardian Path is an intelligence-gathering and routing tool. Always remain aware of your surroundings. While the Agent uses historical and real-time data to suggest safer paths, it is not a substitute for personal judgment and local law enforcement.

---
*Built with care by the Guardian Path Team.*
