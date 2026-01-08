import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
// ✅ Import middleware kamu
import { handleAPIError } from '@/lib/middleware'; // Sesuaikan path jika berbeda

export async function GET(req: NextRequest) {
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

    // Ambil item keranjang beserta data produk (termasuk weight dan origin_village_code)
    const [cartItems] = await pool.execute(`
      SELECT 
        ci.id as cartId,
        ci.userId,
        ci.productId,
        ci.quantity,
        ci.createdAt,
        ci.updatedAt,
        p.name as productName,
        p.price as productPrice,
        p.image_path as productImage,
        p.stock as productWeight, -- Ambil berat produk
        p.origin_village_code as productOriginVillageCode -- Ambil origin produk
      FROM cartitems ci
      JOIN products p ON ci.productId = p.id
      WHERE ci.userId = ?
    `, [userId]);

    // Format data cart items
    const formattedCartItems = (Array.isArray(cartItems) ? cartItems : []).map((item: any) => ({
      id: item.cartId,
      userId: item.userId,
      productId: item.productId,
      quantity: item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: {
        id: item.productId,
        name: item.productName,
        price: item.productPrice,
        image: item.productImage,
        weight: item.productWeight, // Tambahkan berat
        originVillageCode: item.productOriginVillageCode // Tambahkan origin
      }
    }));

    // ✅ Hitung total berat
    const totalWeight = formattedCartItems.reduce((sum, item) => {
      const itemWeight = item.product.weight || 0;
      return sum + (itemWeight * item.quantity);
    }, 0);

    return NextResponse.json({
      success: true,
       formattedCartItems,
      totalWeight // Kirim total berat ke frontend
    });

  } catch (err: any) {
    console.error('Error fetching cart:', err);
    // ✅ Gunakan middleware untuk handle error
    return handleAPIError(err, 'GET /api/cart');
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verifikasi token
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

    // Ambil body request
    const { productId, quantity } = await req.json();

    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Product ID and quantity are required');
    }

    // ✅ Validasi produk (dengan status baru)
    const [productRows] = await pool.execute(
      'SELECT id, stock, min_order, status FROM products WHERE id = ? AND status != ?',
      [productId, 'deleted'] // Jangan ambil produk yang dihapus
    );

    if ((productRows as any[]).length === 0) {
      throw new Error('Product not found or deleted');
    }

    const product = (productRows as any[])[0];

    // ✅ Periksa status produk
    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ Logika berdasarkan status produk
    if (product.status === 'pre_order') {
      // Untuk pre_order, mungkin tidak perlu validasi stok ketat
      // Cukup validasi min_order
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
      // Bisa tambahkan logika lain untuk pre-order, misalnya cek kuota pre-order
    } else if (product.status === 'ready_stock') {
      // Untuk ready_stock, validasi stok wajib
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    } else if (product.status !== 'pre_order' && product.status !== 'ready_stock') {
      // Jika status bukan salah satu dari dua di atas (misalnya 'inactive')
      throw new Error('Product is currently unavailable.');
    }

    // Cek apakah produk sudah ada di keranjang
    const [existingCartRows] = await pool.execute(
      'SELECT id, quantity FROM cartitems WHERE userId = ? AND productId = ?',
      [userId, productId]
    );

    if ((existingCartRows as any[]).length > 0) {
      // Update jumlah
      const existingQuantity = (existingCartRows as any[])[0].quantity;
      const newQuantity = existingQuantity + quantity;

      // ✅ Validasi stok untuk ready_stock saat update jumlah (hanya jika status saat ini adalah ready_stock)
      if (product.status === 'ready_stock' && newQuantity > product.stock) {
        throw new Error(`Insufficient stock for total quantity. Available: ${product.stock}`);
      }

      // ✅ Update jumlah di keranjang
      await pool.execute(
        'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND productId = ?',
        [newQuantity, userId, productId]
      );
    } else {
      // ✅ Insert baru ke keranjang
      // Validasi stok untuk ready_stock saat insert baru (hanya jika status saat ini adalah ready_stock)
      if (product.status === 'ready_stock' && quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }

      await pool.execute(
        'INSERT INTO cartitems (userId, productId, quantity, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [userId, productId, quantity]
      );
    }

    return NextResponse.json({ success: true, message: 'Product added to cart successfully' });

  } catch (err: any) {
    console.error('Error adding to cart:', err);
    // ✅ Gunakan middleware untuk handle error
    return handleAPIError(err, 'POST /api/cart');
  }
}


