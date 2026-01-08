import { NextRequest, NextResponse } from 'next/server';
// ✅ Ganti import ke file yang benar tempat verifyAccessToken berada
import { verifyAccessToken } from '@/lib/jwt'; // Atau sesuaikan jika berbeda

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (
  ip: string,
  windowMs = 5000, // 5 detik
  maxRequests = 5
): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false; // Blocked
  }

  rateLimitMap.set(ip, { count: record.count + 1 });
  return true;
};

// Auth middleware untuk API routes
export const requireAuth = (token: string | undefined) => {
  if (!token) return null;
  try {
    // ✅ Gunakan fungsi verifyAccessToken dari file yang benar
    const decoded = verifyAccessToken(token); // → { sub: string, role: string }
    return decoded; // Kembalikan seluruh payload
  } catch {
    return null;
  }
};

// Error handler middleware
export const handleAPIError = (error: any, context: string = 'API') => {
  console.error(`[${context}] Error:`, error);

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { success: false, error: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  if (error.message?.includes('Insufficient stock')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 400 }
    );
  }

  if (error.message?.includes('not found')) {
    return NextResponse.json(
      { success: false, error: 'NOT_FOUND'},
      { status: 404 }
    );
  }

  // Tambahkan pengecekan untuk error lain yang sering muncul
  if (error.message?.includes('Product not found or deleted')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 404 }
    );
  }

  if (error.message?.includes('Product is currently sold out')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 400 }
    );
  }

  if (error.message?.includes('Quantity must be at least')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 400 }
    );
  }

  if (error.message?.includes('Product not found in cart')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 404 }
    );
  }

  if (error.message?.includes('Product is currently unavailable')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 400 }
    );
  }

  if (error.message?.includes('Unauthorized')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 401 }
    );
  }

  if (error.message?.includes('Invalid token')) {
    return NextResponse.json(
      { success: false, error: error.message},
      { status: 401 }
    );
  }

  // Error default
  return NextResponse.json(
    { success: false, error: 'INTERNAL_ERROR'},
    { status: 500 }
  );
};

// Middleware untuk proteksi route dengan auth dan rate limit
export const withAuthAndRateLimit = (handler: Function) => {
  return async (req: NextRequest, { params }: { params?: any }) => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';

    // 1. Rate Limit
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // 2. Auth Check
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const user = requireAuth(token);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED'},
        { status: 401 }
      );
    }

    // 3. Panggil handler dengan user context
    try {
      // ✅ Kirim user sebagai bagian dari context ke handler
      return await handler(req, { params, user });
    } catch (error) {
      return handleAPIError(error, 'CART_API');
    }
  };
};