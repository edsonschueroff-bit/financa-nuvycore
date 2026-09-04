import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../../utils/api";
import { useBranding } from "../../contexts/BrandingContext";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenUrl = searchParams.get("token") || "";
  const { branding } = useBranding();

  const [token, setToken] = useState(tokenUrl);
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tokenUrl) {
      setToken(tokenUrl);
    }
  }, [tokenUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (novaSenha.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setError("As senhas não coincidem. Digite novamente.");
      return;
    }

    if (!token && !codigo) {
      setError("Token ou código de 6 dígitos não informado.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        token: token || undefined,
        codigo: codigo || undefined,
        novaSenha,
      });

      if (res.data?.sucesso) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/login?reset=sucesso");
        }, 3000);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Não foi possível redefinir a senha. O link pode ter expirado."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-900/40 mx-auto mb-4">
            <KeyRound size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Redefinir Senha
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {branding?.nome_sistema || "Nuvy Finance"} • Acesso Seguro
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-center space-y-3">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-emerald-300">
              Senha Alterada com Sucesso!
            </h3>
            <p className="text-xs text-emerald-200/80">
              Sua nova senha foi salva. Redirecionando para o login em instantes...
            </p>
            <Link
              to="/login"
              className="inline-block mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all"
            >
              Ir para Login Agora
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!tokenUrl && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Código de 6 Dígitos (recebido no celular/e-mail)
                </label>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="Ex: 815110"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-center font-mono text-lg tracking-widest text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Mínimo de 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <ShieldCheck
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando nova senha...</span>
                </>
              ) : (
                <>
                  <span>Salvar Nova Senha</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="text-center pt-3">
              <Link
                to="/login"
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Voltar para o Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
