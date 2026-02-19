import { supabase } from '@/integrations/supabase/client';
import type { Feed, ListSelectors } from '@/types/feed';

export async function getFeeds(): Promise<Feed[]> {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function getFeed(id: string): Promise<Feed> {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function createFeed(feed: {
  name: string;
  source_url: string;
  list_selectors: ListSelectors;
  content_selector?: string;
  content_format?: string;
}): Promise<Feed> {
  const { data, error } = await supabase
    .from('feeds')
    .insert(feed as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteFeed(id: string): Promise<void> {
  const { error } = await supabase.from('feeds').delete().eq('id', id);
  if (error) throw error;
}

export function getFeedUrl(feedId: string, format: 'xml' | 'json' | 'csv'): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/generate-feed?id=${feedId}&format=${format}`;
}
