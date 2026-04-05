import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Login() {
  const { t } = useI18n();
  const loginMutation = useLogin();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Login] handleSubmit fired, username:", username, "password length:", password.length);
    if (!username || !password) {
      console.log("[Login] blocked: empty username or password");
      return;
    }
    setLoading(true);
    try {
      await loginMutation.mutateAsync({ username, password });
      console.log("[Login] mutateAsync succeeded");
    } catch (err: any) {
      console.error("[Login] mutateAsync error:", err);
      const msg = err?.message || t("login.error");
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4">
            <img src="/logo.png" alt={t("app.name")} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-login-title">{t("app.name")}</h1>
          <p className="text-muted-foreground mt-1">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              {t("login.username")}
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("login.username_placeholder")}
              autoFocus
              data-testid="input-username"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              {t("login.password")}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.password_placeholder")}
                className="pl-10"
                data-testid="input-password"
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-bold"
            disabled={loading || !username || !password}
            data-testid="button-login"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("login.logging_in")}
              </div>
            ) : (
              t("login.submit")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
