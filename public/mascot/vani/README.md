# Vani — aset maskot Vanillate Studio

Seluruh pose Vani sebagai **PNG transparan**, sudah ditrim (tanpa whitespace
berlebih) dan dioptimalkan untuk web. Dipakai lewat komponen
`src/components/mascot/Vani.astro` — **jangan** menaruh `<img>` manual.

## Daftar aset

| File | Ekspresi / pose | Contoh penggunaan |
| --- | --- | --- |
| `vani-default.png` | Netral, senyum kecil | Umum |
| `vani-wave.png` | Melambai / menyapa | Hero beranda |
| `vani-happy.png` | Gembira, senyum lebar | Sukses, sambutan |
| `vani-celebrate.png` | Merayakan, tangan terangkat | Event, promo, milestone |
| `vani-thinking.png` | Berpikir, tangan di dagu | Empty state / belum ada data |
| `vani-thumbsup.png` | Jempol / OK | Form terkirim |
| `vani-support.png` | Ramah, membantu | Halaman Support |
| `vani-oops.png` | Maaf / bingung (keringat) | Error & 404 |
| `vani-peek.png` | Mengintip dari tepi | Dekorasi sudut |
| `vani-point-left.png` | Menunjuk ke kiri | Menyorot konten di kiri |
| `vani-point-right.png` | Menunjuk ke kanan | Menyorot konten di kanan |
| `vani-sleeping.png` | Tidur / idle | Maintenance / offline |
| `vani-lineup.png` | Tiga pose (depan/samping/belakang) | "Kenalan dengan Vani" (About) |

> `vani-point-left.png` adalah hasil mirror horizontal dari `vani-point-right.png`.

## Cara pakai

```astro
---
import Vani from '@components/mascot/Vani.astro';
---
<Vani variant="hero" size="lg" priority />   <!-- variant → ekspresi default -->
<Vani expression="thumbsup" size="md" />      <!-- pilih pose langsung -->
<Vani expression="thinking" size="sm" alt="" /><!-- alt="" = dekoratif -->
```

Pemetaan variant → ekspresi default: `hero→wave`, `about→happy`,
`support→support`, `empty→thinking`, `error→oops`, `default→default`.
Prop `expression` menimpa pemetaan itu dan bisa memilih pose mana pun di atas.

Props: `variant`, `expression`, `size` (`sm`|`md`|`lg`|`xl`),
`animation` (`none`|`float`|`fade`|`subtle`), `priority`, `alt`, `class`.

## Menambah pose baru

1. Taruh PNG transparan (sudah ditrim) di folder ini, nama `vani-<pose>.png`.
2. Daftarkan di `SOURCES` pada `Vani.astro` (nama → `{ file, w, h }`; `w`/`h`
   dipakai untuk mengunci aspect-ratio agar tidak terjadi layout shift).
3. Opsional: petakan ke sebuah `variant` di `VARIANT_EXPRESSION`.
