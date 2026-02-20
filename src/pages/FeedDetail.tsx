import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, RefreshCw, Loader2, Rss, FileJson, FileSpreadsheet, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFeed, getFeedUrl } from "@/lib/api/feeds";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export default function FeedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [previewData, setPreviewData] = useState<Record<string, string | null>>({});
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);

  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed", id],
    queryFn: () => getFeed(id!),
    enabled: !!id,
  });

  const copyUrl = (format: "xml" | "json" | "csv") => {
    navigator.clipboard.writeText(getFeedUrl(id!, format));
    toast.success(`${format.toUpperCase()} URL copied`);
  };

  const fetchPreview = async (format: "xml" | "json" | "csv") => {
    setLoadingFormat(format);
    try {
      const { data, error } = await supabase.functions.invoke("generate-feed", {
        body: { id, format },
      });
      if (error) throw error;
      if (typeof data === "string") {
        setPreviewData((prev) => ({ ...prev, [format]: data }));
      } else {
        setPreviewData((prev) => ({ ...prev, [format]: JSON.stringify(data, null, 2) }));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate feed");
    } finally {
      setLoadingFormat(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Feed not found</p>
      </div>
    );
  }

  const formats = [
    { key: "xml" as const, label: "RSS 2.0 (XML)", icon: Rss },
    { key: "json" as const, label: "JSON Feed", icon: FileJson },
    { key: "csv" as const, label: "CSV", icon: FileSpreadsheet },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-mono font-bold">
              <span className="text-primary">$</span> {feed.name}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">{feed.source_url}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/feed/${feed.id}/edit`)} className="font-mono">
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
      </div>

      {/* Metadata */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">Items:</span>{" "}
              <span className="text-foreground">{feed.item_count}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Format:</span>{" "}
              <Badge variant="secondary" className="font-mono text-xs">{feed.content_format}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Last scraped:</span>{" "}
              <span className="text-foreground">
                {feed.last_scraped_at
                  ? formatDistanceToNow(new Date(feed.last_scraped_at), { addSuffix: true })
                  : "never"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Selectors:</span>{" "}
              <span className="text-foreground">
                {Object.keys(feed.list_selectors || {}).filter(k => (feed.list_selectors as any)?.[k]).length} defined
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Output Links & Preview */}
      <Tabs defaultValue="xml" className="space-y-4">
        <TabsList className="bg-secondary border border-border font-mono">
          {formats.map((f) => (
            <TabsTrigger key={f.key} value={f.key} className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {f.key.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>

        {formats.map((f) => (
          <TabsContent key={f.key} value={f.key}>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <f.icon className="h-4 w-4 text-primary" />
                  {f.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-background border border-border text-xs font-mono text-muted-foreground truncate">
                    {getFeedUrl(id!, f.key)}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyUrl(f.key)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPreview(f.key)}
                    disabled={loadingFormat === f.key}
                  >
                    {loadingFormat === f.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                </div>

                {previewData[f.key] && (
                  <pre className="code-panel max-h-[400px] overflow-auto whitespace-pre-wrap text-xs">
                    {previewData[f.key]}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
