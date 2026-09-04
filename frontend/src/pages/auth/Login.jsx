import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBranding } from "../../contexts/BrandingContext";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Building2,
  User,
  Phone,
  Bot,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  QrCode,
  Users,
  Eye,
  EyeOff,
  Zap,
  Check,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import api from "../../utils/api";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login, registerTrial } = useAuth();
  const { branding } = useBranding();

  // Tab State: 'login' | 'register'
  const [activeTab, setActiveTab] = useState("login");

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form State
  const [regEmpresa, setRegEmpresa] = useState("");
  const [regNome, setRegNome] = useState("");
  const [regTelefone, setRegTelefone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotCanais, setForgotCanais] = useState([]);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = solicitar email, 2 = digitar codigo e nova senha

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    setError("");
    setForgotLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail });
      if (res.data?.sucesso) {
        setForgotCanais(res.data.canais || ["email"]);
        setForgotStep(2);
        toast.success("Código de verificação enviado para seu e-mail / WhatsApp!");
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao solicitar recuperação de senha.";
      setError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordWithCode = async (e) => {
    e.preventDefault();
    setError("");
    if (forgotNewPass.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!forgotCode || forgotCode.length < 6) {
      setError("Digite o código de 6 dígitos.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        codigo: forgotCode,
        novaSenha: forgotNewPass,
      });
      if (res.data?.sucesso) {
        setForgotSuccess(true);
        toast.success("Senha redefinida com sucesso! Redirecionando para login...");
        setTimeout(() => {
          setActiveTab("login");
          setForgotStep(1);
          setForgotSuccess(false);
          setLoginEmail(forgotEmail);
        }, 3000);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Código inválido ou expirado.";
      setError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(loginEmail, loginSenha);
      toast.success("Login efetuado com sucesso!");
      if (data.user?.is_super) {
        navigate("/super");
      } else {
        const targetSlug = data.user?.empresa_slug || "nuvy-core";
        navigate(`/admin/${targetSlug}`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Falha no login. Verifique seu e-mail e senha.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await registerTrial({
        nome_empresa: regEmpresa,
        nome_gestor: regNome,
        telefone: regTelefone,
        email: regEmail,
        senha: regSenha,
      });

      toast.success("Conta criada com sucesso! Bem-vindo ao Nuvy Finance.");
      const targetSlug = data.user?.empresa_slug || "empresa";
      navigate(`/admin/${targetSlug}`);
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao criar conta de teste. Tente novamente.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:grid lg:grid-cols-12 relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* LADO ESQUERDO: Apresentação & Vitrine SaaS (7 colunas) */}
      <div className="lg:col-span-7 xl:col-span-7 p-6 sm:p-10 lg:p-14 flex flex-col justify-between z-10 relative border-b lg:border-b-0 lg:border-r border-white/10">
        <div>
          {/* Header da Marca */}
          <div className="flex items-center justify-between mb-8 lg:mb-12">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-emerald-900/30">
                NF
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
                  {branding?.nome_sistema || "Nuvy Finance"}
                </h1>
                <span className="text-[11px] text-emerald-400 font-semibold tracking-wider uppercase">
                  Gestão Financeira & DRE B2B
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>14 Dias Grátis</span>
            </div>
          </div>

          {/* Hero Headline */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-medium mb-4 backdrop-blur-xs">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Plataforma Corporativa com Copiloto IA (WhatsApp & Telegram)</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Controle financeiro total com a inteligência do{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Copiloto no WhatsApp & Telegram.
              </span>
            </h2>

            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
              Gerencie contas a pagar e receber, acompanhe DRE em tempo real, automatize cobranças PIX, baixe recibos em PDF e lance despesas falando por áudio ou foto de comprovante.
            </p>
          </div>

          {/* Grid de Funcionalidades em Destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-8 max-w-2xl">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-colors backdrop-blur-xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Copiloto no WhatsApp & Telegram</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Transcreve áudios (Whisper), lê notas (Vision), gera recibos oficiais em PDF e dá baixa instantânea.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-colors backdrop-blur-xs">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-2.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">DRE Gerencial & Fluxo</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Demonstração de resultados em tempo real, receita líquida, margens e evolução mensal.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-colors backdrop-blur-xs">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2.5">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Régua de Cobrança PIX</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Avisos automáticos de vencimento com PIX Copia e Cola dinâmico para zerar a inadimplência.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-colors backdrop-blur-xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2.5">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Equipe & Permissões</h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Controle de acesso granular por módulo para operadores, gerentes e contadores.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé do lado esquerdo */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" /> 14 dias de teste grátis
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-slate-500" /> Sem cartão de crédito
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Criptografia Ponta a Ponta</span>
          </div>
        </div>
      </div>

      {/* LADO DIREITO: Card de Login & Auto-Cadastro de Trial (5 colunas) */}
      <div className="lg:col-span-5 xl:col-span-5 p-6 sm:p-10 flex items-center justify-center z-10 relative bg-slate-950/80 lg:bg-transparent">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-100 relative">
          {/* Alternador de Abas */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "login"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Já sou cliente
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "register"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Criar Conta Grátis
            </button>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* FORMULÁRIO 1: LOGIN */}
          {activeTab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900">Acessar Painel</h3>
                <p className="text-xs text-slate-500">Informe suas credenciais para entrar no sistema.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setForgotSuccess(false);
                      setForgotEmail(loginEmail);
                      setForgotStep(1);
                      setActiveTab("forgot");
                    }}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginSenha}
                    onChange={(e) => setLoginSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar no Painel <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-xs text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  Ainda não tem conta? <strong className="text-emerald-600">Cadastre-se grátis</strong>
                </button>
              </div>
            </form>
          )}

          {/* FORMULÁRIO: RECUPERAR SENHA (MULTICANAL) */}
          {activeTab === "forgot" && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  Recuperar Acesso
                </h3>
                <p className="text-xs text-slate-500">
                  {forgotStep === 1
                    ? "Informe seu e-mail para enviarmos as instruções e código de acesso."
                    : "Digite o código de 6 dígitos recebido e crie sua nova senha."}
                </p>
              </div>

              {forgotSuccess ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <CheckCircle2 size={32} className="text-emerald-600 mx-auto animate-bounce" />
                  <h4 className="text-sm font-bold text-emerald-900">Senha Alterada com Sucesso!</h4>
                  <p className="text-xs text-emerald-700">Redirecionando para a tela de login...</p>
                </div>
              ) : forgotStep === 1 ? (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      E-mail Cadastrado
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu.email@empresa.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-emerald-900">
                      <Sparkles size={13} className="text-emerald-600" />
                      Envio Multicanal Automático:
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Dispararemos o link seguro e o código no seu <b>E-mail</b>, <b>WhatsApp</b> e <b>Telegram</b>!
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {forgotLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Enviar Código de Recuperação <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setActiveTab("login");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      Lembrou a senha? <strong className="text-emerald-600">Fazer login</strong>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordWithCode} className="space-y-3.5">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Código enviado para: <b>{forgotCanais.join(", ").toUpperCase()}</b>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Código de 6 Dígitos
                    </label>
                    <input
                      type="text"
                      maxLength="6"
                      required
                      placeholder="000000"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono text-xl tracking-widest text-emerald-700 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nova Senha
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Repita a nova senha"
                      value={forgotConfirmPass}
                      onChange={(e) => setForgotConfirmPass(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {forgotLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Salvar Nova Senha e Entrar <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      ← Voltar / Enviar para outro e-mail
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* FORMULÁRIO 2: CRIAR CONTA GRÁTIS (TRIAL 14 DIAS) */}
          {activeTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Teste Grátis por 14 Dias
                </h3>
                <p className="text-xs text-slate-500">
                  Crie sua conta em 30 segundos. Sem cartão de crédito.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Empresa / Negócio *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={regEmpresa}
                    onChange={(e) => setRegEmpresa(e.target.value)}
                    placeholder="Ex: Minha Empresa Ltda"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Seu Nome Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={regNome}
                    onChange={(e) => setRegNome(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp (para o Copiloto IA) *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                  <input
                    type="text"
                    required
                    value={regTelefone}
                    onChange={(e) => setRegTelefone(e.target.value)}
                    placeholder="(67) 99999-9999"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail de Acesso *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="carlos@minhaempresa.com"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Criar Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={regSenha}
                    onChange={(e) => setRegSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles size={16} className="text-amber-300" />
                    Iniciar Meu Teste de 14 Dias
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-xs text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  Já tem conta? <strong className="text-emerald-600">Entrar agora</strong>
                </button>
              </div>
            </form>
          )}

          {/* Micro-Footer do Card */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Ambiente Oficial Seguro • Criptografia SSL 256-bit
          </div>
        </div>
      </div>
    </div>
  );
}
