import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Globe, MousePointer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createFeed } from "@/lib/api/feeds";
import { firecrawlApi } from "@/lib/api/firecrawl";
import { toast } from "sonner";
import type { ListSelectors, SelectorStep } from "@/types/feed";
import { SELECTOR_STEPS } from "@/types/feed";
import { SelectorBuilder } from "@/components/SelectorBuilder";
import { ContentExtractor } from "@/components/ContentExtractor";

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
    if (selectors.link) {
      setIsLoading(true);
      try {
        // We'll use the first link found—parse from the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html!, "text/html");
        const containers = selectors.container ? doc.querySelectorAll(selectors.container) : [];
        let firstLink = "";
        if (containers.length > 0 && selectors.link) {
          const linkEl = containers[0].querySelector(selectors.link);
          if (linkEl) {
            firstLink = linkEl.getAttribute("href") || "";
            if (firstLink && !firstLink.startsWith("http")) {
              const base = new URL(url);
              firstLink = new URL(firstLink, base.origin).href;
            }
          }
        }
        if (firstLink) {
          const res = await firecrawlApi.scrape(firstLink, { formats: ["html"], onlyMainContent: false });
          const rawHtml = res.data?.html || res.data?.data?.html;
          if (rawHtml) setContentHtml(rawHtml);
        }
      } catch {
        // If content page fails, still allow step 2 without it
      } finally {
        setIsLoading(false);
      }
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
            </CardContent>
          </Card>

          {/* Selector Builder */}
          {html && (
            <SelectorBuilder
              html={html}
              selectors={selectors}
              onSelectorsChange={setSelectors}
              sourceUrl={url}
            />
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
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="font-mono">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
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
    </div>
  );
}
