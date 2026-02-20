import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Globe, MousePointer, FileText, Save, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createFeed } from "@/lib/api/feeds";
import { firecrawlApi } from "@/lib/api/firecrawl";
import { toast } from "sonner";
import type { ListSelectors, SelectorStep } from "@/types/feed";
import { SELECTOR_STEPS } from "@/types/feed";
import { SelectorBuilder } from "@/components/SelectorBuilder";
import { ContentExtractor } from "@/components/ContentExtractor";
import { getSavedSelectors, saveSelector, extractDomain, type SavedSelector } from "@/lib/api/saved-selectors";

export default function CreateFeed() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
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

  // Extract domain from URL
  const domain = url ? extractDomain(url) : "";

  // Load saved selectors for the current domain
  const { data: savedSelectors = [] } = useQuery({
    queryKey: ['saved-selectors', domain],
    queryFn: () => getSavedSelectors(domain),
    enabled: !!domain,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      createFeed({
        name: name || new URL(url).hostname,
        source_url: url,
        list_selectors: selectors,
        content_selector: contentSelector || undefined,
        content_format: contentFormat,
      }),
    onSuccess: (feed) => {
      toast.success("Feed created!");
      navigate(`/feed/${feed.id}`);
    },
    onError: (e) => toast.error(e.message),
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
    // Load the selectors
    setSelectors(saved.list_selectors);
    setContentSelector(saved.content_selector || "");
    setContentFormat(saved.content_format as "text" | "html");
    setSelectedSavedSelectorId(saved.id);

    // If page hasn't been fetched yet, fetch it automatically
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
    // Try to fetch the first post's link for content extraction
    setIsLoading(true);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html!, "text/html");
      const containers = selectors.container ? doc.querySelectorAll(selectors.container) : [];
      let firstLink = "";

      if (containers.length > 0) {
        if (selectors.link) {
          // Link selector is specified
          const linkEl = containers[0].querySelector(selectors.link);
          if (linkEl) {
            firstLink = linkEl.getAttribute("href") || "";
          }
        } else {
          // No link selector - check if container itself is an anchor tag
          const container = containers[0];
          if (container.tagName === 'A' || container.tagName === 'a') {
            firstLink = (container as HTMLAnchorElement).href || container.getAttribute("href") || "";
          }
        }

        if (firstLink && !firstLink.startsWith("http")) {
          const base = new URL(url);
          firstLink = new URL(firstLink, base.origin).href;
        }

        if (firstLink) {
          const res = await firecrawlApi.scrape(firstLink, { formats: ["html"], onlyMainContent: false });
          const rawHtml = res.data?.html || res.data?.data?.html;
          if (rawHtml) setContentHtml(rawHtml);
        }
      }
    } catch {
      // If content page fails, still allow step 2 without it
    } finally {
      setIsLoading(false);
    }
    setStep(2);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-mono font-bold">
            <span className="text-primary">$</span> new-feed
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 2 — {step === 1 ? "Source & Selectors" : "Content Extraction"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs ${step === 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          <Globe className="h-3 w-3" /> Source & Selectors
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs ${step === 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          <FileText className="h-3 w-3" /> Content
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          {/* URL Input */}
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

              {/* Saved Selectors */}
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
                          const saved = savedSelectors.find(s => s.id === value);
                          if (saved) {
                            loadSavedSelector(saved);
                          }
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

          {/* Selector Builder */}
          {html && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">Configure selectors</span>
                {domain && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveDialog(true)}
                    className="font-mono text-xs"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Selectors
                  </Button>
                )}
              </div>
              <SelectorBuilder
                html={html}
                selectors={selectors}
                onSelectorsChange={setSelectors}
                sourceUrl={url}
              />
            </>
          )}

          {html && (
            <div className="flex justify-end">
              <Button onClick={goToStep2} disabled={isLoading} className="font-mono glow-green">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Next: Content
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  className="font-mono text-xs"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save Selectors (incl. content)
                </Button>
              )}
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="font-mono glow-green"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Feed
            </Button>
          </div>
        </div>
      )}

      {/* Save Selector Dialog */}
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
              <Label htmlFor="selector-name" className="text-xs">Template Name</Label>
              <Input
                id="selector-name"
                value={saveSelectorName}
                onChange={(e) => setSaveSelectorName(e.target.value)}
                placeholder="Default"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              className="font-mono text-xs"
            >
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
    </div>
  );
}
