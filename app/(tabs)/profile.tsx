import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { getApiErrorMessage } from '@/lib/api';
import { showConfirm } from '@/lib/feedback';
import { validatePasswordChange, validateProfile } from '@/lib/profile-validation';
import { useAuth } from '@/providers/auth-provider';

type Form = 'profile' | 'password' | null;

export default function ProfileScreen() {
  const { changePassword, logout, updateProfile, user } = useAuth();
  const [form, setForm] = useState<Form>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [visible, setVisible] = useState({ current: false, next: false, confirmation: false });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const open = (next: Form) => {
    setName(user?.name ?? ''); setEmail(user?.email ?? '');
    setVisible({ current: false, next: false, confirmation: false });
    setCurrentPassword(''); setNewPassword(''); setConfirmation('');
    setError(''); setSuccess(''); setForm(next);
  };
  const save = async () => {
    if (!user || !form || busy) return;
    setError('');
    const profile = form !== 'password' ? validateProfile(name, email) : null;
    const validationError = form === 'password' ? validatePasswordChange(currentPassword, newPassword, confirmation) : profile?.error;
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    try {
      if (form === 'password') {
        await changePassword(currentPassword, newPassword);
        return;
      }
      if (profile?.value) await updateProfile(profile.value.name, profile.value.email);
      open(null);
      setSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Perubahan belum berhasil disimpan. Coba lagi.'));
    } finally { setBusy(false); }
  };
  const confirmLogout = () => showConfirm('Keluar dari akun?', 'Anda perlu masuk kembali untuk menggunakan akun ini.', 'Ya, Keluar', () => {
    setBusy(true);
    void logout().catch(() => undefined).finally(() => setBusy(false));
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Profil Saya</Text>
        <Text style={styles.subheading}>Kelola informasi dan keamanan akun Anda</Text>
        <View style={styles.hero}>
          <View style={styles.avatar}><SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor="#1B5E20" size={32} /></View>
          <View style={styles.heroText}><Text style={styles.name}>{user?.name ?? 'Profil Petani'}</Text><Text style={styles.email}>{user?.email ?? 'Memuat informasi akun...'}</Text>{user?.plan ? <Text style={styles.plan}>Paket {user.plan.toUpperCase()}</Text> : null}</View>
        </View>
        {success ? <Text accessibilityRole="alert" style={styles.success}>{success}</Text> : null}
        <Text style={styles.section}>INFORMASI PRIBADI</Text>
        <View style={styles.card}>
          <ProfileRow title="Nama lengkap" detail={user?.name ?? '—'} action={() => open('profile')} disabled={!user || busy} />
          <View style={styles.divider} />
          <ProfileRow title="Email" detail={user?.email ?? '—'} action={() => open('profile')} disabled={!user || busy} />
        </View>
        <Text style={styles.section}>KEAMANAN</Text>
        <View style={styles.card}>
          <ProfileRow title="Password" detail="Ubah password akun Anda" action={() => open('password')} disabled={!user || busy} />
        </View>
        <Text style={styles.section}>LANGGANAN</Text>
        <Pressable accessibilityRole="button" disabled={!user || busy} onPress={() => router.push('/payments')} style={styles.primary}><Text style={styles.primaryText}>Pembayaran sandbox & riwayat</Text></Pressable>
        {form ? <View style={styles.form}>
          <Text style={styles.formTitle}>{form === 'profile' ? 'Edit profil' : 'Ubah password'}</Text>
          {form === 'password' ? <>
            <Text style={styles.label}>Password saat ini</Text>
            <View style={styles.passwordRow}>
              <TextInput accessibilityLabel="Password saat ini" autoCapitalize="none" autoCorrect={false} secureTextEntry={!visible.current} maxLength={128} editable={!busy} onChangeText={setCurrentPassword} style={styles.passwordInput} value={currentPassword} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${visible.current ? 'Sembunyikan' : 'Tampilkan'} password saat ini`} disabled={busy} onPress={() => setVisible(current => ({ ...current, current: !current.current }))} style={styles.visibility}><SymbolView name={visible.current ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor="#1B5E20" size={19} /></Pressable>
            </View>
            <Text style={styles.label}>Password baru</Text>
            <View style={styles.passwordRow}>
              <TextInput accessibilityLabel="Password baru" autoCapitalize="none" autoCorrect={false} secureTextEntry={!visible.next} maxLength={128} editable={!busy} onChangeText={setNewPassword} style={styles.passwordInput} value={newPassword} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${visible.next ? 'Sembunyikan' : 'Tampilkan'} password baru`} disabled={busy} onPress={() => setVisible(current => ({ ...current, next: !current.next }))} style={styles.visibility}><SymbolView name={visible.next ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor="#1B5E20" size={19} /></Pressable>
            </View>
            <Text style={styles.hint}>Minimal 12 karakter.</Text>
            <Text style={styles.label}>Konfirmasi password baru</Text>
            <View style={styles.passwordRow}>
              <TextInput accessibilityLabel="Konfirmasi password baru" autoCapitalize="none" autoCorrect={false} secureTextEntry={!visible.confirmation} maxLength={128} editable={!busy} onChangeText={setConfirmation} style={styles.passwordInput} value={confirmation} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${visible.confirmation ? 'Sembunyikan' : 'Tampilkan'} konfirmasi password baru`} disabled={busy} onPress={() => setVisible(current => ({ ...current, confirmation: !current.confirmation }))} style={styles.visibility}><SymbolView name={visible.confirmation ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor="#1B5E20" size={19} /></Pressable>
            </View>
          </> : <>
            <Text style={styles.label}>Nama lengkap</Text>
            <TextInput accessibilityLabel="Nama lengkap" autoCapitalize="words" autoCorrect={false} maxLength={100} editable={!busy} onChangeText={setName} style={styles.input} value={name} />
            <Text style={styles.label}>Email</Text>
            <TextInput accessibilityLabel="Email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={254} editable={!busy} onChangeText={setEmail} style={styles.input} value={email} />
          </>}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Simpan perubahan</Text>}</Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => open(null)} style={styles.cancel}><Text style={styles.cancelText}>Batal</Text></Pressable>
        </View> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={confirmLogout} style={[styles.logout, busy && styles.disabled]}><Text style={styles.logoutText}>Keluar dari akun</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileRow({ title, detail, action, disabled }: { title: string; detail: string; action: () => void; disabled: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} disabled={disabled} onPress={action} style={({ pressed }) => [styles.row, (pressed || disabled) && styles.disabled]}>
    <View style={styles.rowIcon}><SymbolView name={title === 'Password' ? { ios: 'lock', android: 'lock', web: 'lock' } : title === 'Email' ? { ios: 'envelope', android: 'mail', web: 'mail' } : { ios: 'person', android: 'person', web: 'person' }} tintColor="#24733D" size={20} /></View><View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Text style={styles.edit}>Ubah  ›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8F4' },
  content: { padding: 24, paddingTop: 38, paddingBottom: 48, width: '100%', maxWidth: 600, alignSelf: 'center' },
  heading: { fontSize: 27, fontWeight: '800', color: '#173D27' },
  subheading: { marginTop: 6, fontSize: 14, color: '#6E8071' },
  hero: { marginTop: 26, backgroundColor: '#E6F1E5', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  heroText: { flex: 1, marginLeft: 16 }, name: { color: '#173D27', fontSize: 19, fontWeight: '800' }, email: { color: '#607768', marginTop: 5 },
  plan: { color: '#24733D', fontSize: 12, fontWeight: '700', marginTop: 6 },
  section: { color: '#75877A', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 28, marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E7EEE6', overflow: 'hidden' },
  row: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center' }, rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EDF5ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, rowText: { flex: 1 }, rowTitle: { fontSize: 15, fontWeight: '700', color: '#263C2B' }, rowDetail: { color: '#728176', marginTop: 5 }, edit: { color: '#24733D', fontWeight: '700', marginLeft: 8 }, divider: { height: 1, backgroundColor: '#EDF2ED', marginHorizontal: 16 },
  form: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2ECE1', borderRadius: 16, marginTop: 20, padding: 18 }, formTitle: { color: '#173D27', fontSize: 18, fontWeight: '800' },
  label: { color: '#344C39', fontWeight: '700', marginBottom: 6, marginTop: 16 }, input: { backgroundColor: '#FAFCFA', borderColor: '#CDDCCF', borderRadius: 10, borderWidth: 1, minHeight: 50, paddingHorizontal: 14, color: '#212121' }, hint: { color: '#728176', marginTop: 5, fontSize: 12 },
  passwordRow: { alignItems: 'center', backgroundColor: '#FAFCFA', borderColor: '#CDDCCF', borderRadius: 10, borderWidth: 1, flexDirection: 'row' }, passwordInput: { color: '#212121', flex: 1, minHeight: 50, paddingHorizontal: 14 }, visibility: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 12 },
  error: { color: '#B3261E', marginTop: 12 }, success: { color: '#17652F', marginTop: 16 },
  primary: { alignItems: 'center', backgroundColor: '#206B38', borderRadius: 10, justifyContent: 'center', minHeight: 50, marginTop: 20 }, primaryText: { color: '#FFF', fontWeight: '800' }, cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 48 }, cancelText: { color: '#526357', fontWeight: '700' },
  logout: { alignItems: 'center', borderColor: '#E9C8C6', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 28, minHeight: 52 }, logoutText: { color: '#B3261E', fontWeight: '800' }, disabled: { opacity: 0.55 },
});
