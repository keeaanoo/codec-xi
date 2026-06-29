# CODEC-XI: Multimedia Codec Toolkit

CODEC-XI adalah aplikasi web 100% *client-side* (dijalankan sepenuhnya di dalam peramban/browser pengguna) yang dirancang untuk keperluan tugas kuliah multimedia. Aplikasi ini menyediakan fungsionalitas untuk kompresi citra (Huffman), kompresi audio (FFmpeg), kompresi video (FFmpeg), dan steganografi gambar (LSB).

---

## Cara Kerja Aplikasi Web

Aplikasi ini menggunakan arsitektur modern tanpa server (*Serverless / Client-Side processing*). Seluruh proses encoding, decoding, kompresi, dan steganografi diproses di peramban menggunakan perangkat keras lokal pengguna (CPU/GPU) tanpa mengirim data apa pun ke server luar. Hal ini menjamin privasi data secara penuh.

### Poin Utama Cara Kerja:
1. **HTML5 Canvas API**: Digunakan untuk membaca dan memanipulasi piksel mentah (RGBA) dari file gambar sebelum dikompresi dengan Huffman atau dimanipulasi dengan steganografi LSB.
2. **WebAssembly (Wasm)**: Menjalankan kode biner C/C++ dari perpustakaan FFmpeg langsung di browser menggunakan `FFmpeg.wasm`. Ini memungkinkan transcoding audio & video berkinerja tinggi tanpa kompilasi server.
3. **SharedArrayBuffer**: Digunakan oleh FFmpeg.wasm untuk melakukan multithreading di browser.
4. **Vercel Headers Configuration (`vercel.json`)**: Untuk mengizinkan `SharedArrayBuffer` berjalan dengan aman, peramban mewajibkan kebijakan keamanan ketat melalui *header* HTTP berikut:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

---

## Penjelasan Algoritma Codec & Fungsionalitas

### 1. Kompresi Citra — Huffman Coding (Lossless)
Kompresi Huffman adalah algoritma kompresi data tanpa kehilangan (*lossless*) berbasis pengkodean prefiks dengan panjang variabel (*variable-length prefix coding*).

* **Cara Kerja**:
  1. **Analisis Frekuensi**: Aplikasi membaca data piksel gambar (RGBA) dan menghitung frekuensi kemunculan setiap nilai byte (0–255).
  2. **Pembangunan Pohon Huffman (Huffman Tree)**:
     - Membuat simpul daun (*leaf node*) untuk setiap byte yang ada.
     - Menggabungkan dua simpul dengan frekuensi terendah secara berulang hingga menyisakan satu simpul akar (*root node*).
  3. **Pemberian Kode**: Menelusuri pohon dari akar ke daun. Cabang kiri diberi nilai bit `0` dan cabang kanan diberi nilai bit `1`. Byte dengan frekuensi tinggi akan mendapatkan kode bit yang lebih pendek (efisiensi).
  4. **Serialisasi File (`.huff`)**: Struktur pohon (tabel frekuensi) disimpan bersama dengan bitstream terkompresi ke dalam berkas biner `.huff` dengan *header* khusus (`"HUFF"`).
  5. **Dekompresi**: Membaca kembali tabel frekuensi dari berkas `.huff`, membangun ulang Pohon Huffman, dan menelusuri bitstream untuk merekonstruksi piksel gambar asli dengan presisi 100%.

### 2. Kompresi Audio — FFmpeg (Lossy)
Kompresi audio menggunakan FFmpeg.wasm untuk mengubah format dan menurunkan laju bit (*bitrate*) file audio.

* **Format Pilihan**: **MP3** (128 Kbps).
* **Cara Kerja**:
  1. File audio (seperti `.wav` tanpa kompresi atau `.mp3` resolusi tinggi) diunggah ke memori sistem berkas virtual FFmpeg.
  2. FFmpeg mengompresi data audio dengan menghilangkan frekuensi suara yang sulit didengar oleh telinga manusia (prinsip psikoakustik).
  3. Menurunkan laju bit menjadi 128 kbps konstan yang mengoptimalkan ukuran file tanpa mengurangi kualitas secara signifikan.

### 3. Kompresi Video — FFmpeg (Lossy)
Kompresi video menggunakan FFmpeg.wasm dengan codec **H.264 (libx264)** untuk mengurangi ukuran video.

* **Format Pilihan**: **MP4 (H.264)** (Resolusi 720p, Preset Medium).
* **Cara Kerja**:
  1. File video (MP4/WebM) dimasukkan ke sistem berkas virtual.
  2. Jika video memiliki resolusi sangat tinggi, FFmpeg akan mengubah skalanya (*downscale*) menjadi resolusi **1280x720 (720p)** menggunakan filter skala (`scale=-2:720`).
  3. Video dikodekan ulang dengan codec H.264 menggunakan algoritma estimasi gerakan untuk menghilangkan redundansi temporal (perbedaan antar bingkai/frame) dan spasial (redundansi dalam satu frame).
  4. Preset `medium` memastikan keseimbangan optimal antara kecepatan pemrosesan dan efisiensi ukuran file.

### 4. Steganografi — LSB (Least Significant Bit)
Steganografi LSB adalah teknik menyembunyikan informasi rahasia ke dalam media pembawa (dalam hal ini, gambar) secara tidak kasat mata.

* **Cara Kerja**:
  1. **Konversi Teks**: Pesan teks diubah menjadi urutan bit biner (masing-masing karakter berupa 8 bit).
  2. **Penyisipan LSB**:
     - Bit pesan disisipkan ke dalam bit paling tidak signifikan (Least Significant Bit / bit ke-0) dari komponen warna merah (R), hijau (G), dan biru (B) dari setiap piksel gambar.
     - Contoh: Jika nilai merah piksel adalah `254` (biner `11111110`) dan bit pesan adalah `1`, nilai diubah menjadi `255` (biner `11111111`). Perubahan 1 unit warna ini tidak dapat dideteksi oleh mata manusia.
     - Bit alpha (A) sengaja diabaikan untuk mencegah distorsi transparansi oleh browser.
  3. **Penanda Akhir (Sentinel)**: Aplikasi menyisipkan karakter null (`\0` atau biner `00000000`) di akhir pesan untuk menandai batas akhir teks saat proses ekstraksi/dekode.
  4. **Pentingnya Format PNG**: Hasil stego-image wajib diunduh dalam format **PNG** (Lossless), karena jika menggunakan JPG, kompresi lossy dari JPG akan merusak nilai bit LSB sehingga pesan tidak bisa dibaca lagi.
