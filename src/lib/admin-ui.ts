// Helper tampilan untuk halaman admin. Berjalan di browser.

/**
 * Escape teks sebelum disisipkan ke innerHTML.
 *
 * Ini WAJIB, bukan formalitas: nama server, nama pemain, dan isi pesan log
 * berasal dari Discord — artinya diketik oleh orang luar. Menyisipkannya
 * mentah-mentah ke innerHTML akan membuat siapa pun yang bisa memakai bot
 * mampu menitipkan HTML/JS yang jalan di browser admin.
 */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Kelas warna untuk badge level log. */
export function levelBadge(level: string): string {
  switch (level) {
    case 'error': return 'bg-red-500/15 text-red-600 dark:text-red-400';
    case 'warn':  return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    case 'debug': return 'bg-ink-500/15 text-ink-500 dark:text-cream-300/60';
    default:      return 'bg-teal-500/15 text-teal-700 dark:text-teal-300';
  }
}

/** Blok status: memuat / kosong / error. Semua pesan sudah di-escape. */
export function stateBlock(kind: 'loading' | 'empty' | 'error', message: string): string {
  if (kind === 'loading') {
    return `<div class="flex items-center justify-center py-16">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500"></div>
    </div>`;
  }
  const tone = kind === 'error'
    ? 'text-red-600 dark:text-red-400'
    : 'text-ink-500 dark:text-cream-300/60';
  return `<p class="py-16 text-center text-sm ${tone}">${esc(message)}</p>`;
}

/**
 * Pesan error yang aman ditampilkan.
 *
 * Error mentah dari PostgREST kadang menyebut nama tabel atau policy. Itu tidak
 * berguna bagi admin dan tidak perlu dipajang, jadi kasus yang sudah dikenali
 * diterjemahkan ke bahasa manusia.
 */
export function pesanError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Terjadi kesalahan tak dikenal.';
  const code = error.code ?? '';

  // Tabel belum dibuat — paling sering terjadi sebelum schema.sql dijalankan.
  if (code === '42P01' || /does not exist/i.test(error.message ?? '')) {
    return 'Tabel belum ada di Supabase. Jalankan supabase/schema.sql lebih dulu.';
  }
  // Ditolak RLS.
  if (code === '42501' || /permission denied/i.test(error.message ?? '')) {
    return 'Akun ini tidak punya izin membaca data tersebut.';
  }
  return 'Gagal memuat data. Coba muat ulang halaman.';
}
