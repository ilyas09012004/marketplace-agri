// src/app/page.tsx
import React from 'react';
import Image from 'next/image';
import { ProductList } from '@/components/products';
import { Product } from '@/types';

// Server Component: Ambil data dari API
async function getProducts() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/products`, {
      method: 'GET',
      cache: 'no-store' // Jangan cache untuk development
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json() as Promise<Product[]>;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export default async function HomePage() { // ← Tambah async di sini
  const products = await getProducts(); // ← Ambil data dari API

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner */}
      <div className="relative w-full h-[500px] overflow-hidden ">
        <Image
          src="/utama.png"
          alt="Sawah hijau"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
          className="z-0 brightness-50 scale-110"  // ← Tailwind class
        />
        
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-left max-w-2xl px-6 z-20">
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">
            Temukan Hasil Panen<br />
            <span className="ml-1">Segar </span>
            <span className="bg-white text-agri-green px-1 py-0.9 rounded">Langsung dari</span><br />
            <span className="bg-white text-agri-green px-1 py-0.1 rounded">Petani</span>
          </h1>
          <p className="text-lg md:text-xl mt-4">
            Beli langsung, harga transparan, kirim cepat!
          </p>
          <button className="mt-6 bg-agri-green text-white px-6 py-2 rounded-md font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Jelajahi Produk
          </button>
        </div>
      </div>

      {/* Produk Terbaru */}
      <div className="container mx-auto px-4 py-8">
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Produk Terbaru</h2>
            <div className="flex space-x-2">
              <button className="px-3 py-1 bg-agri-green text-white rounded-md text-sm font-medium">
                Sayuran
              </button>
              <button className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm font-medium">
                Buah-buahan
              </button>
              <button className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm font-medium">
                Umbi-umbian & Serealia
              </button>
            </div>
          </div>
          <ProductList products={products} /> {/* ✅ Sekarang `products` sudah didefinisikan */}
        </section>
      </div>
    </div>
  );
}