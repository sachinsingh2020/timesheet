import { NextResponse } from 'next/server';
import { acknowledgeAutoPunchRecord } from '@/lib/autoPunchManager';

export async function POST(request: Request) {
  try {
    const { id, username } = await request.json();

    if (!username) {
      return NextResponse.json({ success: false, message: 'Username required' }, { status: 400 });
    }

    acknowledgeAutoPunchRecord(id || '', username);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error acknowledging auto punch:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
