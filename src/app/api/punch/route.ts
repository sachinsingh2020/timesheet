import { NextResponse } from 'next/server';
import { executePunch } from '@/lib/salesforce';
import { unregisterActiveShift } from '@/lib/autoPunchManager';

export async function POST(request: Request) {
  try {
    const { username, password, workMode } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 });
    }

    const result = await executePunch(username, password, workMode || 'office');

    if (result.success && result.newStatus !== 'in') {
      unregisterActiveShift(username);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error executing punch:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
