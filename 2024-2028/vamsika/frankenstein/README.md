# 🏥 Frankenstein — Hospital AI Agent Factory

**Frankenstein** is a production-ready healthcare MCP server and dynamic dashboard application built using **TypeScript and NitroStack** for the Amrita University MCP Hackathon. It enables clinicians and hospital administrators to instantly create, evolve, and run customized clinical monitoring agents in real-time using natural language prompts.

🔗 **Live Deployment Link:** [Frankenstein Live Portal](https://frankenstein-ho-skill-issue-amrita-university-amritapuri-campus.app.nitrocloud.ai)

---

## 💡 The Problem
In modern clinical telemetry monitoring (vital signs, drug interactions, lab result analysis, and ward capacity limits), alarm thresholds are static and hardcoded. Changing a safety limit or adding a dedicated alert for a high-risk patient requires writing software, passing code reviews, and waiting for IT cycles. This operational delay can directly impact patient outcomes.

## ⚡ The Solution
Frankenstein resolves this by exposing a suite of MCP tools, FHIR data resources, and customized React widgets that allow an AI assistant or a web portal to build and deploy active clinical monitors from natural language (e.g., *"Alert when a patient's temperature goes above 101 degrees"*).

---

## 🛠️ Key Features
* **Zero-Code Agent Factory**: Instantly translates natural language queries into template-driven schema rules and injects them directly into a SQLite database as active, running agents.
* **18 Interactive React Widgets**: Dynamic dashboards, patient charts, alerts boards, and audit logs that render natively inside the AI chat interface or in a standalone web browser.
* **FHIR & openFDA Interoperability**: Simulation of real-time clinical vital observations, prescription histories, and lab diagnostics aligned strictly with HL7 FHIR standards.
* **Immutable Compliance Audit Trail**: Automatic logging of all agent generations, check executions, and alert resolutions for clinical accountability.
* **Dual Transport Architecture**: Supports both standard STDIO (for desktop dev clients like Cursor/Claude Desktop) and HTTP SSE (for cloud hosting).

---

## 📂 Project Structure

```text
├── data/                    # SQLite database containing seeded and generated agents
├── dist/                    # Compiled production build output
└── src/
    ├── data/                # Database service and schema definitions
    ├── health/              # Server health monitoring tools
    ├── modules/             # Core business logic modules
    │   ├── agents/          # Agent management module (list, status, evolve)
    │   ├── alerts/          # Alert thresholds & checks engine
    │   ├── audit/           # Compliance logs
    │   ├── factory/         # Natural language agent parser and compiler
    │   └── integration/     # FHIR data adapters (vitals, meds, beds, blood bank)
    ├── registry/            # Memory registries and templates
    ├── shared/              # Shared seeding scripts and utilities
    └── widgets/             # Next.js custom widget frontend code
        ├── app/             # Main dashboard page
        └── out/             # Built widget HTML pages (served statically)
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* npm (v9 or higher)

### 1. Installation
Clone the repository and install dependencies recursively (both root and widget directories):

```bash
git clone https://github.com/vamsikagh/frankenstein-hospital-system.git
cd frankenstein-hospital-system
npm run install:all
```

### 2. Local Development
To run both the backend MCP server and the Next.js widget development server concurrently:

```bash
npm run dev
```
* Backend runs on: `http://localhost:3000`
* Widgets run on: `http://localhost:3001`

### 3. Production Build & Start
Compile the TypeScript code and bundle the Next.js static widget HTML:

```bash
npm run build
npm start
```
The server will boot in production mode and host the **widgets statically** on `http://localhost:3000`, automatically redirecting browser users visiting `http://localhost:3000` directly to the dashboard page at `/widgets/index.html`!

---

## ☁️ Cloud Deployment

Frankenstein is optimized to run on serverless cloud containers like **NitroStack Cloud**. 

To deploy manually:
1. Package the repository using Git (respects `.gitignore` and creates correct path formatting):
   ```bash
   git archive --format=zip -o ../frankenstein.zip HEAD
   ```
2. Upload the `frankenstein.zip` file directly to the **NitroStack Cloud Console**.
3. Deploy! The cloud builder will automatically run the build scripts, spin up the container, and serve your dashboard live to the world.

---

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.
