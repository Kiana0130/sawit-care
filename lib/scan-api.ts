import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { File as ExpoFile, UploadType } from 'expo-file-system';

import { getAccessToken } from '@/lib/auth-storage';
import { ApiError, getApiErrorMessage, request, type User } from '@/lib/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? 'http://localhost:8000/v1';

export class ScanApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ScanApiError';
  }
}

async function requestScan<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError) throw new ScanApiError(error.status, error.code, error.message);
    throw error;
  }
}

export type ScanStatus = 'pending' | 'healthy' | 'sick';

export type ScanItem = {
  id: string;
  client_id: string;
  status: ScanStatus;
  disease: null;
  confidence: null;
  image_url: null;
  scanned_at: string;
};

export type ScanPhotoSource = { uri: string; headers?: Record<string, string> };

type ScanList = {
  items: ScanItem[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};

export type ScanQuota = {
  date: string;
  plan: string;
  limit: number | null;
  used: number;
  remaining: number | null;
};

type DashboardSummary = {
  total_scans: number;
  healthy_scans: number;
  sick_scans: number;
  pending_scans: number;
  sick_tree_count: number;
  last_updated_at: string | null;
};

export async function submitScan(uri: string, mimeType?: string | null) {
  const clientId = randomUUID();
  try {
    if (Platform.OS !== 'web') {
      const uploadNativeFile = async (token: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);
        try {
          const result = await new ExpoFile(uri).upload(`${API_URL}/scans`, {
            httpMethod: 'POST',
            uploadType: UploadType.MULTIPART,
            fieldName: 'image',
            mimeType: mimeType ?? 'image/jpeg',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            parameters: { client_id: clientId },
            signal: controller.signal,
          });
          if (result.status >= 200 && result.status < 300) return JSON.parse(result.body) as ScanItem;
          let code = 'REQUEST_FAILED';
          try {
            const payload = JSON.parse(result.body) as { detail?: string; error?: { code?: string } };
            code = payload.error?.code ?? payload.detail ?? code;
          } catch { /* use HTTP status fallback */ }
          throw new ApiError(result.status, code, code);
        } finally {
          clearTimeout(timeout);
        }
      };

      const token = await getAccessToken();
      if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi login tidak ditemukan. Silakan login kembali.');
      try {
        return await uploadNativeFile(token);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        // Let the shared client refresh an expired access token, then retry the same idempotent upload.
        await request<User>('/users/me');
        const refreshedToken = await getAccessToken();
        if (!refreshedToken) throw error;
        return await uploadNativeFile(refreshedToken);
      }
    }

    const form = new FormData();
    form.append('client_id', clientId);
    const response = await fetch(uri);
    form.append('image', await response.blob(), 'leaf-image.jpg');
    return await requestScan<ScanItem>('/scans', { method: 'POST', body: form });
  } catch (error) {
    if (error instanceof ApiError) throw new ScanApiError(error.status, error.code, getApiErrorMessage(error, error.message));
    if (error instanceof ScanApiError) throw error;
    throw new ScanApiError(0, 'UPLOAD_ERROR', error instanceof Error ? `Upload gagal: ${error.message}` : 'Upload foto gagal. Periksa izin file dan koneksi API.');
  }
}

export function getScanHistory(page = 1, statusFilter: 'all' | 'healthy' | 'sick' | 'pending' = 'all') {
  const query = new URLSearchParams({ page: String(page), page_size: '20', status: statusFilter, sort: 'latest' });
  return requestScan<ScanList>(`/scans?${query}`);
}

export function getScanDetail(id: string) {
  return requestScan<ScanItem>(`/scans/${id}`);
}

export function deleteScan(id: string) {
  return requestScan<void>(`/scans/${id}`, { method: 'DELETE' });
}

export function getScanQuota() {
  return requestScan<ScanQuota>('/scans/quota');
}

export function getDashboardSummary() {
  return requestScan<DashboardSummary>('/dashboard/summary');
}

export async function getScanPhoto(id: string): Promise<ScanPhotoSource> {
  const token = await getAccessToken();
  if (!token) throw new ScanApiError(401, 'UNAUTHENTICATED', 'Sesi login tidak ditemukan.');
  const url = `${API_URL}/scans/${id}/photo`;
  if (Platform.OS !== 'web') return { uri: url, headers: { Authorization: `Bearer ${token}` } };
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new ScanApiError(response.status, 'PHOTO_UNAVAILABLE', 'Foto scan tidak dapat dimuat.');
  return { uri: URL.createObjectURL(await response.blob()) };
}

export function getCurrentUser(): Promise<User> {
  return requestScan<User>('/users/me');
}
