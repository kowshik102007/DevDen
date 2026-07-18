# Design Document: TriageAI Emergency Response Platform

## Overview

TriageAI is a single-page React 19 application that demonstrates a complete emergency response workflow: **Field Triage → Smart Dispatch → Hospital Pre-Arrival Alerts → Command Dashboard**. It targets paramedics in the field and emergency coordinators at command centers, using Google Gemini AI (gemini-2.0-flash) for multimodal triage assessment and Google Maps Platform for routing and ETA calculations.

The application is a client-side-only SPA deployable to Vercel with no backend or SSR requirements. All hospital data is mocked for the Kochi/Kerala region. A single active triage session is maintained at a time, with completed sessions accumulating in a persistent incidents list for the Command Dashboard.

### Key Design Decisions

- **Client-side only**: No backend needed; Gemini and Maps APIs are called directly from the browser. API keys are scoped to allowed origins in production.
- **Zustand for state**: Chosen over React Context for its minimal boilerplate, devtools support, and clean slice-based organization.
- **React Router v6**: Provides clean URL-based navigation between the three main views.
- **Mock data as a module**: Hospital and incident seed data live in a dedicated `src/data/` directory, making them easy to update without touching component logic.
- **Gemini multimodal**: Images are base64-encoded in the browser and sent inline with the prompt, avoiding any file upload infrastructure.

---

## Architecture

The application follows a **feature-slice architecture** within a standard Vite project structure. There is no server layer; all external communication goes directly to Google APIs from the browser.

```
Browser (React 19 SPA)
│
├── React Router v6 (client-side routing)
│
├── Zustand Store (global state)
│   ├── triageSessionSlice   — current patient + AI result + dispatch status
│   └── incidentsSlice       — accumulated incidents + resource counters
│
├── Feature Modules
│   ├── FieldTriage          — patient input, AI analysis, pre-arrival alert
│   ├── Dispatch             — hospital ranking, route display, dispatch action
│   └── CommandDashboard     — metrics, incident feed, hospital map, dispatches
│
├── Services
│   ├── geminiService        — Gemini API calls (text + multimodal)
│   └── mapsService          — Google Maps Distance Matrix + Directions
│
└── Data
    ├── hospitals.ts         — 15 mock hospitals (Kochi/Kerala)
    └── seedIncidents.ts     — 3 pre-populated sample incidents
```

### Data Flow

```
Paramedic Input (voice/photo/text)
        │
        ▼
  geminiService.analyze()
        │
        ▼
  Zustand: triageSessionSlice.setResult()
        │
        ├──► Dispatch Module reads result → ranks hospitals via mapsService
        │
        ├──► Pre-Arrival Alert reads result → renders modal
        │
        └──► On dispatch confirm → incidentsSlice.addIncident()
                                         │
                                         ▼
                                  Command Dashboard re-renders
```

---

## Components and Interfaces

### Route Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `<FieldTriagePage>` | Patient input + AI triage |
| `/dispatch` | `<DispatchPage>` | Hospital recommendations + dispatch |
| `/dashboard` | `<DashboardPage>` | Command overview |

### Component Tree

```
<App>
  <NavBar />                          — persistent top nav
  <Routes>
    <Route path="/" element={<FieldTriagePage />}>
      <InputTabs>
        <VoiceInputTab />             — Web Speech API
        <PhotoUploadTab />            — file input + preview
        <TextDescriptionTab />        — textarea
      </InputTabs>
      <PatientDetailsForm />          — name, age, gender, location
      <AnalyzeButton />               — triggers Gemini call
      <TriageResultCard />            — severity badge + AI output
      <PreArrivalAlertModal />        — generated alert + send confirmation
    </Route>

    <Route path="/dispatch" element={<DispatchPage />}>
      <HospitalRankingList>
        <HospitalCard />              — per hospital: stats + dispatch button
      </HospitalRankingList>
      <RouteNavigationPanel />        — turn-by-turn summary
    </Route>

    <Route path="/dashboard" element={<DashboardPage />}>
      <MetricCards />                 — active incidents, triaged, severity counts
      <ResourceStatusGrid />          — ambulances, beds, surgeons, blood, vents, OT
      <IncidentFeed />                — scrollable live feed
      <HospitalMap />                 — Google Maps embed with markers
      <DispatchesPanel>
        <PendingDispatches />
        <ActiveDispatches />
      </DispatchesPanel>
    </Route>
  </Routes>
```

