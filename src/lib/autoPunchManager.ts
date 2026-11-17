import fs from 'fs';
import path from 'path';
import { executePunch } from './salesforce';

export interface ActiveShift {
  username: string;
  password?: string;
  employeeName: string;
  workMode: 'office' | 'home';
  punchInTime: string;
  shiftDate: string;
  registeredAt: string;
}

export interface AutoPunchRecord {
  id: string;
  username: string;
  employeeName: string;
  date: string;
  punchInTime: string;
  autoPunchOutTime: string;
  totalHours: string;
  acknowledged: boolean;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const ACTIVE_SHIFTS_FILE = path.join(DATA_DIR, 'active_shifts.json');
const AUTO_PUNCH_FILE = path.join(DATA_DIR, 'auto_punch_records.json');

function ensureDataFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ACTIVE_SHIFTS_FILE)) {
      fs.writeFileSync(ACTIVE_SHIFTS_FILE, '[]', 'utf8');
    }
    if (!fs.existsSync(AUTO_PUNCH_FILE)) {
      fs.writeFileSync(AUTO_PUNCH_FILE, '[]', 'utf8');
    }
  } catch (err) {
    console.error('[AutoPunch] Error ensuring data directory/files:', err);
  }
}

export function getActiveShifts(): ActiveShift[] {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(ACTIVE_SHIFTS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveActiveShifts(shifts: ActiveShift[]) {
  ensureDataFiles();
  try {
    fs.writeFileSync(ACTIVE_SHIFTS_FILE, JSON.stringify(shifts, null, 2), 'utf8');
  } catch (err) {
    console.error('[AutoPunch] Error saving active shifts:', err);
  }
}

export function getAutoPunchRecords(): AutoPunchRecord[] {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(AUTO_PUNCH_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveAutoPunchRecords(records: AutoPunchRecord[]) {
  ensureDataFiles();
  try {
    fs.writeFileSync(AUTO_PUNCH_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.error('[AutoPunch] Error saving auto punch records:', err);
  }
}

export function registerActiveShift(shift: ActiveShift) {
  if (!shift.username || !shift.punchInTime) return;
  const shifts = getActiveShifts();
  const index = shifts.findIndex(s => s.username === shift.username);
  if (index >= 0) {
    shifts[index] = {
      ...shifts[index],
      ...shift,
      password: shift.password || shifts[index].password
    };
  } else {
    shifts.push(shift);
  }
  saveActiveShifts(shifts);
}

export function unregisterActiveShift(username: string) {
  if (!username) return;
  const shifts = getActiveShifts().filter(s => s.username !== username);
  saveActiveShifts(shifts);
}

export function getPendingAutoPunchRecords(username: string): AutoPunchRecord[] {
  return getAutoPunchRecords().filter(r => r.username === username && !r.acknowledged);
}

export function recordAutoPunchEvent(record: Omit<AutoPunchRecord, 'id' | 'createdAt'>): AutoPunchRecord {
  const records = getAutoPunchRecords();
  const newRecord: AutoPunchRecord = {
    ...record,
    id: `auto_${Date.now()}_${record.username}`,
    createdAt: new Date().toISOString()
  };
  records.push(newRecord);
  saveAutoPunchRecords(records);
  return newRecord;
}

export function acknowledgeAutoPunchRecord(id: string, username: string) {
  const records = getAutoPunchRecords();
  for (const r of records) {
    if (r.id === id || (r.username === username && !r.acknowledged)) {
      r.acknowledged = true;
    }
  }
  saveAutoPunchRecords(records);
}

// Calculate elapsed minutes from punch in time
export function calculateElapsedMinutes(punchInStr: string, shiftDateStr?: string): number {
  if (!punchInStr) return 0;
  const clean = punchInStr.trim().replace(/Z$/i, '');
  const isPM = /PM/i.test(clean);
  const isAM = /AM/i.test(clean);
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;

  let inHour = parseInt(match[1], 10);
  const inMinute = parseInt(match[2], 10);
  const inSecond = match[3] ? parseInt(match[3], 10) : 0;

  if (isPM && inHour < 12) inHour += 12;
  if (isAM && inHour === 12) inHour = 0;

  const punchInDate = new Date();
  if (shiftDateStr) {
    const parts = shiftDateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        punchInDate.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        punchInDate.setFullYear(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }
  punchInDate.setHours(inHour, inMinute, inSecond, 0);

  const now = new Date();
  const diffMs = now.getTime() - punchInDate.getTime();
  if (diffMs < 0) return 0;

  return Math.floor(diffMs / (1000 * 60));
}

// Check all active shifts and auto punch out if >= 9 hours 30 minutes (570 minutes)
export async function checkAndAutoPunch() {
  const shifts = getActiveShifts();
  if (!shifts || shifts.length === 0) return;

  const AUTO_PUNCH_MINUTES = 570; // 9 hours + 30 minutes

  for (const shift of shifts) {
    if (!shift.password || !shift.punchInTime) continue;

    const elapsed = calculateElapsedMinutes(shift.punchInTime, shift.shiftDate);
    if (elapsed >= AUTO_PUNCH_MINUTES) {
      console.log(`[AutoPunch] User ${shift.username} reached ${elapsed} minutes (>= 570m). Executing auto punch out...`);
      try {
        const result = await executePunch(shift.username, shift.password, shift.workMode || 'office');
        if (result.success || result.newStatus === 'completed' || result.message.includes('already completed')) {
          const now = new Date();
          const d = String(now.getDate()).padStart(2, '0');
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const y = now.getFullYear();
          const dateFormatted = `${d}-${m}-${y}`;
          const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const totalHours = Math.floor(elapsed / 60);
          const totalMins = elapsed % 60;
          const totalTimeStr = `${totalHours}h ${totalMins}m`;

          recordAutoPunchEvent({
            username: shift.username,
            employeeName: shift.employeeName || shift.username,
            date: shift.shiftDate ? shift.shiftDate.replace(/\//g, '-') : dateFormatted,
            punchInTime: shift.punchInTime.replace(/Z$/i, '').split('.')[0],
            autoPunchOutTime: timeFormatted,
            totalHours: totalTimeStr,
            acknowledged: false
          });

          unregisterActiveShift(shift.username);
          console.log(`[AutoPunch] Auto punch out completed successfully for ${shift.username}`);
        } else {
          console.warn(`[AutoPunch] Punch out failed for ${shift.username}:`, result.message);
        }
      } catch (err) {
        console.error(`[AutoPunch] Error punching out ${shift.username}:`, err);
      }
    }
  }
}

declare global {
  var __autoPunchInterval: NodeJS.Timeout | undefined;
}

export function startAutoPunchScheduler() {
  if (globalThis.__autoPunchInterval) return;

  console.log('[AutoPunch] Starting auto punch background worker (60s check)...');
  checkAndAutoPunch().catch(console.error);

  globalThis.__autoPunchInterval = setInterval(() => {
    checkAndAutoPunch().catch(console.error);
  }, 60000);
}
