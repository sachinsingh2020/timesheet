import { NextResponse } from 'next/server';
import { loginAndGetStatus } from '@/lib/salesforce';
import { 
  startAutoPunchScheduler, 
  registerActiveShift, 
  unregisterActiveShift, 
  getPendingAutoPunchRecords,
  isPunchedInViaApp 
} from '@/lib/autoPunchManager';

export async function POST(request: Request) {
  try {
    startAutoPunchScheduler();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 });
    }

    const data = await loginAndGetStatus(username, password);

    // Only register/maintain auto punch if this user originally punched in through OUR app
    const isAppPunch = isPunchedInViaApp(username, data.selectedDate);

    if (data.success) {
      if (data.punchStatus === 'in') {
        if (isAppPunch) {
          registerActiveShift({
            username,
            password,
            employeeName: data.userName,
            workMode: 'office',
            punchInTime: data.todayPunchIn || '',
            shiftDate: data.selectedDate || '',
            punchedInViaApp: true,
            registeredAt: new Date().toISOString()
          });
        }
      } else {
        unregisterActiveShift(username);
      }
    }

    const pendingNotices = getPendingAutoPunchRecords(username);
    const autoPunchNotice = pendingNotices.length > 0 ? pendingNotices[0] : null;

    return NextResponse.json({
      success: data.success,
      userName: data.userName,
      punchStatus: data.punchStatus,
      buttonLabel: data.buttonLabel,
      selectedDate: data.selectedDate,
      totalHours: data.totalHours,
      todayPunchIn: data.todayPunchIn,
      todayPunchOut: data.todayPunchOut,
      reportHistory: data.reportHistory,
      punchedInViaApp: isAppPunch,
      autoPunchNotice,
      message: data.message
    });
  } catch (err: any) {
    console.error('Error checking status:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
