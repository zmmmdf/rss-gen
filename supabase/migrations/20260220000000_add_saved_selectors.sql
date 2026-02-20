-- Create saved_selectors table for storing selector templates by domain
CREATE TABLE public.saved_selectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  list_selectors JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_selector TEXT,
  content_format TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(domain, name)
);

-- No auth so allow public access
ALTER TABLE public.saved_selectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on saved_selectors"
  ON public.saved_selectors FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on saved_selectors"
  ON public.saved_selectors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on saved_selectors"
  ON public.saved_selectors FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on saved_selectors"
  ON public.saved_selectors FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_saved_selectors_updated_at
  BEFORE UPDATE ON public.saved_selectors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster domain lookups
CREATE INDEX idx_saved_selectors_domain ON public.saved_selectors(domain);
