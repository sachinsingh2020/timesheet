import { NextResponse } from 'next/server';
import { loginAndGetStatus } from '@/lib/salesforce';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 });
    }

    const data = await loginAndGetStatus(username, password);

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
      message: data.message
    });
  } catch (err: any) {
    console.error('Error checking status:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
