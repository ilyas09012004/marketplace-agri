import axios from 'axios';

// Buat instance axios dengan konfigurasi dasar
const api = axios.create({
  baseURL: 'http://localhost:3000/api', // Sesuaikan dengan URL backend kamu jika berbeda
  // Jika kamu menjalankan frontend dan backend di port yang sama (Next.js App Router),
  // maka baseURL bisa dihilangkan atau diisi dengan '/api' untuk route internal.
  // baseURL: '/api', // Contoh jika route internal Next.js

  withCredentials: true, // Penting: Kirim cookie ke backend secara otomatis
});

// Interceptor Request: Tambahkan Authorization header dengan accessToken dari cookie
api.interceptors.request.use(
  (config) => {
    // Fungsi bantu untuk mengambil cookie
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
      return null;
    };

    const token = getCookie('accessToken'); // Ambil access token dari cookie frontend
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor Response (Opsional): Tangani error umum seperti 401 Unauthorized
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Contoh: Redirect ke halaman login jika token tidak valid
      // Karena ini lib, kita tidak bisa menggunakan router di sini secara langsung.
      // Kamu bisa menangani ini di komponen tempat api dipanggil.
      console.error('Unauthorized. Redirecting to login...');
      // window.location.href = '/login'; // Contoh redirect, gunakan router di komponen
    }
    return Promise.reject(error);
  }
);

export default api;