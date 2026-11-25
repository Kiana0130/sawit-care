import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { ApiError, request } from '@/lib/api';
import * as attemptStorage from '@/lib/payment-attempt-storage';
import { createAttemptManager, createPaymentClient, paymentErrorMessage, paymentGrantLabel, paymentStatusLabel, safeCheckoutUrl, type Payment } from '@/lib/payments';
import { useAuth } from '@/providers/auth-provider';

const api = createPaymentClient(request);
const attempts = createAttemptManager(attemptStorage, Crypto.randomUUID);

export default function PaymentsScreen() {
  const { user, refreshProfile } = useAuth();
  const [items, setItems] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const hasUncertainCheckout = items.some(item => ['checkout_uncertain', 'pending', 'created'].includes(item.status));

  const history = useCallback(async () => {
    const result = await api.history();
    setItems(result.items);
    setLoaded(true);
    try { await refreshProfile(); }
    catch { setNotice('Riwayat diperbarui, tetapi profil belum dapat dimuat ulang. Periksa lagi.'); }
  }, [refreshProfile]);
  useEffect(() => {
    let active = true;
    void api.history().then(result => {
      if (active) { setItems(result.items); setLoaded(true); }
    }).catch(err => { if (active) setError(paymentErrorMessage(err instanceof ApiError ? err.code : undefined)); });
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'PAYMENT_CHECKOUT_UNRESOLVED') {
        setError('Masih ada transaksi yang belum selesai. Muat ulang riwayat dan periksa statusnya.');
      } else setError(paymentErrorMessage(err instanceof ApiError ? err.code : undefined));
    }
    finally { lock.current = false; setBusy(false); }
  };
  const create = (clientId?: string) => void run(async () => {
    if (!user) return;
    const payment = await attempts.create(user.id, clientId, api.create);
    setItems(current => [payment, ...current.filter(item => item.order_id !== payment.order_id)]);
    setNotice('Transaksi dibuat. Buka pembayaran, lalu periksa status secara manual.');
  });
  const recover = () => void run(async () => {
    if (!user) return;
    const payment = await attempts.recover(user.id, api.recover);
    if (!payment) { setNotice('Tidak ada upaya tersimpan di perangkat ini. Muat ulang riwayat.'); return; }
    setItems(current => [payment, ...current.filter(item => item.order_id !== payment.order_id)]);
    try { await refreshProfile(); }
    catch { setNotice('Transaksi dipulihkan, tetapi profil belum dapat dimuat ulang.'); return; }
    setNotice('Transaksi dipulihkan. Periksa status server di bawah.');
  });
  const open = (payment: Payment) => void run(async () => {
    if (!payment.redirect_url || !safeCheckoutUrl(payment.redirect_url)) throw new Error('invalid checkout URL');
    await WebBrowser.openBrowserAsync(payment.redirect_url);
    setNotice('Menutup browser tidak menandakan pembayaran berhasil. Periksa status secara manual.');
  });
  const check = (payment: Payment) => void run(async () => {
    const updated = await api.status(payment.order_id);
    setItems(current => current.map(item => item.order_id === updated.order_id ? updated : item));
    try { await refreshProfile(); }
    catch { setNotice('Status diperbarui, tetapi profil belum dapat dimuat ulang. Periksa lagi.'); return; }
    setNotice('Status dan profil diperbarui dari server.');
  });

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>LANGGANAN SAWIT CARE</Text>
    <Text style={styles.title}>Paket & pembayaran</Text>
    <Text style={styles.intro}>Kelola paket dan lihat transaksi Anda di sini.</Text>

    <View style={styles.planCard}>
      <View style={styles.planHeader}><Text style={styles.planName}>Sawit Care PRO</Text><Text style={styles.badge}>{user?.plan === 'pro' ? 'AKTIF' : 'PAKET PRO'}</Text></View>
      <Text style={styles.price}>Rp25.000 <Text style={styles.period}>/ 30 hari</Text></Text>
      <Text style={styles.planDetail}>Pembayaran sekali untuk 30 hari dan tidak diperpanjang otomatis.</Text>
      <View style={styles.planDivider} />
      <Text style={styles.planDetail}>Kuota scan tanpa batas selama masa aktif PRO.</Text>
      <Text style={styles.planDetail}>Fitur peta, pelacakan, dan laporan masih dalam pengembangan.</Text>
      <Pressable accessibilityRole="button" disabled={busy || !loaded || hasUncertainCheckout} style={[styles.button, (busy || !loaded || hasUncertainCheckout) && styles.disabled]} onPress={() => create()}><Text style={styles.buttonText}>{user?.plan === 'pro' ? 'Perpanjang PRO' : 'Pilih paket PRO'}</Text></Pressable>
    </View>

    <View style={styles.sandboxNotice}>
      <Text style={styles.sandboxTitle}>Mode uji coba sandbox</Text>
      <Text accessibilityRole="alert" style={styles.sandboxText}>Jangan gunakan rekening bank, kartu, atau dompet digital asli. Gunakan hanya data uji resmi Midtrans.</Text>
    </View>
    <Text style={styles.helpText}>Akses diberikan setelah pembayaran diverifikasi server. Setelah menutup pembayaran, periksa status transaksi Anda.</Text>
    {busy ? <ActivityIndicator color="#206B38" style={styles.loading} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}

    <View style={styles.heading}><View style={styles.headingText}><Text style={styles.subtitle}>Riwayat pembayaran</Text><Text style={styles.caption}>Pantau status transaksi Anda</Text></View><Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(history)} style={styles.refresh}><Text style={styles.link}>Muat ulang</Text></Pressable></View>
    {loaded && items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Belum ada pembayaran</Text><Text style={styles.caption}>Transaksi Anda akan muncul di sini.</Text></View> : null}
    {items.map(item => <View key={item.order_id} style={styles.card}>
      <View style={styles.transactionHeader}><Text style={styles.transactionTitle}>Paket PRO</Text><Text style={styles.status}>{paymentStatusLabel(item.status)}</Text></View>
      <Text style={styles.caption}>ID transaksi</Text><Text selectable style={styles.order}>{item.order_id}</Text>
      <Text style={styles.text}>{paymentGrantLabel(item)}</Text>
      {item.status === 'checkout_uncertain' ? <Text style={styles.error}>Jangan buat pembayaran baru. Hubungi operator dengan ID order untuk pemeriksaan manual.</Text> : null}
      {item.redirect_url && ['created', 'pending'].includes(item.status) ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => open(item)} style={styles.action}><Text style={styles.link}>Buka pembayaran sandbox</Text></Pressable> : null}
      {!item.redirect_url && item.status === 'created' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => create(item.client_id)} style={styles.action}><Text style={styles.link}>Lanjutkan pembuatan pembayaran</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => check(item)} style={styles.action}><Text style={styles.link}>Periksa status</Text></Pressable>
    </View>)}
    <Pressable accessibilityRole="button" disabled={busy} onPress={recover} style={styles.recover}><Text style={styles.link}>Pulihkan transaksi tersimpan</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F4' },
  content: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 600, alignSelf: 'center', flexGrow: 1 },
  eyebrow: { color: '#67816C', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 27, fontWeight: '800', color: '#173D27', marginTop: 8 },
  intro: { color: '#6E8071', marginTop: 6, lineHeight: 21 },
  planCard: { marginTop: 24, backgroundColor: '#173D27', borderRadius: 20, padding: 22 },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  badge: { color: '#D9F2D7', backgroundColor: '#35664A', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: '800' },
  price: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 22 }, period: { fontSize: 14, color: '#C8DFCD', fontWeight: '600' },
  planDetail: { color: '#D5E6D6', lineHeight: 21, marginTop: 8 }, planDivider: { height: 1, backgroundColor: '#52735A', marginTop: 18, marginBottom: 4 },
  button: { marginTop: 22, backgroundColor: '#FFFFFF', minHeight: 50, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#206B38', fontWeight: '800' }, disabled: { opacity: 0.5 },
  sandboxNotice: { marginTop: 18, padding: 16, backgroundColor: '#FFF7E4', borderWidth: 1, borderColor: '#F0DDA7', borderRadius: 12 }, sandboxTitle: { color: '#775300', fontWeight: '800' }, sandboxText: { color: '#775300', lineHeight: 20, marginTop: 5 },
  helpText: { color: '#728176', lineHeight: 20, fontSize: 13, marginTop: 14 }, loading: { marginTop: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 12 }, headingText: { flex: 1 }, subtitle: { fontSize: 18, fontWeight: '800', color: '#173D27' }, caption: { color: '#728176', fontSize: 12, marginTop: 5, lineHeight: 18 },
  refresh: { minHeight: 48, justifyContent: 'center', paddingLeft: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginTop: 10, borderWidth: 1, borderColor: '#E7EEE6' },
  transactionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }, transactionTitle: { color: '#173D27', fontWeight: '800', fontSize: 15, flexShrink: 1 }, status: { color: '#206B38', fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  order: { color: '#344C39', fontSize: 13, marginTop: 3 }, text: { color: '#526357', marginTop: 10, lineHeight: 21 },
  empty: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E7EEE6' }, emptyTitle: { color: '#344C39', fontWeight: '700' },
  action: { minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#EDF2ED', marginTop: 8 }, recover: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  link: { color: '#206B38', fontWeight: '700' }, error: { color: '#B3261E', marginTop: 10, lineHeight: 20 }, notice: { color: '#17652F', marginTop: 10, lineHeight: 20 },
});
