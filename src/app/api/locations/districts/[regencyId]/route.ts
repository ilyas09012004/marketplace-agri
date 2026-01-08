import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware'; // Import middleware kamu

// Definisikan tipe untuk params
type Params = {
  params: Promise<{ // Tambahkan Promise di sini
    regencyId: string; // URL parameter selalu string
  }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    // ✅ Gunakan await untuk membuka Promise params
    const { regencyId } = await params;

    // Validasi apakah regencyId ada dan bukan string kosong
    if (!regencyId || typeof regencyId !== 'string' || regencyId.trim() === '') {
      throw new Error('regencyId is required and must be a non-empty string');
    }

    // Ambil data dis berdasarkan regencyId dari database lokal
    // Gunakan regencyId.toString() untuk memastikan tipe yang benar di query
    const [rows] = await pool.execute(
      'SELECT id, name FROM districts WHERE regency_id = ? ORDER BY name ASC',
      [regencyId.toString()]
    );

    return NextResponse.json({
      success: true,
        data: Array.isArray(rows) ? rows : []
    });

  } catch (error: any) {
    console.error('Error fetching dis from local DB:', error);
    return handleAPIError(error, 'GET /api/locations/districts/[regencyId]');
  }
}

// ✅ POST: Tambah district baru
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { regencyId } = await params;

    if (!regencyId || typeof regencyId !== 'string' || regencyId.trim() === '') {
      throw new Error('regencyId is required and must be a non-empty string');
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      throw new Error('District name is required');
    }

    // Cek apakah regency_id valid
    const [regencyCheck] = await pool.execute(
      'SELECT id FROM regencies WHERE id = ?',
      [regencyId]
    );

    if ((regencyCheck as any[]).length === 0) {
      throw new Error('Regency not found');
    }

    const [result] = await pool.execute(
      'INSERT INTO districts (regency_id, name) VALUES (?, ?)',
      [regencyId, name]
    );

    return NextResponse.json({
      success: true,
      message: 'District created successfully',
      id: (result as any).insertId
    });

  } catch (error: any) {
    console.error('Error creating district:', error);
    return handleAPIError(error, 'POST /api/locations/districts/[regencyId]');
  }
}
