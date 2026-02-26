import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Globe, FileText, Save, BookOpen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getFeed, updateFeed } from "@/lib/api/feeds";
import { firecrawlApi } from "@/lib/api/firecrawl";
import { toast } from "sonner";
import type { ListSelectors } from "@/types/feed";
import { SELECTOR_STEPS } from "@/types/feed";
import { SelectorBuilder } from "@/components/SelectorBuilder";
import { ContentExtractor } from "@/components/ContentExtractor";
import { getSavedSelectors, saveSelector, extractDomain, type SavedSelector } from "@/lib/api/saved-selectors";
import { LivePreviewModal } from "@/components/LivePreviewModal";

export default function EditFeed() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [name, setName] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectors, setSelectors] = useState<ListSelectors>({});
  const [contentHtml, setContentHtml] = useState<string | null>(null);
  const [contentSelector, setContentSelector] = useState("");
  const [contentFormat, setContentFormat] = useState<"text" | "html">("text");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSelectorName, setSaveSelectorName] = useState("Default");
  const [selectedSavedSelectorId, setSelectedSavedSelectorId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [pageFetchedForEdit, setPageFetchedForEdit] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const domain = url ? extractDomain(url) : "";

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["feed", id],
    queryFn: () => getFeed(id!),
    enabled: !!id,
  });

  const { data: savedSelectors = [] } = useQuery({
    queryKey: ["saved-selectors", domain],
    queryFn: () => getSavedSelectors(domain),
    enabled: !!domain,
  });

  // Fill form from feed when loaded
  useEffect(() => {
    if (feed && !initialized) {
      setUrl(feed.source_url);
      setName(feed.name);
      setSelectors(feed.list_selectors || {});
      setContentSelector(feed.content_selector || "");
      setContentFormat((feed.content_format as "text" | "html") || "text");
      setInitialized(true);
    }
  }, [feed, initialized]);

  // Auto-fetch page HTML when editing so preview and selectors are visible
  useEffect(() => {
    if (!feed?.source_url || !initialized || pageFetchedForEdit) return;
    let cancelled = false;
    setPageFetchedForEdit(true);
    setLoadingPreview(true);
    (async () => {
      try {
        const res = await firecrawlApi.scrape(feed.source_url, { formats: ["html"], onlyMainContent: false });
        const rawHtml = res.data?.html || res.data?.data?.html;
        if (!cancelled && rawHtml) setHtml(rawHtml);
      } catch (e) {
        if (!cancelled) toast.error((e as Error)?.message || "Failed to load page preview");
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoadingPreview(false);
    };
  }, [feed?.source_url, initialized, pageFetchedForEdit]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateFeed(id!, {
        name: name || new URL(url).hostname,
        source_url: url,
        list_selectors: selectors,
        content_selector: contentSelector || null,
        content_format: contentFormat,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", id] });
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Feed updated!");
      navigate(`/feed/${id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSelectorMutation = useMutation({
    mutationFn: () =>
      saveSelector({
        domain,
        name: saveSelectorName,
        list_selectors: selectors,
        content_selector: contentSelector || undefined,
        content_format: contentFormat,
      }),
    onSuccess: () => {
      toast.success("Selectors saved!");
      setShowSaveDialog(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save selectors"),
  });

  const loadSavedSelector = async (saved: SavedSelector) => {
    setSelectors(saved.list_selectors);
    setContentSelector(saved.content_selector || "");
    setContentFormat(saved.content_format as "text" | "html");
    setSelectedSavedSelectorId(saved.id);
    if (!html && url) {
      setIsLoading(true);
      try {
        const res = await firecrawlApi.scrape(url, { formats: ["html"], onlyMainContent: false });
        const rawHtml = res.data?.html || res.data?.data?.html;
        if (rawHtml) {
          setHtml(rawHtml);
          if (!name) setName(new URL(url).hostname);
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to fetch page");
      } finally {
        setIsLoading(false);
      }
    }
    toast.success(`Loaded "${saved.name}" selectors`);
  };

  const fetchPage = async () => {
    if (!url) return;
    setIsLoading(true);
    try {
      const res = await firecrawlApi.scrape(url, { formats: ["html"], onlyMainContent: false });
      const rawHtml = res.data?.html || res.data?.data?.html;
      if (!rawHtml) throw new Error("No HTML returned");
      setHtml(rawHtml);
      if (!name) setName(new URL(url).hostname);
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch page");
    } finally {
      setIsLoading(false);
    }
  };

  const goToStep2 = async () => {
    setIsLoading(true);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html!, "text/html");
      const containers = selectors.container ? doc.querySelectorAll(selectors.container) : [];
      let firstLink = "";
      if (containers.length > 0) {
        if (selectors.link) {
          const linkEl = containers[0].querySelector(selectors.link);
          if (linkEl) firstLink = linkEl.getAttribute("href") || "";
        } else {
          const container = containers[0];
          if (container.tagName === "A" || container.tagName === "a") {
            firstLink = (container as HTMLAnchorElement).href || container.getAttribute("href") || "";
          }
        }
        if (firstLink && !firstLink.startsWith("http")) {
          firstLink = new URL(firstLink, new URL(url).origin).href;
        }
        if (firstLink) {
          const res = await firecrawlApi.scrape(firstLink, { formats: ["html"], onlyMainContent: false });
          const rawHtml = res.data?.html || res.data?.data?.html;
          if (rawHtml) setContentHtml(rawHtml);
        }
      }
    } catch {
      /* noop */
    } finally {
      setIsLoading(false);
    }
    setStep(2);
  };

  if (feedLoading || !feed) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/feed/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-mono font-bold">
              <span className="text-primary">$</span> edit-feed
            </h1>
            <p className="text-sm text-muted-foreground">
              Step {step} of 2 — {step === 1 ? "Source & Selectors" : "Content Extraction"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="font-mono text-xs"
          >
            <Play className="h-4 w-4 mr-1" />
            Live Preview
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="font-mono glow-orange"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Update Feed
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs ${step === 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
        >
          <Globe className="h-3 w-3" /> Source & Selectors
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs ${step === 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
        >
          <FileText className="h-3 w-3" /> Content
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Source URL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/blog"
                  className="font-mono text-sm bg-background"
                />
                <Button onClick={fetchPage} disabled={!url || isLoading} className="font-mono shrink-0">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Feed name (optional)"
                className="font-mono text-sm bg-background"
              />
              {domain && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {savedSelectors.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs font-mono text-muted-foreground">Load Saved Selectors</Label>
                      </div>
                      <Select
                        value={selectedSavedSelectorId}
                        onValueChange={(value) => {
                          const saved = savedSelectors.find((s) => s.id === value);
                          if (saved) loadSavedSelector(saved);
                        }}
                      >
                        <SelectTrigger className="font-mono text-xs bg-secondary">
                          <SelectValue placeholder="Choose saved selectors..." />
                        </SelectTrigger>
                        <SelectContent>
                          {savedSelectors.map((saved) => (
                            <SelectItem key={saved.id} value={saved.id} className="font-mono text-xs">
                              {saved.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-3 w-3" />
                      <span>No saved selectors for {domain} yet</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editable Selectors — always visible */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Save className="h-4 w-4 text-primary" />
                  Selectors
                </CardTitle>
                {domain && (
                  <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} className="font-mono text-xs">
                    <Save className="h-3 w-3 mr-1" />
                    Save Template
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {SELECTOR_STEPS.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">{s.label}:</span>
                  <Input
                    value={selectors[s.key] || ""}
                    onChange={(e) => setSelectors({ ...selectors, [s.key]: e.target.value || undefined })}
                    placeholder={s.description}
                    className="font-mono text-xs bg-background h-8"
                  />
                </div>
              ))}
              <div className="pt-2 border-t border-border mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">Content:</span>
                  <Input
                    value={contentSelector}
                    onChange={(e) => setContentSelector(e.target.value)}
                    placeholder="CSS selector for full content..."
                    className="font-mono text-xs bg-background h-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">Format:</span>
                  <div className="flex gap-1">
                    <Button
                      variant={contentFormat === "text" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setContentFormat("text")}
                      className="font-mono text-xs h-7 px-2"
                    >
                      Text
                    </Button>
                    <Button
                      variant={contentFormat === "html" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setContentFormat("html")}
                      className="font-mono text-xs h-7 px-2"
                    >
                      HTML
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Page Preview + Visual Selector Builder */}
          {loadingPreview && !html && (
            <Card className="bg-card border-border overflow-hidden">
              <div className="bg-secondary px-3 py-2 border-b border-border">
                <span className="text-xs font-mono text-muted-foreground">Loading page preview…</span>
              </div>
              <CardContent className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-2 text-muted-foreground font-mono text-sm">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Loading page preview…</span>
                </div>
              </CardContent>
            </Card>
          )}

          {html && (
            <SelectorBuilder html={html} selectors={selectors} onSelectorsChange={setSelectors} sourceUrl={url} />
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="font-mono text-xs h-9"
            >
              <Play className="h-3 w-3 mr-1" />
              Live Preview
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="font-mono glow-orange"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Update Feed
            </Button>
            {html && (
              <Button variant="outline" onClick={goToStep2} disabled={isLoading} className="font-mono">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Next: Content
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ContentExtractor
            html={contentHtml}
            contentSelector={contentSelector}
            onContentSelectorChange={setContentSelector}
            contentFormat={contentFormat}
            onContentFormatChange={setContentFormat}
          />
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="font-mono">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {domain && (
                <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} className="font-mono text-xs">
                  <Save className="h-3 w-3 mr-1" />
                  Save Selectors (incl. content)
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="font-mono text-xs h-9"
              >
                <Play className="h-3 w-3 mr-1" />
                Live Preview
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="font-mono glow-orange"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Update Feed
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle className="text-sm">Save Selectors</DialogTitle>
            <DialogDescription className="text-xs">
              Save list selectors and content extraction for {domain} to reuse later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="selector-name-edit" className="text-xs">
                Template Name
              </Label>
              <Input
                id="selector-name-edit"
                value={saveSelectorName}
                onChange={(e) => setSaveSelectorName(e.target.value)}
                placeholder="Default"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="font-mono text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => saveSelectorMutation.mutate()}
              disabled={saveSelectorMutation.isPending || !saveSelectorName.trim()}
              className="font-mono text-xs"
            >
              {saveSelectorMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LivePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        feedConfig={{
          name: name || (url ? new URL(url).hostname : "Live Preview"),
          source_url: url,
          list_selectors: selectors,
          content_selector: contentSelector || undefined,
          content_format: contentFormat,
        }}
      />
    </div>
  );
}