### Key Component Interfaces

```typescript
// TriageResultCard
interface TriageResultCardProps {
  result: TriageResult;
  onSendAlert: () => void;
}

// HospitalCard
interface HospitalCardProps {
  hospital: RankedHospital;
  onDispatch: (hospitalId: string) => void;
  isSelected: boolean;
}

// PreArrivalAlertModal
interface PreArrivalAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: PreArrivalAlert;
}

// MetricCards
interface MetricCardsProps {
  activeIncidents: number;
  totalTriaged: number;
  severityCounts: SeverityCounts;
}
```

---

## Data Models

### Core Types

```typescript
// Triage severity levels
type SeverityLevel = 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';

// Patient details captured in the form
interface PatientDetails {
  name: string;
  age: number | null;
  gender: 'Male' | 'Female' | 'Other' | '';
  location: string;
}

// Raw input from the paramedic
interface TriageInput {
  patientDetails: PatientDetails;
  description: string;           // from voice transcription or text tab
  imageBase64: string | null;    // base64-encoded image for Gemini multimodal
  imageMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null;
}

// AI-generated triage result from Gemini
interface TriageResult {
  severityLevel: SeverityLevel;
  confidenceScore: number;       // 0–100
  injurySummary: string;
  recommendedActions: string[];
  requiresSurgery: boolean;
  requiresBlood: boolean;
  assessedAt: string;            // ISO 8601 timestamp
  rawGeminiResponse: string;     // stored for debugging
}

// Active triage session (single at a time)
interface TriageSession {
  id: string;                    // uuid
  input: TriageInput;
  result: TriageResult | null;
  selectedHospitalId: string | null;
  dispatchStatus: 'idle' | 'pending' | 'confirmed';
  alertSent: boolean;
  createdAt: string;
}

// Completed incident stored in the incidents list
interface Incident {
  id: string;
  patientName: string;
  location: string;
  severityLevel: SeverityLevel;
  destinationHospital: string | null;
  eta: number | null;            // minutes
  dispatchStatus: 'pending' | 'confirmed';
  timestamp: string;
}
```

### Hospital Data Model

```typescript
interface Hospital {
  id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  specialties: string[];         // e.g. ['Trauma', 'Cardiac', 'Neurology']
  totalBeds: number;
  availableBeds: number;
  icuCapacity: number;
  availableIcuBeds: number;
  otCount: number;
  availableOtSlots: number;
  contactNumber: string;
  availabilityStatus: 'available' | 'limited' | 'full';
}

// Hospital enriched with routing data for display
interface RankedHospital extends Hospital {
  distanceKm: number;
  etaMinutes: number;
  specialtyMatchScore: number;   // 0–1, computed from injury summary
  rank: number;
}
```

### Mock Hospital Data (Kochi/Kerala Region — 15 hospitals)

The `src/data/hospitals.ts` module exports an array of 15 hospitals covering the broader Kochi/Kerala region:

| # | Hospital | Area | Key Specialties |
|---|----------|------|-----------------|
| 1 | Amrita Institute of Medical Sciences | Edappally, Kochi | Trauma, Cardiac, Neurology, Oncology |
| 2 | Lakeshore Hospital | Maradu, Kochi | Trauma, Orthopedics, Cardiac |
| 3 | Aster Medcity | Cheranalloor, Kochi | Cardiac, Neurology, Transplant |
| 4 | KIMS Hospital | Thiruvananthapuram | Trauma, Cardiac, Neurology |
| 5 | Medical Trust Hospital | Ernakulam, Kochi | General, Orthopedics, Pediatrics |
| 6 | Rajagiri Hospital | Aluva, Kochi | Trauma, Cardiac, Orthopedics |
| 7 | VPS Lakeshore | Nettoor, Kochi | Cardiac, Neurology, Oncology |
| 8 | Baby Memorial Hospital | Kozhikode | Pediatrics, Trauma, General |
| 9 | Malabar Institute of Medical Sciences | Kozhikode | Trauma, Cardiac, Neurology |
| 10 | Jubilee Mission Medical College | Thrissur | Trauma, Orthopedics, General |
| 11 | PVS Memorial Hospital | Kaloor, Kochi | Cardiac, Orthopedics, General |
| 12 | Ernakulam Medical Centre | Ernakulam, Kochi | General, Trauma, Pediatrics |
| 13 | Caritas Hospital | Kottayam | Trauma, General, Oncology |
| 14 | Government Medical College | Thiruvananthapuram | Trauma, Cardiac, Neurology, Burns |
| 15 | Believers Church Medical College | Thiruvalla | Trauma, Cardiac, General |

