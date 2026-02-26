import { supabase } from '@/integrations/supabase/client';
import type { ListSelectors } from '@/types/feed';

export interface SavedSelector {
  id: string;
  domain: string;
  name: string;
  list_selectors: ListSelectors;
  content_selector: string | null;
  content_format: string;
  created_at: string;
  updated_at: string;
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function getSavedSelectors(domain: string): Promise<SavedSelector[]> {
  const { data, error } = await supabase
    .from('saved_selectors')
    .select('*')
    .eq('domain', domain)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function saveSelector(selector: {
  domain: string;
  name: string;
  list_selectors: ListSelectors;
  content_selector?: string;
  content_format?: string;
}): Promise<SavedSelector> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await supabase
    .from('saved_selectors')
    .upsert(
      {
        domain: selector.domain,
        name: selector.name,
        list_selectors: selector.list_selectors,
        content_selector: selector.content_selector || null,
        content_format: selector.content_format || 'text',
        user_id: userData.user.id,
      } as any,
      {
        onConflict: 'domain,name',
      }
    )
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteSavedSelector(id: string): Promise<void> {
  const { error } = await supabase.from('saved_selectors').delete().eq('id', id);
  if (error) throw error;
}
