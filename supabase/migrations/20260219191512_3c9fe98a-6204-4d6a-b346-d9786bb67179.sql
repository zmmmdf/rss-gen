
-- Create feeds table for storing feed configurations
CREATE TABLE public.feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  list_selectors JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_selector TEXT,
  content_format TEXT NOT NULL DEFAULT 'text',
  item_count INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No auth so allow public access
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on feeds"
  ON public.feeds FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on feeds"
  ON public.feeds FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on feeds"
  ON public.feeds FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on feeds"
  ON public.feeds FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_feeds_updated_at
  BEFORE UPDATE ON public.feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
