// src/app/layout.tsx
import React, { ReactNode } from 'react';
import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Agri-X',
  description: 'Marketplace Pertanian',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen ">
          {/* Header */}
          <header className="bg-white shadow-sm py-3 sticky top-0 z-50">
            <div className="container mx-auto flex items-center  justify-center gap-20">

              {/* Logo */}
              <Link href="/" className="flex items-center">
                <img src="/logo.png" alt="Agri-X" className="h-8" />
              </Link>

              {/* Menu */}
              <nav className="flex items-center space-x-6 ">
                <Link href="/" className="text-gray-700 text-sm font-medium">Home</Link>
                <Link href="/products" className="text-gray-700 text-sm font-medium">Produk</Link>
                <Link href="/cart" className="text-gray-700 text-sm font-medium">Keranjang</Link>

                {/* Button Forum */}
                <button className="border border-agri-green text-agri-green px-4 py-1 rounded-md text-sm font-medium hover:bg-agri-green hover:text-white transition-colors">
                  Forum
                </button>

                {/* Akun */}
                <Link href="/login" className="flex items-center text-gray-700 text-sm font-medium gap-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Akun
                </Link>
              </nav>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-grow">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-gray-100 py-6 mt-12">
            <div className="container mx-auto px-4 text-center text-gray-600">
              © {new Date().getFullYear()} Agri-X. Membangun pertanian yang lebih baik.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}