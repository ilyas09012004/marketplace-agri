'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCookie } from '@/lib/auth';

// Definisikan tipe Product
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
  status: 'active' | 'inactive' | 'sold_out' | 'deleted';
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const searchParams = useSearchParams();
  const router = useRouter();

  // Baca query parameter dari URL saat halaman dimuat
  useEffect(() => {
    const initialPage = parseInt(searchParams.get('page') || '1', 10);
    const initialLimit = parseInt(searchParams.get('limit') || '10', 10);
    const initialSearch = searchParams.get('q') || '';
    const initialSort = searchParams.get('sort') || 'created_at';
    const initialOrder = searchParams.get('order') || 'desc';

    setSearch(initialSearch);
    setSort(initialSort);
    setOrder(initialOrder);

    fetchProducts(initialPage, initialLimit, initialSearch, initialSort, initialOrder);
  }, [searchParams]);

  const fetchProducts = async (
    page: number = 1,
    limit: number = 10,
    q: string = '',
    sort: string = 'created_at',
    order: string = 'desc'
  ) => {
    try {
      setError(null);
      setLoading(true);

      // Bangun URL dengan query parameter
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (q) params.set('q', q);
      if (sort) params.set('sort', sort);
      if (order) params.set('order', order);

      const res = await fetch(`/api/products?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${getCookie('accessToken') || ''}`, // Jika perlu auth
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

      setProducts(data.products || []);
      setPagination(data.pagination);

    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Reset ke halaman 1 saat pencarian dijalankan
    const newParams = new URLSearchParams();
    newParams.set('page', '1');
    newParams.set('limit', '10');
    if (search) newParams.set('q', search);
    newParams.set('sort', sort);
    newParams.set('order', order);

    router.push(`/products?${newParams.toString()}`);
  };

  const handleSortChange = (newSort: string) => {
    const newOrder = sort === newSort && order === 'asc' ? 'desc' : 'asc';
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('page', '1'); // Reset ke halaman 1
    newParams.set('sort', newSort);
    newParams.set('order', newOrder);

    router.push(`/products?${newParams.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    if (!pagination || newPage < 1 || newPage > pagination.totalPages) return;

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('page', newPage.toString());

    router.push(`/products?${newParams.toString()}`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat produk...</div>;
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

  return (
    <div className="min-h-screen bg-green-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-green-800 mb-6">Daftar Produk</h1>

        {/* Form Pencarian */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="flex-1 p-2 border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Cari
          </button>
        </form>

        {/* Header Tabel dengan Sortir */}
        <div className="grid grid-cols-12 gap-4 mb-4 text-sm font-semibold text-gray-700 border-b pb-2">
          <div className="col-span-4 cursor-pointer" onClick={() => handleSortChange('name')}>
            Nama {sort === 'name' && (order === 'asc' ? '↑' : '↓')}
          </div>
          <div className="col-span-2 cursor-pointer" onClick={() => handleSortChange('price')}>
            Harga {sort === 'price' && (order === 'asc' ? '↑' : '↓')}
          </div>
          <div className="col-span-2 cursor-pointer" onClick={() => handleSortChange('stock')}>
            Stok {sort === 'stock' && (order === 'asc' ? '↑' : '↓')}
          </div>
          <div className="col-span-2 cursor-pointer" onClick={() => handleSortChange('created_at')}>
            Tanggal {sort === 'created_at' && (order === 'asc' ? '↑' : '↓')}
          </div>
          <div className="col-span-2">Status</div>
        </div>

        {/* Daftar Produk */}
        <div className="space-y-4">
          {products.length > 0 ? (
            products.map((product) => (
              <div key={product.id} className="grid grid-cols-12 gap-4 p-4 border border-gray-200 rounded-lg items-center">
                <div className="col-span-4">
                  <h3 className="font-medium text-gray-800">{product.name}</h3>
                  <p className="text-xs text-gray-600 truncate">{product.description}</p>
                </div>
                <div className="col-span-2 text-green-700 font-semibold">
                  Rp {product.price.toLocaleString('id-ID')}
                </div>
                <div className="col-span-2">
                  {product.stock} {product.unit}
                </div>
                <div className="col-span-2 text-gray-600 text-sm">
                  {new Date(product.created_at).toLocaleDateString('id-ID')}
                </div>
                <div className="col-span-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    product.status === 'active' ? 'bg-green-100 text-green-800' :
                    product.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                    product.status === 'sold_out' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">Tidak ada produk ditemukan.</p>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={`px-4 py-2 rounded-lg ${
                pagination.page === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Sebelumnya
            </button>
            <span className="text-gray-600">
              Halaman {pagination.page} dari {pagination.totalPages} (Total: {pagination.total} produk)
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className={`px-4 py-2 rounded-lg ${
                pagination.page === pagination.totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
}