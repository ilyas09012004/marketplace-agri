'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCookie } from '@/lib/auth'; // Sesuaikan path jika berbeda

// Definisikan tipe Product sesuai dengan respons API
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  seller_id: number;
  harvest_date: string | null;
  image_path: string | null;
  category: string | null;
  // ✅ Update tipe status
  status: 'pre_order' | 'ready_stock' | 'sold_out' | 'deleted';
  created_at: string;
  updated_at: string;
}


export default function ProductDetailPage() {
  const { id } = useParams(); // Ambil ID produk dari URL
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1); // State untuk jumlah
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Ambil detail produk saat komponen dimount
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('Product ID is missing.');
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);

        // Ambil access token
        const token = getCookie('accessToken');
        if (!token) {
          throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
        }

        const res = await fetch(`/api/products/${id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'API returned error');
        }

        setProduct(data.product);

      } catch (err: any) {
        console.error('Error fetching product:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Handler untuk mengubah jumlah
const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Jika input kosong, set ke 0 (atau nilai default)
    if (inputValue === '') {
      setQuantity(0);
      return;
    }

    const value = parseFloat(inputValue);

    // Validasi: pastikan nilai adalah angka
    if (isNaN(value)) {
      // Jika bukan angka, jangan ubah state
      return;
    }

    // Validasi: pastikan nilai tidak negatif
    if (value < 0) {
      // Jika negatif, set ke 0
      setQuantity(0);
      return;
    }

    // ✅ Jika product sudah dimuat, validasi berdasarkan min/max dari produk
    if (product) {
      // Batasi ke nilai maksimum (stock jika ready_stock, atau nilai tinggi jika pre_order)
      // Untuk pre_order, mungkin tidak ada batas max, tapi untuk ready_stock, gunakan stock
      let maxValue = Infinity; // Default untuk pre_order
      if (product.status === 'ready_stock') {
        maxValue = product.stock;
      }
      // Tambahkan logika lain jika ada batas max untuk pre_order

      if (value > maxValue) {
        // Jika melebihi max, set ke max
        setQuantity(maxValue);
        return;
      }

      // Batasi ke nilai minimum
      if (value < product.min_order) {
        // Jika di bawah min, set ke min
        setQuantity(product.min_order);
        return;
      }
    }

    // Jika semua validasi lolos, set nilai
    setQuantity(value);
  };

// Handler untuk menambah ke keranjang
// ...
const handleAddToCart = async () => {
  if (!product) return;

  console.log('DEBUG: Product stock from API:', product.stock);
  console.log('DEBUG: Quantity input:', quantity);
  console.log('DEBUG: Product status from API:', product.status);

  // ✅ Update validasi berdasarkan status produk yang mungkin dikembalikan API
  // Misalnya, API bisa mengembalikan 'active', 'inactive', 'sold_out', 'deleted'
  // Kita sesuaikan dengan logika status baru yang kamu inginkan: 'pre_order', 'ready_stock', 'habis', 'deleted'

  // Jika status dari API adalah 'deleted' atau 'sold_out' (sesuai struktur lama), tolak
  if (product.status === 'deleted') {
    setError('Produk ini telah dihapus.');
    return;
  }

  if (product.status === 'sold_out') {
    setError('Produk ini sedang habis.');
    return;
  }

  // Jika status dari API adalah 'pre_order' (struktur baru kamu)
  if (product.status === 'pre_order') {
    if (quantity < product.min_order) {
      setError(`Jumlah minimal pesan untuk pre-order ini adalah ${product.min_order} ${product.unit}.`);
      return;
    }
    // Bisa tambahkan logika lain untuk pre-order jika perlu
  }
  // Jika status dari API adalah 'ready_stock' (struktur baru kamu)
  else if (product.status === 'ready_stock') {
    if (quantity < product.min_order) {
      setError(`Jumlah minimal pesan untuk produk ini adalah ${product.min_order} ${product.unit}.`);
      return;
    }

    if (quantity > product.stock) {
      setError(`Stok tidak mencukupi. Tersisa ${product.stock} ${product.unit}.`);
      return;
    }
  }
  // Jika status bukan salah satu dari yang dikenali di atas
  else {
    setError('Produk ini sedang tidak tersedia.');
    console.error('Unhandled product status:', product.status); // Log status yang tidak dikenali
    return;
  }

  setIsAddingToCart(true);
  setError(null);

  try {
    const token = getCookie('accessToken');
    if (!token) {
      throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
    }

    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: product.id,
        quantity: quantity,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API Cart Error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'API Cart returned error');
    }

    alert('Produk berhasil ditambahkan ke keranjang!');

  } catch (err: any) {
    console.error('Error adding to cart:', err);
    setError(err.message);
  } finally {
    setIsAddingToCart(false);
  }
};
// ...

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-green-700">Memuat produk...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-red-500 p-4 bg-white rounded-lg shadow-md">
          <p>Error: {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-red-500 p-4 bg-white rounded-lg shadow-md">
          <p>Produk tidak ditemukan.</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
        <button
          onClick={() => router.back()}
          className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          &larr; Kembali
        </button>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Gambar Produk */}
          <div className="md:w-1/2">
            {product.image_path ? (
              <img
                src={product.image_path} // Sesuaikan path jika perlu (misalnya, tambah base URL)
                alt={product.name}
                className="w-full h-64 object-contain rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                <span className="text-gray-500">Gambar tidak tersedia</span>
              </div>
            )}
          </div>

          {/* Detail Produk */}
          <div className="md:w-1/2">
            <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
            <p className="text-gray-600 mt-2">{product.description}</p>

            <div className="mt-4 space-y-2">
              <p className="text-lg font-semibold text-green-700">Rp {product.price.toLocaleString('id-ID')} / {product.unit}</p>
              <p className="text-gray-600">Stok: {product.stock} {product.unit}</p>
              <p className="text-gray-600">Minimal Pesan: {product.min_order} {product.unit}</p>
              <p className="text-gray-600">Kategori: {product.category || 'Tidak ada kategori'}</p>
              <p className="text-gray-600">Tanggal Panen: {product.harvest_date || 'N/A'}</p>
               <p className="text-gray-600">
                Status: 
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  // ✅ Update warna dan teks berdasarkan status baru
                  product.status === 'ready_stock' ? 'bg-green-100 text-green-800' :
                  product.status === 'pre_order' ? 'bg-yellow-100 text-yellow-800' :
                  product.status === 'sold_out' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800' // deleted
                }`}>
                  {/* ✅ Format teks status */}
                  {product.status === 'pre_order' ? 'Pre Order' :
                   product.status === 'ready_stock' ? 'ready Stok' :
                   product.status === 'sold_out' ? 'Sold Out' :
                   'Dihapus'}
                </span>
              </p>
            </div>

            {/* Form Jumlah dan Tombol Tambah ke Keranjang */}
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <label className="text-gray-700">Jumlah ({product.unit}):</label>
                <input
                  type="number"
                  min={product.min_order}
                  max={product.stock}
                  step="0.01" // Jika ingin bisa input desimal (misal 1.5 kg)
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="w-24 p-2 border border-gray-300 rounded-lg text-gray-600"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Minimal: {product.min_order} {product.unit} | Maksimal: {product.stock} {product.unit}
              </p>

               <button
                onClick={handleAddToCart}
                // ✅ Update kondisi disabled berdasarkan status baru
                disabled={isAddingToCart || product.status === 'sold_out' ||  (product.status === 'ready_stock' && product.stock <= 0)}
                className={`mt-4 w-full py-3 px-4 rounded-lg font-bold text-white transition cursor-pointer ${
                  // ✅ Update kelas bg berdasarkan status
                  (product.status === 'ready_stock' || product.status === 'pre_order') && !isAddingToCart
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {isAddingToCart
                  ? 'Menambahkan...'
                  : product.status === 'sold_out' ||  (product.status === 'ready_stock' && product.stock <= 0)
                  ? 'Produk Tidak Tersedia'
                  : 'Tambah ke Keranjang'}
              </button>

              {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}