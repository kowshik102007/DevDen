# Requirements Document

## Introduction

TriageAI is an AI-powered end-to-end emergency response platform designed for India's mass casualty and critical emergency scenarios. The platform demonstrates a complete emergency response workflow: Field Triage → Smart Dispatch → Hospital Pre-Arrival Alerts → Command Dashboard. It is built as a responsive web application targeting paramedics in the field and emergency coordinators at command centers, using Google Gemini AI for multimodal triage assessment and Google Maps for routing and ETA calculations. The platform uses realistic mock data for the Kochi/Kerala region and is optimized for hackathon demonstration.

## Glossary

- **TriageAI**: The emergency response web application described in this document
- **Field_Triage_Interface**: The module where paramedics input patient data and receive AI-generated triage assessments
- **Triage_Engine**: The AI component powered by Google Gemini API (gemini-2.0-flash) that analyzes patient data and assigns severity levels
- **Severity_Level**: One of four triage categories — RED (Immediate), YELLOW (Urgent), GREEN (Delayed), BLACK (Expectant/Deceased)
- **Dispatch_Module**: The module that recommends hospitals and simulates ambulance dispatch
- **Pre_Arrival_Alert**: A structured notification sent to a receiving hospital containing patient summary and AI assessment
- **Command_Dashboard**: The real-time overview interface for emergency coordinators showing all active incidents, resources, and dispatches
- **ABDM**: Ayushman Bharat Digital Mission — India's national digital health infrastructure
- **START_Triage**: Simple Triage and Rapid Treatment — the standard field triage protocol used as the basis for AI assessment
- **ETA**: Estimated Time of Arrival
- **ICU**: Intensive Care Unit
- **OT**: Operation Theatre
- **108/112**: India's national emergency ambulance and police helpline numbers
- **Confidence_Score**: A percentage value (0–100%) indicating the Triage_Engine's certainty in its severity assessment
- **Mock_Hospital_Data**: Simulated hospital records for the Kochi/Kerala region used for demonstration purposes
- **Web_Speech_API**: The browser-native API used for voice input capture
- **Incident_Feed**: A real-time list of active emergency events displayed on the Command_Dashboard

---

## Requirements

### Requirement 1: Field Triage — Patient Data Input

**User Story:** As a paramedic at an emergency scene, I want to input patient information via voice, photo, or text, so that I can quickly capture triage data without manual typing under pressure.

#### Acceptance Criteria

1. THE Field_Triage_Interface SHALL provide three input tabs: Voice Input, Photo Upload, and Text Description.
2. WHEN the Voice Input tab is active, THE Field_Triage_Interface SHALL capture audio using the Web_Speech_API and transcribe it into the text description field in real time.
3. IF the browser does not support the Web_Speech_API, THEN THE Field_Triage_Interface SHALL display a message indicating that voice input is unavailable and direct the user to the Text Description tab.
4. WHEN the Photo Upload tab is active, THE Field_Triage_Interface SHALL accept image input from the device camera or local file system.
5. THE Field_Triage_Interface SHALL accept images in JPEG, PNG, and WebP formats up to 10 MB in size.
6. IF an uploaded file exceeds 10 MB or is not a supported image format, THEN THE Field_Triage_Interface SHALL display a descriptive error message and reject the file.
7. THE Field_Triage_Interface SHALL include a patient details form with the following fields: Name (text), Age (numeric, 0–120), Gender (Male/Female/Other), and Location (text).
8. WHEN the patient details form is submitted with any required field empty, THE Field_Triage_Interface SHALL highlight the missing fields and prevent submission.

---

### Requirement 2: AI-Powered Triage Assessment

**User Story:** As a paramedic, I want the system to analyze patient data using AI and assign a triage severity level, so that I can make faster, more consistent triage decisions in mass casualty events.

#### Acceptance Criteria

