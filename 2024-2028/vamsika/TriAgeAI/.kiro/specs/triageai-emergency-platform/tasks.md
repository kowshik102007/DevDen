# Tasks

## Task List

- [-] 1 Project Scaffolding and Configuration
  - [ ] 1.1 Initialize Vite 8 + React 19 project with TypeScript template
  - [~] 1.2 Install and configure Tailwind CSS v3
  - [~] 1.3 Install dependencies: react-router-dom v6, zustand, lucide-react, @googlemaps/js-api-loader, @react-google-maps/api, fast-check (dev)
  - [~] 1.4 Create `.env.example` with `VITE_GEMINI_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` placeholder values and descriptions
  - [~] 1.5 Create `vercel.json` with SPA rewrite rule (`"source": "/(.*)"` → `"destination": "/index.html"`)
  - [~] 1.6 Configure Vite with path aliases (`@/` → `src/`)
  - [~] 1.7 Set up Vitest with React Testing Library and jsdom environment
  - [~] 1.8 Create `README.md` with prerequisites, env var setup, local dev commands, demo flow walkthrough, and Vercel deployment steps

- [ ] 2 Mock Data and Type Definitions
  - [~] 2.1 Define all TypeScript types in `src/types/index.ts`: `SeverityLevel`, `PatientDetails`, `TriageInput`, `TriageResult`, `TriageSession`, `Incident`, `Hospital`, `RankedHospital`, `ResourceStatus`, `PreArrivalAlert`, `SeverityCounts`
  - [~] 2.2 Create `src/data/hospitals.ts` with 15 mock hospitals for the Kochi/Kerala region (name, address, coordinates, specialties, bed counts, ICU, OT, contact)
  - [~] 2.3 Create `src/data/seedIncidents.ts` with 3 pre-populated sample incidents (e.g., "Metro Line Collapse - Sector 18")
  - [~] 2.4 Create `src/data/seedResources.ts` with initial mock resource status (ambulances, beds, surgeons, blood units, ventilators, OT slots)

- [ ] 3 Zustand State Management
  - [~] 3.1 Create `src/store/triageSessionSlice.ts` with session state, `startNewSession`, `setInput`, `setResult`, `setAnalyzing`, `setAnalysisError`, `selectHospital`, `confirmDispatch`, `markAlertSent` actions
  - [~] 3.2 Create `src/store/incidentsSlice.ts` with incidents list, resource status, `addIncident`, `updateResourceStatus` actions; initialize with seed incidents and seed resources
  - [~] 3.3 Combine slices into `src/store/index.ts` using Zustand's `create` with combined store
  - [~] 3.4 Write unit tests for `triageSessionSlice`: verify `startNewSession` resets all fields to initial values
  - [~] 3.5 Write unit tests for `incidentsSlice`: verify `addIncident` appends correctly and preserves existing items
  - [~] 3.6 Write property-based tests (fast-check) for `startNewSession` reset invariant (Property 6)
  - [~] 3.7 Write property-based tests (fast-check) for `addIncident` append-only invariant (Property 7)

- [ ] 4 Services Layer
  - [~] 4.1 Create `src/services/geminiService.ts` with `buildTriagePrompt()` function that constructs START-protocol-based prompts from `TriageInput`
  - [~] 4.2 Implement `analyzePatient(input: TriageInput): Promise<TriageResult>` in geminiService — handles text-only and multimodal (image) requests, reads key from `VITE_GEMINI_API_KEY`
  - [~] 4.3 Implement Gemini response parser: extract JSON block via regex, validate required fields, throw structured errors for malformed responses
  - [~] 4.4 Implement graceful degradation in geminiService: return `null` / throw `ConfigError` when `VITE_GEMINI_API_KEY` is absent
  - [~] 4.5 Create `src/services/mapsService.ts` with `getHospitalDistances(origin, hospitals)` using Google Maps Distance Matrix API
  - [~] 4.6 Implement `getRoute(origin, destination)` in mapsService for turn-by-turn navigation summary
  - [~] 4.7 Implement Haversine fallback in mapsService for when Maps API key is absent or Distance Matrix fails
  - [~] 4.8 Create `src/services/hospitalRanking.ts` with `computeSpecialtyMatch(specialties, result)` and `rankHospitals(hospitals, result, distances)` pure functions
  - [~] 4.9 Write unit tests for `buildTriagePrompt`: verify START severity definitions are present in output
  - [~] 4.10 Write unit tests for Gemini response parser: valid JSON, malformed JSON, missing fields
  - [~] 4.11 Write unit tests for `rankHospitals`: specialty priority, availability tiebreaker, distance tiebreaker
  - [~] 4.12 Write property-based tests (fast-check) for `rankHospitals` preserves all hospitals (Property 2)
  - [~] 4.13 Write property-based tests (fast-check) for `rankHospitals` order invariant (Property 3)
  - [~] 4.14 Write property-based tests (fast-check) for `computeSpecialtyMatch` score bounds [0,1] (Property 4)
  - [~] 4.15 Write property-based tests (fast-check) for Gemini response parser round-trip integrity (Property 1)
  - [~] 4.16 Write property-based tests (fast-check) for Gemini error preserves patient data (Property 9)
  - [~] 4.17 Write property-based tests (fast-check) for prompt construction includes START protocol (Property 10)

