export interface ListSelectors {
  container?: string;
  title?: string;
  description?: string;
  date?: string;
  link?: string;
  image?: string;
}

export interface Feed {
  id: string;
  name: string;
  source_url: string;
  list_selectors: ListSelectors;
  content_selector: string | null;
  content_format: string;
  item_count: number;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SelectorStep = 'container' | 'title' | 'description' | 'date' | 'link' | 'image';

export const SELECTOR_STEPS: { key: SelectorStep; label: string; description: string }[] = [
  { key: 'container', label: 'Post Container', description: 'Click a repeating post/article element' },
  { key: 'title', label: 'Title', description: 'Click the title of a post' },
  { key: 'description', label: 'Description', description: 'Click the description/summary text' },
  { key: 'date', label: 'Date', description: 'Click the date/timestamp' },
  { key: 'link', label: 'Post Link', description: 'Click the link to the full post' },
  { key: 'image', label: 'Image', description: 'Click the thumbnail/image' },
];
