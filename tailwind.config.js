/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Baris di bawah ini WAJIB ada agar mode gelap aktif saat tombol diklik
  darkMode: 'class', 
  theme: {
    extend: {
      // Tambahkan kustomisasi warna atau animasi jika diperlukan di sini
    },
  },
  plugins: [],
}