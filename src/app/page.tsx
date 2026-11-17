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
  AlertTriangle,
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
  ShieldCheck,
  Smartphone,
  Share,
  PlusSquare,
  Download,
  X,
  Bell,
  BellRing
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

interface AutoPunchNotice {
  id: string;
  username: string;
  employeeName: string;
  date: string;
  punchInTime: string;
  autoPunchOutTime: string;
  totalHours: string;
  acknowledged: boolean;
  createdAt?: string;
}

// Generate polite, natural English notice for auto punch out
function getAutoPunchDescription(record: AutoPunchNotice): string {
  const now = new Date();
  let recDate = new Date();
  if (record.createdAt) {
    const parsed = new Date(record.createdAt);
    if (!isNaN(parsed.getTime())) recDate = parsed;
  } else if (record.date) {
    const parts = record.date.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        recDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        recDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  const isToday = now.toDateString() === recDate.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === recDate.toDateString();

  const d = String(recDate.getDate()).padStart(2, '0');
  const m = String(recDate.getMonth() + 1).padStart(2, '0');
  const y = recDate.getFullYear();
  const formattedDate = `${d}-${m}-${y}`;

  if (isToday) {
    return `You completed your 9-hour shift today but didn't punch out within the 30-minute grace window. We automatically punched you out on your behalf at ${record.autoPunchOutTime}. Your total logged time for today is ${record.totalHours}.`;
  }
  if (isYesterday) {
    return `You completed your 9-hour shift yesterday but forgot to punch out within the 30-minute grace window. We automatically punched you out on your behalf at ${record.autoPunchOutTime}. Your total logged time was ${record.totalHours}.`;
  }
  return `On ${formattedDate}, you forgot to punch out after completing your 9-hour shift. We automatically punched you out for you at ${record.autoPunchOutTime}. On that day, your total tracked time was ${record.totalHours}.`;
}

// Format time string (e.g., "09:35:37.565Z" or "06:35:40") to 12-hour AM/PM format ("9:35 AM", "6:35 PM")
function formatTime12Hour(timeStr?: string | null, isOutTime?: boolean): string {
  if (!timeStr || timeStr === '--' || timeStr.trim() === '') return '--';
  const clean = timeStr.trim().replace(/Z$/i, '');
  if (/AM|PM/i.test(clean)) return clean;

  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];

  let period = 'AM';
  if (hours >= 12) {
    period = 'PM';
    if (hours > 12) hours -= 12;
  } else if (hours === 0) {
    hours = 12;
    period = 'AM';
  } else {
    // If hours is between 1 and 8 for punch out time, it is PM (e.g. 1:00 PM to 8:59 PM)
    if (isOutTime && hours < 9) {
      period = 'PM';
    } else {
      period = 'AM';
    }
  }

  return `${hours}:${minutes} ${period}`;
}

// Format raw punch time without AM/PM (e.g. "09:35:37")
function formatRawTime(timeStr?: string | null): string {
  if (!timeStr || timeStr === '--' || timeStr.trim() === '') return '--:--';
  return timeStr.trim().replace(/Z$/i, '').split('.')[0];
}

// Calculate elapsed worked hours and remaining time for a 9-hour shift
function getWorkedTime(punchInStr: string | null, totalHoursStr?: string) {
  if (!punchInStr) {
    if (totalHoursStr && totalHoursStr.includes(':')) {
      const [thH, thM] = totalHoursStr.split(':').map(Number);
      if (!isNaN(thH) && !isNaN(thM)) {
        const totalMinutes = thH * 60 + thM;
        const totalHoursDecimal = totalMinutes / 60;
        const remainingMinutesTotal = Math.max(0, 9 * 60 - totalMinutes);
        return {
          hours: thH,
          minutes: thM,
          totalHoursDecimal,
          hasCompleted9Hours: totalHoursDecimal >= 9,
          remainingHours: Math.floor(remainingMinutesTotal / 60),
          remainingMinutes: remainingMinutesTotal % 60
        };
      }
    }
    return {
      hours: 0,
      minutes: 0,
      totalHoursDecimal: 0,
      hasCompleted9Hours: false,
      remainingHours: 9,
      remainingMinutes: 0
    };
  }

  const clean = punchInStr.trim().replace(/Z$/i, '');
  const isPM = /PM/i.test(clean);
  const isAM = /AM/i.test(clean);
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return {
      hours: 0,
      minutes: 0,
      totalHoursDecimal: 0,
      hasCompleted9Hours: false,
      remainingHours: 9,
      remainingMinutes: 0
    };
  }

  let inHour = parseInt(match[1], 10);
  const inMinute = parseInt(match[2], 10);
  const inSecond = match[3] ? parseInt(match[3], 10) : 0;

  if (isPM && inHour < 12) inHour += 12;
  if (isAM && inHour === 12) inHour = 0;

  const now = new Date();
  const punchInDate = new Date();
  punchInDate.setHours(inHour, inMinute, inSecond, 0);

  let diffMs = now.getTime() - punchInDate.getTime();
  if (diffMs < 0) diffMs = 0;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const totalHoursDecimal = diffMs / (1000 * 60 * 60);
  const remainingMinutesTotal = Math.max(0, 9 * 60 - totalMinutes);

  return {
    hours,
    minutes,
    totalHoursDecimal: Number(totalHoursDecimal.toFixed(2)),
    hasCompleted9Hours: totalHoursDecimal >= 9,
    remainingHours: Math.floor(remainingMinutesTotal / 60),
    remainingMinutes: remainingMinutesTotal % 60
  };
}

