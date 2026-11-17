import { NextResponse } from 'next/server';
import { loginAndGetStatus } from '@/lib/salesforce';
import { 
  startAutoPunchScheduler, 
  registerActiveShift, 
  unregisterActiveShift, 
  getPendingAutoPunchRecords 
} from '@/lib/autoPunchManager';

export async function POST(request: Request) {
  try {
    startAutoPunchScheduler();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 });
    }

    const data = await loginAndGetStatus(username, password);

    if (data.success) {
      if (data.punchStatus === 'in') {
        registerActiveShift({
          username,
          password,
          employeeName: data.userName,
          workMode: 'office',
          punchInTime: data.todayPunchIn || '',
          shiftDate: data.selectedDate || '',
          registeredAt: new Date().toISOString()
        });
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
      autoPunchNotice,
      message: data.message
    });
  } catch (err: any) {
    console.error('Error checking status:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
