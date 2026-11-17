import { NextResponse } from 'next/server';
import { executePunch } from '@/lib/salesforce';
import { registerActiveShift, unregisterActiveShift } from '@/lib/autoPunchManager';

export async function POST(request: Request) {
  try {
    const { username, password, workMode } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 });
    }

    const result = await executePunch(username, password, workMode || 'office');

    if (result.success) {
      if (result.newStatus === 'in') {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const shiftDate = `${d}/${m}/${y}`;
        const punchInTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Mark that this user punched in specifically through OUR application today
        registerActiveShift({
          username,
          password,
          employeeName: username,
          workMode: workMode || 'office',
          punchInTime: result.timestamp || punchInTime,
          shiftDate,
          punchedInViaApp: true,
          registeredAt: now.toISOString()
        });
      } else {
        unregisterActiveShift(username);
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error executing punch:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
