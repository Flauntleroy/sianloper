# SIANLOPER - Sistem Antrian Rumah Sakit

Aplikasi manajemen antrian berbasis Electron untuk Rumah Sakit. Dikembangkan oleh RSUD H. Abdul Aziz Marabahan.

## Features

- **Multi Loket**: Mendukung beberapa loket antrian (Loket A dan B)
- **Tampilan Terpisah**: Tampilan antrian dan tampilan operator terpisah
- **Panggilan Suara**: Sistem panggilan otomatis dengan suara
- **Sinkronisasi Data**: Sinkronisasi data antrian secara real-time
- **Kustomisasi**: Pengaturan tampilan yang dapat disesuaikan (logo, teks berjalan, dll)
- **Integrasi Database**: Dukungan untuk MySQL

## Requirements

- Windows 7 atau lebih tinggi
- Node.js 14 atau lebih tinggi
- MySQL (opsional, untuk fitur database)

## Installation

1. Clone repositori ini
   ```
   git clone https://github.com/username/sianloper.git
   cd sianloper
   ```

2. Install dependensi
   ```
   npm install
   ```

3. Jalankan aplikasi
   ```
   npm start
   ```

## Development

```
npm run dev
```

## Build 

Untuk membuat executable Windows:
```
npm run build
```

Hasil build akan tersedia di folder `dist`.

## Structure

- `main.js` - File utama Electron
- `index.html` - Halaman utama aplikasi
- `staff-a.html` / `staff-b.html` - Antarmuka operator loket
- `display-a.html` / `display-b.html` - Tampilan antrian untuk pengunjung
- `settings.html` - Halaman pengaturan aplikasi
- `settings.json` - File konfigurasi aplikasi
- `assets/` - Folder untuk aset (logo, suara, dll)

## License

Copyright © 2025 ITRSHAA. All rights reserved.
