import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util'; // Sesuaikan path
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// Definisikan tipe untuk params
type Params = {
  params: Promise<{ id: string }>; // Next.js 15+
};

// PUT: Ganti SELURUH quantity item di keranjang berdasarkan cartItemId
export async function PUT(req: NextRequest, { params }: Params) {
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
    const resolvedParams = await params;
    const cartItemId = resolvedParams.id;

    if (!cartItemId || isNaN(Number(cartItemId))) {
      throw new Error('Invalid cart item ID');
    }

    const { quantity } = await req.json();

    if (quantity === undefined || quantity < 0) {
      throw new Error('Quantity is required and must be non-negative');
    }

    // Ambil data item keranjang dan produk terkait
    const [cartItemRows] = await pool.execute(
      'SELECT ci.id, ci.userId, ci.productId, ci.quantity, p.stock, p.min_order, p.status FROM cartitems ci JOIN products p ON ci.productId = p.id WHERE ci.id = ? AND ci.userId = ?',
      [Number(cartItemId), Number(userId)]
    );

    if ((cartItemRows as any[]).length === 0) {
      throw new Error('Cart item not found or does not belong to user');
    }

    const cartItem = (cartItemRows as any[])[0];

    // Validasi berdasarkan status produk
    if (cartItem.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    if (cartItem.status === 'pre_order') {
      if (quantity < cartItem.min_order) {
        throw new Error(`Quantity must be at least ${cartItem.min_order} for pre-order items.`);
      }
    } else if (cartItem.status === 'ready_stock') {
      if (quantity < cartItem.min_order) {
        throw new Error(`Quantity must be at least ${cartItem.min_order}`);
      }
      if (quantity > cartItem.stock) {
        throw new Error(`Insufficient stock. Available: ${cartItem.stock}`);
      }
    } else if (cartItem.status !== 'pre_order' && cartItem.status !== 'ready_stock') {
      throw new Error('Product is currently unavailable.');
    }

    // Update quantity
    await pool.execute(
      'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
      [quantity, Number(cartItemId), Number(userId)]
    );

    return NextResponse.json({ success: true, message: 'Cart item quantity updated successfully' });

  } catch (err: any) {
    console.error('Error updating cart item quantity (PUT):', err);
    return handleAPIError(err, 'PUT /api/cart/[id]');
  }
}

// PATCH: Update SEBAGIAN item di keranjang (misalnya hanya quantity)
export async function PATCH(req: NextRequest, { params }: Params) {
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
    const resolvedParams = await params;
    const cartItemId = resolvedParams.id;

    if (!cartItemId || isNaN(Number(cartItemId))) {
      throw new Error('Invalid cart item ID');
    }

    const { quantity } = await req.json(); // Hanya ambil field yang ingin diupdate

    if (quantity === undefined && quantity !== 0) {
      throw new Error('No fields to update provided');
    }

    // Ambil data item keranjang dan produk terkait
    const [cartItemRows] = await pool.execute(
      'SELECT ci.id, ci.userId, ci.productId, ci.quantity, p.stock, p.min_order, p.status FROM cartitems ci JOIN products p ON ci.productId = p.id WHERE ci.id = ? AND ci.userId = ?',
      [Number(cartItemId), Number(userId)]
    );

    if ((cartItemRows as any[]).length === 0) {
      throw new Error('Cart item not found or does not belong to user');
    }

    const cartItem = (cartItemRows as any[])[0];

    // Validasi quantity jika disertakan
    if (quantity !== undefined) {
      if (quantity < 0) {
        throw new Error('Quantity must be non-negative');
      }

      if (cartItem.status === 'sold_out') {
        throw new Error('Product is currently sold out.');
      }

      if (cartItem.status === 'pre_order') {
        if (quantity < cartItem.min_order) {
          throw new Error(`Quantity must be at least ${cartItem.min_order} for pre-order items.`);
        }
      } else if (cartItem.status === 'ready_stock') {
        if (quantity < cartItem.min_order) {
          throw new Error(`Quantity must be at least ${cartItem.min_order}`);
        }
        if (quantity > cartItem.stock) {
          throw new Error(`Insufficient stock. Available: ${cartItem.stock}`);
        }
      } else if (cartItem.status !== 'pre_order' && cartItem.status !== 'ready_stock') {
        throw new Error('Product is currently unavailable.');
      }

      // Update quantity
      await pool.execute(
        'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
        [quantity, Number(cartItemId), Number(userId)]
      );
    }

    return NextResponse.json({ success: true, message: 'Cart item updated successfully' });

  } catch (err: any) {
    console.error('Error updating cart item (PATCH):', err);
    return handleAPIError(err, 'PATCH /api/cart/[id]');
  }
}

// DELETE: Hapus item dari keranjang berdasarkan cartItemId
export async function DELETE(req: NextRequest, { params }: Params) {
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
    const resolvedParams = await params;
    const cartItemId = resolvedParams.id;

    if (!cartItemId || isNaN(Number(cartItemId))) {
      throw new Error('Invalid cart item ID');
    }

    // Hapus item dari tabel cartitems
    const [result] = await pool.execute(
      'DELETE FROM cartitems WHERE id = ? AND userId = ?',
      [Number(cartItemId), Number(userId)]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Cart item not found or does not belong to user');
    }

    return NextResponse.json({ success: true, message: 'Cart item removed successfully' });

  } catch (err: any) {
    console.error('Error removing cart item:', err);
    return handleAPIError(err, 'DELETE /api/cart/[id]');
  }
}