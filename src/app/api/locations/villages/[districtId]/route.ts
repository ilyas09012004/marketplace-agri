import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware'; // Import middleware kamu

// Definisikan tipe untuk params
type Params = {
  params: Promise<{ // Tambahkan Promise di sini
    districtId: string; // URL parameter selalu string
  }>;
};

// Definisikan tipe payload untuk POST (sesuaikan dengan kebutuhan kamu)
interface PostPayload {
  name: string;
  district_id: string;
  // tambahkan field lain jika perlu
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    // ✅ Gunakan await untuk membuka Promise params
    const { districtId } = await params;

    // Validasi apakah districtId ada dan bukan string kosong
    if (!districtId || typeof districtId !== 'string' || districtId.trim() === '') {
      throw new Error('districtId is required and must be a non-empty string');
    }

    // Ambil data villages berdasarkan districtId dari database lokal
    // Gunakan districtId.toString() untuk memastikan tipe yang benar di query
    const [rows] = await pool.execute(
      'SELECT id, name FROM villages WHERE district_id = ? ORDER BY name ASC',
      [districtId.toString()]
    );

    return NextResponse.json({
      success: true,
        data: Array.isArray(rows) ? rows : []
    });

  } catch (error: any) {
    console.error('Error fetching villages from local DB:', error);
    return handleAPIError(error, 'GET /api/locations/villages/[districtId]');
  }
}

// ✅ POST: Tambahkan data desa baru (contoh)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    // Await params jika perlu mengakses districtId
    const { districtId } = await params;

    // Validasi districtId dari URL (opsional, tergantung kebutuhan)
    if (!districtId || typeof districtId !== 'string' || districtId.trim() === '') {
      throw new Error('districtId is required and must be a non-empty string');
    }

    // Ambil body request
    const body: PostPayload = await request.json();

    const { name, district_id } = body;

    // Validasi input
    if (!name || !district_id) {
      throw new Error('Name and district_id are required');
    }

    // (Opsional) Validasi apakah district_id dari body cocok dengan districtId dari URL
    // if (district_id !== districtId) {
    //   throw new Error('district_id in body must match the URL parameter');
    // }

    // Lakukan insert ke database
    await pool.execute(
      'INSERT INTO villages (name, district_id) VALUES (?, ?)',
      [name, district_id]
    );

    return NextResponse.json({ success: true, message: 'Village added successfully' });

  } catch (error: any) {
    console.error('Error adding village to local DB:', error);
    return handleAPIError(error, 'POST /api/locations/villages/[districtId]');
  }
}