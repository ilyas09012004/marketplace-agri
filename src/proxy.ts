// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';
// import { rateLimit } from '@/lib/middleware'; // Pastikan path ini benar jika file rateLimit ada

// Fungsi rateLimit sederhana sebagai contoh (ganti dengan implementasi aslimu)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 5 * 60 * 1000; // 5 menit
const MAX_REQUESTS = 5;

function rateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier) || { count: 0, resetTime: now + WINDOW_MS };

  if (now > record.resetTime) {
    // Reset window
    record.count = 0;
    record.resetTime = now + WINDOW_MS;
  }

  if (record.count >= MAX_REQUESTS) {
    // Masih di window yang sama dan sudah melebihi batas
    return false;
  }

  record.count++;
  requestCounts.set(identifier, record);
  return true;
}

// Ganti nama fungsi dari 'middleware' ke 'proxy'
export function proxy(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';

  // Terapkan rate limiting hanya ke auth endpoints
  if (req.nextUrl.pathname.startsWith('/api/auth/login')) {
    if (!rateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Tambahkan header CORS dasar
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export const config = {
  matcher: ['/api/:path*','/api/cart/:path*'] // Apply to all API routes
};