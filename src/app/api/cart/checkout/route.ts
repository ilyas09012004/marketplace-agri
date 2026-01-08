import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

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

    const { addressId, shippingOption, paymentMethod, totalAmount } = await req.json();

    if (!addressId || !shippingOption || !paymentMethod || typeof totalAmount !== 'number' || totalAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields or invalid totalAmount' }, { status: 400 });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Ambil item keranjang user
      const [cartItems] = await connection.execute(`
        SELECT ci.productId, ci.quantity, p.price, p.stock
        FROM cartitems ci
        JOIN products p ON ci.productId = p.id
        WHERE ci.userId = ?
      `, [userId]);

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      // 2. Validasi stok
      for (const item of cartItems) {
        if (item.stock < item.quantity) {
          throw new Error(`Stock for product ${item.productId} is insufficient`);
        }
      }

      // 3. Hitung total harga produk dari cart
      const totalProductPrice = cartItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      // 4. Simpan ke tabel orders
      const shippingCost = parseInt(shippingOption, 10); // Harga ongkir yang dipilih
      const grandTotal = totalAmount; // Total bayar yang dihitung di frontend

      const [orderResult] = await connection.execute(
        `INSERT INTO orders (userId, addressId, status, paymentMethod, totalProductPrice, shippingCost, grandTotal, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, addressId, 'pending', paymentMethod, totalProductPrice, shippingCost, grandTotal]
      );

      const orderId = orderResult.insertId;

      // 5. Simpan ke tabel order_items
      for (const item of cartItems) {
        await connection.execute(
          `INSERT INTO order_items (orderId, productId, quantity, priceAtOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [orderId, item.productId, item.quantity, item.price]
        );

        // 6. Kurangi stok produk
        await connection.execute(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [item.quantity, item.productId]
        );
      }

      // 7. Hapus item dari cart
      await connection.execute(
        `DELETE FROM cartitems WHERE userId = ?`,
        [userId]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        orderId: orderId
      });

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err: any) {
    console.error('Error in checkout:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process checkout' },
      { status: 500 }
    );
  }
}