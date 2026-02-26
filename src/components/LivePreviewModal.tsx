import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Rss, FileJson } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ListSelectors } from "@/types/feed";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feedConfig: {
        name: string;
        source_url: string;
        list_selectors: ListSelectors;
        content_selector?: string;
        content_format?: "text" | "html";
    };
}

export function LivePreviewModal({ open, onOpenChange, feedConfig }: Props) {
    const [activeFormat, setActiveFormat] = useState<"xml" | "json">("xml");
    const [previewData, setPreviewData] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState(false);

    // When modal opens, we could auto-fetch or wait for user to click.
    // Because the config could be large, let's fetch on demand or on first open.
    const handleOpenChange = (newOpen: boolean) => {
        onOpenChange(newOpen);
        if (!newOpen) {
            // Clear data when closing so it always loads fresh next time
            setPreviewData({});
        } else {
            // Auto fetch default format when opening
            fetchPreview("xml");
        }
    };

    const fetchPreview = async (format: "xml" | "json") => {
        if (!feedConfig.source_url) {
            toast.error("Source URL is required for preview");
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("generate-feed", {
                body: {
                    preview: feedConfig,
                    format,
                },
            });
            if (error) throw error;

            if (typeof data === "string") {
                setPreviewData((prev) => ({ ...prev, [format]: data }));
            } else {
                setPreviewData((prev) => ({ ...prev, [format]: JSON.stringify(data, null, 2) }));
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to generate live preview");
            setPreviewData((prev) => ({ ...prev, [format]: `Error: ${e.message}` }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="font-mono flex items-center gap-2">
                        <span className="text-primary">$</span> live-preview
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs">
                        Generate a real feed response without saving to the database.
                    </DialogDescription>
                </DialogHeader>

                <Tabs
                    value={activeFormat}
                    onValueChange={(v) => {
                        const format = v as "xml" | "json";
                        setActiveFormat(format);
                        if (!previewData[format]) {
                            fetchPreview(format);
                        }
                    }}
                    className="flex-1 min-h-0 flex flex-col mt-4"
                >
                    <div className="flex items-center justify-between">
                        <TabsList className="bg-secondary border border-border font-mono">
                            <TabsTrigger value="xml" className="font-mono text-xs">
                                <Rss className="h-3 w-3 mr-1" /> XML (RSS)
                            </TabsTrigger>
                            <TabsTrigger value="json" className="font-mono text-xs">
                                <FileJson className="h-3 w-3 mr-1" /> JSON Feed
                            </TabsTrigger>
                        </TabsList>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchPreview(activeFormat)}
                            disabled={loading}
                            className="font-mono text-xs"
                        >
                            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Run Live Test
                        </Button>
                    </div>

                    <TabsContent value="xml" className="flex-1 mt-4 border border-border rounded-md relative bg-background">
                        {loading && !previewData["xml"] ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-md">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-xs font-mono text-muted-foreground">Scraping & generating...</span>
                                </div>
                            </div>
                        ) : null}
                        <pre className="p-4 overflow-auto max-h-[500px] text-xs h-full">
                            {previewData["xml"] || "No data"}
                        </pre>
                    </TabsContent>

                    <TabsContent value="json" className="flex-1 mt-4 border border-border rounded-md relative bg-background">
                        {loading && !previewData["json"] ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-md">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-xs font-mono text-muted-foreground">Scraping & generating...</span>
                                </div>
                            </div>
                        ) : null}
                        <pre className="p-4 overflow-auto max-h-[500px] text-xs h-full">
                            {previewData["json"] || "No data"}
                        </pre>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
