import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBranding } from "../../contexts/BrandingContext";
import api from "../../utils/api";
import TrialModal from "./TrialModal";
import NotificationDropdown from "./NotificationDropdown";
import { Badge } from "../ui";
import { toast } from "sonner";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  Wallet,
  Users,
  FolderTree,
  FileSpreadsheet,
  Settings,
  Shield,
  CreditCard,
  Layers,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  ArrowLeftRight,
  Landmark,
  LineChart,
  Calculator,
  Target,
  BrainCircuit,
  MessageSquare,
  AlertCircle,
  Clock,
  PieChart,
  LifeBuoy,
  Megaphone,
  Info,
  Lock,
} from "lucide-react";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { empresaSlug } = useParams();
  const { user, logout, isSuperAdmin, empresas, switchEmpresa } = useAuth();
  const { branding } = useBranding();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switchingEmpresa, setSwitchingEmpresa] = useState(false);
  const [empresaDropdownOpen, setEmpresaDropdownOpen] = useState(false);
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [comunicadosAtivos, setComunicadosAtivos] = useState([]);
  const [dispensados, setDispensados] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nuvy_comunicados_dispensados") || "[]");
    } catch (e) {
      return [];
    }
  });

  const dispensarComunicado = async (id) => {
    // 1. Remove visualmente imediatamente
    setComunicadosAtivos((prev) => prev.filter((c) => c.id !== id));
    // 2. Grava no banco de dados para nunca mais voltar, mesmo trocando de navegador
    try {
      await api.post(`/comunicados/${id}/dispensar`);
    } catch (e) {}
    // 3. Grava também no localStorage como contingência
    try {
      const novos = [...dispensados, id];
      setDispensados(novos);
      localStorage.setItem("nuvy_comunicados_dispensados", JSON.stringify(novos));
    } catch (e) {}
  };

  const slug = empresaSlug || user?.empresa_slug || "demo";
  const basePath = `/admin/${slug}`;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSwitchEmpresa = async (id) => {
    if (id === user?.empresa_id) {
      setEmpresaDropdownOpen(false);
      return;
    }
    try {
      setSwitchingEmpresa(true);
      const updatedUser = await switchEmpresa(id);
      setEmpresaDropdownOpen(false);
      navigate(`/admin/${updatedUser.empresa_slug}`);
    } catch (err) {
      toast.error("Erro ao trocar de empresa.");
    } finally {
      setSwitchingEmpresa(false);
    }
  };

  const isSuperPath = location.pathname.startsWith("/super");

  useEffect(() => {
    if (!isSuperPath && user?.empresa_id) {
      api.get("/comunicados/ativos")
        .then((res) => setComunicadosAtivos(res.data?.comunicados || []))
        .catch(() => {});
    }
  }, [isSuperPath, user?.empresa_id]);

  const isPersonalPlan = user?.plano_tipo_publico === "pessoal";
  const planoRecursos = user?.plano_recursos || {};

  // Definir seções com chaves de permissão
  const rawMenuSections = isSuperPath
    ? [
      {
        title: "PLATAFORMA SAAS",
        items: [
          { title: "Visão Geral SaaS", path: "/super", icon: LayoutDashboard },
          { title: "Empresas Assinantes", path: "/super/empresas", icon: Building2 },
          { title: "Planos de Assinatura", path: "/super/saas-planos", icon: Layers },
          { title: "Faturas e Cobranças", path: "/super/saas-faturas", icon: CreditCard },
          { title: "Central de Chamados", path: "/super/chamados", icon: LifeBuoy },
          { title: "Banners & Comunicados", path: "/super/comunicados", icon: Megaphone },
          { title: "WhatsApp, Telegram & IA", path: "/super/whatsapp", icon: MessageSquare },
          { title: "Branding & White-Label", path: "/super/branding", icon: Sparkles },
          { title: "Auditoria & Logs Globais", path: "/super/auditoria", icon: Shield },
        ],
      },
    ]
    : [
      {
        title: "VISÃO GERAL",
        items: [
          { title: "Dashboard Executivo", path: basePath, icon: LayoutDashboard, permKey: "dashboard" },
          { title: "DRE Gerencial", path: `${basePath}/dre`, icon: FileSpreadsheet, permKey: "dre", featureKey: "dre", b2bOnly: true },
          { title: "Fluxo de Caixa Projetado", path: `${basePath}/fluxo-caixa`, icon: LineChart, permKey: "fluxo_caixa", featureKey: "fluxo_caixa", b2bOnly: true },
        ],
      },
      {
        title: "GESTÃO FINANCEIRA",
        items: [
          { title: "Contas a Receber", path: `${basePath}/receber`, icon: TrendingUp, permKey: "receber" },
          { title: "Contas a Pagar", path: `${basePath}/pagar`, icon: TrendingDown, permKey: "pagar" },
          { title: "Contas & Caixas", path: `${basePath}/contas`, icon: Wallet, permKey: "contas" },
          { title: "Conciliação Bancária", path: `${basePath}/conciliacao`, icon: Landmark, permKey: "conciliacao", featureKey: "open_finance" },
          { title: "Investimentos & B3", path: `${basePath}/investimentos`, icon: LineChart, permKey: "investimentos", featureKey: "investimentos_b3" },
        ],
      },
      {
        title: "ESTRATÉGIA & INTELIGÊNCIA",
        items: [
          { title: "Precificação & Markup", path: `${basePath}/precificacao`, icon: Calculator, permKey: "precificacao", b2bOnly: true },
          { title: "Orçamento & Metas", path: `${basePath}/orcamento`, icon: Target, permKey: "orcamento", featureKey: "orcamento_metas" },
          { title: "Rateio & Centros de Custo", path: `${basePath}/rateio-centros`, icon: PieChart, permKey: "orcamento", featureKey: "centros_custo", b2bOnly: true },
          { title: "Inteligência Estratégica", path: `${basePath}/inteligencia`, icon: BrainCircuit, permKey: "inteligencia", b2bOnly: true },
        ],
      },
      {
        title: "CADASTROS & ESTRUTURA",
        items: [
          { title: "Contatos & Favorecidos", path: `${basePath}/contatos`, icon: Users, permKey: "contatos" },
          { title: "Plano de Contas", path: `${basePath}/categorias`, icon: FolderTree, permKey: "categorias" },
        ],
      },
      {
        title: "CONFIGURAÇÕES & EQUIPE",
        items: [
          {
            title: isPersonalPlan ? "Meus Dados" : "Minha Empresa",
            path: `${basePath}/empresa`,
            icon: isPersonalPlan ? User : Building2,
            permKey: "assinatura",
          },
          { title: "Minha Assinatura / Plano", path: `${basePath}/assinatura`, icon: CreditCard, permKey: "assinatura" },
          { title: "Gateways de Cobrança", path: `${basePath}/gateways`, icon: CreditCard, permKey: "assinatura", featureKey: "gateways_proprios", b2bOnly: true },
          { title: "Copiloto IA (Whats & Telegram)", path: `${basePath}/automacoes`, icon: MessageSquare, permKey: "automacoes", featureKey: "copiloto_ia" },
          { title: "Equipe & Usuários", path: `${basePath}/usuarios`, icon: Users, permKey: "usuarios", b2bOnly: true },
          { title: "Auditoria & Logs", path: `${basePath}/auditoria`, icon: Shield, permKey: "auditoria", b2bOnly: true },
          { title: "Ajuda & Suporte", path: `${basePath}/suporte`, icon: LifeBuoy, permKey: "suporte" },
        ],
      },
    ];

  // Filtrar itens do menu de acordo com o plano SaaS e permissões do usuário
  const menuSections = rawMenuSections
    .map((sec) => {
      if (isSuperPath || isSuperAdmin) {
        return sec;
      }

      const allowedItems = sec.items.filter((item) => {
        // 1. Trava de Recursos do Plano SaaS (Feature Flags)
        if (item.featureKey && planoRecursos[item.featureKey] === false) {
          return false;
        }

        // 2. Trava de módulos puramente empresariais para planos pessoais
        if (isPersonalPlan && item.b2bOnly) {
          return false;
        }

        // 3. Permissões de Operadores (Sub-usuários)
        if (user?.role !== "proprietario" && item.permKey) {
          return Array.isArray(user?.permissoes) && user.permissoes.includes(item.permKey);
        }

        return true;
      });

      // Títulos adaptados para plano pessoal
      let sectionTitle = sec.title;
      if (isPersonalPlan) {
        if (sec.title === "GESTÃO FINANCEIRA") sectionTitle = "MINHAS FINANÇAS";
        if (sec.title === "ESTRATÉGIA & INTELIGÊNCIA") sectionTitle = "METAS & ORÇAMENTO";
        if (sec.title === "CADASTROS & ESTRUTURA") sectionTitle = "ORGANIZAÇÃO";
      }

      return {
        ...sec,
        title: sectionTitle,
        items: allowedItems,
      };
    })
    .filter((sec) => sec.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        {/* Logo / Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xs font-bold text-lg">
              NF
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight text-sm">
                {branding?.nome_sistema || "Nuvy Finance"}
              </h1>
              <span className="text-[10px] text-emerald-600 font-semibold tracking-wider uppercase">
                {isSuperPath ? "Super Admin" : "Gestão Financeira"}
              </span>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {menuSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <h3 className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {sec.title}
              </h3>
              <div className="space-y-0.5 mt-1.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                        }`}
                    >
                      <Icon
                        size={18}
                        className={active ? "text-emerald-600" : "text-slate-400"}
                      />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Super Admin Switcher Link */}
        {isSuperAdmin && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            {isSuperPath ? (
              <Link
                to={basePath}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <ArrowLeftRight size={14} /> Voltar ao Painel da Empresa
              </Link>
            ) : (
              <Link
                to="/super"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition-colors shadow-xs"
              >
                <Shield size={14} /> Painel Super Admin
              </Link>
            )}
          </div>
        )}

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs uppercase flex-shrink-0">
              {user?.nome?.[0] || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.nome}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair da conta"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            {/* Empresa Switcher */}
            {!isSuperPath && (
              <div className="relative">
                <button
                  onClick={() => setEmpresaDropdownOpen(!empresaDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                >
                  <Building2 size={14} className="text-emerald-600" />
                  <span className="max-w-[160px] md:max-w-[220px] truncate">
                    {user?.empresa_nome || "Minha Empresa"}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {empresaDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Alternar Empresa
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {(empresas || []).map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleSwitchEmpresa(emp.id)}
                          disabled={switchingEmpresa}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${emp.id === user?.empresa_id ? "bg-emerald-50 text-emerald-700 font-bold" : "text-slate-700"
                            }`}
                        >
                          <span className="truncate">{emp.nome}</span>
                          {emp.id === user?.empresa_id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isSuperPath && <NotificationDropdown basePath={basePath} />}

            {!isSuperPath && user?.empresa_status === "trial" && (
              <button
                onClick={() => setTrialModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {user?.dias_trial_restantes !== null && user.dias_trial_restantes >= 0
                    ? `Trial: ${user.dias_trial_restantes}d restantes`
                    : "Trial Expirado"}
                </span>
              </button>
            )}

            {!isSuperPath && user?.empresa_status === "bloqueado" ? (
              <Badge variant="danger" icon={<Lock size={12} />}>
                Empresa Bloqueada
              </Badge>
            ) : !isSuperPath && user?.empresa_status === "trial" ? (
              <Badge variant="warning">
                Trial ({user?.dias_trial_restantes !== null ? `${user.dias_trial_restantes}d` : "Ativo"})
              </Badge>
            ) : (
              <Badge variant="success" icon={<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}>
                SaaS Multi-Tenant Ativo
              </Badge>
            )}
          </div>
        </header>

        {/* Banner de Aviso de Empresa Bloqueada para Super Admin */}
        {!isSuperPath && isSuperAdmin && user?.empresa_status === "bloqueado" && (
          <div className="px-4 py-2.5 bg-rose-900 text-rose-100 text-xs flex items-center justify-between shadow-xs border-b border-rose-800">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Modo Super Admin (Auditoria):</strong> A empresa <strong>{user?.empresa_nome}</strong> está <strong className="text-white bg-rose-800 px-1.5 py-0.5 rounded">BLOQUEADA</strong> no SaaS. Clientes e operadores desta empresa estão impedidos de acessar. Você está visualizando em modo de suporte.
              </span>
            </div>
            <Link
              to="/super/empresas"
              className="px-2.5 py-1 bg-white text-rose-900 font-bold rounded text-[11px] hover:bg-rose-50 transition shrink-0"
            >
              Gerenciar Empresa
            </Link>
          </div>
        )}

        {/* Free Trial Banner */}
        {!isSuperPath && user?.empresa_status === "trial" && user?.dias_trial_restantes !== null && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between shadow-2xs ${user.dias_trial_restantes >= 0
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                : "bg-gradient-to-r from-rose-600 to-red-700 text-white"
              }`}
          >
            <div className="flex items-center gap-2">
              {user.dias_trial_restantes >= 0 ? (
                <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
              )}
              <span>
                {user.dias_trial_restantes >= 0 ? (
                  <>
                    <strong>Período de Teste Gratuito:</strong> Restam{" "}
                    <strong>{user.dias_trial_restantes} dias</strong> de acesso completo a todos os recursos.
                  </>
                ) : (
                  <>
                    <strong>Período de Teste Expirado:</strong> O período de testes da sua empresa terminou.
                  </>
                )}
              </span>
            </div>

            <button
              onClick={() => setTrialModalOpen(true)}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer shrink-0 shadow-2xs ${user.dias_trial_restantes >= 0
                  ? "bg-white text-orange-800 hover:bg-amber-50"
                  : "bg-white text-rose-800 hover:bg-rose-50"
                }`}
            >
              {user.dias_trial_restantes >= 0 ? "Escolher Plano" : "Ativar Assinatura"}
            </button>
          </div>
        )}

        {/* Comunicados Broadcast Banner */}
        {!isSuperPath && comunicadosAtivos.filter((c) => !dispensados.includes(c.id)).length > 0 && (
          <div className="space-y-1">
            {comunicadosAtivos
              .filter((c) => !dispensados.includes(c.id))
              .map((com) => (
                <div
                  key={com.id}
                  className={`px-4 py-2 text-xs flex items-center justify-between shadow-2xs ${
                    com.tipo === "urgente"
                      ? "bg-gradient-to-r from-rose-600 to-red-700 text-white"
                      : com.tipo === "aviso"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                      : com.tipo === "novidade"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                      : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {com.tipo === "urgente" ? (
                      <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
                    ) : com.tipo === "novidade" ? (
                      <Sparkles className="w-4 h-4 text-indigo-200 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-200 shrink-0" />
                    )}
                    <span>
                      <strong>{com.titulo}:</strong> {com.mensagem}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispensarComunicado(com.id)}
                    className="p-1 hover:bg-white/20 rounded text-white cursor-pointer transition"
                    title="Dispensar aviso"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Page Content View / Bloqueio Total para Clientes Comuns */}
        {!isSuperPath && !isSuperAdmin && user?.empresa_status === "bloqueado" ? (
          <main className="flex-1 p-4 lg:p-8 max-w-3xl w-full mx-auto flex items-center justify-center min-h-[70vh]">
            <div className="bg-white border-2 border-rose-200 rounded-3xl p-8 shadow-2xl text-center space-y-6 max-w-lg w-full">
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <Lock size={40} />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 bg-rose-100 text-rose-800 font-extrabold text-xs uppercase tracking-wider rounded-full">
                  Acesso Suspenso
                </span>
                <h2 className="text-2xl font-black text-slate-900">
                  Empresa Bloqueada
                </h2>
                <p className="text-sm text-slate-600">
                  O acesso da sua empresa <strong>{user?.empresa_nome}</strong> ao Nuvy Finance foi temporariamente suspenso devido a pendências na assinatura SaaS ou bloqueio administrativo.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-600" /> Como reativar meu acesso?
                </p>
                <p>
                  Para desbloquear imediatamente o painel financeiro, entre em contato com o suporte ou efetue a regularização da sua assinatura mensal.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link
                  to={`${basePath}/suporte`}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition text-center"
                >
                  Falar com Suporte Técnico
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Sair da Conta
                </button>
              </div>
            </div>
          </main>
        ) : (
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
        )}

        {/* Trial / Upgrade Modal */}
        <TrialModal
          isOpen={trialModalOpen}
          onClose={() => setTrialModalOpen(false)}
          isExpired={user?.dias_trial_restantes !== null && user?.dias_trial_restantes < 0}
          diasRestantes={user?.dias_trial_restantes || 0}
        />
      </div>
    </div>
  );
}
