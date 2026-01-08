import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Ambil data provinces dari database lokal
    const [rows] = await pool.execute(
      'SELECT id, name FROM provinces ORDER BY name ASC'
    );

    return NextResponse.json({
      success: true,
       data:Array.isArray(rows) ? rows : []
    });

  } catch (error: any) {
    console.error('Error fetching provinces from local DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch provinces' },
      { status: 500 }
    );
  }
}