import { db } from '../client.js';
import type { SportsComplex } from '../../types/index.js';

export async function getComplexById(id: string): Promise<SportsComplex | null> {
  const { data, error } = await db.client
    .from('sports_complexes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as SportsComplex;
}

export async function getComplexByWhatsappNumber(phone: string): Promise<SportsComplex | null> {
  const { data, error } = await db.client
    .from('sports_complexes')
    .select('*')
    .eq('whatsapp_number', phone)
    .eq('plan_status', 'active')
    .single();

  if (error || !data) return null;
  return data as SportsComplex;
}

export async function getComplexBySlug(slug: string): Promise<SportsComplex | null> {
  const { data, error } = await db.client
    .from('sports_complexes')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as SportsComplex;
}

export async function createComplex(payload: Partial<SportsComplex>): Promise<SportsComplex> {
  const { data, error } = await db.client
    .from('sports_complexes')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Failed to create complex: ${error.message}`);
  return data as SportsComplex;
}

export async function updateComplex(
  id: string,
  payload: Partial<SportsComplex>
): Promise<SportsComplex> {
  const { data, error } = await db.client
    .from('sports_complexes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update complex: ${error.message}`);
  return data as SportsComplex;
}