1. WHEN the "Analyze with Gemini AI" button is activated, THE Triage_Engine SHALL send the patient description, any uploaded image, and patient details to the Google Gemini API (gemini-2.0-flash model).
2. THE Triage_Engine SHALL construct prompts that follow START triage principles and include medically reasonable assessment criteria.
3. WHEN the Gemini API returns a response, THE Triage_Engine SHALL parse and display: Severity_Level (RED, YELLOW, GREEN, or BLACK), Confidence_Score (0–100%), injury analysis summary, recommended immediate actions, and flags for surgery requirement and blood type need.
4. THE Triage_Engine SHALL display the Severity_Level using the corresponding triage color: RED for Immediate, YELLOW for Urgent, GREEN for Delayed, BLACK for Expectant/Deceased.
5. IF the Gemini API call fails or returns an error, THEN THE Triage_Engine SHALL display a descriptive error message and allow the user to retry without losing entered patient data.
6. WHEN a triage assessment is completed, THE Triage_Engine SHALL store the result in application state so it is available to the Dispatch_Module and Pre_Arrival_Alert module.
7. WHILE the Gemini API call is in progress, THE Field_Triage_Interface SHALL display a loading indicator and disable the "Analyze with Gemini AI" button to prevent duplicate submissions.

---

### Requirement 3: Smart Hospital Matching and Ambulance Dispatch

**User Story:** As an emergency coordinator, I want the system to recommend the most suitable hospitals based on patient severity and proximity, so that I can dispatch the ambulance to the best available facility quickly.

#### Acceptance Criteria

1. WHEN a triage assessment is completed, THE Dispatch_Module SHALL display a ranked list of hospital recommendations from the Mock_Hospital_Data for the Kochi/Kerala region.
2. THE Dispatch_Module SHALL rank hospitals using the following criteria in order of priority: specialty match to the assessed injuries, live ICU/OT/bed availability, and distance from the patient's location.
3. THE Dispatch_Module SHALL display the following for each recommended hospital: hospital name, specialty match indicator, available beds, available ICU beds, available OT slots, distance in kilometers, and ETA in minutes using Google Maps Platform routing.
4. THE Mock_Hospital_Data SHALL include 10–15 hospitals in the Kochi/Kerala region with realistic attributes: name, address, coordinates, specialties, total beds, available beds, ICU capacity, available ICU beds, OT count, available OT slots, and contact number.
5. WHEN the "Dispatch to 108/112" action is triggered for a selected hospital, THE Dispatch_Module SHALL simulate dispatch confirmation and display a turn-by-turn navigation summary for the selected route.
6. IF no hospital in the Mock_Hospital_Data has available beds matching the patient's severity, THEN THE Dispatch_Module SHALL display a warning and show the nearest hospitals regardless of availability.
7. WHEN a dispatch is confirmed, THE Dispatch_Module SHALL update the Command_Dashboard's active dispatches list with the patient name, destination hospital, ETA, and Severity_Level.

---

### Requirement 4: Pre-Arrival Hospital Alert

**User Story:** As a paramedic, I want to send a structured pre-arrival alert to the receiving hospital, so that the ER team can prepare the appropriate resources before the patient arrives.

#### Acceptance Criteria

1. WHEN a hospital is selected and a triage assessment exists, THE Field_Triage_Interface SHALL display a "Send Alert to Hospital" button.
2. WHEN the "Send Alert to Hospital" button is activated, THE Field_Triage_Interface SHALL generate and display a Pre_Arrival_Alert containing: patient name, age, gender, Severity_Level, Confidence_Score, injury analysis summary, recommended actions, surgery and blood flags, and the AI assessment timestamp.
3. WHERE a patient photo was uploaded, THE Pre_Arrival_Alert SHALL include a thumbnail of the uploaded photo.
4. THE Pre_Arrival_Alert SHALL be displayed in a modal or dedicated panel styled to reflect the patient's Severity_Level color.
5. WHEN the Pre_Arrival_Alert is displayed, THE Field_Triage_Interface SHALL show a simulated confirmation message indicating the alert was sent to the selected hospital's ER team.

---

### Requirement 5: Real-Time Command Dashboard

**User Story:** As an emergency coordinator, I want a centralized dashboard showing all active incidents, resource status, and dispatches, so that I can manage mass casualty events from a single view.

