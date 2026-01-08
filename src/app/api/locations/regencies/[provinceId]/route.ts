import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware'; // Import middleware kamu

// Definisikan tipe untuk params
type Params = {
  params: Promise<{ // Tambahkan Promise di sini
    provinceId: string; // URL parameter selalu string
  }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    // ✅ Gunakan await untuk membuka Promise params
    const { provinceId } = await params;

    // Validasi apakah provinceId ada dan bukan string kosong
    if (!provinceId || typeof provinceId !== 'string' || provinceId.trim() === '') {
      throw new Error('provinceId is required and must be a non-empty string');
    }

    // Ambil data regencies berdasarkan provinceId dari database lokal
    // Gunakan provinceId.toString() untuk memastikan tipe yang benar di query
    const [rows] = await pool.execute(
      'SELECT id, name FROM regencies WHERE provinceId = ? ORDER BY name ASC',
      [provinceId.toString()] // ✅ Gunakan ProvinceId
    );

    return NextResponse.json({
      success: true,
        data: Array.isArray(rows) ? rows : []
    });

  } catch (error: any) {
    console.error('Error fetching regencies from local DB:', error);
    return handleAPIError(error, 'GET /api/locations/regencies/[provinceId]');
  }
}

// ✅ POST: Tambah regency baru ke provinsi tertentu
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { provinceId } = await params;

    if (!provinceId || typeof provinceId !== 'string' || provinceId.trim() === '') {
      throw new Error('provinceId is required and must be a non-empty string');
    }

    const { name } = await request.json();

    if (!name) {
      throw new Error('Regency name is required');
    }

    // Cek apakah regency dengan nama dan province_id sudah ada
    const [existingRows] = await pool.execute(
      'SELECT id FROM regencies WHERE name = ? AND province_id = ?',
      [name, provinceId]
    );

    if ((existingRows as any[]).length > 0) {
      throw new Error('Regency with this name already exists in the specified province.');
    }

    const [result] = await pool.execute(
      'INSERT INTO regencies (name, province_id) VALUES (?, ?)',
      [name, provinceId]
    );

    const newId = (result as any).insertId;

    // Ambil data regency yang baru saja dibuat
    const [newRegencyRows] = await pool.execute(
      'SELECT id, name FROM regencies WHERE id = ?',
      [newId]
    );

    const newRegency = (newRegencyRows as any[])[0];

    return NextResponse.json({
      success: true,
      message: 'Regency created successfully',
      data: newRegency
    });

  } catch (error: any) {
    console.error('Error creating regency:', error);
    return handleAPIError(error, 'POST /api/locations/regencies/[provinceId]');
  }
}

// ✅ PUT: Ganti SELURUH data regency berdasarkan ID (jika kamu memiliki endpoint untuk ID regency)
// Karena endpoint ini untuk [provinceId], kita asumsikan kamu tidak akan mengganti regency tertentu di sini.
// Tapi jika kamu ingin mengganti semua regency milik provinsi ini, bisa dibuat.
// Contoh: Ganti semua nama regency milik provinsi ini (tidak umum, tapi mungkin).
// Kita abaikan PUT untuk kasus ini.

// ✅ PATCH: Update SEBAGIAN data regency berdasarkan ID (jika kamu memiliki endpoint untuk ID regency)
// Sama seperti PUT, endpoint ini untuk [provinceId], bukan ID regency spesifik.
// Kita abaikan PATCH untuk kasus ini.

// ✅ DELETE: Hapus semua regency milik provinsi tertentu (tidak umum)
// Kita tidak akan menghapus semua regency milik provinsi karena bisa merusak data.
// Jika kamu ingin hapus regency spesifik, kamu butuh endpoint seperti /api/locations/regencies/[regencyId]
// Kita abaikan DELETE untuk kasus ini.

// Jika kamu ingin CRUD untuk regency INDIVIDUAL, buat endpoint baru di [regencyId]