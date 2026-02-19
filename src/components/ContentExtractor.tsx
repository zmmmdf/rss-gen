import { useRef, useEffect } from "react";
import { FileText, MousePointer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  html: string | null;
  contentSelector: string;
  onContentSelectorChange: (s: string) => void;
  contentFormat: "text" | "html";
  onContentFormatChange: (f: "text" | "html") => void;
}

export function ContentExtractor({
  html,
  contentSelector,
  onContentSelectorChange,
  contentFormat,
  onContentFormatChange,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    // Check if HTML is a full document or just body content
    const trimmedHtml = html.trim();
    const isFullDocument = trimmedHtml.toLowerCase().startsWith('<!doctype') || trimmedHtml.toLowerCase().startsWith('<html');
    
    doc.open();
    
    if (isFullDocument) {
      // If it's a full document, inject our styles into the head using string manipulation
      // to preserve the original HTML exactly as-is
      const selectorStyles = `
        <style>
          .__rss-hover { outline: 2px dashed #22c55e !important; outline-offset: 2px; cursor: crosshair !important; }
          .__rss-selected { outline: 2px solid #22c55e !important; outline-offset: 2px; background: rgba(34,197,94,0.08) !important; }
        </style>
      `;
      
      // Try to inject styles before </head> or at start of body
      let modifiedHtml = trimmedHtml;
      const headEndIndex = modifiedHtml.toLowerCase().indexOf('</head>');
      if (headEndIndex !== -1) {
        // Insert before </head>
        modifiedHtml = modifiedHtml.slice(0, headEndIndex) + selectorStyles + modifiedHtml.slice(headEndIndex);
      } else {
        // No head tag, try to add styles before body
        const bodyStartIndex = modifiedHtml.toLowerCase().indexOf('<body');
        if (bodyStartIndex !== -1) {
          const bodyTagEnd = modifiedHtml.indexOf('>', bodyStartIndex) + 1;
          modifiedHtml = modifiedHtml.slice(0, bodyTagEnd) + selectorStyles + modifiedHtml.slice(bodyTagEnd);
        } else {
          // No body tag either, prepend styles
          modifiedHtml = selectorStyles + modifiedHtml;
        }
      }
      
      doc.write(modifiedHtml);
    } else {
      // If it's just body content, wrap it
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .__rss-hover { outline: 2px dashed #22c55e !important; outline-offset: 2px; cursor: crosshair !important; }
            .__rss-selected { outline: 2px solid #22c55e !important; outline-offset: 2px; background: rgba(34,197,94,0.08) !important; }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `);
    }
    
    doc.close();

    doc.addEventListener("click", (e) => e.preventDefault(), true);

    let hovered: Element | null = null;
    doc.addEventListener("mouseover", (e: Event) => {
      const target = e.target as Element;
      if (target.tagName === "HTML" || target.tagName === "BODY") return;
      if (hovered) hovered.classList.remove("__rss-hover");
      target.classList.add("__rss-hover");
      hovered = target;
    }, true);

    doc.addEventListener("mouseout", (e: Event) => {
      (e.target as Element).classList.remove("__rss-hover");
    }, true);

    doc.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element;
      doc.querySelectorAll(".__rss-selected").forEach(el => el.classList.remove("__rss-selected"));
      target.classList.add("__rss-selected");

      // Build a simple selector
      const tag = target.tagName.toLowerCase();
      const classes = Array.from(target.classList).filter(c => !c.startsWith("__")).slice(0, 2);
      const selector = classes.length ? `${tag}.${classes.join(".")}` : tag;
      onContentSelectorChange(selector);
    }, true);
  }, [html, onContentSelectorChange]);

  // Preview extracted content
  let previewContent = "";
  if (html && contentSelector) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const el = doc.querySelector(contentSelector);
      if (el) {
        previewContent = contentFormat === "html" ? el.innerHTML : el.textContent?.trim() || "";
      }
    } catch {}
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Content Extraction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {html
              ? "Click the main content area on the page below to select it"
              : "No content page available — you can set a selector manually or skip this step"}
          </p>
          <Input
            value={contentSelector}
            onChange={(e) => onContentSelectorChange(e.target.value)}
            placeholder="CSS selector for full content..."
            className="font-mono text-xs bg-background"
          />
          <div className="flex gap-2">
            <Button
              variant={contentFormat === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => onContentFormatChange("text")}
              className="font-mono text-xs"
            >
              Plain Text
            </Button>
            <Button
              variant={contentFormat === "html" ? "default" : "outline"}
              size="sm"
              onClick={() => onContentFormatChange("html")}
              className="font-mono text-xs"
            >
              HTML
            </Button>
          </div>
        </CardContent>
      </Card>

      {html && (
        <Card className="bg-card border-border overflow-hidden">
          <div className="bg-secondary px-3 py-2 border-b border-border">
            <span className="text-xs font-mono text-muted-foreground">Content Page Preview</span>
          </div>
          <iframe
            ref={iframeRef}
            className="w-full h-[400px] bg-background"
            sandbox="allow-same-origin"
            title="Content Preview"
          />
        </Card>
      )}

      {previewContent && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono">Extracted Content Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="code-panel max-h-[300px] overflow-auto whitespace-pre-wrap text-xs">
              {previewContent.slice(0, 2000)}
              {previewContent.length > 2000 ? "\n..." : ""}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