#### Acceptance Criteria

1. THE Command_Dashboard SHALL display the following overview metric cards: Active Incidents count, Total Triaged count, severity distribution (RED/YELLOW/GREEN/BLACK counts), and resource status for Ambulances, Beds, Surgeons, Blood units, Ventilators, and OT slots.
2. THE Command_Dashboard SHALL display a live Incident_Feed showing recent emergency events with event name, location, severity, and timestamp.
3. THE Incident_Feed SHALL include at least 3 pre-populated sample incidents (e.g., "Metro Line Collapse - Sector 18") to demonstrate the feed during a demo.
4. THE Command_Dashboard SHALL display a hospital map using Google Maps Platform showing hospital locations with capacity indicators color-coded by availability (green = available, yellow = limited, red = full).
5. THE Command_Dashboard SHALL display a Pending Dispatches section and an Active Dispatches section, each listing patient name, destination hospital, Severity_Level, and ETA.
6. WHEN a new triage assessment is completed and a dispatch is confirmed, THE Command_Dashboard SHALL update all relevant metric cards, the Incident_Feed, and the dispatches sections without requiring a full page reload.
7. THE Command_Dashboard SHALL be accessible from a persistent navigation element available on all pages of the application.

---

### Requirement 6: Application Layout and Navigation

**User Story:** As a user (paramedic or coordinator), I want a consistent navigation structure, so that I can move between the triage, dispatch, and dashboard modules without confusion.

#### Acceptance Criteria

1. THE TriageAI SHALL provide a persistent top navigation bar or sidebar containing links to: New Triage (Field_Triage_Interface), Command Dashboard, and an application logo/branding element.
2. THE TriageAI SHALL apply a dark theme across all pages using a dark background color palette.
3. THE TriageAI SHALL apply triage color coding consistently: RED (#EF4444 or equivalent), YELLOW (#EAB308 or equivalent), GREEN (#22C55E or equivalent), BLACK (#1F2937 or equivalent with white text).
4. THE TriageAI SHALL be responsive and render correctly on viewport widths from 375px (mobile) to 1920px (desktop).
5. THE TriageAI SHALL use Tailwind CSS for all styling and Lucide React for all iconography.
6. THE TriageAI SHALL be built with React 19 and Vite 8 and deployable to Vercel without additional server-side configuration.

---

### Requirement 7: Configuration and Environment

**User Story:** As a developer setting up the project, I want clear environment variable management, so that API keys are not hardcoded and the app can be configured for different environments.

#### Acceptance Criteria

1. THE TriageAI SHALL read the Google Gemini API key from an environment variable named `VITE_GEMINI_API_KEY`.
2. THE TriageAI SHALL read the Google Maps API key from an environment variable named `VITE_GOOGLE_MAPS_API_KEY`.
3. IF either required API key environment variable is missing at runtime, THEN THE TriageAI SHALL display a configuration warning in the affected module and degrade gracefully (e.g., show static map placeholder, disable AI analysis button).
4. THE TriageAI SHALL include a `.env.example` file listing all required environment variables with placeholder values and descriptions.
5. THE TriageAI SHALL include a `README.md` with setup instructions covering: prerequisites, environment variable configuration, local development commands, demo flow walkthrough, and Vercel deployment steps.

---

### Requirement 8: State Management

**User Story:** As a developer, I want predictable application state management, so that triage results flow correctly between the triage, dispatch, alert, and dashboard modules.

#### Acceptance Criteria

1. THE TriageAI SHALL manage global application state using either React Context with hooks or Zustand.
2. THE TriageAI SHALL maintain a triage session state containing the current patient details, triage result, selected hospital, and dispatch status.
3. WHEN a new triage session is started, THE TriageAI SHALL reset the triage session state to its initial empty values.
4. THE TriageAI SHALL maintain a persistent incidents list in state that accumulates completed triage sessions for display on the Command_Dashboard.
5. WHEN the application is refreshed, THE TriageAI SHALL initialize the Command_Dashboard with the pre-populated sample incidents and mock resource data.
