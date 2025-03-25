# Hadist API Collection

![Hadist API](https://img.shields.io/badge/Hadist-API-brightgreen) ![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-JavaScript-blue) ![Version](https://img.shields.io/badge/Version-1.1.0-orange)

API Hadist Collection adalah layanan API yang menyediakan akses ke koleksi hadist dari berbagai periwayat. Dibangun menggunakan Google Apps Script dan Google Spreadsheet sebagai database.

## Fitur

- ✅ Daftar hadist dari berbagai periwayat (Bukhari, Muslim, Malik, dll)
- 🔍 Pencarian hadist berdasarkan kata kunci
- 🎲 Pengambilan hadist acak
- 📚 Filter berdasarkan periwayat
- 📊 Panel admin dengan visualisasi statistik penggunaan
- 📈 Sistem log akses dan statistik penggunaan
- 🚀 Sistem cache untuk performa yang lebih baik
- 🔔 Notifikasi Telegram untuk monitoring

## Endpoint

| Endpoint | Method | Deskripsi | Contoh |
|----------|--------|-----------|--------|
| `/` | GET | Halaman informasi API | `/?` |
| `/?action=books` | GET | Mendapatkan daftar periwayat | `/?action=books` |
| `/?action=hadith&book=[id]&range=[start]-[end]` | GET | Mendapatkan hadist berdasarkan periwayat dan range | `/?action=hadith&book=bukhari&range=1-10` |
| `/?action=random&count=[jumlah]` | GET | Mendapatkan hadist secara acak | `/?action=random&count=5` |
| `/?action=search&q=[keyword]` | GET | Mencari hadist berdasarkan kata kunci | `/?action=search&q=nikah` |
| `/?action=stats` | GET | Menampilkan statistik API | `/?action=stats` |
| `/?action=admin` | GET | Panel admin (visualisasi data) | `/?action=admin` |

## Format Response

### Daftar Periwayat

```json
{
  "code": 200,
  "message": "9 books sent.",
  "data": [
    {
      "name": "HR. Abu Daud",
      "id": "abu-daud",
      "available": 4419
    },
    {
      "name": "HR. Ahmad",
      "id": "ahmad",
      "available": 4305
    },
    ...
  ],
  "error": false
}
```

### Hadist Berdasarkan Periwayat

```json
{
  "code": 200,
  "message": "10 hadiths requested.",
  "data": {
    "name": "HR. Bukhari",
    "id": "bukhari",
    "available": 6638,
    "requested": 10,
    "hadiths": [
      {
        "number": 1,
        "arab": "...",
        "indonesia": "..."
      },
      ...
    ]
  },
  "error": false
}
```

### Hasil Pencarian

```json
{
  "status": "success",
  "keyword": "nikah",
  "count": 62,
  "data": [
    {
      "number": 498,
      "arab": "...",
      "indonesia": "...",
      "riwayat": "HR. Malik",
      "id": "malik"
    },
    ...
  ]
}
```

## Cara Menggunakan

1. Clone repository ini
2. Buat spreadsheet di Google Sheets dengan format yang sesuai (lihat bagian Setup)
3. Buka Google Apps Script dan buat project baru
4. Salin kode dari file `code.gs` ke editor script
5. Deploy sebagai web app:
   - Klik "Deploy" > "New deployment"
   - Pilih jenis "Web app"
   - Set akses ke "Anyone"
   - Klik "Deploy"
6. Gunakan URL deployment untuk mengakses API

## Setup Spreadsheet

Buat spreadsheet dengan struktur berikut:

1. Sheet "hadist" dengan kolom:
   - number (nomor hadist)
   - arab (teks hadist dalam bahasa Arab)
   - indonesia (terjemahan bahasa Indonesia)
   - riwayat (nama periwayat, contoh: "HR. Bukhari")
   - id (ID periwayat, contoh: "bukhari")

2. Sheet "logAccess" dan "apiStats" akan dibuat otomatis oleh script.

## Panel Admin

API ini juga menyediakan panel admin untuk visualisasi penggunaan:

![Admin Panel](https://via.placeholder.com/800x400?text=Admin+Panel)

Panel admin menampilkan:
- Statistik penggunaan API
- Log akses terbaru
- Grafik penggunaan endpoint
- Grafik penggunaan harian (7 hari terakhir)

## Berkontribusi

Kontribusi sangat diterima! Silakan fork repository ini dan buat pull request.

## Lisensi

[MIT License](LICENSE)

## Kontak

Jika Anda memiliki pertanyaan atau saran, silakan buka issue di repository ini.
