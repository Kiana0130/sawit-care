export type Payment = {
  order_id: string;
  client_id: string;
  status: string;
  redirect_url: string | null;
  granted_until: string | null;
};

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createPaymentClient(request: Request) {
  return {
    create: (clientId: string) => request<Payment>('/payments', { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
    recover: (clientId: string) => request<Payment>('/payments/recover', { method: 'POST', body: JSON.stringify({ client_id: clientId }) }),
    history: () => request<{ items: Payment[] }>('/payments'),
    status: (orderId: string) => request<Payment>(`/payments/${encodeURIComponent(orderId)}`),
  };
}

export function safeCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'app.sandbox.midtrans.com' && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}


type AttemptStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export function createAttemptManager(storage: AttemptStorage, randomId: () => string) {
  return {
    async recover<T>(userId: string, recover: (id: string) => Promise<T>): Promise<T | null> {
      if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error('Invalid user ID');
      const key = `payment_attempt_${userId}`;
      const id = await storage.get(key);
      if (!id) return null;
      const result = await recover(id);
      await storage.remove(key);
      return result;
    },
    async create<T>(userId: string, requestedId: string | undefined, create: (id: string) => Promise<T>): Promise<T> {
      if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error('Invalid user ID');
      const key = `payment_attempt_${userId}`;
      const existing = await storage.get(key);
      if (existing && requestedId && existing !== requestedId) throw new Error('Unresolved payment attempt');
      const id = existing ?? requestedId ?? randomId();
      if (!existing) await storage.set(key, id);
      const result = await create(id);
      await storage.remove(key);
      return result;
    },
  };
}

export function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: 'Sedang dibuat', checkout_uncertain: 'Pembuatan pembayaran belum pasti', pending: 'Menunggu pembayaran', settlement: 'Pembayaran berhasil',
    capture: 'Pembayaran berhasil', deny: 'Pembayaran ditolak', cancel: 'Pembayaran dibatalkan',
    expire: 'Pembayaran kedaluwarsa', failure: 'Pembayaran gagal', refund: 'Pembayaran dikembalikan',
    partial_refund: 'Pembayaran dikembalikan sebagian', chargeback: 'Pembayaran disengketakan',
    partial_chargeback: 'Pembayaran disengketakan sebagian',
  };
  return Object.hasOwn(labels, status) ? labels[status] : 'Status belum diketahui';
}

export function paymentGrantLabel(payment: Pick<Payment, 'granted_until' | 'status'>): string {
  return payment.granted_until
    ? `Akhir pemberian akses awal: ${payment.granted_until}. Akses saat ini dapat berubah; periksa profil.`
    : 'Belum ada akses yang dikonfirmasi. Periksa status untuk memperbarui.';
}

export function paymentErrorMessage(code?: string): string {
  const messages: Record<string, string> = {
    PAYMENT_SERVICE_UNAVAILABLE: 'Layanan pembayaran belum tersedia. Silakan coba lagi.',
    PAYMENT_CHECKOUT_UNCERTAIN: 'Pembuatan pembayaran belum pasti. Jangan buat pembayaran baru; muat ulang riwayat dan hubungi operator dengan ID order untuk pemeriksaan manual.',
    PAYMENT_CHECKOUT_UNRESOLVED: 'Masih ada transaksi yang belum selesai. Muat ulang riwayat dan periksa statusnya.',
    PAYMENT_LEGACY_GRANT_REVIEW_REQUIRED: 'Transaksi lama memerlukan pemeriksaan manual oleh operator. Status akses belum dapat diperbarui.',
    PAYMENT_STATUS_INVALID: 'Status pembayaran belum dapat diverifikasi. Silakan coba lagi.',
    UNAUTHENTICATED: 'Sesi Anda sudah berakhir. Silakan login kembali.',
    RESOURCE_NOT_FOUND: 'Transaksi pembayaran tidak ditemukan.',
    REQUEST_TIMEOUT: 'Server terlalu lama merespons. Coba lagi untuk melanjutkan transaksi yang sama.',
    NETWORK_ERROR: 'Tidak dapat terhubung ke server. Periksa koneksi dan coba lagi.',
  };
  return code && Object.hasOwn(messages, code) ? messages[code] : 'Permintaan pembayaran belum berhasil. Silakan coba lagi.';
}