### State Shape (Zustand)

```typescript
// triageSessionSlice
interface TriageSessionState {
  session: TriageSession | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  // actions
  startNewSession: () => void;
  setInput: (input: Partial<TriageInput>) => void;
  setResult: (result: TriageResult) => void;
  setAnalyzing: (loading: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  selectHospital: (hospitalId: string) => void;
  confirmDispatch: () => void;
  markAlertSent: () => void;
}

// incidentsSlice
interface IncidentsState {
  incidents: Incident[];
  resources: ResourceStatus;
  // actions
  addIncident: (incident: Incident) => void;
  updateResourceStatus: (resources: Partial<ResourceStatus>) => void;
}

interface ResourceStatus {
  ambulances: { total: number; available: number };
  beds: { total: number; available: number };
  surgeons: { total: number; available: number };
  bloodUnits: { total: number; available: number };
  ventilators: { total: number; available: number };
  otSlots: { total: number; available: number };
}
```

---

## API Integration Patterns

### Gemini API Integration

The `geminiService` calls the Gemini REST API directly from the browser using `fetch`. The API key is read from `import.meta.env.VITE_GEMINI_API_KEY`.

**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

**Prompt Construction** (START triage principles):

```typescript
function buildTriagePrompt(input: TriageInput): string {
  return `You are an emergency medical triage AI assistant trained on START triage protocols.

Analyze the following patient information and provide a structured triage assessment.

Patient Details:
- Name: ${input.patientDetails.name}
- Age: ${input.patientDetails.age}
- Gender: ${input.patientDetails.gender}
- Location: ${input.patientDetails.location}

Clinical Description:
${input.description}

${input.imageBase64 ? '[A patient photo has been provided for visual assessment]' : ''}

Respond ONLY with a valid JSON object in this exact format:
{
  "severityLevel": "RED" | "YELLOW" | "GREEN" | "BLACK",
  "confidenceScore": <number 0-100>,
  "injurySummary": "<concise clinical summary>",
  "recommendedActions": ["<action 1>", "<action 2>", ...],
  "requiresSurgery": <boolean>,
  "requiresBlood": <boolean>
}

Severity definitions (START protocol):
- RED (Immediate): Life-threatening, salvageable with immediate intervention
- YELLOW (Urgent): Serious but stable, can wait 30-60 minutes
- GREEN (Delayed): Minor injuries, ambulatory
- BLACK (Expectant): Unsurvivable injuries or deceased`;
}
```

**Multimodal request** (when image is present):

```typescript
const parts: Part[] = [{ text: prompt }];
if (input.imageBase64 && input.imageMimeType) {
  parts.push({
    inlineData: {
      mimeType: input.imageMimeType,
      data: input.imageBase64,
    },
  });
}
```

**Response parsing**: The service extracts the JSON block from the Gemini text response using a regex (`/\{[\s\S]*\}/`) and validates required fields before returning a `TriageResult`. If parsing fails, a structured error is thrown.

**Graceful degradation**: If `VITE_GEMINI_API_KEY` is absent, the Analyze button is disabled and a warning banner is shown.

### Google Maps Integration

The `mapsService` uses the **Maps JavaScript API** loaded via the `@googlemaps/js-api-loader` package.

**Distance Matrix**: Used to compute `distanceKm` and `etaMinutes` for each hospital relative to the patient's location. Requests are batched (up to 25 destinations per call) to minimize API quota usage.

```typescript
async function getHospitalDistances(
  origin: string,           // patient location string
  hospitals: Hospital[]
): Promise<Map<string, { distanceKm: number; etaMinutes: number }>>
```

**Directions**: Used to generate the turn-by-turn navigation summary when a dispatch is confirmed.

```typescript
async function getRoute(
  origin: string,
  destination: { lat: number; lng: number }
): Promise<DirectionsResult>
```

**Map rendering**: The `<HospitalMap>` component uses `@react-google-maps/api` to render an interactive map with custom markers color-coded by `availabilityStatus`.

**Graceful degradation**: If `VITE_GOOGLE_MAPS_API_KEY` is absent, the map panel shows a static placeholder image and distance/ETA values fall back to straight-line Haversine calculations.

