-- Add user_id column to feeds table (allow NULL initially)
ALTER TABLE public.feeds 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Set default user ID for existing feeds
UPDATE public.feeds SET user_id = '48ec99cf-0eaf-4b1e-a229-9618ff439dd9' WHERE user_id IS NULL;

-- Enforce NOT NULL and default auth.uid()
ALTER TABLE public.feeds 
ALTER COLUMN user_id SET DEFAULT auth.uid(),
ALTER COLUMN user_id SET NOT NULL;

-- Add user_id column to saved_selectors table (allow NULL initially)
ALTER TABLE public.saved_selectors 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Set default user ID for existing saved_selectors
UPDATE public.saved_selectors SET user_id = '48ec99cf-0eaf-4b1e-a229-9618ff439dd9' WHERE user_id IS NULL;

-- Enforce NOT NULL and default auth.uid()
ALTER TABLE public.saved_selectors 
ALTER COLUMN user_id SET DEFAULT auth.uid(),
ALTER COLUMN user_id SET NOT NULL;

-- Drop existing public policies on feeds
DROP POLICY IF EXISTS "Allow public read access on feeds" ON public.feeds;
DROP POLICY IF EXISTS "Allow public insert on feeds" ON public.feeds;
DROP POLICY IF EXISTS "Allow public update on feeds" ON public.feeds;
DROP POLICY IF EXISTS "Allow public delete on feeds" ON public.feeds;

-- Drop existing public policies on saved_selectors
DROP POLICY IF EXISTS "Allow public read access on saved_selectors" ON public.saved_selectors;
DROP POLICY IF EXISTS "Allow public insert on saved_selectors" ON public.saved_selectors;
DROP POLICY IF EXISTS "Allow public delete on saved_selectors" ON public.saved_selectors;
DROP POLICY IF EXISTS "Allow public update on saved_selectors" ON public.saved_selectors;

-- Create secure scoped policies for feeds
CREATE POLICY "Users can fully manage their own feeds"
  ON public.feeds
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create secure scoped policies for saved_selectors
CREATE POLICY "Users can fully manage their own saved_selectors"
  ON public.saved_selectors
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
