import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware'; // Import middleware kamu

export async function GET(req: NextRequest) {
  try {
    // 1. Verifikasi token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userIdString = decoded.sub;
    const userId = parseInt(userIdString, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // 2. Ambil alamat dari database
    // ✅ Tambahkan villageCode ke dalam SELECT
    const [rows] = await pool.execute(
      'SELECT id, detail, cityId, districtId, villageCode, province, zipCode FROM address WHERE userId = ?',
      [userId]
    );

    return NextResponse.json({
      success: true,
      addresses: Array.isArray(rows) ? rows : []
    });

  } catch (err: any) {
    console.error('Error fetching addresses:', err);
    return handleAPIError(err, 'GET /api/address'); // ✅ Gunakan middleware
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    // ✅ Ambil villageCode dari body request
    const { detail, cityId, districtId, villageCode, province, zipCode } = await req.json();

    // ✅ Masukkan villageCode ke dalam INSERT
    const [result] = await pool.execute(
      'INSERT INTO address (userId, detail, cityId, districtId, villageCode, province, zipCode) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, detail, cityId, districtId, villageCode, province, zipCode]
    );

    const insertedId = (result as any).insertId;

    // ✅ Ambil data alamat yang baru ditambahkan (termasuk villageCode)
    const [rows] = await pool.execute(
      'SELECT id, detail, cityId, districtId, villageCode, province, zipCode, createdAt, updatedAt FROM address WHERE id = ?',
      [insertedId]
    );

    return NextResponse.json({
      success: true,
      address: Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    });

  } catch (err: any) {
    console.error('Error adding address:', err);
    return handleAPIError(err, 'POST /api/address'); // ✅ Gunakan middleware
  }
}

// ✅ Tambahkan method PUT
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { id, detail, cityId, districtId, villageCode, province, zipCode } = await req.json();

    if (!id) {
      throw new Error('Address ID is required for update.');
    }

    // Verifikasi apakah alamat milik user ini
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [id, userId]
    );

    if ((checkRows as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user.');
    }

    const [result] = await pool.execute(
      'UPDATE address SET detail = ?, cityId = ?, districtId = ?, villageCode = ?, province = ?, zipCode = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
      [detail, cityId, districtId, villageCode, province, zipCode, id, userId]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Address not found or could not be updated.');
    }

    // Ambil data alamat yang diperbarui
    const [updatedRows] = await pool.execute(
      'SELECT id, detail, cityId, districtId, villageCode, province, zipCode, createdAt, updatedAt FROM address WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      address: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null,
      message: 'Address updated successfully.'
    });

  } catch (err: any) {
    console.error('Error updating address:', err);
    return handleAPIError(err, 'PUT /api/address'); // ✅ Gunakan middleware
  }
}

// ✅ Tambahkan method PATCH
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { id, ...updates } = await req.json(); // Ambil id dan field lain yang ingin diupdate

    if (!id) {
      throw new Error('Address ID is required for update.');
    }

    // Bangun query dinamis berdasarkan field yang dikirim
    const updateFields = Object.keys(updates);
    if (updateFields.length === 0) {
      throw new Error('No fields provided for update.');
    }

    let query = 'UPDATE address SET ';
    const values: any[] = [];
    updateFields.forEach(field => {
      // Validasi field yang boleh diupdate
      if (['detail', 'cityId', 'districtId', 'villageCode', 'province', 'zipCode'].includes(field)) {
        query += `${field} = ?, `;
        values.push(updates[field]);
      }
    });

    if (values.length === 0) {
      throw new Error('No valid fields provided for update.');
    }

    query = query.slice(0, -2); // Hapus ', ' terakhir
    query += ' WHERE id = ? AND userId = ?';
    values.push(id, userId);

    // Verifikasi apakah alamat milik user ini
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [id, userId]
    );

    if ((checkRows as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user.');
    }

    const [result] = await pool.execute(query, values);

    if ((result as any).affectedRows === 0) {
      throw new Error('Address not found or could not be updated.');
    }

    // Ambil data alamat yang diperbarui
    const [updatedRows] = await pool.execute(
      'SELECT id, detail, cityId, districtId, villageCode, province, zipCode, createdAt, updatedAt FROM address WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      address: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null,
      message: 'Address updated successfully.'
    });

  } catch (err: any) {
    console.error('Error partially updating address:', err);
    return handleAPIError(err, 'PATCH /api/address'); // ✅ Gunakan middleware
  }
}

// ✅ Tambahkan method DELETE
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { id } = await req.json(); // Ambil id alamat dari body

    if (!id) {
      throw new Error('Address ID is required for deletion.');
    }

    // Verifikasi apakah alamat milik user ini
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [id, userId]
    );

    if ((checkRows as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user.');
    }

    const [result] = await pool.execute(
      'DELETE FROM address WHERE id = ? AND userId = ?',
      [id, userId]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Address not found or could not be deleted.');
    }

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully.'
    });

  } catch (err: any) {
    console.error('Error deleting address:', err);
    return handleAPIError(err, 'DELETE /api/address'); // ✅ Gunakan middleware
  }
}