### Hospital Ranking Algorithm

```typescript
function rankHospitals(
  hospitals: Hospital[],
  result: TriageResult,
  distances: Map<string, { distanceKm: number; etaMinutes: number }>
): RankedHospital[] {
  return hospitals
    .map(h => ({
      ...h,
      ...distances.get(h.id)!,
      specialtyMatchScore: computeSpecialtyMatch(h.specialties, result),
    }))
    .sort((a, b) => {
      // 1. Specialty match (descending)
      if (b.specialtyMatchScore !== a.specialtyMatchScore)
        return b.specialtyMatchScore - a.specialtyMatchScore;
      // 2. Availability (available > limited > full)
      const avail = { available: 0, limited: 1, full: 2 };
      if (avail[a.availabilityStatus] !== avail[b.availabilityStatus])
        return avail[a.availabilityStatus] - avail[b.availabilityStatus];
      // 3. Distance (ascending)
      return a.distanceKm - b.distanceKm;
    })
    .map((h, i) => ({ ...h, rank: i + 1 }));
}
```

---

## Routing and Navigation

React Router v6 with `createBrowserRouter` is used for client-side routing.

```typescript
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,          // contains <NavBar /> + <Outlet />
    children: [
      { index: true, element: <FieldTriagePage /> },
      { path: 'dispatch', element: <DispatchPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
]);
```

**Navigation guards**: The Dispatch page checks that a completed `TriageResult` exists in the store. If not, it redirects to `/` with a toast notification. This prevents users from landing on the dispatch page without a triage result.

**NavBar**: Persistent across all routes. Contains:
- TriageAI logo + branding
- "New Triage" link → `/`
- "Command Dashboard" link → `/dashboard`
- Active session indicator (shows severity badge if a session is in progress)

**Vercel deployment**: `vercel.json` includes a rewrite rule to serve `index.html` for all routes, enabling direct URL access.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Triage result JSON round-trip integrity

*For any* valid `TriageResult` object produced by the Gemini response parser, serializing it to JSON and deserializing it back should produce an object that is deeply equal to the original.

**Validates: Requirements 2.3, 2.6**

---

### Property 2: Hospital ranking preserves all hospitals

*For any* list of hospitals and any triage result, the ranked output of `rankHospitals()` should contain exactly the same hospitals as the input list — no hospitals added or removed.

**Validates: Requirements 3.1, 3.2**

---

### Property 3: Hospital ranking order invariant

*For any* list of hospitals and any triage result, the ranked output should be ordered such that no hospital with a lower specialty match score appears before a hospital with a higher specialty match score (when availability and distance are equal).

**Validates: Requirements 3.2**

---

### Property 4: Specialty match score bounds

*For any* hospital and any triage result, the computed `specialtyMatchScore` should always be in the range [0, 1].

**Validates: Requirements 3.2**

---

### Property 5: Image validation rejects oversized and wrong-format files

*For any* file input, if the file size exceeds 10 MB or the MIME type is not one of `image/jpeg`, `image/png`, or `image/webp`, the validation function should return an error and never return a valid base64 string.

**Validates: Requirements 1.5, 1.6**

---

### Property 6: New session resets state

*For any* triage session state (regardless of how much data it contains), calling `startNewSession()` should produce a state where `result` is null, `selectedHospitalId` is null, `dispatchStatus` is `'idle'`, and `alertSent` is false.

**Validates: Requirements 8.3**

---

### Property 7: Incidents list is append-only

*For any* incidents state and any new incident, calling `addIncident()` should result in an incidents list whose length is exactly one greater than before, and all previously existing incidents should still be present.

**Validates: Requirements 8.4, 3.7**

---

### Property 8: Pre-arrival alert contains all required fields

*For any* completed triage session with a result and a selected hospital, the generated `PreArrivalAlert` object should contain non-empty values for: patient name, age, gender, severity level, confidence score, injury summary, recommended actions, and assessment timestamp.

**Validates: Requirements 4.2**

---

## Error Handling

### Gemini API Errors

| Scenario | Handling |
|----------|----------|
| Network failure | Catch `fetch` rejection; show "Network error — check connection" toast; re-enable Analyze button |
| HTTP 4xx (bad request / quota) | Parse error body; show descriptive message (e.g., "API quota exceeded"); preserve patient data |
| HTTP 5xx (server error) | Show "Gemini service unavailable — please retry"; preserve patient data |
| Malformed JSON in response | Show "Could not parse AI response — please retry"; log raw response to console |
| Missing API key | Disable Analyze button on mount; show persistent warning banner |

