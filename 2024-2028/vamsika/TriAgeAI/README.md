# 🏥 TriageAI - AI-Powered Emergency Response Platform

> **Real-time mass casualty triage intelligence powered by Google Gemini AI**

[![React](https://img.shields.io/badge/React-19.2.5-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0.10-646CFF?logo=vite)](https://vitejs.dev/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## DEMO:
[Click here to watch demo](https://tri-age.vercel.app/)

## 📊 Presentation  
[View Presentation (PDF)](https://github.com/vamsikagh/TriAgeAi/blob/main/Presentation.pdf)

## ✨ Features

### 🤖 AI-Powered Triage
- **Multimodal Analysis**: Voice, photo, and text-based injury assessment
- **START Protocol**: Automated severity classification (RED/YELLOW/GREEN/BLACK)
- **Confidence Scoring**: AI-generated confidence levels for each assessment
- **Smart Recommendations**: Automated treatment and transport suggestions

### 🚑 Smart Dispatch System
- **Hospital Matching**: Intelligent routing based on injury type and specialty
- **Real-time Availability**: Live bed, ICU, and OR capacity tracking
- **ETA Calculation**: Google Maps integration for accurate arrival times
- **Resource Optimization**: Automated ambulance and resource allocation

### 📊 Command Dashboard
- **Live Event Monitoring**: Real-time mass casualty event tracking
- **Resource Management**: Track ambulances, beds, surgeons, blood units, ventilators
- **Patient Overview**: Comprehensive patient list with severity indicators
- **Hospital Network**: Interactive map of nearby hospitals with capacity data

### 🎨 Professional UI/UX
- **Modern Design System**: Glassmorphism, gradients, and smooth animations
- **Dark Theme**: Eye-friendly interface for 24/7 operations
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile
- **Accessibility**: WCAG-compliant color contrast and keyboard navigation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Google Maps API key ([Get one here](https://console.cloud.google.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd triageai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## 📖 Usage Guide

### Starting a New Triage

1. **Navigate to "New Triage"** from the sidebar
2. **Choose input method**:
   - 🎤 **Voice**: Click record and describe the injury
   - 📸 **Photo**: Upload or capture an injury photo
   - ✍️ **Text**: Type a detailed description
3. **Fill patient details**: Name, age, gender, location
4. **Click "Analyze with Gemini AI"**
5. **Review AI assessment**: Severity, confidence, recommendations
6. **Assign to hospital**: View matched hospitals and dispatch

### Managing Resources

- **Dashboard**: View real-time resource availability
- **Resources Page**: Detailed breakdown of all resources
- **Auto-updates**: Resources automatically adjust as patients are triaged

### Hospital Map

- **Interactive Map**: View all nearby hospitals
- **Capacity Indicators**: Color-coded availability status
- **Quick Navigation**: Click hospital for details and routing

## 🏗️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 19, Vite 8 |
| **Styling** | Custom CSS (Glassmorphism Design System) |
| **Routing** | React Router v7 |
| **State Management** | React Context API |
| **AI Engine** | Google Gemini 2.0 Flash |
| **Icons** | Lucide React |
| **Maps** | Google Maps Platform |
| **Animations** | CSS Animations & Transitions |

## 📁 Project Structure

```
triageai/
├── src/
│   ├── assets/          # Images and static files
│   ├── components/      # Reusable UI components
│   ├── context/         # React Context (State Management)
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── TriagePage.jsx
│   │   ├── PatientsPage.jsx
│   │   ├── ResourcesPage.jsx
│   │   ├── AmbulancePage.jsx
│   │   └── MapPage.jsx
│   ├── services/        # API services
│   │   └── geminiService.js
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Public assets
├── .env                 # Environment variables (not in git)
├── .env.example         # Environment template
├── package.json         # Dependencies
└── vite.config.js       # Vite configuration
```

## 🎨 Design System

### Color Palette
- **Primary Background**: `#0a0e1a` (Deep Navy)
- **Secondary Background**: `#0f1419` (Darker Navy)
- **Card Background**: `#161b26` (Slate)
- **Accent Blue**: `#5b7cff` (Vibrant Blue)
- **Accent Purple**: `#a855f7` (Royal Purple)
- **Accent Cyan**: `#06b6d4` (Bright Cyan)

### Severity Colors
- 🔴 **RED (Immediate)**: `#ef4444` - Life-threatening
- 🟡 **YELLOW (Delayed)**: `#f59e0b` - Serious but stable
- 🟢 **GREEN (Minor)**: `#10b981` - Walking wounded
- ⚫ **BLACK (Deceased)**: `#6b7280` - No signs of life

## 🔒 Security & Privacy

- **API Keys**: Stored in environment variables, never committed to git
- **Data Privacy**: All patient data stored locally in browser context
- **No Backend**: Fully client-side application (no data sent to external servers)
- **HTTPS Only**: Recommended for production deployment

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

<div align="center">
  <strong>Built with ❤️ for emergency responders worldwide</strong>
  <br>
  <sub>Saving lives through AI-powered triage intelligence</sub>
</div>

## 📊 Presentation  
[View Presentation (PDF)](https://github.com/vamsikagh/TriAgeAi/blob/main/Presentation.pdf)

[Click here to watch demo](https://tri-age.vercel.app/)
