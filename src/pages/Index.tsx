import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Rss, Copy, Trash2, ExternalLink, Clock, Hash, Pencil, CopyPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getFeeds, deleteFeed, getFeedUrl, createFeed } from "@/lib/api/feeds";
import { toast } from "sonner";
import type { Feed } from "@/types/feed";
import { formatDistanceToNow } from "date-fns";

function FeedCard({ feed }: { feed: Feed }) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => deleteFeed(feed.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Feed deleted");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () =>
      createFeed({
        name: `${feed.name} (copy)`,
        source_url: feed.source_url,
        list_selectors: feed.list_selectors,
        content_selector: feed.content_selector || undefined,
        content_format: feed.content_format,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Feed duplicated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to duplicate feed"),
  });

  const copyUrl = (format: "xml" | "json" | "csv") => {
    navigator.clipboard.writeText(getFeedUrl(feed.id, format));
    toast.success(`${format.toUpperCase()} URL copied`);
  };

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <Link to={`/feed/${feed.id}`} className="group">
              <h3 className="font-mono font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {feed.name}
              </h3>
            </Link>
            <p className="text-xs text-muted-foreground font-mono truncate mt-1">{feed.source_url}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => duplicateMutation.mutate()}
              title="Duplicate feed"
              disabled={duplicateMutation.isPending}
            >
              {duplicateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}
            </Button>
            <Link to={`/feed/${feed.id}/edit`}>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="Edit feed">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              title="Delete feed"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {feed.item_count} items
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {feed.last_scraped_at
              ? formatDistanceToNow(new Date(feed.last_scraped_at), { addSuffix: true })
              : "never"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(["xml", "json", "csv"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => copyUrl(fmt)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Copy className="h-3 w-3" />
              {fmt.toUpperCase()}
            </button>
          ))}
          <Link to={`/feed/${feed.id}`} className="ml-auto">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Index() {
  const { data: feeds, isLoading } = useQuery({
    queryKey: ["feeds"],
    queryFn: getFeeds,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">
            <span className="text-primary">$</span> feeds
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your RSS feed generators</p>
        </div>
        <Link to="/create">
          <Button className="font-mono glow-orange">
            <Plus className="h-4 w-4 mr-1" />
            New Feed
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="p-4 h-32" />
            </Card>
          ))}
        </div>
      ) : feeds && feeds.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {feeds.map((feed) => (
            <FeedCard key={feed.id} feed={feed} />
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-12 text-center">
            <Rss className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-mono text-lg text-foreground mb-2">No feeds yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first RSS feed by scraping a website
            </p>
            <Link to="/create">
              <Button className="font-mono glow-orange">
                <Plus className="h-4 w-4 mr-1" />
                Create Feed
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
