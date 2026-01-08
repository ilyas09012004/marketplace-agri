'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCookie } from '@/lib/auth'; // Import getCookie

// ✅ SESUAIKAN TYPE OrderItem DENGAN FIELD DARI ENDPOINT BACKEND
type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productImage: string; // Dari p.image_path
  priceAtOrder: number; // Dari oi.priceAtOrder
  quantity: number;
};

type Order = {
  id: string;
  userId: string;
  addressId: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled';
  // ✅ SESUAIKAN DENGAN NAMA FIELD DARI ENDPOINT BACKEND
  totalProductPrice: number;
  shippingCost: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
  address: {
    detail: string;
    cityId: string;
    districtId: string;
    villageCode: string;
    province: string;
    zipCode: string;
  };
  orderItems: OrderItem[]; // Gunakan type yang baru
};

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | Order['status']>('all');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = getCookie('accessToken');
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const storedUser = userStr ? JSON.parse(userStr) : null;

      if (!token || !storedUser) {
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      setUser(storedUser);
      await fetchOrders(storedUser.id, token);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const fetchOrders = async (userId: string, token: string) => {
    try {
      const res = await fetch(`/api/orders/user/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Orders Error:', res.status, errorText);
        throw new Error(`API Orders Error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API Orders returned error');
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setOrders([]); // Reset jika error
    }
  };

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(order => order.status === filterStatus);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Logout warning:', err);
    } finally {
      localStorage.removeItem('user');
      document.cookie = 'accessToken=; Path=/; Max-Age=0;';
      document.cookie = 'refreshToken=; Path=/; Max-Age=0;';
      router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-green-700">Memuat dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-green-800">
              Selamat datang, <span className="text-green-600">{user.name}</span>!
            </h1>
            <p className="text-gray-600 text-sm mt-1">Role: {user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
          >
            Logout
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Daftar Pesanan Saya</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'pending', 'paid', 'shipped', 'delivered', 'canceled'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 text-sm rounded-full ${
                  filterStatus === status
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-800">Order ID: {order.id}</h3>
                      <p className="text-sm text-gray-600">Tanggal: {new Date(order.createdAt).toLocaleDateString('id-ID')}</p>
                      <p className="text-sm font-medium text-gray-800">Status: 
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'shipped' ? 'bg-indigo-100 text-indigo-800' :
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-700">
                        Rp {(
                          typeof order.grandTotal === 'number' ? order.grandTotal : 0
                        ).toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ongkir: Rp {(
                          typeof order.shippingCost === 'number' ? order.shippingCost : 0
                        ).toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-500">
                        Produk: Rp {(
                          typeof order.totalProductPrice === 'number' ? order.totalProductPrice : 0
                        ).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    <p className="font-medium">Alamat Pengiriman:</p>
                    <p>
                      {order.address.detail || 'N/A'}, 
                      {order.address.cityId || 'N/A'}, 
                      {order.address.province || 'N/A'}, 
                      {order.address.zipCode || 'N/A'}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="font-medium text-gray-800">Item:</p>
                    <div className="mt-1 space-y-1">
                      {order.orderItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-gray-950">
                          {/* ✅ SESUAIKAN DENGAN NAMA FIELD DARI ENDPOINT BACKEND */}
                          {item.productImage && ( // Gunakan productImage
                            <img
                              src={item.productImage} // Gunakan productImage
                              alt={item.productName}
                              className="w-8 h-8 object-cover rounded"
                            />
                          )}
                          <span className="text-sm">{item.productName} x{item.quantity}</span>
                          {/* ✅ SESUAIKAN DENGAN NAMA FIELD DARI ENDPOINT BACKEND */}
                          <span className="text-sm text-gray-600 ml-auto">
                            Rp {(
                              (typeof item.priceAtOrder === 'number' ? item.priceAtOrder : 0) * // Gunakan priceAtOrder
                              (typeof item.quantity === 'number' ? item.quantity : 0)
                            ).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      Detail
                    </button>
                    {order.status === 'delivered' && (
                      <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                        Ulas
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700">
                        Lacak
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">Tidak ada pesanan yang ditemukan.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-gray-950">
          {[
            { title: 'Katalog Produk', desc: 'Kelola atau telusuri produk pertanian', color: 'emerald' },
            { title: 'Forum Diskusi', desc: 'Buat permintaan atau tawarkan bantuan', color: 'amber' },
            { title: 'Keranjang & Pesanan', desc: 'Lihat pesanan atau riwayat transaksi', color: 'blue' },
          ].map((card, i) => (
            <div
              key={i}
              className={`bg-${card.color}-50 p-4 rounded-lg border border-${card.color}-200`}>
              <h2 className={`font-bold text-${card.color}-800`}>{card.title}</h2>
              <p className="text-gray-600 text-sm mt-1">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}