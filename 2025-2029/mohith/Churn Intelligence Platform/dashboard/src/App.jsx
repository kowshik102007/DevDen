import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Users, BarChart3, Search, ArrowLeft, TrendingUp, 
  ShieldAlert, Award, DollarSign, RefreshCw, AlertTriangle, HelpCircle, 
  CheckCircle2, XCircle, ArrowUpDown, ChevronLeft, ChevronRight, UserMinus,
  Mail, Lock, Key, Settings
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      const u = JSON.parse(saved);
      return u.role === 'retention_agent' ? 'directory' : 'overview';
    }
    return 'overview';
  });

  const [cost, setCost] = useState(15.0);
  const [value, setValue] = useState(150.0);
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Auth Modes & New states
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  
  // Signup states
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState('data_scientist');
  const [signupError, setSignupError] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  // Reset password states
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Simulated Email Sandbox state
  const [simulatedEmail, setSimulatedEmail] = useState(null);

  // Simulation actions for agents
  const [actionStatus, setActionStatus] = useState('');
  const [actingCustomerId, setActingCustomerId] = useState(null);

  const handleTriggerAction = (custId) => {
    setActionStatus('sending');
    setActingCustomerId(custId);
    setTimeout(() => {
      setActionStatus('success');
      setTimeout(() => {
        setActionStatus('');
        setActingCustomerId(null);
      }, 3000);
    }, 1500);
  };
  
  // Stats & API states
  const [apiOnline, setApiOnline] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metrics, setMetrics] = useState(null);
  
  // Customers List state
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('All');
  const [sortBy, setSortBy] = useState('churn_risk');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Selected Customer Detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Evaluation curves state
  const [evaluation, setEvaluation] = useState(null);
  
  // Add Customer modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState('');
  const [metricsTrigger, setMetricsTrigger] = useState(0);
  
  // Add Customer Form states
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newGender, setNewGender] = useState('Female');
  const [newSeniorCitizen, setNewSeniorCitizen] = useState('No');
  const [newPartner, setNewPartner] = useState('No');
  const [newDependents, setNewDependents] = useState('No');
  const [newTenureMonths, setNewTenureMonths] = useState(12);
  const [newPhoneService, setNewPhoneService] = useState('Yes');
  const [newMultipleLines, setNewMultipleLines] = useState('No');
  const [newInternetService, setNewInternetService] = useState('Fiber optic');
  const [newOnlineSecurity, setNewOnlineSecurity] = useState('No');
  const [newOnlineBackup, setNewOnlineBackup] = useState('No');
  const [newDeviceProtection, setNewDeviceProtection] = useState('No');
  const [newTechSupport, setNewTechSupport] = useState('No');
  const [newStreamingTV, setNewStreamingTV] = useState('No');
  const [newStreamingMovies, setNewStreamingMovies] = useState('No');
  const [newContract, setNewContract] = useState('Month-to-month');
  const [newPaperlessBilling, setNewPaperlessBilling] = useState('Yes');
  const [newPaymentMethod, setNewPaymentMethod] = useState('Electronic check');
  const [newMonthlyCharges, setNewMonthlyCharges] = useState(70.0);
  const [newTotalCharges, setNewTotalCharges] = useState(840.0);
  const [newChurnValue, setNewChurnValue] = useState(0); // 0 = Active, 1 = Churned

  // Auto-calculate Total Charges when monthly charges or tenure changes
  useEffect(() => {
    const monthly = parseFloat(newMonthlyCharges) || 0;
    const tenure = parseInt(newTenureMonths, 10) || 0;
    setNewTotalCharges((monthly * tenure).toFixed(2));
  }, [newMonthlyCharges, newTenureMonths]);

  const generateRandomCustomerId = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let id1 = '';
    let id2 = '';
    for (let i = 0; i < 4; i++) {
      id1 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    for (let i = 0; i < 5; i++) {
      id2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCustomerId(`${id1}-${id2}`);
  };

  const resetAddCustomerForm = () => {
    setNewCustomerId('');
    setNewGender('Female');
    setNewSeniorCitizen('No');
    setNewPartner('No');
    setNewDependents('No');
    setNewTenureMonths(12);
    setNewPhoneService('Yes');
    setNewMultipleLines('No');
    setNewInternetService('Fiber optic');
    setNewOnlineSecurity('No');
    setNewOnlineBackup('No');
    setNewDeviceProtection('No');
    setNewTechSupport('No');
    setNewStreamingTV('No');
    setNewStreamingMovies('No');
    setNewContract('Month-to-month');
    setNewPaperlessBilling('Yes');
    setNewPaymentMethod('Electronic check');
    setNewMonthlyCharges(70.0);
    setNewTotalCharges(840.0);
    setNewChurnValue(0);
    setAddCustomerError('');
  };

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    setSubmittingCustomer(true);
    setAddCustomerError('');
    
    const trimmedId = newCustomerId.trim();
    if (!trimmedId) {
      setAddCustomerError('Customer ID cannot be empty.');
      setSubmittingCustomer(false);
      return;
    }

    // Alphanumeric format validation for Customer ID
    if (!/^[A-Z0-9-]+$/i.test(trimmedId)) {
      setAddCustomerError('Customer ID must contain only alphanumeric characters and hyphens.');
      setSubmittingCustomer(false);
      return;
    }
    
    const phoneService = newPhoneService;
    const multipleLines = phoneService === 'No' ? 'No phone service' : newMultipleLines;
    
    const internetService = newInternetService;
    const isNoInternet = internetService === 'No';
    const onlineSecurity = isNoInternet ? 'No internet service' : newOnlineSecurity;
    const onlineBackup = isNoInternet ? 'No internet service' : newOnlineBackup;
    const deviceProtection = isNoInternet ? 'No internet service' : newDeviceProtection;
    const techSupport = isNoInternet ? 'No internet service' : newTechSupport;
    const streamingTV = isNoInternet ? 'No internet service' : newStreamingTV;
    const streamingMovies = isNoInternet ? 'No internet service' : newStreamingMovies;
    
    const payload = {
      CustomerID: trimmedId,
      Gender: newGender,
      SeniorCitizen: newSeniorCitizen,
      Partner: newPartner,
      Dependents: newDependents,
      TenureMonths: parseInt(newTenureMonths, 10),
      PhoneService: phoneService,
      MultipleLines: multipleLines,
      InternetService: internetService,
      OnlineSecurity: onlineSecurity,
      OnlineBackup: onlineBackup,
      DeviceProtection: deviceProtection,
      TechSupport: techSupport,
      StreamingTV: streamingTV,
      StreamingMovies: streamingMovies,
      Contract: newContract,
      PaperlessBilling: newPaperlessBilling,
      PaymentMethod: newPaymentMethod,
      MonthlyCharges: parseFloat(newMonthlyCharges),
      TotalCharges: parseFloat(newTotalCharges),
      ChurnValue: parseInt(newChurnValue, 10),
      TreatmentW: 0
    };
    
    try {
      const res = await fetch(`${backendUrl}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setShowAddModal(false);
        resetAddCustomerForm();
        
        // Search the newly added customer and reset filters to All
        setSearch(trimmedId);
        setSegmentFilter('All');
        setPage(1);
        
        // Reload API metrics & directory
        setMetricsTrigger(prev => prev + 1);
      } else {
        const err = await res.json();
        setAddCustomerError(err.detail || 'Failed to add customer. Verify Customer ID is unique.');
      }
    } catch (err) {
      setAddCustomerError('Could not connect to FastAPI server. Please ensure the backend is running.');
    } finally {
      setSubmittingCustomer(false);
    }
  };
  
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('backendUrl') || 'http://127.0.0.1:8000';
  });

  // Settings States
  const [settingsName, setSettingsName] = useState('');
  const [settingsRole, setSettingsRole] = useState('data_scientist');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);

  useEffect(() => {
    if (user) {
      setSettingsName(user.name || '');
      setSettingsRole(user.role || 'data_scientist');
    }
  }, [user]);

  const debounceTimer = useRef(null);

  // Poll API health & fetch static evaluation details
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/evaluation`);
        if (res.ok) {
          const evalData = await res.json();
          setEvaluation(evalData);
          setApiOnline(true);
        }
      } catch (err) {
        setApiOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch metrics when sliders or options change, only if logged in
  useEffect(() => {
    if (!apiOnline || !user) return;
    if (user.role === 'retention_agent') return; // Agents don't need macro simulation metrics
    
    const fetchMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const res = await fetch(`${backendUrl}/api/metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cost, value })
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
  }, [cost, value, apiOnline, user, metricsTrigger]);

  // Fetch customers with debounce for search, only if logged in
  useEffect(() => {
    if (!apiOnline || !user) return;
    if (user.role === 'executive') return; // Executives don't see the directory
    
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await fetch(
          `${backendUrl}/api/customers?page=${page}&limit=12&search=${encodeURIComponent(search)}&segment=${segmentFilter}&sort_by=${sortBy}&sort_order=${sortOrder}&cost=${cost}&value=${value}`
        );
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers);
          setTotalCustomers(data.total);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchCustomers();
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search, segmentFilter, sortBy, sortOrder, page, cost, value, apiOnline, user, metricsTrigger]);

  // Fetch customer details, only if logged in
  useEffect(() => {
    if (!selectedCustomerId || !apiOnline || !user) return;

    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(`${backendUrl}/api/customers/${selectedCustomerId}?cost=${cost}&value=${value}`);
        if (res.ok) {
          const data = await res.json();
          setCustomerDetail(data);
        }
      } catch (err) {
        console.error("Failed to fetch customer detail:", err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedCustomerId, cost, value, apiOnline, user]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${backendUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        setActiveTab(data.role === 'retention_agent' ? 'directory' : 'overview');
        setLoginError('');
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Incorrect credentials');
      }
    } catch (err) {
      setLoginError('Cannot establish server connection');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleQuickLogin = async (qEmail, qPass) => {
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${backendUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: qEmail, password: qPass })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        setActiveTab(data.role === 'retention_agent' ? 'directory' : 'overview');
        setLoginError('');
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Incorrect credentials');
      }
    } catch (err) {
      setLoginError('Cannot establish server connection');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setSelectedCustomerId(null);
    setEmail('');
    setPassword('');
    setLoginError('');
    setAuthMode('login');
    setSimulatedEmail(null);
  };

  const handleSignup = async (e) => {
    if (e) e.preventDefault();
    setSigningUp(true);
    setSignupError('');
    try {
      const res = await fetch(`${backendUrl}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
          role: signupRole
        })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        setActiveTab(data.role === 'retention_agent' ? 'directory' : 'overview');
        setSignupError('');
        // Clear fields
        setSignupName('');
        setSignupEmail('');
        setSignupPassword('');
      } else {
        const err = await res.json();
        setSignupError(err.detail || 'Signup failed');
      }
    } catch (err) {
      setSignupError('Cannot establish server connection');
    } finally {
      setSigningUp(false);
    }
  };

  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    setSendingCode(true);
    setForgotError('');
    try {
      const res = await fetch(`${backendUrl}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      if (res.ok) {
        const data = await res.json();
        setForgotError('');
        setResetSuccess(false);
        // Show simulated email toast
        setSimulatedEmail({
          to: forgotEmail,
          subject: 'CausalChurn Password Reset Verification Code',
          code: data.code,
          body: `We received a request to reset your CausalChurn account password. Please use the following 6-digit verification code to complete the reset. This code is valid for 5 minutes.`
        });
        // Transition to reset mode
        setAuthMode('reset');
      } else {
        const err = await res.json();
        setForgotError(err.detail || 'Failed to request reset code');
      }
    } catch (err) {
      setForgotError('Cannot establish server connection');
    } finally {
      setSendingCode(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setResettingPassword(true);
    setResetError('');
    try {
      const res = await fetch(`${backendUrl}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          code: resetCode,
          new_password: resetPassword
        })
      });
      if (res.ok) {
        setResetError('');
        setResetSuccess(true);
        // Clear fields
        setResetCode('');
        setResetPassword('');
        setSimulatedEmail(null); // Dismiss toast
        
        // Return to login after 3 seconds
        setTimeout(() => {
          setAuthMode('login');
          setResetSuccess(false);
          setEmail(forgotEmail); // Pre-fill reset email on login
          setForgotEmail(''); // Clear forgot email after filling
        }, 3000);
      } else {
        const err = await res.json();
        setResetError(err.detail || 'Failed to reset password');
      }
    } catch (err) {
      setResetError('Cannot establish server connection');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleUpdateUserSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess('');

    if (settingsPassword && settingsPassword !== settingsConfirmPassword) {
      setSettingsError('New passwords do not match');
      setSavingSettings(false);
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/api/user/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_email: user.email,
          name: settingsName,
          role: settingsRole,
          new_password: settingsPassword || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        setSettingsSuccess('Profile successfully updated!');
        setSettingsPassword('');
        setSettingsConfirmPassword('');
      } else {
        const err = await res.json();
        setSettingsError(err.detail || 'Failed to update settings');
      }
    } catch (err) {
      setSettingsError('Cannot establish server connection');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSystemDb = async () => {
    if (!window.confirm('Are you sure you want to reset the system database? All registered user accounts and updated passwords will be wiped, and original seed accounts restored.')) {
      return;
    }
    setResettingDb(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await fetch(`${backendUrl}/api/system/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        setSettingsSuccess('Database successfully reset. Logging you out...');
        setTimeout(() => {
          handleLogout();
          setSettingsSuccess('');
        }, 2000);
      } else {
        const err = await res.json();
        setSettingsError(err.detail || 'Failed to reset system database');
      }
    } catch (err) {
      setSettingsError('Cannot establish server connection');
    } finally {
      setResettingDb(false);
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // UI Components
  const renderSidebar = () => {
    const showOverview = user?.role === 'data_scientist' || user?.role === 'executive';
    const showDirectory = user?.role === 'data_scientist' || user?.role === 'retention_agent';
    const showModels = user?.role === 'data_scientist' || user?.role === 'executive';

    return (
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            <Activity size={28} color="#6366f1" style={{ filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.5))' }} />
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CausalChurn</h1>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decision System</span>
            </div>
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {showOverview && (
              <button 
                className={`tab-btn ${activeTab === 'overview' && !selectedCustomerId ? 'active' : ''}`}
                onClick={() => { setActiveTab('overview'); setSelectedCustomerId(null); }}
              >
                <Activity size={18} />
                Campaign Simulation
              </button>
            )}
            {showDirectory && (
              <button 
                className={`tab-btn ${activeTab === 'directory' || selectedCustomerId ? 'active' : ''}`}
                onClick={() => { setActiveTab('directory'); }}
              >
                <Users size={18} />
                Customer Directory
              </button>
            )}
            {showModels && (
              <button 
                className={`tab-btn ${activeTab === 'models' && !selectedCustomerId ? 'active' : ''}`}
                onClick={() => { setActiveTab('models'); setSelectedCustomerId(null); }}
              >
                <BarChart3 size={18} />
                Model Validation
              </button>
            )}
            <button 
              className={`tab-btn ${activeTab === 'settings' && !selectedCustomerId ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setSelectedCustomerId(null); }}
            >
              <Settings size={18} />
              System Settings
            </button>
            <button 
              className="tab-btn logout-menu-btn"
              onClick={handleLogout}
              style={{ color: '#f43f5e', marginTop: '10px' }}
            >
              <UserMinus size={18} />
              Log Out
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="api-status-light" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiOnline ? 'var(--success)' : 'var(--danger)', boxShadow: apiOnline ? '0 0 8px var(--success)' : '0 0 8px var(--danger)', animation: 'pulse 2s infinite' }}></div>
            <span style={{ color: 'var(--text-muted)' }}>Service: </span>
            <span style={{ fontWeight: 600, color: apiOnline ? 'var(--text-main)' : 'var(--text-muted)' }}>{apiOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>

          {user && (
            <div className="sidebar-profile">
              <div className="profile-avatar">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="profile-info">
                <span className="profile-name" title={user.name}>{user.name}</span>
                <span className="profile-role-badge">{user.role.replace('_', ' ')}</span>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Log Out">
                <UserMinus size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  };

  const renderSliders = () => (
    <div className="glass-card animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} color="var(--primary)" />
            Intervention Offer Cost {user?.role === 'executive' && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 400 }}>(Read Only)</span>}
          </label>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>${cost.toFixed(2)}</span>
        </div>
        <input 
          type="range" 
          min="5" 
          max="100" 
          step="5" 
          value={cost} 
          disabled={user?.role === 'executive'}
          onChange={(e) => { setCost(parseFloat(e.target.value)); setPage(1); }} 
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          <span>$5.00 (Standard Promo)</span>
          <span>$100.00 (High-tier Save)</span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="var(--secondary)" />
            Retained Customer LTV Value {user?.role === 'executive' && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 400 }}>(Read Only)</span>}
          </label>
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>${value.toFixed(2)}</span>
        </div>
        <input 
          type="range" 
          min="50" 
          max="500" 
          step="10" 
          value={value} 
          disabled={user?.role === 'executive'}
          onChange={(e) => { setValue(parseFloat(e.target.value)); setPage(1); }} 
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          <span>$50.00 (Low LTV)</span>
          <span>$500.00 (Enterprise LTV)</span>
        </div>
      </div>
    </div>
  );

  const renderOverview = () => {
    if (loadingMetrics || !metrics) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
        </div>
      );
    }

    const { overall, campaign_roi } = metrics;
    const strategyData = [
      { name: 'Causal Uplift', 'Net Campaign Value ($)': campaign_roi.strategies.uplift.net_value, cost: campaign_roi.strategies.uplift.cost, fill: '#6366f1' },
      { name: 'Naive Risk-Based', 'Net Campaign Value ($)': campaign_roi.strategies.risk.net_value, cost: campaign_roi.strategies.risk.cost, fill: '#a855f7' },
      { name: 'Blanket (All)', 'Net Campaign Value ($)': campaign_roi.strategies.blanket.net_value, cost: campaign_roi.strategies.blanket.cost, fill: '#3b82f6' },
      { name: 'No Intervention', 'Net Campaign Value ($)': 0, cost: 0, fill: '#64748b' }
    ];

    const upliftRoi = campaign_roi.strategies.uplift.net_value;
    const riskRoi = campaign_roi.strategies.risk.net_value;
    const valueLift = upliftRoi - riskRoi;

    return (
      <div className="animate-slide-up">
        {/* KPI Row */}
        <div className="kpi-grid">
          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Targeting Volume</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0' }}>
              {campaign_roi.targeted_count.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>({campaign_roi.targeting_percent.toFixed(1)}%)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optimal target cohort size</span>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Campaign Cost</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--text-muted)' }}>
              ${campaign_roi.strategies.uplift.cost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total investment amount</span>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>LTV Revenue Saved</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--success)' }}>
              ${campaign_roi.strategies.uplift.savings.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>{campaign_roi.strategies.uplift.churns_prevented} churns avoided</span>
          </div>

          <div className="glass-card" style={{ padding: '20px', borderLeft: '3px solid var(--primary)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Net Campaign Value</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ${upliftRoi.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary-light)' }}>
              +{((upliftRoi / (campaign_roi.strategies.uplift.cost || 1)) * 100).toFixed(0)}% ROI yield
            </span>
          </div>
        </div>

        {/* Chart & Insights Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '30px', marginBottom: '30px' }}>
          <div className="glass-card" style={{ minHeight: '350px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px' }}>Net Campaign Value by Targeting Strategy ($)</h3>
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strategyData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1423', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                  />
                  <Bar dataKey="Net Campaign Value ($)" radius={[8, 8, 0, 0]}>
                    {strategyData.map((entry, index) => (
                      <rect key={`rect-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--primary)" />
                Causal Lift Advantage
              </h3>
              
              <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '12px', padding: '16px', marginBottom: '15px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Additional profit over standard ML model:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-light)', display: 'block', margin: '4px 0' }}>
                  ${valueLift.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  By skipping non-responders and avoiding annoyed "Sleeping Dogs."
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--success)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>Targeting Causal Uplift</strong> avoids wasting budget on customers who would stay anyway (Sure Things) or leave anyway (Lost Causes).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                <AlertTriangle size={16} color="var(--warning)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>Sleeping Dogs Flagging</strong> prevents contacts that spark churn (reminding satisfied, quiet users of monthly subscriptions).</span>
              </div>
            </div>
          </div>
        </div>

        {/* Causal Segments Card */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="var(--primary)" />
            Causal Segment Breakdown (A/B Test Cohort)
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', marginBottom: '8px' }}>PERSUADABLES</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{overall.segments.Persuadable}</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Churn if control, saved if treated. Target this group for optimal ROI.</p>
            </div>
            
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-light)', marginBottom: '8px' }}>SURE THINGS</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{overall.segments['Sure Thing']}</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Never churn. Sending them an offer wastes campaign budget.</p>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(244, 63, 94, 0.1)', color: 'var(--danger)', marginBottom: '8px' }}>LOST CAUSES</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{overall.segments['Lost Cause']}</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Churn regardless of intervention. Do not waste offers here.</p>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', marginBottom: '8px' }}>SLEEPING DOGS</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{overall.segments['Sleeping Dog'] || 0}</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Annoyed if contacted (churn increases). Triggered to cancel.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDirectory = () => {
    return (
      <div className="glass-card animate-slide-up">
        {/* Table Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '250px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input 
                type="text" 
                placeholder="Search Customer ID, contract, payment method..." 
                className="search-input"
                style={{ width: '100%', paddingLeft: '36px' }}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recommendation:</span>
              <select 
                className="search-input auth-select"
                value={segmentFilter}
                onChange={(e) => { setSegmentFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All Profiles</option>
                <option value="Target">Target with Offer</option>
                <option value="Skip">Skip / Ignore</option>
              </select>
            </div>

            <button
              className="btn-secondary"
              style={{
                background: 'var(--primary-gradient)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={() => {
                resetAddCustomerForm();
                generateRandomCustomerId();
                setShowAddModal(true);
              }}
            >
              Add Customer
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('CustomerID')}>
                  Customer ID <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th>Gender</th>
                <th>Contract</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('MonthlyCharges')}>
                  Charges / Mo <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th>Tenure</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('churn_risk')}>
                  Churn Risk <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('uplift')}>
                  Uplift Lift <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                </th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {loadingCustomers ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    <RefreshCw className="animate-spin" size={24} color="var(--primary)" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No customer profiles matched the criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomerId(c.id)}>
                    <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{c.id}</td>
                    <td>{c.gender}</td>
                    <td>{c.contract}</td>
                    <td>${c.monthly_charges.toFixed(2)}</td>
                    <td>{c.tenure} Mo</td>
                    <td>
                      <span style={{ color: c.churn_risk > 0.6 ? 'var(--danger)' : c.churn_risk > 0.3 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                        {(c.churn_risk * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <span style={{ color: c.uplift > 0.15 ? 'var(--success)' : c.uplift < -0.01 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {c.uplift > 0 ? '+' : ''}{(c.uplift * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${c.recommendation === 'Target' ? 'badge-target' : 'badge-skip'}`}>
                        {c.recommendation === 'Target' ? 'Offer Discount' : 'No Action'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <span>Showing {((page - 1) * 12) + 1} - {Math.min(page * 12, totalCustomers)} of {totalCustomers} customers</span>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="tab-btn" 
              style={{ padding: '6px 12px', border: '1px solid var(--border-color)' }}
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600, color: 'var(--text-main)' }}>Page {page}</span>
            <button 
              className="tab-btn" 
              style={{ padding: '6px 12px', border: '1px solid var(--border-color)' }}
              disabled={page * 12 >= totalCustomers}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerDetail = () => {
    if (loadingDetail || !customerDetail) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
        </div>
      );
    }

    const { customer_info, predictions, survival_curve, explainability } = customerDetail;
    const isTarget = predictions.recommendation === 'Target';

    // Prepare SHAP chart data
    const shapData = [
      ...explainability.risk_increasing.map(item => ({
        name: item.display_name,
        impact: item.shap_value,
        direction: 'increase'
      })),
      ...explainability.risk_decreasing.map(item => ({
        name: item.display_name,
        impact: item.shap_value,
        direction: 'decrease'
      }))
    ].sort((a, b) => Math.abs(a.impact) - Math.abs(b.impact)); // sorted for horizontal rendering

    return (
      <div className="animate-slide-up">
        {/* Back header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <button 
            className="tab-btn" 
            style={{ padding: '8px', border: '1px solid var(--border-color)' }}
            onClick={() => setSelectedCustomerId(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Customer Details: {customer_info.CustomerID}</h2>
              <span className={`badge ${predictions.recommendation === 'Target' ? 'badge-target' : 'badge-skip'}`}>
                {predictions.recommendation === 'Target' ? 'TARGET WITH OFFER' : 'NO ACTION RECOMMENDED'}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Demographics: {customer_info.Gender} | Partner: {customer_info.Partner} | Dependents: {customer_info.Dependents}
            </span>
          </div>
        </div>

        {/* Dynamic Diagnostic banner */}
        <div style={{ 
          background: isTarget ? 'rgba(16, 185, 129, 0.08)' : predictions.uplift < -0.01 ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: isTarget ? 'rgba(16, 185, 129, 0.2)' : predictions.uplift < -0.01 ? 'rgba(244, 63, 94, 0.2)' : 'var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '25px',
          display: 'flex',
          gap: '15px',
          alignItems: 'start',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'start' }}>
            {isTarget ? (
              <CheckCircle2 size={24} color="var(--success)" style={{ flexShrink: 0 }} />
            ) : predictions.uplift < -0.01 ? (
              <AlertTriangle size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
            ) : (
              <HelpCircle size={24} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            )}
            <div>
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>System Diagnostic Reason:</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>{explainability.diagnostic}</p>
            </div>
          </div>

          {user?.role === 'retention_agent' && isTarget && (
            <div style={{ flexShrink: 0 }}>
              <button
                className="tab-btn"
                style={{
                  background: actionStatus === 'success' ? 'var(--success-gradient)' : 'var(--primary-gradient)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 10px rgba(99,102,241,0.25)',
                  borderRadius: '8px'
                }}
                disabled={actionStatus === 'sending' || actionStatus === 'success'}
                onClick={() => handleTriggerAction(customer_info.CustomerID)}
              >
                {actionStatus === 'sending' ? (
                  <RefreshCw className="animate-spin" size={14} />
                ) : actionStatus === 'success' ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}
                {actionStatus === 'sending' ? 'Sending Offer...' : actionStatus === 'success' ? 'Offer Triggered!' : 'Send Discount Offer'}
              </button>
            </div>
          )}
        </div>

        {/* Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
          {/* Diagnostic Metrics */}
          <div className="glass-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '20px' }}>Causal Model Analysis</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Churn Risk (No Offer)</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--danger)', margin: '4px 0' }}>
                  {(predictions.risk_control * 100).toFixed(0)}%
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Baseline customer risk</span>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Churn Risk (With Offer)</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)', margin: '4px 0' }}>
                  {(predictions.risk_treated * 100).toFixed(0)}%
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Risk if sent discount campaign</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Estimated Churn reduction (Uplift)</span>
                <span style={{ fontWeight: 600, color: predictions.uplift > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {predictions.uplift > 0 ? '+' : ''}{(predictions.uplift * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Contract Type</span>
                <span style={{ fontWeight: 600 }}>{customer_info.Contract}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monthly Subscription Charges</span>
                <span style={{ fontWeight: 600 }}>${customer_info['Monthly Charges'].toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Billing Method</span>
                <span style={{ fontWeight: 600 }}>{customer_info['Payment Method']}</span>
              </div>
            </div>
          </div>

          {/* Survival Curves */}
          <div className="glass-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Survival Timeline (Time-to-Churn)</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated median customer lifespan:</span>
              <span style={{ fontWeight: 600, color: 'var(--primary-light)', padding: '2px 8px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '6px', fontSize: '0.85rem' }}>
                {predictions.median_survival}
              </span>
            </div>
            
            <div style={{ width: '100%', height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={survival_curve} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} label={{ value: 'Months', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} domain={[0, 1.0]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1423', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Survival Prob']}
                  />
                  <Line type="monotone" dataKey="probability" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <ReferenceLine y={0.5} stroke="rgba(244, 63, 94, 0.3)" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* SHAP Explanation */}
        <div className="glass-card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '20px' }}>Individual Feature Drivers (SHAP values)</h3>
          
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} tickLine={false} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1423', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(v) => [v.toFixed(4), 'Shap Impact']}
                />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                  {shapData.map((entry, index) => (
                    <rect 
                      key={`rect-${index}`} 
                      fill={entry.impact > 0 ? 'rgba(244, 63, 94, 0.7)' : 'rgba(16, 185, 129, 0.7)'} 
                      stroke={entry.impact > 0 ? 'var(--danger)' : 'var(--success)'}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: 'rgba(244, 63, 94, 0.7)', border: '1px solid var(--danger)', borderRadius: '2px' }}></div>
              Risk-Increasing Factors
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: 'rgba(16, 185, 129, 0.7)', border: '1px solid var(--success)', borderRadius: '2px' }}></div>
              Risk-Decreasing Factors
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderModelPerformance = () => {
    if (!evaluation) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
        </div>
      );
    }

    const { metrics: evalMetrics, curves } = evaluation;

    return (
      <div className="animate-slide-up">
        {/* Model validation stats */}
        <div className="kpi-grid">
          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>ROC AUC Score</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--primary-light)' }}>
              {evalMetrics.roc_auc.toFixed(4)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Classifier classification accuracy</span>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Precision-Recall AUC</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--info)' }}>
              {evalMetrics.pr_auc.toFixed(4)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accuracy under class imbalance</span>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Survival C-Index</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--warning)' }}>
              {evalMetrics.c_index.toFixed(4)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Survival ranking accuracy</span>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Qini Coefficient</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--success)' }}>
              {evalMetrics.qini_coefficient.toFixed(1)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Causal uplift model lift over random</span>
          </div>
        </div>

        {/* Validation Curves Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
          
          {/* Qini Curve */}
          <div className="glass-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '20px' }}>Holdout Qini Curve (Uplift Validation)</h3>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curves.qini} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="percentile" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} label={{ value: 'Percentile Targeted', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1423', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelFormatter={(v) => `Targeting top ${v.toFixed(1)}%`}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line name="Causal T-Learner" type="monotone" dataKey="model_qini" stroke="var(--success)" strokeWidth={2.5} dot={false} />
                  <Line name="Random Strategy" type="monotone" dataKey="random_qini" stroke="var(--text-muted)" strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROI Simulation Curve */}
          <div className="glass-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '20px' }}>Net Campaign Value by Percentage Targeted</h3>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curves.roi_simulation} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorUplift" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="percentile" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1423', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    formatter={(v) => [`$${v.toLocaleString(undefined, {minimumFractionDigits: 0})}`, 'Net Value']}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area name="Causal Target Value" type="monotone" dataKey="uplift_net_val" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorUplift)" />
                  <Line name="Random Target Value" type="monotone" dataKey="random_net_val" stroke="var(--text-muted)" strokeDasharray="3 3" dot={false} />
                  <ReferenceLine x={evalMetrics.optimal_target_percentile} stroke="rgba(16, 185, 129, 0.5)" strokeDasharray="3 3" label={{ value: `Optimal: ${evalMetrics.optimal_target_percentile.toFixed(0)}%`, fill: 'var(--success)', fontSize: 9, position: 'top' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="animate-fade-in" style={{ padding: '5px' }}>
        {settingsError && (
          <div className="login-error" style={{ marginBottom: '20px' }}>
            <AlertTriangle size={16} />
            <span>{settingsError}</span>
          </div>
        )}
        
        {settingsSuccess && (
          <div className="auth-success-alert" style={{ marginBottom: '20px' }}>
            <CheckCircle2 size={16} />
            <span>{settingsSuccess}</span>
          </div>
        )}

        <div className="settings-grid">
          {/* Section 1: User Account Profile */}
          <div className="glass-card">
            <h3 className="settings-section-title">
              <Users size={18} color="var(--primary)" />
              User Account Settings
            </h3>
            
            <form onSubmit={handleUpdateUserSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="search-input" 
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label>Corporate Email (Read-Only)</label>
                <input 
                  type="email" 
                  className="search-input" 
                  value={user?.email || ''}
                  disabled 
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Workspace Role</label>
                <select 
                  className="search-input auth-select"
                  value={settingsRole}
                  onChange={(e) => setSettingsRole(e.target.value)}
                  required
                >
                  <option value="data_scientist">Data Scientist (Analyst Tab Access)</option>
                  <option value="executive">Executive (Overview / ROI Simulator Only)</option>
                  <option value="retention_agent">Retention Agent (Targeting Directory Only)</option>
                </select>
                <p className="settings-help-text">Changing your role will alter which tabs are visible in the left sidebar navigation.</p>
              </div>

              <div className="form-group">
                <label>New Password (Optional)</label>
                <input 
                  type="password" 
                  className="search-input" 
                  placeholder="Leave blank to keep current password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  className="search-input" 
                  placeholder="Confirm new password"
                  value={settingsConfirmPassword}
                  onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                className="login-btn" 
                style={{ marginTop: '10px' }}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {savingSettings ? 'Saving Profile...' : 'Save Profile Changes'}
              </button>

              <button 
                type="button" 
                className="btn-secondary" 
                style={{ marginTop: '10px', borderColor: 'rgba(244, 63, 94, 0.25)', color: 'var(--danger)', width: '100%' }}
                onClick={handleLogout}
              >
                <UserMinus size={18} />
                Log Out of Session
              </button>
            </form>
          </div>

          {/* Section 2: Project & System Configurations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div className="glass-card">
              <h3 className="settings-section-title">
                <Settings size={18} color="var(--primary)" />
                Project Configurations
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                <div className="form-group">
                  <label>Campaign Settings (Persisted Defaults)</label>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Intervention Cost ($)</span>
                      <input 
                        type="number" 
                        className="search-input" 
                        value={cost}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCost(val);
                        }}
                        style={{ width: '100%', marginTop: '5px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Value saved ($)</span>
                      <input 
                        type="number" 
                        className="search-input" 
                        value={value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setValue(val);
                        }}
                        style={{ width: '100%', marginTop: '5px' }}
                      />
                    </div>
                  </div>
                  <p className="settings-help-text">Altering these default numbers impacts ROI simulations across the dashboard.</p>
                </div>
              </div>
            </div>

            {/* Section 3: Danger Zone */}
            <div className="glass-card settings-danger-zone">
              <h3 className="settings-section-title" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                System Maintenance
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', opacity: 0.9 }}>
                  Wipe all registered users and custom passwords, resetting the platform backend users database to original seed settings.
                </p>
                
                <div style={{ marginTop: '10px' }}>
                  <button 
                    type="button" 
                    className="btn-danger"
                    onClick={handleResetSystemDb}
                    disabled={resettingDb}
                  >
                    {resettingDb ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                    {resettingDb ? 'Resetting System...' : 'Reset User DB to Seeds'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAddCustomerModal = () => {
    const isNoPhone = newPhoneService === 'No';
    const isNoInternet = newInternetService === 'No';

    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <div className="modal-header">
            <h3>
              <Users size={20} color="var(--primary-light)" />
              Add New Customer Profile
            </h3>
            <button className="modal-close-btn" type="button" onClick={() => setShowAddModal(false)}>&times;</button>
          </div>
          
          <form onSubmit={handleAddCustomerSubmit}>
            <div className="modal-body">
              {addCustomerError && (
                <div className="login-error" style={{ marginBottom: '20px' }}>
                  <AlertTriangle size={16} />
                  <span>{addCustomerError}</span>
                </div>
              )}
              
              {/* Section 1: Demographics & Account Identity */}
              <div className="form-section">
                <h4 className="form-section-title">
                  <Activity size={14} /> Identity & Demographics
                </h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Customer ID</label>
                    <div className="input-with-button">
                      <input 
                        type="text" 
                        className="search-input" 
                        placeholder="e.g. 1234-ABCD"
                        value={newCustomerId}
                        onChange={(e) => setNewCustomerId(e.target.value.toUpperCase())}
                        required 
                      />
                      <button 
                        type="button" 
                        className="input-btn"
                        onClick={generateRandomCustomerId}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Gender</label>
                    <select 
                      className="search-input auth-select" 
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value)}
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Senior Citizen</label>
                    <select 
                      className="search-input auth-select" 
                      value={newSeniorCitizen}
                      onChange={(e) => setNewSeniorCitizen(e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Partner status</label>
                    <select 
                      className="search-input auth-select" 
                      value={newPartner}
                      onChange={(e) => setNewPartner(e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Dependents status</label>
                    <select 
                      className="search-input auth-select" 
                      value={newDependents}
                      onChange={(e) => setNewDependents(e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Churn Status (Baseline)</label>
                    <select 
                      className="search-input auth-select" 
                      value={newChurnValue}
                      onChange={(e) => setNewChurnValue(parseInt(e.target.value, 10))}
                    >
                      <option value={0}>Active (Non-Churned)</option>
                      <option value={1}>Churned (Closed Account)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Contract & Billing Info */}
              <div className="form-section">
                <h4 className="form-section-title">
                  <DollarSign size={14} /> Contract & Billing Details
                </h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Contract Type</label>
                    <select 
                      className="search-input auth-select" 
                      value={newContract}
                      onChange={(e) => setNewContract(e.target.value)}
                    >
                      <option value="Month-to-month">Month-to-month</option>
                      <option value="One year">One year</option>
                      <option value="Two year">Two year</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tenure (Months)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="72"
                      className="search-input" 
                      value={newTenureMonths}
                      onChange={(e) => setNewTenureMonths(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Monthly Subscription Charges ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="search-input" 
                      value={newMonthlyCharges}
                      onChange={(e) => setNewMonthlyCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Total Charges ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="search-input" 
                      value={newTotalCharges}
                      onChange={(e) => setNewTotalCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                      required 
                    />
                    <span className="form-help-text">Calculated as Monthly * Tenure, but editable.</span>
                  </div>

                  <div className="form-group">
                    <label>Payment Method</label>
                    <select 
                      className="search-input auth-select" 
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                    >
                      <option value="Electronic check">Electronic check</option>
                      <option value="Mailed check">Mailed check</option>
                      <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
                      <option value="Credit card (automatic)">Credit card (automatic)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Paperless Billing</label>
                    <select 
                      className="search-input auth-select" 
                      value={newPaperlessBilling}
                      onChange={(e) => setNewPaperlessBilling(e.target.value)}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Telecommunications Services */}
              <div className="form-section">
                <h4 className="form-section-title">
                  <ShieldAlert size={14} /> Subscribed Services
                </h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Phone Service</label>
                    <select 
                      className="search-input auth-select" 
                      value={newPhoneService}
                      onChange={(e) => {
                        setNewPhoneService(e.target.value);
                        if (e.target.value === 'No') {
                          setNewMultipleLines('No phone service');
                        } else {
                          setNewMultipleLines('No');
                        }
                      }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Multiple Lines</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoPhone ? 'No phone service' : newMultipleLines}
                      onChange={(e) => setNewMultipleLines(e.target.value)}
                      disabled={isNoPhone}
                      style={{ opacity: isNoPhone ? 0.6 : 1 }}
                    >
                      {isNoPhone ? (
                        <option value="No phone service">No phone service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Internet Service Provider</label>
                    <select 
                      className="search-input auth-select" 
                      value={newInternetService}
                      onChange={(e) => {
                        setNewInternetService(e.target.value);
                        if (e.target.value === 'No') {
                          setNewOnlineSecurity('No internet service');
                          setNewOnlineBackup('No internet service');
                          setNewDeviceProtection('No internet service');
                          setNewTechSupport('No internet service');
                          setNewStreamingTV('No internet service');
                          setNewStreamingMovies('No internet service');
                        } else {
                          setNewOnlineSecurity('No');
                          setNewOnlineBackup('No');
                          setNewDeviceProtection('No');
                          setNewTechSupport('No');
                          setNewStreamingTV('No');
                          setNewStreamingMovies('No');
                        }
                      }}
                    >
                      <option value="Fiber optic">Fiber optic</option>
                      <option value="DSL">DSL</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Online Security</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoInternet ? 'No internet service' : newOnlineSecurity}
                      onChange={(e) => setNewOnlineSecurity(e.target.value)}
                      disabled={isNoInternet}
                      style={{ opacity: isNoInternet ? 0.6 : 1 }}
                    >
                      {isNoInternet ? (
                        <option value="No internet service">No internet service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Online Backup</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoInternet ? 'No internet service' : newOnlineBackup}
                      onChange={(e) => setNewOnlineBackup(e.target.value)}
                      disabled={isNoInternet}
                      style={{ opacity: isNoInternet ? 0.6 : 1 }}
                    >
                      {isNoInternet ? (
                        <option value="No internet service">No internet service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Device Protection</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoInternet ? 'No internet service' : newDeviceProtection}
                      onChange={(e) => setNewDeviceProtection(e.target.value)}
                      disabled={isNoInternet}
                      style={{ opacity: isNoInternet ? 0.6 : 1 }}
                    >
                      {isNoInternet ? (
                        <option value="No internet service">No internet service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tech Support</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoInternet ? 'No internet service' : newTechSupport}
                      onChange={(e) => setNewTechSupport(e.target.value)}
                      disabled={isNoInternet}
                      style={{ opacity: isNoInternet ? 0.6 : 1 }}
                    >
                      {isNoInternet ? (
                        <option value="No internet service">No internet service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Streaming TV</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoInternet ? 'No internet service' : newStreamingTV}
                      onChange={(e) => setNewStreamingTV(e.target.value)}
                      disabled={isNoInternet}
                      style={{ opacity: isNoInternet ? 0.6 : 1 }}
                    >
                      {isNoInternet ? (
                        <option value="No internet service">No internet service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Streaming Movies</label>
                    <select 
                      className="search-input auth-select" 
                      value={isNoInternet ? 'No internet service' : newStreamingMovies}
                      onChange={(e) => setNewStreamingMovies(e.target.value)}
                      disabled={isNoInternet}
                      style={{ opacity: isNoInternet ? 0.6 : 1 }}
                    >
                      {isNoInternet ? (
                        <option value="No internet service">No internet service</option>
                      ) : (
                        <>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowAddModal(false)}
                disabled={submittingCustomer}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-secondary" 
                style={{ background: 'var(--primary-gradient)', color: '#fff', border: 'none' }}
                disabled={submittingCustomer}
              >
                {submittingCustomer ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} style={{ marginRight: '6px' }} />
                    Creating Profile...
                  </>
                ) : 'Create Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!apiOnline) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center' }}>
          <UserMinus size={64} color="var(--text-muted)" style={{ marginBottom: '20px', animation: 'pulse 2s infinite' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '10px' }}>FastAPI Backend Offline</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>
            The dashboard cannot fetch predictions because the backend local server is unreachable. Start the server from your terminal using:
          </p>
          <div style={{ background: '#070a13', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 20px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--primary-light)', marginBottom: '20px' }}>
            .venv\Scripts\python api/main.py
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The app will automatically reconnect as soon as the service is active.</p>
        </div>
      );
    }

    if (selectedCustomerId) {
      return renderCustomerDetail();
    }

    switch (activeTab) {
      case 'overview':
        return user?.role === 'retention_agent' ? renderDirectory() : renderOverview();
      case 'directory':
        return user?.role === 'executive' ? renderOverview() : renderDirectory();
      case 'models':
        return user?.role === 'retention_agent' ? renderDirectory() : renderModelPerformance();
      case 'settings':
        return renderSettings();
      default:
        return user?.role === 'retention_agent' ? renderDirectory() : renderOverview();
    }
  };

  const renderLogin = () => {
    return (
      <div className="login-container">
        {simulatedEmail && (
          <div className="simulated-email-toast">
            <div className="email-toast-header">
              <span className="email-toast-title">
                <Mail size={16} />
                <span>Simulated Mailbox sandbox</span>
              </span>
              <button type="button" className="email-toast-close" onClick={() => setSimulatedEmail(null)}>×</button>
            </div>
            <div className="email-toast-body">
              <div className="email-toast-field">
                <span className="email-toast-label">To: </span>
                {simulatedEmail.to}
              </div>
              <div className="email-toast-field">
                <span className="email-toast-label">Subject: </span>
                {simulatedEmail.subject}
              </div>
              <p style={{ marginTop: '8px', opacity: 0.85, fontSize: '0.75rem' }}>{simulatedEmail.body}</p>
              <div className="email-toast-code-container">
                <span className="email-toast-code">{simulatedEmail.code}</span>
                <button 
                  type="button" 
                  className="email-toast-copy-btn"
                  onClick={() => {
                    setResetCode(simulatedEmail.code);
                    navigator.clipboard.writeText(simulatedEmail.code);
                  }}
                >
                  Auto-fill Code
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="glass-card login-card animate-slide-up">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Activity size={40} color="#6366f1" style={{ filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.6))' }} />
          </div>

          {authMode === 'login' && (
            <>
              <h2 className="login-title">CausalChurn System</h2>
              <p className="login-subtitle">Counterfactual retention decision support platform</p>
              
              {loginError && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{loginError}</span>
                </div>
              )}
              
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Corporate Email</label>
                  <input 
                    type="email" 
                    className="search-input" 
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="search-input" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>

                <div className="auth-link-container" style={{ marginBottom: '20px' }}>
                  <button type="button" className="auth-link-btn" onClick={() => { setAuthMode('forgot'); setLoginError(''); }}>
                    Forgot Password?
                  </button>
                  <button type="button" className="auth-link-btn" onClick={() => { setAuthMode('signup'); setLoginError(''); }}>
                    Create Account
                  </button>
                </div>
                
                <button 
                  type="submit" 
                  className="login-btn"
                  disabled={loggingIn}
                >
                  {loggingIn ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Activity size={18} />
                  )}
                  {loggingIn ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
              
              <div className="quick-login-section">
                <h4 className="quick-login-title">Demo Access Roles</h4>
                <div className="quick-login-grid">
                  <div 
                    className="quick-login-card"
                    onClick={() => handleQuickLogin('analyst@company.com', 'password123')}
                  >
                    <div className="quick-login-info">
                      <span className="quick-login-user">Sarah Connor</span>
                      <span className="quick-login-role">analyst@company.com</span>
                    </div>
                    <span className="quick-login-badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--secondary)' }}>
                      Data Scientist
                    </span>
                  </div>
                  
                  <div 
                    className="quick-login-card"
                    onClick={() => handleQuickLogin('executive@company.com', 'password123')}
                  >
                    <div className="quick-login-info">
                      <span className="quick-login-user">John Connor</span>
                      <span className="quick-login-role">executive@company.com</span>
                    </div>
                    <span className="quick-login-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--info)' }}>
                      Executive
                    </span>
                  </div>
                  
                  <div 
                    className="quick-login-card"
                    onClick={() => handleQuickLogin('marketer@company.com', 'password123')}
                  >
                    <div className="quick-login-info">
                      <span className="quick-login-user">Kyle Reese</span>
                      <span className="quick-login-role">marketer@company.com</span>
                    </div>
                    <span className="quick-login-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                      Retention Agent
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {authMode === 'signup' && (
            <>
              <h2 className="login-title">Join CausalChurn</h2>
              <p className="login-subtitle">Register a new decision support workspace account</p>
              
              {signupError && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{signupError}</span>
                </div>
              )}
              
              <form onSubmit={handleSignup}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="e.g. Sarah Connor"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Corporate Email</label>
                  <input 
                    type="email" 
                    className="search-input" 
                    placeholder="name@company.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Account Role</label>
                  <select 
                    className="search-input auth-select"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    required
                  >
                    <option value="data_scientist">Data Scientist (Analyst Tab Access)</option>
                    <option value="executive">Executive (Overview / ROI Simulator Only)</option>
                    <option value="retention_agent">Retention Agent (Targeting Directory Only)</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="search-input" 
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required 
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="login-btn"
                  disabled={signingUp}
                >
                  {signingUp ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Activity size={18} />
                  )}
                  {signingUp ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>

              <div className="auth-link-container" style={{ justifyContent: 'center', marginTop: '20px' }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>Already have an account?</span>
                <button type="button" className="auth-link-btn" onClick={() => { setAuthMode('login'); setSignupError(''); }}>
                  Sign In
                </button>
              </div>
            </>
          )}

          {authMode === 'forgot' && (
            <>
              <h2 className="login-title">Forgot Password</h2>
              <p className="login-subtitle">Enter your email and we'll send you a password reset code</p>
              
              {forgotError && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{forgotError}</span>
                </div>
              )}
              
              <form onSubmit={handleForgotPassword}>
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label>Corporate Email</label>
                  <input 
                    type="email" 
                    className="search-input" 
                    placeholder="name@company.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required 
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="login-btn"
                  disabled={sendingCode}
                >
                  {sendingCode ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Mail size={18} />
                  )}
                  {sendingCode ? 'Sending Code...' : 'Send Reset Code'}
                </button>
              </form>

              <div className="auth-link-container" style={{ justifyContent: 'center', marginTop: '20px' }}>
                <button type="button" className="auth-link-btn" onClick={() => { setAuthMode('login'); setForgotError(''); }}>
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {authMode === 'reset' && (
            <>
              <h2 className="login-title">Reset Password</h2>
              <p className="login-subtitle">Enter the verification code and set your new password</p>
              
              {resetError && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="auth-success-alert">
                  <CheckCircle2 size={16} />
                  <span>Password updated successfully! Redirecting to login...</span>
                </div>
              )}
              
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label>Corporate Email</label>
                  <input 
                    type="email" 
                    className="search-input" 
                    value={forgotEmail}
                    disabled 
                  />
                </div>

                <div className="form-group">
                  <label>Verification Code</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="6-digit code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    maxLength={6}
                    required 
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label>New Password</label>
                  <input 
                    type="password" 
                    className="search-input" 
                    placeholder="••••••••"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required 
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="login-btn"
                  disabled={resettingPassword || resetSuccess}
                >
                  {resettingPassword ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  {resettingPassword ? 'Updating Password...' : 'Reset Password'}
                </button>
              </form>

              <div className="auth-link-container" style={{ justifyContent: 'center', marginTop: '20px' }}>
                <button type="button" className="auth-link-btn" onClick={() => { setAuthMode('login'); setResetError(''); setResetSuccess(false); setSimulatedEmail(null); }}>
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!user) {
    return renderLogin();
  }

  return (
    <div className="dashboard-layout">
      {renderSidebar()}
      
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {selectedCustomerId ? "Customer Analytics Profile" : 
               activeTab === 'overview' ? "Retention Campaign Simulator" : 
               activeTab === 'directory' ? "Customer Targeting Directory" : 
               activeTab === 'settings' ? "Workspace & Account Settings" : "Model Verification Panel"}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              {selectedCustomerId ? "Counterfactual analysis and individual treatment responses." :
               activeTab === 'overview' ? "Adjust retention campaign assumptions to optimize cohort financial value." : 
               activeTab === 'directory' ? "Search, sort, and select individual customer profiles to inspect SHAP drivers." : 
               activeTab === 'settings' ? "Customize system defaults, update profile, and manage data parameters." : 
               "Evaluate model calibration, precision-recall, and uplift Qini gains."}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {apiOnline && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Targeting cohort: <strong>{totalCustomers > 0 ? totalCustomers.toLocaleString() : '7,043'} Customers</strong>
              </span>
            )}
          </div>
        </header>

        {apiOnline && !selectedCustomerId && user?.role !== 'retention_agent' && activeTab !== 'settings' && renderSliders()}

        {renderContent()}
      </main>

      {showAddModal && renderAddCustomerModal()}
    </div>
  );
}

export default App;
