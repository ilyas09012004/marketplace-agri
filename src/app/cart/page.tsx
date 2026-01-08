'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';



// Fungsi bantu untuk membaca cookie
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        setError(null);
        setLoading(true);

        // Ambil access token dari cookie
        const token = getCookie('accessToken');
        if (!token) {
          throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
        }

        const res = await fetch('/api/cart', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          let errorText = 'Unknown error';
          try {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorJson = await res.json();
              errorText = errorJson.error || 'API Cart returned error';
            } else {
              errorText = await res.text();
            }
          } catch (parseErr) {
            console.error('Failed to parse API Cart error:', parseErr);
            errorText = await res.text();
          }
          throw new Error(`${res.status} - ${errorText}`);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'API Cart returned error');
        }

        // ✅ Ganti dari data.cartItems menjadi data.formattedCartItems
        setCartItems(data.formattedCartItems || []);
      } catch (err: any) {
        console.error('Error fetching cart items:', err);
        setError(err.message);
        if (err.message.includes('Unauthorized') || err.message.includes('Invalid token')) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCartItems();
  }, [router]);

  // Fungsi untuk mengupdate quantity
  const updateQuantity = async (productId: number, newQuantity: number) => {
    console.log('DEBUG: updateQuantity called with productId:', productId, 'newQuantity:', newQuantity);
    console.log('DEBUG: Current cartItems:', cartItems);

    // ✅ 1. Validasi lokal jumlah sebelum mencari item
    if (newQuantity < 0) { // ✅ Ubah dari < 1 ke < 0
      setError('Jumlah tidak boleh negatif.');
      return;
    }

    // ✅ 2. Cari item di cartItems berdasarkan productId
    const cartItemIndex = cartItems.findIndex(item => item.productId === productId);

    // ✅ 3. Periksa apakah item ditemukan
    if (cartItemIndex === -1) {
      console.error('Cart item not found for productId:', productId);
      setError('Item tidak ditemukan di keranjang.');
      return;
    }

    // ✅ 4. Ambil data item dan produk dari state
    const cartItem = cartItems[cartItemIndex];
    const product = cartItem.product;

    // ✅ 5. Validasi lokal berdasarkan status produk (hanya jika quantity > 0)
    if (newQuantity > 0) {
      if (product.status === 'pre_order') {
        if (newQuantity < product.min_order) {
          setError(`Jumlah minimal pesan untuk pre-order ini adalah ${product.min_order} ${product.unit || ''}.`);
          return;
        }
      } else if (product.status === 'ready_stock') {
        if (newQuantity < product.min_order) {
          setError(`Jumlah minimal pesan untuk produk ini adalah ${product.min_order} ${product.unit || ''}.`);
          return;
        }
        if (newQuantity > product.stock) {
          setError(`Stok tidak mencukupi. Tersisa ${product.stock} ${product.unit || ''}.`);
          return;
        }
      } else if (product.status === 'sold_out' || product.status === 'deleted') {
        setError('Produk ini tidak dapat diperbarui.');
        return;
      }
    }

    // ✅ 6. Siapkan fetch ke backend
    try {
      setError(null); // Reset error sebelum fetch

      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const res = await fetch('/api/cart', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: productId,
          quantity: newQuantity,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update quantity in cart');
      }

      const data = await res.json();
      console.log(data.message);

      // ✅ 7. Update state cartItems setelah sukses dari backend
      setCartItems(prevItems => {
        const indexToUpdate = prevItems.findIndex(item => item.productId === productId);
        if (indexToUpdate === -1) {
          // Jika item tidak ditemukan di state terbaru, mungkin sudah dihapus oleh backend
          if (newQuantity === 0) {
            console.log('Item successfully removed from cart state.');
            return prevItems.filter(item => item.productId !== productId); // ✅ Hapus dari state
          }
          console.warn('Item not found in cart state after update request.');
          return prevItems;
        }

        // Jika quantity adalah 0, hapus item dari state
        if (newQuantity === 0) {
          console.log('Removing item from cart state.');
          return prevItems.filter(item => item.productId !== productId);
        }

        // Jika quantity > 0, update quantity item di index tersebut
        const updatedItems = [...prevItems];
        updatedItems[indexToUpdate] = { ...updatedItems[indexToUpdate], quantity: newQuantity };
        return updatedItems;
      });

    } catch (err: any) {
      console.error('Update quantity error:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat keranjang...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-red-600 text-center">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-green-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
          <h1 className="text-2xl font-bold text-green-800 mb-6">Keranjang Belanja</h1>
          <p className="text-gray-600">Keranjang kamu kosong.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-green-800 mb-6">Keranjang Belanja</h1>
        <div className="space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                {item.product.image && (
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-16 h-16 object-contain"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-800">{item.product.name}</h3>
                  <p className="text-gray-600 text-sm">
                    Rp {typeof item.product.price === 'number' ? item.product.price.toLocaleString('id-ID') : item.product.price}/{item.product.unit || 'satuan'}
                  </p>
                </div>
              </div>
               <div className="flex items-center space-x-4">
                {/* --- Input Quantity --- */}
                <div className="flex items-center space-x-2">
                  <button
                    // ✅ Gunakan item.productId bukan item.id
                    // ✅ Pastikan quantity tidak kurang dari 0 sebelum kirim ke fungsi
                    onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                    className="w-8 h-8 flex items-center justify-center  text-gray-600 bg-gray-200 rounded-full hover:bg-gray-500  hover:text-white"
                  >
                    -
                  </button>
                  <span className="text-gray-700 w-10 text-center">{item.quantity}</span>
                  <button
                    // ✅ Gunakan item.productId bukan item.id
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 bg-gray-200 rounded-full hover:bg-gray-500 hover:text-white"
                  >
                    +
                  </button>
                </div>

                {/* --- Samapi sini --- */}
                <span className="font-semibold text-green-700">
                  Rp {typeof item.product.price === 'number' && typeof item.quantity === 'number' ? (item.product.price * item.quantity).toLocaleString('id-ID') : (parseFloat(item.product.price) * item.quantity).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-lg font-bold  text-gray-600">
            <span>Total:</span>
            <span className="text-green-700">
              Rp {cartItems.reduce((acc, item) => {
                // Jika price adalah number
                if (typeof item.product.price === 'number') {
                  return acc + (item.product.price * item.quantity);
                }
                // Jika price adalah string (misalnya "25000.00"), ubah ke number
                if (typeof item.product.price === 'string') {
                  return acc + (parseFloat(item.product.price) * item.quantity);
                }
                return acc;
              }, 0).toLocaleString('id-ID')}
            </span>
          </div>
          {/* --- Tambahkan tombol Checkout di sini --- */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => router.push('/checkout')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Checkout
            </button>
          </div>
          {/* --- Sampai sini --- */}
        </div>
      </div>
    </div>
  );
}