- [ ] 5 Application Shell and Navigation
  - [~] 5.1 Create `src/App.tsx` with `createBrowserRouter` defining routes: `/` (FieldTriagePage), `/dispatch` (DispatchPage), `/dashboard` (DashboardPage)
  - [~] 5.2 Create `src/components/Layout.tsx` wrapping `<NavBar />` + `<Outlet />` with dark background
  - [~] 5.3 Create `src/components/NavBar.tsx` with TriageAI logo, "New Triage" link, "Command Dashboard" link, and active session severity badge
  - [~] 5.4 Implement navigation guard in `DispatchPage`: redirect to `/` with toast if no completed `TriageResult` in store
  - [~] 5.5 Create `src/components/ErrorBoundary.tsx` wrapping the entire app with fallback UI and "Reload Application" button
  - [~] 5.6 Apply global dark theme base styles in `src/index.css` (dark background, default text color)
  - [~] 5.7 Define triage color constants/utilities in `src/utils/triageColors.ts`: RED `#EF4444`, YELLOW `#EAB308`, GREEN `#22C55E`, BLACK `#1F2937`

- [ ] 6 Field Triage Page — Patient Input
  - [~] 6.1 Create `src/pages/FieldTriagePage.tsx` as the main container for patient input and triage result
  - [~] 6.2 Create `src/components/triage/InputTabs.tsx` with three tabs: Voice Input, Photo Upload, Text Description
  - [~] 6.3 Create `src/components/triage/VoiceInputTab.tsx` using Web Speech API for real-time transcription into the description field; show unsupported browser message when API is unavailable
  - [~] 6.4 Create `src/components/triage/PhotoUploadTab.tsx` with file input accepting JPEG/PNG/WebP up to 10 MB; show preview thumbnail; display error for invalid files
  - [~] 6.5 Implement image validation in `src/utils/imageValidation.ts`: validate MIME type and file size, return base64 string or validation error
  - [~] 6.6 Create `src/components/triage/TextDescriptionTab.tsx` with textarea for manual description input
  - [~] 6.7 Create `src/components/triage/PatientDetailsForm.tsx` with Name, Age (0–120), Gender (select), Location fields; inline validation on submit
  - [~] 6.8 Create `src/components/triage/AnalyzeButton.tsx` that triggers Gemini analysis; shows loading spinner while analyzing; disabled when analyzing or API key missing
  - [~] 6.9 Show persistent warning banner when `VITE_GEMINI_API_KEY` is absent
  - [~] 6.10 Write unit tests for `PatientDetailsForm`: empty field rejection, age range validation
  - [~] 6.11 Write unit tests for `PhotoUploadTab`: valid file acceptance, oversized file rejection, wrong format rejection
  - [~] 6.12 Write property-based tests (fast-check) for image validation (Property 5)

- [ ] 7 Field Triage Page — AI Result Display
  - [~] 7.1 Create `src/components/triage/TriageResultCard.tsx` displaying severity badge (color-coded), confidence score, injury summary, recommended actions, surgery/blood flags
  - [~] 7.2 Apply correct triage color to severity badge: RED/YELLOW/GREEN/BLACK with appropriate text contrast
  - [~] 7.3 Show "Send Alert to Hospital" button on `TriageResultCard` when a hospital is selected in the store
  - [~] 7.4 Create `src/components/triage/PreArrivalAlertModal.tsx` displaying all required alert fields in a modal styled with the patient's severity color
  - [~] 7.5 Implement `generatePreArrivalAlert(session: TriageSession): PreArrivalAlert` pure function in `src/utils/alertGenerator.ts`
  - [~] 7.6 Show simulated confirmation message ("Alert sent to [Hospital] ER team") after alert modal is opened
  - [~] 7.7 Include patient photo thumbnail in alert modal when `imageBase64` is present in session
  - [~] 7.8 Write unit tests for `TriageResultCard`: correct color class for each severity level
  - [~] 7.9 Write unit tests for `PreArrivalAlertModal`: all required fields rendered
  - [~] 7.10 Write property-based tests (fast-check) for `generatePreArrivalAlert` completeness (Property 8)