### Google Maps Errors

| Scenario | Handling |
|----------|----------|
| Missing API key | Show static map placeholder; use Haversine fallback for distances |
| Distance Matrix failure | Fall back to Haversine straight-line distance; show "(estimated)" label |
| Directions failure | Show "Route unavailable" in navigation panel; dispatch action still proceeds |
| Maps JS load failure | Catch loader error; render placeholder with error message |

### Form Validation Errors

| Scenario | Handling |
|----------|----------|
| Empty required field | Highlight field with red border + inline error message; prevent submission |
| Age out of range (< 0 or > 120) | Inline validation error; prevent submission |
| No description and no image | Show "Please provide a description or upload a photo" error |
| Web Speech API unsupported | Show info banner on Voice tab; auto-focus Text Description tab |

### Global Error Boundary

A React `ErrorBoundary` wraps the entire app to catch unexpected render errors and display a fallback UI with a "Reload Application" button.

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

Focus on pure functions and component behavior with concrete examples:

- `geminiService`: prompt construction, JSON response parsing, error handling for malformed responses
- `rankHospitals()`: specific ranking scenarios (specialty match priority, availability tiebreaker, distance tiebreaker)
- `computeSpecialtyMatch()`: known injury descriptions against known specialty lists
- `PatientDetailsForm`: required field validation, age range validation
- `PhotoUploadTab`: file size rejection, format rejection, valid file acceptance
- `TriageResultCard`: correct color rendering for each severity level
- `PreArrivalAlertModal`: all required fields present in rendered output
- Zustand store slices: `startNewSession` reset, `addIncident` append behavior

### Property-Based Tests (fast-check)

Each property test runs a minimum of 100 iterations. Tests are tagged with the design property they validate.

**Feature: triageai-emergency-platform, Property 1: Triage result JSON round-trip integrity**
- Generator: arbitrary `TriageResult` objects with valid field ranges
- Assertion: `JSON.parse(JSON.stringify(result))` deep-equals `result`

**Feature: triageai-emergency-platform, Property 2: Hospital ranking preserves all hospitals**
- Generator: arbitrary arrays of `Hospital` objects (1–15 items) + arbitrary `TriageResult`
- Assertion: `rankHospitals(hospitals, result, distances).length === hospitals.length`

**Feature: triageai-emergency-platform, Property 3: Hospital ranking order invariant**
- Generator: arbitrary hospital arrays + triage results
- Assertion: for all adjacent pairs in ranked output, `rank[i].specialtyMatchScore >= rank[i+1].specialtyMatchScore` (when availability is equal)

**Feature: triageai-emergency-platform, Property 4: Specialty match score bounds**
- Generator: arbitrary hospital + arbitrary triage result
- Assertion: `0 <= computeSpecialtyMatch(h, r) <= 1`

**Feature: triageai-emergency-platform, Property 5: Image validation rejects invalid files**
- Generator: arbitrary file sizes and MIME types
- Assertion: files > 10 MB or with non-supported MIME types always return validation error

**Feature: triageai-emergency-platform, Property 6: New session resets state**
- Generator: arbitrary populated `TriageSession` states
- Assertion: after `startNewSession()`, result/selectedHospitalId/dispatchStatus/alertSent are at initial values

**Feature: triageai-emergency-platform, Property 7: Incidents list is append-only**
- Generator: arbitrary incidents list + arbitrary new incident
- Assertion: length increases by exactly 1; all prior incidents still present

**Feature: triageai-emergency-platform, Property 8: Pre-arrival alert contains all required fields**
- Generator: arbitrary completed triage sessions
- Assertion: all required alert fields are non-empty/non-null

### Integration Tests

- End-to-end triage flow: input → Gemini call (mocked) → result display → dispatch → dashboard update
- Google Maps integration: mocked Maps API responses → correct distance/ETA display
- Navigation guards: accessing `/dispatch` without a triage result redirects to `/`

### Accessibility

- All interactive elements have ARIA labels
- Color is never the sole indicator of state (severity badges include text labels)
- Keyboard navigation works for all primary flows
- Minimum contrast ratio 4.5:1 for text on dark backgrounds
