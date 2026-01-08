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

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<any[]>([]); // Item di keranjang
  const [totalWeight, setTotalWeight] = useState(0); // ✅ Total berat dari backend
  const [productTotal, setProductTotal] = useState(0); // Total harga produk
  const [shippingCost, setShippingCost] = useState(0); // Ongkos kirim yang dipilih
  const [grandTotal, setGrandTotal] = useState(0);     // Total bayar
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState(''); // ID alamat
  const [selectedCity, setSelectedCity] = useState(''); // ID kota
  const [originVillageCode, setOriginVillageCode] = useState(''); // Tambahkan ini
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedShipping, setSelectedShipping] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  // --- State untuk modal tambah alamat ---
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({
    detail: '',
    cityId: '',        // regency_id
    districtId: '',    // district_id
    villageCode: '',   // village_id (ini yang digunakan untuk destination)
    province: '',      // province name
    zipCode: ''
  });
  const [loadingAddAddress, setLoadingAddAddress] = useState(false);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);        // Daftar kota/kabupaten
  const [subDistricts, setSubDistricts] = useState<any[]>([]); // Daftar kecamatan
  const [villages, setVillages] = useState<any[]>([]);    // Daftar desa/kelurahan
  // --- Sampai sini ---

  useEffect(() => {
    const loadCheckoutData = async () => {
      try {
        setError(null);
        setLoading(true);

        // Ambil access token dari cookie
        const token = getCookie('accessToken');
        if (!token) {
          throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
        }

        // Ambil daftar provinsi
        fetchProvinces();

        // 1. Ambil item keranjang (termasuk totalWeight)
        const cartRes = await fetch('/api/cart', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!cartRes.ok) {
          let errorText = 'Unknown error';
          try {
            const contentType = cartRes.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorJson = await cartRes.json();
              errorText = errorJson.error || 'API Cart returned error';
            } else {
              errorText = await cartRes.text();
            }
          } catch (parseErr) {
            console.error('Failed to parse API Cart error:', parseErr);
            errorText = await cartRes.text();
          }
          throw new Error(`${cartRes.status} - ${errorText}`);
        }

        const cartData = await cartRes.json();
      if (!cartData.success) {
        throw new Error(cartData.error || 'API Cart returned error');
      }

      setCartItems(Array.isArray(cartData.formattedCartItems) ? cartData.formattedCartItems : []);
      setTotalWeight(cartData.totalWeight || 0);

      // ✅ Hitung dan simpan total harga produk
      const calculatedProductTotal = cartData.formattedCartItems.reduce((sum, item) => {
        return sum + (item.product.price * item.quantity);
      }, 0);
      setProductTotal(calculatedProductTotal);

      // Ambil origin_village_code
      if (Array.isArray(cartData.formattedCartItems) && cartData.formattedCartItems.length > 0) {
        setOriginVillageCode(cartData.formattedCartItems[0].product.originVillageCode || '');
      } else {
        setOriginVillageCode('');
        setProductTotal(0); // Reset jika cart kosong
      }

      // 2. Ambil alamat user
      const addrRes = await fetch('/api/address', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!addrRes.ok) {
        console.warn('Failed to fetch addresses, continuing without addresses.');
        setAddresses([]);
      } else {
        const addrData = await addrRes.json();
        if (addrData.success) {
          setAddresses(Array.isArray(addrData.addresses) ? addrData.addresses : []);
          if (addrData.addresses.length > 0) {
            const firstAddr = addrData.addresses[0];
            setSelectedAddress(firstAddr.id);
            setSelectedCity(firstAddr.cityId);
          }
        }
      }

    } catch (err: any) {
      console.error('Error loading checkout ', err);
      setError(err.message);
      if (err.message.includes('Unauthorized') || err.message.includes('Invalid token')) {
        router.push('/login');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  loadCheckoutData();
}, [router]);

  // Fungsi untuk mengambil daftar provinsi
  const fetchProvinces = async () => {
    try {
      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const res = await fetch('/api/locations/provinces', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Provinces Error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API Provinces returned error');
      }

      setProvinces(data.data || []);
    } catch (err: any) {
      console.error('Error fetching provinces:', err);
      setError(err.message);
    }
  };

  // Fungsi untuk mengambil daftar kota/kabupaten berdasarkan provinsi
  const fetchCities = async (provinceId: string) => {
    if (!provinceId) {
      setCities([]);
      setNewAddress(prev => ({ ...prev, cityId: '', districtId: '', villageCode: '' }));
      setSubDistricts([]);
      setVillages([]);
      return;
    }

    try {
      setError(null);

      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const res = await fetch(`/api/locations/regencies/${provinceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Cities Error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API Cities returned error');
      }

      setCities(data.data || []);
      setNewAddress(prev => ({ ...prev, cityId: '', districtId: '', villageCode: '' }));
      setSubDistricts([]);
      setVillages([]);
    } catch (err: any) {
      console.error('Error fetching cities:', err);
      setError(err.message);
      setCities([]);
      setNewAddress(prev => ({ ...prev, cityId: '', districtId: '', villageCode: '' }));
      setSubDistricts([]);
      setVillages([]);
    }
  };

  // Fungsi untuk mengambil daftar kecamatan berdasarkan kota/kabupaten
  const fetchSubDistricts = async (cityId: string) => {
    if (!cityId) {
      setSubDistricts([]);
      setNewAddress(prev => ({ ...prev, districtId: '', villageCode: '' }));
      setVillages([]);
      return;
    }

    try {
      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const res = await fetch(`/api/locations/districts/${cityId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Sub-Districts Error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API Sub-Districts returned error');
      }

      setSubDistricts(data.data || []);
      setNewAddress(prev => ({ ...prev, districtId: '', villageCode: '' }));
      setVillages([]);
    } catch (err: any) {
      console.error('Error fetching sub-districts:', err);
      setError(err.message);
      setSubDistricts([]);
      setNewAddress(prev => ({ ...prev, districtId: '', villageCode: '' }));
      setVillages([]);
    }
  };

  // Fungsi untuk mengambil daftar desa/kelurahan berdasarkan kecamatan
  const fetchVillages = async (districtId: string) => {
    if (!districtId) {
      setVillages([]);
      setNewAddress(prev => ({ ...prev, villageCode: '' }));
      return;
    }

    try {
      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const res = await fetch(`/api/locations/villages/${districtId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Villages Error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API Villages returned error');
      }

      setVillages(data.data || []);
      setNewAddress(prev => ({ ...prev, villageCode: '' }));
    } catch (err: any) {
      console.error('Error fetching villages:', err);
      setError(err.message);
      setVillages([]);
      setNewAddress(prev => ({ ...prev, villageCode: '' }));
    }
  };

  // Handler untuk mengganti alamat
  const handleAddressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const addrId = e.target.value;
    const addr = addresses.find(a => a.id === addrId);
    if (addr) {
      setSelectedAddress(addrId);
      setSelectedCity(addr.cityId);
      // Jika kamu ingin load villages saat pilih alamat, uncomment baris ini
      // fetchVillages(addr.districtId);
    }
  };

// ✅ Fungsi untuk estimasi ongkir
const handleEstimateShipping = async () => {
  if (!selectedAddress) {
    setError('Silakan pilih alamat terlebih dahulu.');
    return;
  }

  const selectedAddr = addresses.find(a => a.id === selectedAddress);
  if (!selectedAddr || !selectedAddr.villageCode) {
    setError('Alamat yang dipilih tidak memiliki kode desa/kelurahan.');
    return;
  }

  if (cartItems.length === 0 || totalWeight <= 0) {
    setError('Keranjang kosong atau total berat tidak valid.');
    return;
  }

  // ✅ Validasi origin_village_code
  if (!originVillageCode) {
    setError('Origin village code produk tidak ditemukan.');
    return;
  }

  try {
    setError(null);

    const token = getCookie('accessToken');
    if (!token) {
      throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
    }

    // ✅ Kirim data sebagai body JSON ke endpoint POST
    const res = await fetch('/api/rajaongkir/estimate', {
      method: 'POST', // ✅ PASTIKAN METHOD NYA POST
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        origin_village_code: originVillageCode, // Dari state produk
        destination_village_code: selectedAddr.villageCode, // Dari alamat pembeli
        weight: totalWeight, // Dari total berat cart
        // courier: 'jne' // Opsional
      })
    });

    if (!res.ok) {
      let errorText = 'Unknown error';
      try {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorJson = await res.json();
          errorText = errorJson.error || 'API RajaOngkir Estimate returned error';
        } else {
          errorText = await res.text();
        }
      } catch (parseErr) {
        console.error('Failed to parse API RajaOngkir Estimate error:', parseErr);
        errorText = await res.text();
      }
      throw new Error(`${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'API RajaOngkir Estimate returned error');
    }

    // ✅ Format data sesuai dengan respons dari endpoint kamu
    // Respons dari endpoint adalah: { success: true, formattedData: [...] }
    // Jadi akses data dengan `data.formattedData`
    const formattedOptions = data.formattedData.map((opt: any) => ({
      service: opt.service, // Gunakan field dari respons
      name: opt.service,    // Gunakan field dari respons
      value: opt.value,     // Gunakan field dari respons
      etd: opt.etd,         // Gunakan field dari respons
      description: opt.description // Gunakan field dari respons
    }));

    setShippingOptions(formattedOptions);
    // ✅ Reset selectedShipping agar user harus memilih lagi
    setSelectedShipping('');
    setShippingCost(0); // Reset ongkir
    setGrandTotal(productTotal); // Reset grand total ke total produk dulu

  } catch (err: any) {
    console.error('Error estimating shipping:', err);
    setError(err.message);
  }
};

// Update handler saat memilih jasa ongkir
const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  const selectedValue = parseInt(value, 10);
  setSelectedShipping(selectedValue.toString());
  setShippingCost(selectedValue); // Simpan ongkos kirim

  // ✅ Hitung dan simpan grand total
  const calculatedGrandTotal = productTotal + selectedValue;
  setGrandTotal(calculatedGrandTotal);
};

// Update handleCheckout untuk mengirim grandTotal
const handleCheckout = async () => {
  if (!selectedAddress || !selectedShipping) {
    setError('Please select address and shipping option');
    return;
  }

  // ✅ Validasi grandTotal
  if (grandTotal <= 0) {
    setError('Total pembayaran tidak valid.');
    return;
  }

  try {
    setError(null);

    const token = getCookie('accessToken');
    if (!token) {
      throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
    }

    // ✅ Ambil alamat yang dipilih untuk dikirim ke backend checkout
    const selectedAddr = addresses.find(a => a.id === selectedAddress);
    if (!selectedAddr) {
      throw new Error('Alamat yang dipilih tidak valid.');
    }

    // ✅ Kirim data ke endpoint checkout yang benar
    const res = await fetch('/api/cart/checkout', { // Ganti ke endpoint checkout
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        addressId: selectedAddress,      // ID alamat dari state
        shippingOption: selectedShipping, // Harga ongkir yang dipilih (dari state)
        paymentMethod,                   // Metode pembayaran dari state
        // ✅ Kirim grandTotal yang sudah dihitung di frontend
        totalAmount: grandTotal,
        // Jika backend kamu membutuhkan origin_village_code atau data lain dari frontend
        // untuk keperluan logging atau verifikasi, kirimkan juga
        originVillageCode: originVillageCode,
        destinationVillageCode: selectedAddr.villageCode,
        weight: totalWeight,
        // dst.
      })
    });

    if (!res.ok) {
      let errorText = 'Unknown error';
      try {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorJson = await res.json();
          errorText = errorJson.error || 'API Checkout returned error';
        } else {
          errorText = await res.text();
        }
      } catch (parseErr) {
        console.error('Failed to parse API Checkout error:', parseErr);
        errorText = await res.text();
      }
      throw new Error(`${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'API Checkout returned error');
    }

    // ✅ Handle respons sukses (misalnya, redirect ke halaman order detail)
    alert('Checkout successful! Order ID: ' + data.orderId);
    router.push('/orders/' + data.orderId);

  } catch (err: any) {
    console.error('Checkout failed:', err);
    setError(err.message);
  }
};

  // --- Handler untuk modal tambah alamat ---
  const handleAddAddressClick = () => {
    setShowAddAddressModal(true);
  };

  const handleAddAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAddress(prev => ({ ...prev, [name]: value }));
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceId = e.target.value;
    setNewAddress(prev => ({ ...prev, province: provinceId, cityId: '', districtId: '', villageCode: '' }));
    setCities([]);
    setSubDistricts([]);
    setVillages([]);
    if (provinceId) {
      fetchCities(provinceId);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    setNewAddress(prev => ({ ...prev, cityId, districtId: '', villageCode: '' }));
    setSubDistricts([]);
    setVillages([]);
    if (cityId) {
      fetchSubDistricts(cityId);
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtId = e.target.value;
    setNewAddress(prev => ({ ...prev, districtId, villageCode: '' }));
    setVillages([]);
    if (districtId) {
      fetchVillages(districtId);
    }
  };

  const handleAddAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAddAddress(true);
    setError('');

    try {
      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const provinceName = provinces.find(p => p.id === newAddress.province)?.name || '';

      const res = await fetch('/api/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          detail: newAddress.detail,
          cityId: newAddress.cityId,
          districtId: newAddress.districtId,
          villageCode: newAddress.villageCode,
          province: provinceName,
          zipCode: newAddress.zipCode,
        })
      });

      if (!res.ok) {
        let errorText = 'Unknown error';
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorJson = await res.json();
            errorText = errorJson.error || 'API Add Address returned error';
          } else {
            errorText = await res.text();
          }
        } catch (parseErr) {
          console.error('Failed to parse API Add Address error:', parseErr);
          errorText = await res.text();
        }
        throw new Error(`${res.status} - ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API Add Address returned error');
      }

      setAddresses(prev => [...prev, data.address]);
      setSelectedAddress(data.address.id);
      setSelectedCity(data.address.cityId);

      setShowAddAddressModal(false);
      setNewAddress({ detail: '', cityId: '', districtId: '', villageCode: '', province: '', zipCode: '' });

      alert('Alamat berhasil ditambahkan!');

    } catch (err: any) {
      console.error('Error adding address:', err);
      setError(err.message);
    } finally {
      setLoadingAddAddress(false);
    }
  };

  const handleModalClose = () => {
    setShowAddAddressModal(false);
    setError('');
    setNewAddress({ detail: '', cityId: '', districtId: '', villageCode: '', province: '', zipCode: '' });
  };
  // --- Sampai sini ---

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-green-700">Memuat checkout...</div>
    </div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-green-800">Checkout</h1>
        <p className="text-gray-600 mt-2">Lengkapi pesananmu sekarang!</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kolom Kiri: Items */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">Daftar Produk</h2>
          {cartItems.length > 0 ? (
            <div className="space-y-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  {item.product.image && (
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{item.product.name}</h3>
                    <p className="text-sm text-gray-600">
                      Rp {item.product.price.toLocaleString('id-ID')} / {item.product.unit || 'kg'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-700">
                      x{item.quantity} = Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">Tidak ada item di keranjang.</p>
          )}

          {/* Total */}
           <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-lg font-bold text-green-700">
            <span>Total Belanja:</span>
            <span className="text-green-700">
              {/* ✅ Gunakan state productTotal */}
              Rp {productTotal.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between text-md text-gray-600 mt-1">
            <span>Total Berat:</span>
            <span>{totalWeight} gram</span>
          </div>
        </div>
      </div>

        {/* Kolom Kanan: Shipping & Payment */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">Pengiriman & Pembayaran</h2>

           {/* Address (Alamat Tujuan) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Alamat Pengiriman (Tujuan)</label>
          {addresses.length > 0 ? (
            <select
              value={selectedAddress}
              onChange={handleAddressChange}
              className="w-full p-3 border text-neutral-500 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {addresses.map(addr => (
                <option key={addr.id} value={addr.id}>
                  {/* Tambahkan villageCode di sini jika perlu */}
                  {addr.detail}, {addr.cityName || addr.cityId}, {addr.province}, {addr.zipCode} ({addr.villageCode})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-gray-500">Belum ada alamat.</p>
          )}
          <button
            onClick={handleAddAddressClick}
            className="mt-2 w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Tambah Alamat
          </button>
        </div>

        {/* Village (Desa/Kelurahan) - Alamat Asal Pengiriman */}
         {/*{originVillageCode && (*/}
           {/*<div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Desa/Kelurahan Asal Pengiriman</label>
            <p className="p-3 border border-gray-300 rounded-lg bg-gray-50 text-black">
              {/* ✅ Tampilkan origin_village_code dari produk
              {originVillageCode}
            </p>
          </div>
        )} */}

        {/* Tombol Estimasi Ongkir */}
         <button
          onClick={handleEstimateShipping}
          disabled={!selectedAddress || !originVillageCode || totalWeight <= 0}
          className={`mb-6 w-full py-2 px-4 rounded-lg font-medium transition ${
            selectedAddress && originVillageCode && totalWeight > 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Estimasi Ongkir
        </button>

        {/* ✅ Tampilkan Pilihan Jasa Ongkir */}
        {shippingOptions.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Opsi Pengiriman</label>
            <div className="space-y-2">
              {shippingOptions.map(opt => ( // <-- Baris 975:76 ?
                <div key={opt.service} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="shipping"
                      value={opt.value} // <-- Apakah opt.value didefinisikan?
                      checked={selectedShipping === opt.value.toString()}
                      onChange={handleShippingChange}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium">{opt.service}</p>
                      <p className="text-sm text-gray-600">Rp {opt.value.toLocaleString('id-ID')} • {opt.etd}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ Tampilkan Total Harga Produk, Ongkir, dan Grand Total */}
        {productTotal > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Rincian Pembayaran</h3>
            <div className="flex justify-between text-sm  text-gray-800">
              <span>Total Produk:</span>
              <span>Rp {productTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm mt-1  text-gray-800">
              <span>Ongkos Kirim:</span>
              <span>Rp {shippingCost > 0 ? shippingCost.toLocaleString('id-ID') : '0'}</span>
            </div>
            <div className="flex justify-between text-lg font-bold mt-3 pt-2 border-t border-gray-300  text-gray-800">
              <span>Total Bayar:</span>
              <span className="text-green-700">Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

          {/* Payment Method */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
            <div className="space-y-2">
              <label className="flex items-center  text-gray-800">
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="mr-2"
                />
                <span>Cash on Delivery (COD)</span>
              </label>
              <label className="flex items-center  text-gray-800">
                <input
                  type="radio"
                  name="payment"
                  value="transfer"
                  checked={paymentMethod === 'transfer'}
                  onChange={() => setPaymentMethod('transfer')}
                  className="mr-2"
                />
                <span>Transfer Bank</span>
              </label>
            </div>
          </div>

          {/* Place Order Button */}
           <button
          onClick={handleCheckout}
          disabled={!selectedShipping}
          className={`w-full py-3 px-4 rounded-lg font-bold text-white transition ${
            selectedShipping
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {selectedShipping ? 'Place Order' : 'Pilih Opsi Pengiriman'}
        </button>
      </div>
    </div>

      {/* --- Modal Tambah Alamat --- */}
      {showAddAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-green-800 mb-4">Tambah Alamat Baru</h2>

            {error && <div className="text-red-500 mb-4">{error}</div>}

            <form onSubmit={handleAddAddressSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  name="detail"
                  value={newAddress.detail}
                  onChange={handleAddAddressChange}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Provinsi</label>
                <select
                  name="province"
                  value={newAddress.province}
                  onChange={handleProvinceChange}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  required
                >
                  <option value="">Pilih Provinsi</option>
                  {provinces.map(prov => (
                    <option key={prov.id} value={prov.id}>
                      {prov.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Kota/Kabupaten</label>
                <select
                  name="cityId"
                  value={newAddress.cityId}
                  onChange={handleCityChange}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  required
                  disabled={!newAddress.province}
                >
                  <option value="">Pilih Kota/Kabupaten</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Kecamatan</label>
                <select
                  name="districtId"
                  value={newAddress.districtId}
                  onChange={handleDistrictChange}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  required
                  disabled={!newAddress.cityId}
                >
                  <option value="">Pilih Kecamatan</option>
                  {subDistricts.map(dist => (
                    <option key={dist.id} value={dist.id}>
                      {dist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Desa/Kelurahan</label>
                <select
                  name="villageCode"
                  value={newAddress.villageCode}
                  onChange={handleAddAddressChange}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  required
                  disabled={!newAddress.districtId}
                >
                  <option value="">Pilih Desa/Kelurahan</option>
                  {villages.map(village => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Pos</label>
                <input
                  type="text"
                  name="zipCode"
                  value={newAddress.zipCode}
                  onChange={handleAddAddressChange}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                  disabled={loadingAddAddress}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  disabled={loadingAddAddress}
                >
                  {loadingAddAddress ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- Sampai sini --- */}
    </div>
  );
};