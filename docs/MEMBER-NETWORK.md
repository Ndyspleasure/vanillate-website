# Integrasi Member Network

Menu `/admin/member-network` membaca analitik agregat saat dibuka menggunakan sesi Supabase CMS existing. Tidak ada polling atau snapshot tambahan ke bot utama. Pengelolaan anggota, komunitas dan campaign dibuka pada panel layanan mandiri melalui tautan tanpa JWT di URL.

Atur repository variable `PUBLIC_MEMBER_NETWORK_API_URL` ke origin HTTPS aplikasi Wispbyte (tanpa path/query). Workflow Deploy memasukkannya saat build. Atur `CMS_ORIGIN=https://vanillate.id` pada backend Member Network, dan masukkan UUID Supabase Auth admin/viewer yang diizinkan ke allowlist backend. Tanpa URL, halaman menampilkan penjelasan konfigurasi dan tidak melakukan request.

Nilai URL bersifat publik. Jangan mengisi secret bot, service-role key, DATABASE_URL atau encryption key di website. Backend memverifikasi JWT dan hak akses sendiri. Halaman CMS ini bukan pengganti pemeriksaan otorisasi backend. Panel admin layanan mungkin meminta login CMS lagi karena cookie layanan mandiri tidak dibagikan lintas origin.

Perkiraan biaya: satu request analitik per pembukaan/manual refresh dengan jeda minimum 15 detik. Tidak membaca database pemain. Pengujian model memeriksa URL HTTPS, format agregat dan keberadaan menu. Pemasangan baru aktif setelah backend Wispbyte dan URL telah dikonfigurasi.
