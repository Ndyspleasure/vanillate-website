// Tujuan setelah login: dipisah dari servers-page.ts supaya halaman server
// tidak ikut mengunduh kode halaman daftar server.

export const NEXT_KEY = 'vanillate-dashboard-next';

/** Dipakai halaman server: simpan tujuan lalu arahkan ke login. */
export function rememberNextAndGoToLogin(next: string): void {
  try {
    sessionStorage.setItem(NEXT_KEY, next);
  } catch {
    /* mode privat: abaikan */
  }
  location.replace('/dashboard/');
}