- [ ] 8 Dispatch Page
  - [~] 8.1 Create `src/pages/DispatchPage.tsx` as the main container for hospital recommendations and dispatch
  - [~] 8.2 Create `src/components/dispatch/HospitalRankingList.tsx` that calls `rankHospitals()` on mount and displays ranked hospital cards
  - [~] 8.3 Create `src/components/dispatch/HospitalCard.tsx` displaying: hospital name, specialty match indicator, available beds, ICU beds, OT slots, distance (km), ETA (minutes), dispatch button
  - [~] 8.4 Implement hospital selection: clicking a card sets `selectedHospitalId` in the store and highlights the card
  - [~] 8.5 Create `src/components/dispatch/RouteNavigationPanel.tsx` showing turn-by-turn navigation summary after dispatch is confirmed
  - [~] 8.6 Implement "Dispatch to 108/112" action: call `confirmDispatch()` in store, call `addIncident()` with patient + hospital + ETA data, show confirmation state
  - [~] 8.7 Show warning banner when no hospital has available beds; still display all hospitals sorted by distance
  - [~] 8.8 Show "(estimated)" label on distance/ETA when Haversine fallback is used
  - [~] 8.9 Write unit tests for `HospitalCard`: all required fields rendered with known data
  - [~] 8.10 Write unit tests for dispatch confirmation: store state updates correctly

- [ ] 9 Command Dashboard
  - [~] 9.1 Create `src/pages/DashboardPage.tsx` as the main container for the command overview
  - [~] 9.2 Create `src/components/dashboard/MetricCards.tsx` displaying: Active Incidents, Total Triaged, RED/YELLOW/GREEN/BLACK severity counts
  - [~] 9.3 Create `src/components/dashboard/ResourceStatusGrid.tsx` displaying: Ambulances, Beds, Surgeons, Blood Units, Ventilators, OT Slots (available/total)
  - [~] 9.4 Create `src/components/dashboard/IncidentFeed.tsx` showing scrollable list of incidents with event name, location, severity badge, and timestamp
  - [~] 9.5 Create `src/components/dashboard/HospitalMap.tsx` using `@react-google-maps/api` with custom markers color-coded by `availabilityStatus` (green/yellow/red)
  - [~] 9.6 Implement Maps API key check in `HospitalMap`: show static placeholder image when key is absent
  - [~] 9.7 Create `src/components/dashboard/DispatchesPanel.tsx` with Pending Dispatches and Active Dispatches sub-sections
  - [~] 9.8 Ensure dashboard re-renders reactively when Zustand store updates (new incidents, dispatch confirmations)
  - [~] 9.9 Write unit tests for `MetricCards`: correct counts from store data
  - [~] 9.10 Write unit tests for `IncidentFeed`: seed incidents render on initialization

- [ ] 10 Styling, Responsiveness, and Accessibility
  - [~] 10.1 Apply responsive layout breakpoints across all pages: 375px mobile → 768px tablet → 1280px desktop → 1920px wide
  - [~] 10.2 Ensure NavBar collapses to hamburger menu or icon-only on mobile (375px)
  - [~] 10.3 Ensure DispatchPage hospital list stacks vertically on mobile
  - [~] 10.4 Ensure DashboardPage metric cards and resource grid use responsive grid (1 col mobile, 2 col tablet, 4 col desktop)
  - [~] 10.5 Add ARIA labels to all interactive elements (buttons, inputs, tabs, modal)
  - [~] 10.6 Ensure severity badges always include text labels (not color alone) for accessibility
  - [~] 10.7 Verify minimum 4.5:1 contrast ratio for all text on dark backgrounds
  - [~] 10.8 Ensure keyboard navigation works for all primary flows (tab order, Enter/Space for buttons)

- [ ] 11 Integration and End-to-End Verification
  - [~] 11.1 Write integration test for complete triage flow: input → mocked Gemini call → result display → dispatch → dashboard update
  - [~] 11.2 Write integration test for navigation guard: accessing `/dispatch` without triage result redirects to `/`
  - [~] 11.3 Write smoke test verifying mock hospital data has 10–15 entries with all required fields
  - [~] 11.4 Write smoke test verifying seed incidents initialize with at least 3 entries
  - [~] 11.5 Verify Vercel deployment: run `vite build` and confirm no build errors; test SPA routing with `vercel.json` rewrite
  - [~] 11.6 Manual demo flow walkthrough: voice input → photo upload → AI analysis → hospital selection → dispatch → pre-arrival alert → dashboard view