export default function Home() {
  // Profiles in localStorage
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [showAddForm, setShowAddForm] = useState(true);

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
  const [showEarlyPunchModal, setShowEarlyPunchModal] = useState(false);

  // PWA / Add to Home Screen State
  const [isInstalled, setIsInstalled] = useState(true); // Default true until verified on client
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [dismissedInSession, setDismissedInSession] = useState(false);

  // Notification & Auto Punch State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [autoPunchNotice, setAutoPunchNotice] = useState<AutoPunchNotice | null>(null);
  const [punchedInViaApp, setPunchedInViaApp] = useState(false);

  // Load profiles from localStorage on mount (no default accounts)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('astrea_saved_profiles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedProfiles(parsed);
          setShowAddForm(false);
          return;
        }
      }
      setSavedProfiles([]);
      setShowAddForm(true);
    } catch {
      setSavedProfiles([]);
      setShowAddForm(true);
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

  // Detect if app is already running in standalone (added to home screen) or installed
  useEffect(() => {
    const checkStandalone = () => {
      if (typeof window === 'undefined') return true;

      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');

      const storedInstalled = localStorage.getItem('astrea_pwa_installed') === 'true';

      if (isStandalone || storedInstalled) {
        setIsInstalled(true);
        return true;
      }
      setIsInstalled(false);
      return false;
    };

    if (checkStandalone()) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem('astrea_pwa_installed', 'true');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem('astrea_pwa_installed', 'true');
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  // Handle Add to Home Screen Click
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('astrea_pwa_installed', 'true');
      }
      setDeferredPrompt(null);
      return;
    }
    // If no native prompt is available (e.g. iOS Safari), show the visual guide
    setShowInstallModal(true);
  };

  // Service Worker and Notification Setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      }
    }
  }, []);

  // Show browser notification via Service Worker (fallback to native Notification)
  const showNotification = async (title: string, options: NotificationOptions) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      }
      new Notification(title, options);
    } catch {
      try {
        new Notification(title, options);
      } catch (e) {
        console.error('Notification error:', e);
      }
    }
  };

  // Request Notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showNotification('Shift Reminders Active 🔔', {
          body: 'We will notify you 5 minutes after your 9-hour shift and auto-punch out after 30 minutes.',
          icon: '/icon.svg',
          badge: '/icon.svg'
        });
      }
    } catch (err) {
      console.error('Permission error:', err);
    }
  };

  // Acknowledge Auto Punch Out Notice
  const handleAcknowledgeAutoPunch = async () => {
    if (!autoPunchNotice) return;
    const noticeId = autoPunchNotice.id;
    setAutoPunchNotice(null);
    try {
      await fetch('/api/acknowledge-auto-punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noticeId, username })
      });
    } catch (e) {
      console.error('Error acknowledging auto-punch:', e);
    }
  };

  // Quick 1-Tap Login from a Profile Box
  const handleQuickLogin = async (profile: SavedProfile) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission();
    }
    setLoggingInUser(profile.username);
    setUsername(profile.username);
    setPassword(profile.password);
    await performLoginRequest(profile.username, profile.password, false);
    setLoggingInUser(null);
  };

  // Login from manual form
  const handleManualLogin = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission();
    }
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
        if (data.autoPunchNotice) {
          setAutoPunchNotice(data.autoPunchNotice);
        }

        const dateKey = (data.selectedDate || new Date().toISOString().split('T')[0]).replace(/[\/\-\.]/g, '');
        const clientAppPunch = localStorage.getItem(`astrea_app_punch_${userToAuth}_${dateKey}`) === 'true';
        setPunchedInViaApp(!!(data.punchedInViaApp || clientAppPunch));

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
    if (updated.length === 0) {
      setShowAddForm(true);
    }
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
        if (data.autoPunchNotice) {
          setAutoPunchNotice(data.autoPunchNotice);
        }

        const dateKey = (data.selectedDate || new Date().toISOString().split('T')[0]).replace(/[\/\-\.]/g, '');
        const clientAppPunch = localStorage.getItem(`astrea_app_punch_${username}_${dateKey}`) === 'true';
        setPunchedInViaApp(!!(data.punchedInViaApp || clientAppPunch));
      } else {
        setErrorMsg(data.message || 'Could not refresh status');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error');
    } finally {
      setRefreshLoading(false);
    }
  };

  // Shift progress monitor for 5-min reminder and 30-min auto-punch out
  useEffect(() => {
    // Only auto-punch out and remind if user specifically punched in via this app today
    if (!isLoggedIn || punchStatus !== 'in' || !todayPunchIn || !punchedInViaApp) return;

    const checkInterval = setInterval(() => {
      const worked = getWorkedTime(todayPunchIn, totalHours);
      const elapsedMinutes = worked.hours * 60 + worked.minutes;
      const todayDateKey = `${selectedDate || new Date().toISOString().split('T')[0]}_${username}`;

      // 1. 5 minutes past 9 hours (545 minutes = 9h 05m): Send reminder notification
      if (elapsedMinutes >= 545 && elapsedMinutes < 570) {
        const reminderSent = localStorage.getItem(`astrea_reminder_sent_${todayDateKey}`);
        if (!reminderSent) {
          localStorage.setItem(`astrea_reminder_sent_${todayDateKey}`, 'true');
          showNotification('Punch Out Reminder ⏰', {
            body: 'Your standard 9-hour shift ended 5 minutes ago. Please punch out now, or your shift will be automatically punched out in 25 minutes.',
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: 'punch-out-reminder'
          });
        }
      }

      // 2. 30 minutes past 9 hours (570 minutes = 9h 30m): Auto punch out
      if (elapsedMinutes >= 570 && !punching) {
        const autoDone = localStorage.getItem(`astrea_autopunch_triggered_${todayDateKey}`);
        if (!autoDone) {
          localStorage.setItem(`astrea_autopunch_triggered_${todayDateKey}`, 'true');

          handlePunch().then(() => {
            showNotification('Shift Auto-Punched Out ✅', {
              body: 'You have been automatically punched out after 9h 30m. Total time logged: 9h 30m.',
              icon: '/icon.svg',
              badge: '/icon.svg',
              tag: 'auto-punch-out'
            });

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const totalHoursStr = `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`;

            setAutoPunchNotice({
              id: `client_auto_${Date.now()}`,
              username,
              employeeName: userName || username,
              date: selectedDate ? selectedDate.replace(/\//g, '-') : 'Today',
              punchInTime: formatRawTime(todayPunchIn),
              autoPunchOutTime: timeStr,
              totalHours: totalHoursStr,
              acknowledged: false,
              createdAt: now.toISOString()
            });
          });
        }
      }
    }, 15000);

    return () => clearInterval(checkInterval);
  }, [isLoggedIn, punchStatus, todayPunchIn, totalHours, selectedDate, username, userName, punching, punchedInViaApp]);

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
        const dateKey = (selectedDate || new Date().toISOString().split('T')[0]).replace(/[\/\-\.]/g, '');
        if (data.newStatus === 'in') {
          setPunchedInViaApp(true);
          localStorage.setItem(`astrea_app_punch_${username}_${dateKey}`, 'true');
        } else {
          setPunchedInViaApp(false);
          localStorage.removeItem(`astrea_app_punch_${username}_${dateKey}`);
        }
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

  // Intercept punch out click: Check if user has completed 9 hours
  const handlePunchClick = () => {
    if (punchStatus === 'in') {
      const worked = getWorkedTime(todayPunchIn, totalHours);
      if (!worked.hasCompleted9Hours) {
        setShowEarlyPunchModal(true);
        return;
      }
    }
    handlePunch();
  };

  // Confirm punch out from warning modal
  const confirmEarlyPunchOut = () => {
    setShowEarlyPunchModal(false);
    handlePunch();
  };

  // Switch User / Return to Profile Box Screen
  const handleSwitchUser = () => {
    setIsLoggedIn(false);
    setShowAddForm(savedProfiles.length === 0);
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

          {/* Notification Permission Card (Login Screen) */}
          {typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'default' && !notificationDismissed && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-3 mb-4 shadow-sm flex items-center justify-between gap-3 text-xs text-left animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block text-xs">Allow Push Notifications?</span>
                  <span className="text-[11px] text-slate-500 block">Get reminded at 9h 5m & auto-punchout alerts</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-blue-200 active:scale-95 transition"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationDismissed(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

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
                {savedProfiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    ← Back to Profiles
                  </button>
                )}
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

        {/* Floating "Add to Home Screen" Corner Button */}
        {!isInstalled && !dismissedInSession && (
          <div className="fixed bottom-4 right-4 z-40 flex items-center shadow-lg shadow-blue-900/10 rounded-full bg-slate-900/95 border border-slate-700/80 p-1 text-white backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:text-blue-400 active:scale-95 transition"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Add to Home Screen</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissedInSession(true)}
              aria-label="Close"
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition mr-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Add to Home Screen Instructions Modal */}
        {showInstallModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-sm">
                <Smartphone className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-1">Add to Home Screen</h3>
              <p className="text-xs text-slate-500 mb-5">
                Install Astrea Timesheet on your phone for fast, 1-tap access like a native mobile app.
              </p>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-left space-y-3 mb-5">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-slate-600">
                    Tap the <strong className="text-slate-800">Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" /> in Safari, or browser menu <strong className="text-slate-800">(⋮)</strong> in Chrome.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-slate-600">
                    Scroll down and tap <strong className="text-slate-800">"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" /> or <strong className="text-slate-800">"Install app"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-slate-600">
                    Tap <strong className="text-slate-800">"Add"</strong> in the top right corner. Done!
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 active:scale-95 transition"
                >
                  Got It
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsInstalled(true);
                    localStorage.setItem('astrea_pwa_installed', 'true');
                    setShowInstallModal(false);
                  }}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                >
                  I have already added it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Automatic Punch Out Notice Modal */}
        {autoPunchNotice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 shadow-sm">
                <Clock className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-1.5">Automatic Punch Out Notice</h3>
              <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed text-left">
                {getAutoPunchDescription(autoPunchNotice)}
              </p>

              {/* Details summary */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-xs text-left space-y-2">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Shift Date:</span>
                  <span className="font-mono font-bold text-slate-700">{autoPunchNotice.date}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Punch In Time:</span>
                  <span className="font-mono font-bold text-slate-700">{formatRawTime(autoPunchNotice.punchInTime)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Auto Punch Out Time:</span>
                  <span className="font-mono font-bold text-rose-600">{autoPunchNotice.autoPunchOutTime}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 border-t border-slate-200/60 pt-1.5">
                  <span>Total Time Recorded:</span>
                  <span className="font-mono font-bold text-emerald-600">{autoPunchNotice.totalHours}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAcknowledgeAutoPunch}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 active:scale-95 transition"
              >
                Got it, thank you!
              </button>
            </div>
          </div>
        )}
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

        {/* Notification Permission Card (Dashboard Screen) */}
        {typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'default' && !notificationDismissed && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-3 mb-4 shadow-sm flex items-center justify-between gap-3 text-xs text-left animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block text-xs">Allow Push Notifications?</span>
                <span className="text-[11px] text-slate-500 block">Get reminded at 9h 5m & auto-punchout alerts</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-blue-200 active:scale-95 transition"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => setNotificationDismissed(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
              <div className="flex flex-col items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Currently Punched IN
                </span>
                {punchedInViaApp ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Punched in via this App (Auto punch-out active)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Punched in via Official Portal (Auto punch-out disabled)
                  </span>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Currently Punched OUT
              </span>
            )}
          </div>

          {/* Notification Permission Prompt & Active Indicator */}
          {punchStatus === 'in' && punchedInViaApp && notificationPermission === 'default' && (
            <div className="bg-blue-50 border border-blue-200/90 rounded-2xl p-3 mb-4 flex items-center justify-between gap-3 text-xs text-left">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">Enable Punch Reminders</span>
                  <span className="text-[11px] text-slate-500 block">Alerts 5m after 9h shift & auto punch-out in 30m</span>
                </div>
              </div>
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition shrink-0"
              >
                Enable
              </button>
            </div>
          )}

          {punchStatus === 'in' && punchedInViaApp && notificationPermission === 'granted' && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-emerald-600 mb-3">
              <BellRing className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Shift reminders active (auto-punchout enabled)</span>
            </div>
          )}

          {/* Today's Punch Times Summary if recorded */}
          {(todayPunchIn || todayPunchOut) && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 mb-4 text-xs grid grid-cols-2 gap-2 text-left">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Punch In Time</span>
                <span className="font-mono font-bold text-slate-700">{formatRawTime(todayPunchIn)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Punch Out Time</span>
                <span className="font-mono font-bold text-slate-700">{formatRawTime(todayPunchOut)}</span>
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
              onClick={handlePunchClick}
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
                      <span className="text-emerald-600 font-semibold">{formatTime12Hour(rec.inTime, false)}</span>
                      <span className="text-slate-300 mx-1">→</span>
                      <span className="text-slate-600">{formatTime12Hour(rec.outTime, true)}</span>
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

      {/* Early Punch Out Confirmation Modal */}
      {showEarlyPunchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 shadow-sm">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1.5">Early Punch Out</h3>
            <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed">
              You have not completed 9 hours yet, are you sure you want to punch out?
            </p>

            {/* Time progress summary */}
            {(() => {
              const worked = getWorkedTime(todayPunchIn, totalHours);
              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-xs text-left space-y-2">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Punch In Time:</span>
                    <span className="font-mono font-bold text-slate-700">{formatRawTime(todayPunchIn)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Time Worked:</span>
                    <span className="font-mono font-bold text-amber-600">{worked.hours}h {worked.minutes}m</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 border-t border-slate-200/60 pt-1.5">
                    <span>Remaining for 9 Hours:</span>
                    <span className="font-mono font-bold text-slate-700">{worked.remainingHours}h {worked.remainingMinutes}m</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <button
                type="button"
                onClick={confirmEarlyPunchOut}
                disabled={punching}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-200 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Yes, Punch Out</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEarlyPunchModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold active:scale-95 transition"
              >
                Cancel (Stay Punched In)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating "Add to Home Screen" Corner Button */}
      {!isInstalled && !dismissedInSession && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center shadow-lg shadow-blue-900/10 rounded-full bg-slate-900/95 border border-slate-700/80 p-1 text-white backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:text-blue-400 active:scale-95 transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Add to Home Screen</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissedInSession(true)}
            aria-label="Close"
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition mr-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add to Home Screen Instructions Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-sm">
              <Smartphone className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">Add to Home Screen</h3>
            <p className="text-xs text-slate-500 mb-5">
              Install Astrea Timesheet on your phone for fast, 1-tap access like a native mobile app.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-left space-y-3 mb-5">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-slate-600">
                  Tap the <strong className="text-slate-800">Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" /> in Safari, or browser menu <strong className="text-slate-800">(⋮)</strong> in Chrome.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-slate-600">
                  Scroll down and tap <strong className="text-slate-800">"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" /> or <strong className="text-slate-800">"Install app"</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-slate-600">
                  Tap <strong className="text-slate-800">"Add"</strong> in the top right corner. Done!
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 active:scale-95 transition"
              >
                Got It
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsInstalled(true);
                  localStorage.setItem('astrea_pwa_installed', 'true');
                  setShowInstallModal(false);
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-medium"
              >
                I have already added it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Punch Out Notice Modal */}
      {autoPunchNotice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 shadow-sm">
              <Clock className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1.5">Automatic Punch Out Notice</h3>
            <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed text-left">
              {getAutoPunchDescription(autoPunchNotice)}
            </p>

            {/* Details summary */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-xs text-left space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span>Shift Date:</span>
                <span className="font-mono font-bold text-slate-700">{autoPunchNotice.date}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Punch In Time:</span>
                <span className="font-mono font-bold text-slate-700">{formatRawTime(autoPunchNotice.punchInTime)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Auto Punch Out Time:</span>
                <span className="font-mono font-bold text-rose-600">{autoPunchNotice.autoPunchOutTime}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 border-t border-slate-200/60 pt-1.5">
                <span>Total Time Recorded:</span>
                <span className="font-mono font-bold text-emerald-600">{autoPunchNotice.totalHours}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAcknowledgeAutoPunch}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 active:scale-95 transition"
            >
              Got it, thank you!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
