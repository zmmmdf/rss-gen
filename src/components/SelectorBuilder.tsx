import { useState, useRef, useEffect, useCallback } from "react";
import { MousePointer, Check, RotateCcw, TestTube, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { ListSelectors, SelectorStep } from "@/types/feed";
import { SELECTOR_STEPS } from "@/types/feed";

interface Props {
  html: string;
  selectors: ListSelectors;
  onSelectorsChange: (s: ListSelectors) => void;
  sourceUrl: string;
}

function generateSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter(c => !c.startsWith('__')).slice(0, 2).join('.');
  const parent = el.parentElement;
  if (!parent) return classes ? `${tag}.${classes}` : tag;
  const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
  const index = siblings.indexOf(el);
  const base = classes ? `${tag}.${classes}` : tag;
  if (siblings.length > 1) return `${base}:nth-child(${index + 1})`;
  return base;
}

function buildCssPath(el: Element, stopAt?: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== stopAt && current.tagName !== 'HTML' && current.tagName !== 'BODY') {
    parts.unshift(generateSelector(current));
    current = current.parentElement;
    if (parts.length > 4) break;
  }
  return parts.join(' > ');
}

export function SelectorBuilder({ html, selectors, onSelectorsChange, sourceUrl }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeStep, setActiveStep] = useState<SelectorStep>("container");
  const [testResults, setTestResults] = useState<Record<string, string>[] | null>(null);

  const currentStepIndex = SELECTOR_STEPS.findIndex(s => s.key === activeStep);

  // Inject HTML into iframe with interaction script
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Check if HTML is a full document or just body content
    const trimmedHtml = html.trim();
    const isFullDocument = trimmedHtml.toLowerCase().startsWith('<!doctype') || trimmedHtml.toLowerCase().startsWith('<html');
    
    // Write HTML with injected script
    doc.open();
    
    if (isFullDocument) {
      // If it's a full document, inject our styles into the head using string manipulation
      // to preserve the original HTML exactly as-is
      const selectorStyles = `
        <style>
          .__rss-hover { outline: 2px dashed #22c55e !important; outline-offset: 2px; cursor: crosshair !important; }
          .__rss-selected { outline: 2px solid #22c55e !important; outline-offset: 2px; background: rgba(34,197,94,0.08) !important; }
          .__rss-matched { outline: 1px solid #3b82f6 !important; background: rgba(59,130,246,0.06) !important; }
        </style>
      `;
      
      // Try to inject styles before </head> or </body>, or at the start if no head tag
      let modifiedHtml = trimmedHtml;
      const headEndIndex = modifiedHtml.toLowerCase().indexOf('</head>');
      if (headEndIndex !== -1) {
        // Insert before </head>
        modifiedHtml = modifiedHtml.slice(0, headEndIndex) + selectorStyles + modifiedHtml.slice(headEndIndex);
      } else {
        // No head tag, try to add base and styles before body
        const bodyStartIndex = modifiedHtml.toLowerCase().indexOf('<body');
        if (bodyStartIndex !== -1) {
          const bodyTagEnd = modifiedHtml.indexOf('>', bodyStartIndex) + 1;
          modifiedHtml = modifiedHtml.slice(0, bodyTagEnd) + selectorStyles + modifiedHtml.slice(bodyTagEnd);
        } else {
          // No body tag either, prepend styles
          modifiedHtml = selectorStyles + modifiedHtml;
        }
      }
      
      // Add base tag if not present
      if (!modifiedHtml.toLowerCase().includes('<base')) {
        const headStartIndex = modifiedHtml.toLowerCase().indexOf('<head');
        if (headStartIndex !== -1) {
          const headTagEnd = modifiedHtml.indexOf('>', headStartIndex) + 1;
          modifiedHtml = modifiedHtml.slice(0, headTagEnd) + `\n<base href="${sourceUrl}" />` + modifiedHtml.slice(headTagEnd);
        }
      }
      
      doc.write(modifiedHtml);
    } else {
      // If it's just body content, wrap it but preserve original structure
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <base href="${sourceUrl}" />
          <style>
            .__rss-hover { outline: 2px dashed #22c55e !important; outline-offset: 2px; cursor: crosshair !important; }
            .__rss-selected { outline: 2px solid #22c55e !important; outline-offset: 2px; background: rgba(34,197,94,0.08) !important; }
            .__rss-matched { outline: 1px solid #3b82f6 !important; background: rgba(59,130,246,0.06) !important; }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `);
    }
    
    doc.close();

    // Prevent navigation
    doc.addEventListener('click', (e) => e.preventDefault(), true);
    const links = doc.querySelectorAll('a');
  }, [html, sourceUrl]);

  // Setup hover/click handlers
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    let hovered: Element | null = null;

    const onMouseOver = (e: Event) => {
      const target = e.target as Element;
      if (target.tagName === 'HTML' || target.tagName === 'BODY') return;
      if (hovered) hovered.classList.remove('__rss-hover');
      target.classList.add('__rss-hover');
      hovered = target;
    };

    const onMouseOut = (e: Event) => {
      const target = e.target as Element;
      target.classList.remove('__rss-hover');
    };

    const onClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element;
      const selector = buildCssPath(target);
      
      onSelectorsChange({ ...selectors, [activeStep]: selector });

      // Highlight matched elements
      doc.querySelectorAll('.__rss-selected, .__rss-matched').forEach(el => {
        el.classList.remove('__rss-selected', '__rss-matched');
      });
      target.classList.add('__rss-selected');

      // Try to match all similar elements
      try {
        doc.querySelectorAll(selector).forEach(el => el.classList.add('__rss-matched'));
      } catch {}
    };

    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);

    return () => {
      doc.removeEventListener('mouseover', onMouseOver, true);
      doc.removeEventListener('mouseout', onMouseOut, true);
      doc.removeEventListener('click', onClick, true);
    };
  }, [html, activeStep, selectors, onSelectorsChange]);

  // Highlight when selectors change
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.querySelectorAll('.__rss-selected, .__rss-matched').forEach(el => {
      el.classList.remove('__rss-selected', '__rss-matched');
    });

    const currentSelector = selectors[activeStep];
    if (currentSelector) {
      try {
        doc.querySelectorAll(currentSelector).forEach(el => el.classList.add('__rss-matched'));
      } catch {}
    }
  }, [activeStep, selectors, html]);

  const testSelectors = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc || !selectors.container) return;

    try {
      const containers = doc.querySelectorAll(selectors.container);
      const results: Record<string, string>[] = [];
      containers.forEach((container, i) => {
        if (i >= 10) return;
        const row: Record<string, string> = {};
        for (const step of SELECTOR_STEPS) {
          if (step.key === 'container') continue;
          const sel = selectors[step.key];
          
          if (step.key === 'link') {
            if (sel) {
              const el = container.querySelector(sel);
              if (el) {
                row[step.key] = (el as HTMLAnchorElement).href || el.textContent?.trim() || '';
              }
            } else {
              // If no link selector, check if container itself is an anchor tag
              if (container.tagName === 'A' || container.tagName === 'a') {
                row[step.key] = (container as HTMLAnchorElement).href || '';
              }
            }
          } else {
            if (!sel) continue;
            const el = container.querySelector(sel);
            if (el) {
              if (step.key === 'image') row[step.key] = (el as HTMLImageElement).src || '';
              else row[step.key] = el.textContent?.trim() || '';
            }
          }
        }
        if (Object.keys(row).length > 0) results.push(row);
      });
      setTestResults(results);
    } catch {
      setTestResults([]);
    }
  }, [selectors]);

  return (
    <div className="space-y-4">
      {/* Steps */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <MousePointer className="h-4 w-4 text-primary" />
            Selector Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SELECTOR_STEPS.map((step, i) => (
              <button
                key={step.key}
                onClick={() => setActiveStep(step.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                  activeStep === step.key
                    ? "bg-primary text-primary-foreground"
                    : selectors[step.key]
                    ? "bg-secondary text-primary"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {selectors[step.key] ? <Check className="h-3 w-3" /> : <span className="text-muted-foreground">{i + 1}.</span>}
                {step.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground font-mono">
            → {SELECTOR_STEPS[currentStepIndex]?.description}
          </div>

          {/* Manual selector input */}
          <div className="flex gap-2">
            <Input
              value={selectors[activeStep] || ""}
              onChange={(e) => onSelectorsChange({ ...selectors, [activeStep]: e.target.value })}
              placeholder={`CSS selector for ${activeStep}...`}
              className="font-mono text-xs bg-background"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectorsChange({ ...selectors, [activeStep]: undefined })}
              className="shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview iframe */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="bg-secondary px-3 py-2 flex items-center justify-between border-b border-border">
          <span className="text-xs font-mono text-muted-foreground">Preview — click elements to select</span>
          <Button variant="outline" size="sm" onClick={testSelectors} className="font-mono text-xs">
            <TestTube className="h-3 w-3 mr-1" /> Test Selectors
          </Button>
        </div>
        <iframe
          ref={iframeRef}
          className="w-full h-[500px] bg-background"
          sandbox="allow-same-origin"
          title="Page Preview"
        />
      </Card>

      {/* Test Results */}
      {testResults !== null && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TestTube className="h-4 w-4 text-primary" />
              Extracted Items
              <Badge variant="secondary" className="font-mono">{testResults.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.length > 0 ? (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-mono text-xs bg-muted/50 sticky top-0 z-10 min-w-[80px]">#</TableHead>
                        {(Object.keys(testResults[0]) as (keyof typeof testResults[0])[]).map((key) => (
                          <TableHead
                            key={key}
                            className="font-mono text-xs bg-muted/50 sticky top-0 z-10 whitespace-nowrap first:pl-4"
                          >
                            {key}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testResults.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-muted-foreground align-top w-8">
                            {i + 1}
                          </TableCell>
                          {(Object.keys(testResults[0]) as (keyof typeof testResults[0])[]).map((key) => {
                            const val = row[key] ?? "";
                            const isLink = key === "link";
                            const isImage = key === "image";
                            const isUrl = isLink || isImage;
                            const displayVal = String(val).trim();
                            const truncated = displayVal.length > 60 ? displayVal.slice(0, 57) + "…" : displayVal;
                            return (
                              <TableCell
                                key={key}
                                className="font-mono text-xs align-top py-2 px-3 max-w-[280px]"
                              >
                                {isUrl && displayVal ? (
                                  <div className="flex items-center gap-1 min-w-0">
                                    {isLink ? (
                                      <a
                                        href={displayVal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline truncate flex-1 min-w-0 block"
                                        title={displayVal}
                                      >
                                        {truncated}
                                      </a>
                                    ) : (
                                      <span className="truncate block flex-1 min-w-0" title={displayVal}>
                                        {truncated}
                                      </span>
                                    )}
                                    <TooltipProvider delayDuration={300}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0"
                                            onClick={() => {
                                              navigator.clipboard.writeText(displayVal);
                                              toast.success("Copied to clipboard");
                                            }}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="font-mono text-xs max-w-sm break-all">
                                          Copy URL
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {isImage && displayVal && (
                                      <a
                                        href={displayVal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 text-muted-foreground hover:text-primary"
                                        title="Open image"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div
                                          className="line-clamp-3 break-words text-foreground"
                                          title={displayVal}
                                        >
                                          {displayVal || "—"}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="font-mono text-xs max-w-sm break-words">
                                        {displayVal || "—"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">No items extracted. Check your selectors.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
