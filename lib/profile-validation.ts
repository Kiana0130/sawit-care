export function validateProfile(name: string, email: string):
  | { value: { name: string; email: string }; error: null }
  | { value: null; error: string } {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    return { value: null, error: 'Nama harus terdiri dari 2–100 karakter.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { value: null, error: 'Format email tidak valid.' };
  }
  return { value: { name: normalizedName, email: normalizedEmail }, error: null };
}

export function validatePasswordChange(current: string, next: string, confirmation: string): string | null {
  if (!current || current.length > 128) return 'Masukkan password saat ini (maksimal 128 karakter).';
  if (next.length < 12 || next.length > 128) return 'Password baru harus terdiri dari 12–128 karakter.';
  if (next === current) return 'Password baru harus berbeda dari password saat ini.';
  if (next !== confirmation) return 'Konfirmasi password baru tidak cocok.';
  return null;
}
