import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("pwa-install-dismissed") === "1"
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 bg-white border border-pink-200 rounded-2xl shadow-2xl p-4 flex items-center gap-3 max-w-sm mx-auto">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">Install Lamsa Anoutha</p>
        <p className="text-xs text-muted-foreground">Works offline · Full screen · No browser bar</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          className="h-8 text-xs bg-gradient-to-l from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600"
          onClick={handleInstall}
        >
          Install
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleDismiss}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