// ✅ PUT: Update jumlah item di keranjang
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

    const { productId, quantity } = await req.json();

    if (!productId || quantity === undefined || quantity < 0) {
      throw new Error('Product ID and quantity are required');
    }

    // ✅ Jika quantity adalah 0, hapus item dari keranjang
    if (quantity === 0) {
      const [deleteResult] = await pool.execute(
        'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
        [userId, productId]
      );

      if ((deleteResult as any).affectedRows === 0) {
        // Item tidak ditemukan untuk dihapus
        throw new Error('Product not found in cart for deletion');
      }

      return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });
    }

    // Validasi produk (aktif, *tidak deleted*, stok mencukupi jika status ready_stock)
    const [productRows] = await pool.execute(
      'SELECT id, stock, min_order, status FROM products WHERE id = ? AND status != ?',
      [productId, 'deleted']
    );

    if ((productRows as any[]).length === 0) {
      throw new Error('Product not found or deleted');
    }

    const product = (productRows as any[])[0];

    // Periksa status produk
    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // Logika berdasarkan status produk saat update
    if (product.status === 'pre_order') {
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
    } else if (product.status === 'ready_stock') {
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    } else if (product.status !== 'pre_order' && product.status !== 'ready_stock') {
      throw new Error('Product is currently unavailable.');
    }

    // Update jumlah di tabel cartitems
    const [result] = await pool.execute(
      'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND productId = ?',
      [quantity, userId, productId]
    );

    if ((result as any).affectedRows === 0) {
      // Artinya item tidak ditemukan di keranjang user ini
      throw new Error('Product not found in cart');
    }

    return NextResponse.json({ success: true, message: 'Cart item quantity updated successfully' });

  } catch (err: any) {
    console.error('Error updating cart item quantity:', err);
    // ✅ Gunakan middleware untuk handle error
    return handleAPIError(err, 'PUT /api/cart');
  }
}

// ✅ PATCH: Update jumlah item di keranjang secara relatif (misal: tambah 2, kurangi 1)
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

    const { productId, delta } = await req.json();

    if (!productId || delta === undefined) {
      throw new Error('Product ID and delta (change amount) are required');
    }

    if (typeof delta !== 'number' || !Number.isInteger(delta)) {
      throw new Error('Delta must be an integer (e.g., +2, -1)');
    }

    // Ambil item keranjang saat ini
    const [cartRows] = await pool.execute(
      'SELECT quantity FROM cartitems WHERE userId = ? AND productId = ?',
      [userId, productId]
    );

    if ((cartRows as any[]).length === 0) {
      throw new Error('Product not found in cart');
    }

    const currentQuantity = (cartRows as any[])[0].quantity;
    const newQuantity = currentQuantity + delta;

    // Jika hasilnya <= 0, hapus item
    if (newQuantity <= 0) {
      await pool.execute(
        'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
        [userId, productId]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Product removed from cart (quantity <= 0)' 
      });
    }

    // Validasi produk (aktif, bukan deleted)
    const [productRows] = await pool.execute(
      'SELECT id, stock, min_order, status FROM products WHERE id = ? AND status != ?',
      [productId, 'deleted']
    );

    if ((productRows as any[]).length === 0) {
      // Produk mungkin dihapus setelah dimasukkan ke keranjang
      await pool.execute(
        'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
        [userId, productId]
      );
      throw new Error('Product is no longer available');
    }

    const product = (productRows as any[])[0];

    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // Validasi berdasarkan status
    if (product.status === 'pre_order') {
      if (newQuantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
    } else if (product.status === 'ready_stock') {
      if (newQuantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (newQuantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    } else {
      throw new Error('Product is currently unavailable.');
    }

    // Update jumlah
    await pool.execute(
      'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND productId = ?',
      [newQuantity, userId, productId]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Cart item quantity updated successfully',
      newQuantity
    });

  } catch (err: any) {
    console.error('Error patching cart item:', err);
    return handleAPIError(err, 'PATCH /api/cart');
  }
}

// ✅ DELETE: Hapus item dari keranjang berdasarkan productId
export async function DELETE(req: NextRequest) {
  try {
    // Verifikasi token
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

    // Ambil body request
    const { productId } = await req.json();

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Hapus item dari tabel cartitems
    // Hanya hapus jika userId dan productId cocok
    const [result] = await pool.execute(
      'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
      [userId, productId]
    );

    // Cek apakah ada baris yang terpengaruh (artinya item ditemukan dan dihapus)
    if ((result as any).affectedRows === 0) {
      // Item tidak ditemukan di keranjang user ini
      throw new Error('Product not found in cart');
    }

    return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });

  } catch (err: any) {
    console.error('Error removing product from cart:', err);
    // ✅ Gunakan middleware untuk handle error
    return handleAPIError(err, 'DELETE /api/cart');
  }
}