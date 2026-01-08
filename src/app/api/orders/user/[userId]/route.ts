import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware'; // Import middleware

// Definisikan tipe untuk params
interface Params {
  userId: string;
}

export async function GET(request: NextRequest, context: { params: Promise<Params> }) {
  const params = await context.params;
  try {
    const { userId } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    if (decoded.sub !== userId) {
      throw new Error('Forbidden');
    }

    const [orders] = await pool.execute(`
      SELECT 
        o.id,
        o.userId,
        o.addressId,
        o.status,
        o.totalProductPrice,
        o.shippingCost,
        o.grandTotal,
        o.createdAt,
        o.updatedAt,
        a.detail as address_detail,
        a.cityId as address_cityId,
        a.districtId as address_districtId,
        a.villageCode as address_villageCode,
        a.province as address_province,
        a.zipCode as address_zipCode
      FROM orders o
      JOIN address a ON o.addressId = a.id
      WHERE o.userId = ?
      ORDER BY o.createdAt DESC
    `, [userId]);

    const ordersWithItems = await Promise.all(
      (Array.isArray(orders) ? orders : []).map(async (order: any) => {
        const [items] = await pool.execute(`
          SELECT 
            oi.id,
            oi.orderId,
            oi.productId,
            p.name as productName,
            p.image_path as productImage,
            oi.priceAtOrder,
            oi.quantity
          FROM order_items oi
          JOIN products p ON oi.productId = p.id
          WHERE oi.orderId = ?
        `, [order.id]);

        return {
          ...order,
          address: {
            detail: order.address_detail,
            cityId: order.address_cityId,
            districtId: order.address_districtId,
            villageCode: order.address_villageCode,
            province: order.address_province,
            zipCode: order.address_zipCode,
          },
          orderItems: Array.isArray(items) ? items : [],
        };
      })
    );

    return NextResponse.json({
      success: true,
       orders: ordersWithItems
    });

  } catch (err: any) {
    console.error('Error fetching user orders:', err);
    return handleAPIError(err, 'GET /api/orders/user/[userId]');
  }
}

// ✅ POST: Membuat order baru (contoh)
export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  const params = await context.params;
  try {
    const { userId } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    if (decoded.sub !== userId) {
      throw new Error('Forbidden');
    }

    const body = await request.json();
    // ... (logika validasi dan pembuatan order)

    // Contoh query sederhana (sesuaikan dengan kebutuhan kamu)
    const { addressId, totalProductPrice, shippingCost, grandTotal, paymentMethod } = body;

    if (!addressId || totalProductPrice === undefined || shippingCost === undefined || grandTotal === undefined) {
      throw new Error('addressId, totalProductPrice, shippingCost, and grandTotal are required');
    }

    // Validasi addressId milik user
    const [addressCheck] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((addressCheck as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user');
    }

    // Insert ke tabel orders
    const [orderResult] = await pool.execute(
      'INSERT INTO orders (userId, addressId, status, totalProductPrice, shippingCost, grandTotal, paymentMethod, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [userId, addressId, 'pending', totalProductPrice, shippingCost, grandTotal, paymentMethod || 'cod']
    );

    const orderId = (orderResult as any).insertId;

    // Ambil item keranjang user untuk dipindahkan ke order_items
    const [cartItems] = await pool.execute(
      'SELECT productId, quantity, price FROM cartitems WHERE userId = ?',
      [userId]
    );

    if ((cartItems as any[]).length > 0) {
      // Insert ke order_items
      for (const item of cartItems as any[]) {
        await pool.execute(
          'INSERT INTO order_items (orderId, productId, priceAtOrder, quantity) VALUES (?, ?, ?, ?)',
          [orderId, item.productId, item.price, item.quantity]
        );

        // Kurangi stok produk
        await pool.execute(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.productId]
        );
      }

      // Hapus item dari keranjang
      await pool.execute('DELETE FROM cartitems WHERE userId = ?', [userId]);
    }

    return NextResponse.json({ success: true, orderId, message: 'Order created successfully' });

  } catch (err: any) {
    console.error('Error creating order:', err);
    return handleAPIError(err, 'POST /api/orders/user/[userId]');
  }
}

// ✅ PUT: Update seluruh order (contoh - hanya status)
export async function PUT(request: NextRequest, context: { params: Promise<Params> }) {
  const params = await context.params;
  try {
    const { userId } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    if (decoded.sub !== userId) {
      throw new Error('Forbidden');
    }

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      throw new Error('orderId and status are required');
    }

    // Validasi order milik user
    const [orderCheck] = await pool.execute(
      'SELECT id FROM orders WHERE id = ? AND userId = ?',
      [orderId, userId]
    );

    if ((orderCheck as any[]).length === 0) {
      throw new Error('Order not found or does not belong to user');
    }

    // Update status
    await pool.execute(
      'UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, orderId]
    );

    return NextResponse.json({ success: true, message: 'Order updated successfully' });

  } catch (err: any) {
    console.error('Error updating order:', err);
    return handleAPIError(err, 'PUT /api/orders/user/[userId]');
  }
}

// ✅ PATCH: Update sebagian order (contoh - hanya status)
export async function PATCH(request: NextRequest, context: { params: Promise<Params> }) {
  const params = await context.params;
  try {
    const { userId } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    if (decoded.sub !== userId) {
      throw new Error('Forbidden');
    }

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      throw new Error('orderId and status are required');
    }

    // Validasi order milik user
    const [orderCheck] = await pool.execute(
      'SELECT id FROM orders WHERE id = ? AND userId = ?',
      [orderId, userId]
    );

    if ((orderCheck as any[]).length === 0) {
      throw new Error('Order not found or does not belong to user');
    }

    // Update status
    await pool.execute(
      'UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, orderId]
    );

    return NextResponse.json({ success: true, message: 'Order partially updated successfully' });

  } catch (err: any) {
    console.error('Error partially updating order:', err);
    return handleAPIError(err, 'PATCH /api/orders/user/[userId]');
  }
}

// ✅ DELETE: Soft delete order (contoh - ubah status ke cancelled)
export async function DELETE(request: NextRequest, context: { params: Promise<Params> }) {
  const params = await context.params;
  try {
    const { userId } = params;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    if (decoded.sub !== userId) {
      throw new Error('Forbidden');
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      throw new Error('orderId is required');
    }

    // Validasi order milik user
    const [orderCheck] = await pool.execute(
      'SELECT id FROM orders WHERE id = ? AND userId = ?',
      [orderId, userId]
    );

    if ((orderCheck as any[]).length === 0) {
      throw new Error('Order not found or does not belong to user');
    }

    // Soft delete - update status
    await pool.execute(
      'UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelled', orderId]
    );

    return NextResponse.json({ success: true, message: 'Order cancelled successfully' });

  } catch (err: any) {
    console.error('Error cancelling order:', err);
    return handleAPIError(err, 'DELETE /api/orders/user/[userId]');
  }
}