import { createContext, useContext, useState, useCallback } from 'react';

const TriageContext = createContext();

const initialResources = {
  ambulances: { total: 12, available: 8 },
  beds: { total: 50, available: 32 },
  surgeons: { total: 8, available: 5 },
  bloodUnits: { total: 200, available: 145 },
  ventilators: { total: 15, available: 11 },
  operatingRooms: { total: 6, available: 4 },
};

const initialHospitals = [
  { id: 1, name: "AIIMS Trauma Center", lat: 28.5672, lng: 77.2100, beds: 120, distance: "2.3 km", eta: "8 min", speciality: "Level 1 Trauma" },
  { id: 2, name: "Safdarjung Hospital", lat: 28.5685, lng: 77.2065, beds: 85, distance: "3.1 km", eta: "12 min", speciality: "Emergency Medicine" },
  { id: 3, name: "Apollo Emergency", lat: 28.5494, lng: 77.2501, beds: 60, distance: "5.7 km", eta: "18 min", speciality: "Multi-Specialty" },
  { id: 4, name: "Max Super Speciality", lat: 28.5672, lng: 77.2716, beds: 45, distance: "7.2 km", eta: "22 min", speciality: "Cardiac & Neuro" },
  { id: 5, name: "GTB Hospital", lat: 28.6876, lng: 77.3106, beds: 90, distance: "9.5 km", eta: "28 min", speciality: "Burn & Trauma" },
];

export function TriageProvider({ children }) {
  const [patients, setPatients] = useState([]);
  const [resources, setResources] = useState(initialResources);
  const [hospitals] = useState(initialHospitals);
  const [activeEvent, setActiveEvent] = useState({
    name: "Metro Line Collapse — Sector 18",
    type: "Building Collapse",
    location: "Noida Sector 18 Metro Station",
    startTime: new Date().toISOString(),
    estimatedCasualties: 45,
    status: "active"
  });

  const addPatient = useCallback((patient) => {
    const newPatient = {
      id: `TC-${String(patients.length + 1).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      status: 'triaged',
      assignedHospital: null,
      ...patient,
    };
    setPatients(prev => [newPatient, ...prev]);

    // Update resource availability
    if (patient.severity === 'red' || patient.severity === 'yellow') {
      setResources(prev => ({
        ...prev,
        beds: { ...prev.beds, available: Math.max(0, prev.beds.available - 1) },
        ambulances: { ...prev.ambulances, available: Math.max(0, prev.ambulances.available - 1) },
      }));
    }
    return newPatient;
  }, [patients.length]);

  const updatePatient = useCallback((id, updates) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const getStats = useCallback(() => {
    const total = patients.length;
    const red = patients.filter(p => p.severity === 'red').length;
    const yellow = patients.filter(p => p.severity === 'yellow').length;
    const green = patients.filter(p => p.severity === 'green').length;
    const black = patients.filter(p => p.severity === 'black').length;
    return { total, red, yellow, green, black };
  }, [patients]);

  return (
    <TriageContext.Provider value={{
      patients, addPatient, updatePatient,
      resources, setResources,
      hospitals,
      activeEvent, setActiveEvent,
      getStats,
    }}>
      {children}
    </TriageContext.Provider>
  );
}

export function useTriage() {
  const ctx = useContext(TriageContext);
  if (!ctx) throw new Error('useTriage must be used within TriageProvider');
  return ctx;
}
