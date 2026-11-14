'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  Calendar, 
  User, 
  RefreshCw, 
  AlertCircle, 
  BookOpen, 
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Building2,
  Users,
  CheckCircle,
  History,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Trash2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface PunchRecord {
  day: string;
  date: string;
  inTime: string;
  outTime?: string;
}

interface SavedProfile {
  username: string;
  password: string;
  displayName: string;
}

// Default initial profiles known to exist
const DEFAULT_PROFILES: SavedProfile[] = [
  { username: '202507', password: '175092', displayName: 'Sachin Singh' },
  { username: '202501', password: '582194', displayName: 'Ankit Kumar' }
];

export default function Home() {
  // Profiles in localStorage
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Authentication & Form State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(true);

  // User & Portal State
  const [userName, setUserName] = useState('');
  const [punchStatus, setPunchStatus] = useState<'in' | 'out' | 'completed'>('out');
  const [buttonLabel, setButtonLabel] = useState('Punch In');
  const [selectedDate, setSelectedDate] = useState('');
  const [totalHours, setTotalHours] = useState('00:00');
  const [todayPunchIn, setTodayPunchIn] = useState<string | null>(null);
  const [todayPunchOut, setTodayPunchOut] = useState<string | null>(null);
  const [reportHistory, setReportHistory] = useState<PunchRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lastActionTime, setLastActionTime] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<'office' | 'home'>('office');

  // UI States
  const [authLoading, setAuthLoading] = useState(false);
  const [loggingInUser, setLoggingInUser] = useState<string | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [punching, setPunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Load profiles from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('astrea_saved_profiles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedProfiles(parsed);
          return;
        }
      }
      // Seed default profiles if none exist
      localStorage.setItem('astrea_saved_profiles', JSON.stringify(DEFAULT_PROFILES));
      setSavedProfiles(DEFAULT_PROFILES);
    } catch {
      setSavedProfiles(DEFAULT_PROFILES);
    }
  }, []);

  // Live Digital Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick 1-Tap Login from a Profile Box
  const handleQuickLogin = async (profile: SavedProfile) => {
    setLoggingInUser(profile.username);
    setUsername(profile.username);
    setPassword(profile.password);
    await performLoginRequest(profile.username, profile.password, false);
    setLoggingInUser(null);
  };

  // Login from manual form
  const handleManualLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both Username and Password.');
      return;
    }
    setAuthLoading(true);
    await performLoginRequest(username.trim(), password.trim(), rememberUser);
    setAuthLoading(false);
  };

  // Core Login Request
  const performLoginRequest = async (userToAuth: string, passToAuth: string, shouldRemember: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userToAuth, password: passToAuth })
      });
      const data = await res.json();

      if (data.success) {
        const actualName = data.userName || userToAuth;
        setUserName(actualName);
        setUsername(userToAuth);
        setPassword(passToAuth);
        setPunchStatus(data.punchStatus);
        setButtonLabel(data.buttonLabel);
        setSelectedDate(data.selectedDate || new Date().toLocaleDateString());
        setTotalHours(data.totalHours || '00:00');
        setTodayPunchIn(data.todayPunchIn || null);
        setTodayPunchOut(data.todayPunchOut || null);
        setReportHistory(data.reportHistory || []);
        setIsLoggedIn(true);

        // If rememberUser is checked, update saved profiles in localStorage
        if (shouldRemember) {
          const updated = [...savedProfiles.filter(p => p.username !== userToAuth)];
          updated.push({
            username: userToAuth,
            password: passToAuth,
            displayName: actualName
          });
          setSavedProfiles(updated);
          localStorage.setItem('astrea_saved_profiles', JSON.stringify(updated));
        }
      } else {
        setErrorMsg(data.message || 'Invalid username or password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to connect to Salesforce server.');
    }
  };

  // Remove a profile box
  const handleRemoveProfile = (e: React.MouseEvent, userToRemove: string) => {
    e.stopPropagation();
    const updated = savedProfiles.filter(p => p.username !== userToRemove);
    setSavedProfiles(updated);
    localStorage.setItem('astrea_saved_profiles', JSON.stringify(updated));
  };

  // Refresh Attendance Status
  const refreshStatus = async () => {
    setRefreshLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        if (data.userName) setUserName(data.userName);
        setPunchStatus(data.punchStatus);
        setButtonLabel(data.buttonLabel);
        setSelectedDate(data.selectedDate);
        setTotalHours(data.totalHours);
        setTodayPunchIn(data.todayPunchIn || null);
        setTodayPunchOut(data.todayPunchOut || null);
        setReportHistory(data.reportHistory || []);
      } else {
        setErrorMsg(data.message || 'Could not refresh status');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error');
    } finally {
      setRefreshLoading(false);
    }
  };

  // Execute Punch Action
  const handlePunch = async () => {
    setPunching(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, workMode })
      });
      const data = await res.json();
      if (data.success) {
        setPunchStatus(data.newStatus);
        setSuccessMsg(data.message);
        setLastActionTime(data.timestamp);
        await refreshStatus();
      } else {
        setErrorMsg(data.message || 'Punch action failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error during punch.');
    } finally {
      setPunching(false);
    }
  };

  // Switch User / Return to Profile Box Screen
  const handleSwitchUser = () => {
    setIsLoggedIn(false);
    setShowAddForm(false);
    setUsername('');
    setPassword('');
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // Helper: Get avatar color from name
  const getAvatarGradient = (index: number) => {
    const gradients = [
      'from-blue-600 to-indigo-600 text-white shadow-blue-200',
      'from-emerald-600 to-teal-600 text-white shadow-emerald-200',
      'from-purple-600 to-pink-600 text-white shadow-purple-200',
      'from-amber-500 to-orange-600 text-white shadow-amber-200'
    ];
    return gradients[index % gradients.length];
  };

  // ----------------------------------------------------
  // VIEW 1: LOGIN & PROFILE SELECTION SCREEN
  // ----------------------------------------------------
  if (!isLoggedIn) {
    return (
      <main className="max-w-md mx-auto w-full p-4 min-h-screen flex flex-col justify-between">
        <div className="flex-1 flex flex-col justify-center py-4">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 mb-2.5 p-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Astrea Timesheet</h1>
            <p className="text-xs text-slate-500 mt-1">Tap your profile box to punch in immediately</p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl p-3 mb-4 flex items-start gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* SUB-VIEW 1A: KPI METRIC BOXES (Quick Profile Switcher) */}
          {!showAddForm ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Saved Profiles</span>
                <span className="text-[11px] text-slate-400 font-medium">{savedProfiles.length} available</span>
              </div>

              {/* Grid of Profile KPI Cards */}
              <div className="grid grid-cols-1 gap-2.5">
                {savedProfiles.map((p, idx) => {
                  const isCurrent = loggingInUser === p.username;
                  const initials = p.displayName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);

                  return (
                    <button
                      key={p.username}
                      type="button"
                      disabled={!!loggingInUser}
                      onClick={() => handleQuickLogin(p)}
                      className="group bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-blue-400 rounded-2xl p-4 shadow-sm hover:shadow active:scale-[0.98] transition-all text-left flex items-center justify-between relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatarGradient(idx)} flex items-center justify-center font-bold text-sm shadow-md shrink-0`}>
                          {isCurrent ? <RefreshCw className="w-4 h-4 animate-spin" /> : initials}
                        </div>

                        {/* Name and ID */}
                        <div>
                          <h2 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition">
                            {p.displayName}
                          </h2>
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ID: {p.username}
                          </p>
                        </div>
                      </div>

                      {/* Right action & delete button */}
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Remove from device"
                          onClick={(e) => handleRemoveProfile(e, p.username)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRemoveProfile(e as any, p.username); }}
                          className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Add New User Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(true);
                  setUsername('');
                  setPassword('');
                  setErrorMsg(null);
                }}
                className="w-full py-3.5 px-4 bg-slate-100 hover:bg-blue-50 border border-dashed border-slate-300 hover:border-blue-400 rounded-2xl text-xs font-bold text-slate-600 hover:text-blue-600 active:scale-98 transition flex items-center justify-center gap-2 mt-4"
              >
                <UserPlus className="w-4 h-4" />
                <span>New User? Login & Save Profile Here</span>
              </button>
            </div>
          ) : (
            /* SUB-VIEW 1B: ADD NEW USER FORM */
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  Add & Login New Employee
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  ← Back to Profiles
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Username / Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 202501"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualLogin(); }}
                    className="w-full text-base px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleManualLogin(); }}
                      className="w-full text-base px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition pr-10 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember User Checkbox */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={rememberUser}
                      onChange={(e) => setRememberUser(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block">Remember this profile</span>
                      <span className="text-[10px] text-slate-400 block">Creates a 1-tap quick card for next time</span>
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleManualLogin}
                  disabled={authLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-200 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {authLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing in & Saving...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In & Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center py-3 text-[11px] text-slate-400">
          Astrea Timesheet Portal &bull; Fast Profile Switcher
        </footer>
      </main>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: LOGGED-IN ATTENDANCE DASHBOARD
  // ----------------------------------------------------
  return (
    <main className="max-w-md mx-auto w-full p-4 min-h-screen flex flex-col justify-between">
      <div>
        {/* Header with Switch User */}
        <header className="flex items-center justify-between py-2 border-b border-slate-200 mb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-base font-bold text-slate-800">{userName}</h1>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-slate-400" />
              <span>ID: {username}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshStatus}
              disabled={refreshLoading || punching}
              aria-label="Refresh"
              className="p-2 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow active:scale-95 transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleSwitchUser}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow active:scale-95 transition flex items-center gap-1 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 mb-4 flex items-start gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Live Clock Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 mb-4 shadow-lg text-center relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400 tracking-wider uppercase mb-1 flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{selectedDate || 'Today'}</span>
          </div>
          <div className="text-4xl font-extrabold tracking-tight font-mono text-white mb-2">
            {currentTime || '00:00:00'}
          </div>
          <div className="inline-flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full text-xs text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Today's Tracked Time: <strong>{totalHours}</strong></span>
          </div>
        </div>

        {/* Punch Action Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center mb-4">
          {/* Status Badge */}
          <div className="mb-3">
            {punchStatus === 'completed' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                Today's Shift Completed
              </span>
            ) : punchStatus === 'in' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Currently Punched IN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Currently Punched OUT
              </span>
            )}
          </div>

          {/* Today's Punch Times Summary if recorded */}
          {(todayPunchIn || todayPunchOut) && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 mb-4 text-xs grid grid-cols-2 gap-2 text-left">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Punch In Time</span>
                <span className="font-mono font-bold text-slate-700">{todayPunchIn || '--:--'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Punch Out Time</span>
                <span className="font-mono font-bold text-slate-700">{todayPunchOut || '--:--'}</span>
              </div>
            </div>
          )}

          {/* Work Mode Toggle for Punch In */}
          {punchStatus === 'out' && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setWorkMode('office')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  workMode === 'office'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🏢 Work From Office
              </button>
              <button
                type="button"
                onClick={() => setWorkMode('home')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  workMode === 'home'
                    ? 'bg-purple-50 border-purple-400 text-purple-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🏠 Work From Home
              </button>
            </div>
          )}

          {/* Descriptive text */}
          <p className="text-xs text-slate-500 mb-5">
            {punchStatus === 'completed'
              ? 'You have finished both Punch In and Out for today. Salesforce permits one attendance cycle per day.'
              : punchStatus === 'in' 
              ? 'Tap below when you leave or take a break' 
              : `Tap below to punch in (${workMode === 'home' ? 'Work From Home' : 'Work From Office'})`}
          </p>

          {/* Main Action Button */}
          {punchStatus === 'completed' ? (
            <button
              type="button"
              disabled
              className="w-full py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span>Shift Completed for Today</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePunch}
              disabled={punching || refreshLoading}
              className={`w-full py-5 rounded-2xl text-lg font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 ${
                punchStatus === 'in'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
              } ${punching ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {punching ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span>Recording Punch...</span>
                </>
              ) : punchStatus === 'in' ? (
                <>
                  <LogOut className="w-6 h-6" />
                  <span>PUNCH OUT</span>
                </>
              ) : (
                <>
                  <LogIn className="w-6 h-6" />
                  <span>PUNCH IN</span>
                </>
              )}
            </button>
          )}

          {lastActionTime && (
            <p className="text-[11px] text-slate-400 mt-3">
              Last action recorded at {lastActionTime}
            </p>
          )}
        </div>

        {/* Live Attendance History from Salesforce */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>Official Attendance Records (Salesforce)</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showHistory && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              {reportHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">No records found</p>
              ) : (
                reportHistory.map((rec, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                      <span className="font-semibold text-slate-800">{rec.day}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">{rec.date}</span>
                    </div>
                    <div className="font-mono text-right text-[11px]">
                      <span className="text-emerald-600 font-semibold">{rec.inTime ? rec.inTime.substring(0, 8) : '--'}</span>
                      <span className="text-slate-300 mx-1">→</span>
                      <span className="text-slate-600">{rec.outTime ? rec.outTime.substring(0, 8) : '--'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Practice Questions Portal Link */}
        <a
          href="https://timesheetastrea-dev-ed.develop.my.salesforce-sites.com/Questions"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-400 hover:shadow transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Practice Questions Portal</div>
              <div className="text-[11px] text-slate-400">View interview topics & questions</div>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>

      {/* Footer */}
      <footer className="text-center py-3 text-[11px] text-slate-400">
        Astrea Timesheet Assistant &bull; Connected to Salesforce Sites
      </footer>
    </main>
  );
}
