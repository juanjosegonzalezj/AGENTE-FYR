import { api } from '@/lib/api';
import CourtsClient from './CourtsClient';

const TENANT_ID = process.env.DEMO_TENANT_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function getCourts() {
  try {
    const res = await api.get<{ success: boolean; data: any[] }>(
      '/api/v1/courts',
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

export default async function CourtsPage() {
  const courts = await getCourts();
  return <CourtsClient courts={courts} tenantId={TENANT_ID} />;
}
