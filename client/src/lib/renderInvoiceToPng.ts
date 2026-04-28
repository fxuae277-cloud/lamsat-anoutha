/**
 * renderInvoiceToPng.ts — render <Invoice80> or <Invoice58> off-screen with
 * React, capture it with html2canvas, return a base64 PNG sized in physical
 * printer dots (576px for 80mm, 384px for 58mm).
 *
 * The PNG is then POSTed to the local print service which converts it to
 * 1-bit raster ESC/POS bytes (GS v 0). This is the only path that supports
 * full Arabic shaping/RTL on the thermal printer — the previous text-mode
 * Latin-1 ESC/POS pipeline has been removed.
 */

import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import html2canvas from "html2canvas";
import Invoice80, {
  INVOICE_80_WIDTH_PX,
  type Invoice80Props,
} from "@/components/Invoice80";
import Invoice58, {
  INVOICE_58_WIDTH_PX,
  type Invoice58Props,
} from "@/components/Invoice58";

export type PaperWidth = "58mm" | "80mm";

/** Common props accepted by both 80mm and 58mm invoices. */
export type InvoiceRenderProps = Invoice80Props & Invoice58Props;

const RENDER_TIMEOUT_MS = 6000;

/** Wait one paint frame so React commits the tree and layout is final. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Wait until every <img> inside `host` is either loaded or errored out. */
async function waitForImages(host: HTMLElement, timeoutMs = 4000): Promise<void> {
  const imgs = Array.from(host.querySelectorAll("img"));
  if (imgs.length === 0) return;
  const promises = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  });
  await Promise.race([
    Promise.all(promises),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Render the chosen invoice component into an off-screen container, snapshot
 * to PNG, and return the result as base64 (no data: prefix) plus dimensions.
 */
export async function renderInvoiceToPng(
  paperWidth: PaperWidth,
  props: InvoiceRenderProps,
): Promise<{ base64: string; widthPx: number; heightPx: number }> {
  const widthPx =
    paperWidth === "58mm" ? INVOICE_58_WIDTH_PX : INVOICE_80_WIDTH_PX;

  // Off-screen host. Position fixed + far-negative-left keeps it out of the
  // viewport but still in flow for layout/img-load. We do NOT use display:none
  // because html2canvas needs measurable dimensions.
  const host = document.createElement("div");
  host.setAttribute("data-invoice-host", paperWidth);
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "-10000px";
  host.style.width = `${widthPx}px`;
  host.style.background = "#ffffff";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    const element: ReactElement =
      paperWidth === "58mm"
        ? createElement(Invoice58, props)
        : createElement(Invoice80, props);

    root = createRoot(host);
    root.render(element);

    // Two animation frames: one for React commit, one for layout flush.
    await nextPaint();
    await nextPaint();
    await waitForImages(host);

    const canvas = await Promise.race([
      html2canvas(host, {
        backgroundColor: "#ffffff",
        // Render at 2× density then downscale on the server with sharp →
        // sharper Arabic glyphs after thresholding.
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: widthPx,
        windowWidth: widthPx,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("html2canvas timeout")),
          RENDER_TIMEOUT_MS,
        ),
      ),
    ]);

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    return { base64, widthPx, heightPx: canvas.height / 2 };
  } finally {
    try {
      root?.unmount();
    } catch {
      /* ignore unmount races */
    }
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}
