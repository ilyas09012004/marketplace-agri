import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/jwt';
import crypto from 'crypto';
import { serialize } from 'cookie';
import pool from '@/lib/db';
import { generateTokens } from '@/lib/jwt';
import { getDeviceType } from '@/lib/device.util';

const getBrowser = (ua: string): string => {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
};

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role = 'buyer' } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'buyer', 'seller'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    console.log(`[REGISTER] Attempting registration for email: ${email}`);

    // ✅ Ganti 'user' menjadi 'users'
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as [any[], any];

    if (existingUsers.length > 0) {
      console.log(`[REGISTER] Email already exists: ${email}`);
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // ✅ Ganti 'user' menjadi 'users'
    const insertResult = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    ) as any;

    const newUserId = insertResult.insertId;

    const { accessToken, refreshToken } = generateTokens(String(newUserId), role);
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : realIp || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);
    const browser = getBrowser(userAgent);

    await pool.execute(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, device_type, browser, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [newUserId, refreshTokenHash, ip, userAgent, deviceType, browser]
    );

    console.log(`[REGISTER] Successfully registered user: ${newUserId}`);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    };

    const headers = new Headers();
    headers.set('Set-Cookie', serialize('refreshToken', refreshToken, cookieOptions));
    headers.append('Set-Cookie', serialize('accessToken', accessToken, { ...cookieOptions, httpOnly: false }));

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        user: { id: String(newUserId), name, email, role }
      },
      { status: 201, headers }
    );

  } catch (err: any) {
    console.error('🔐 Registration error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return NextResponse.json(
      { success: false, error: 'Registration service unavailable' },
      { status: 500 }
    );
  }
}