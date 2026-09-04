import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAuth } from "../../contexts/AuthContext";
import { usePlanoContext } from "../../hooks/usePlanoContext";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Printer,
  Eye,
  EyeOff,
  Landmark,
  FileSpreadsheet,
  Layers,
  Briefcase,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  PieChart,
  Calculator,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Wallet,
  Clock,
  ChevronRight,
  HelpCircle,
  Target,
  Bot,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPersonal, hasFeature, termo } = usePlanoContext();
  const isPersonalPlan = isPersonal;
  const hasInvestimentos = hasFeature("investimentos_b3");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtros Globais do Cockpit
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear().toString());
  const [tipoVisao, setTipoVisao] = useState("realizado"); // realizado | projetado
  const [privacidade, setPrivacidade] = useState(() => {
    return localStorage.getItem("dashboard_privacidade") === "true";
  });

  const [dataInicio, setDataInicio] = useState(`${now.getFullYear()}-01-01`);
  const [dataFim, setDataFim] = useState(
    new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0]
  );

  const carregarDashboard = async () => {
    try {
      setLoading(true);
      const url = `/relatorios/dashboard?ano=${ano}&data_inicio=${dataInicio}&data_fim=${dataFim}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error("Erro ao carregar Dashboard Executivo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDashboard();
  }, [ano, dataInicio, dataFim]);

  const togglePrivacidade = () => {
    const novoValor = !privacidade;
    setPrivacidade(novoValor);
    localStorage.setItem("dashboard_privacidade", novoValor.toString());
  };

  const formatBRL = (val) => {
    if (privacidade) return "R$ ••••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const kpis = data?.kpis;
  const contas = data?.contas_bancarias || [];
  const matriz12 = data?.matriz_12_meses || [];
  const evolucaoConsolidada = data?.evolucao_saldo_consolidado || [];
  const slug = data?.periodo?.slug || "nuvy-core";

  // Verificar se o período atual está completamente zerado (Empty State)
  const isPeriodoVazio =
    !loading &&
    (kpis?.receita_realizada || 0) === 0 &&
    (kpis?.despesa_realizada || 0) === 0 &&
    (kpis?.contas_receber?.total || 0) === 0 &&
    (kpis?.contas_pagar?.total || 0) === 0 &&
    (kpis?.saldo_bancario || 0) === 0 &&
    (kpis?.saldo_investimentos_b3 || 0) === 0;

  // Cálculos para Gráficos SVG interativos
  const maxDRE = Math.max(
    ...matriz12.map((m) => Math.max(m.receita_bruta, Math.abs(m.lucro_liquido_dre))),
    1000
  );
  const maxCaixa = Math.max(
    ...matriz12.map((m) => Math.max(m.entradas_caixa, m.saidas_caixa)),
    1000
  );
  const maxEvolucao = Math.max(...evolucaoConsolidada.map((m) => m.saldo_final), 1000);

  // Margem Líquida %
  const margemLiquidaPct =
    (kpis?.receita_realizada || 0) > 0
      ? (((kpis?.lucro_liquido || 0) / kpis.receita_realizada) * 100).toFixed(1)
      : "0.0";

  return (
    <AdminLayout>
      <div className="space-y-5 pb-12 print:p-0 print:m-0 print:space-y-2">
        {/* =========================================================================
            1. BARRA SUPERIOR DE FILTROS & PERÍODO (DESIGN PRECISION LIGHT)
           ========================================================================= */}
        <Card padding="md" className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
          {/* Lado Esquerdo: Filtros de Data & Presets Rápidos */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar size={15} className="text-emerald-600 shrink-0" />
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">De:</span>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="bg-white border border-slate-200 text-xs px-2 py-0.5 rounded-lg text-slate-800 font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Até:</span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="bg-white border border-slate-200 text-xs px-2 py-0.5 rounded-lg text-slate-800 font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Presets Rápidos */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => {
                  const hj = new Date().toISOString().split("T")[0];
                  setDataInicio(hj);
                  setDataFim(hj);
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                onClick={() => {
                  const hj = new Date();
                  const ini = `${hj.getFullYear()}-${String(hj.getMonth() + 1).padStart(2, "0")}-01`;
                  const fim = new Date(hj.getFullYear(), hj.getMonth() + 1, 0)
                    .toISOString()
                    .split("T")[0];
                  setDataInicio(ini);
                  setDataFim(fim);
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Este Mês
              </button>
              <button
                onClick={() => {
                  setDataInicio(`${ano}-01-01`);
                  setDataFim(`${ano}-12-31`);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold transition-colors cursor-pointer shadow-xs"
              >
                Ano Completo
              </button>
            </div>
          </div>

          {/* Lado Direito: Seletor de Ano, Regime e Ações */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <select
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="bg-white border border-slate-200 text-xs px-2.5 py-1 rounded-lg text-slate-800 font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="2027">2027</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>

              {/* Regime: Realizado vs Projetado */}
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2 text-xs font-semibold">
                <button
                  onClick={() => setTipoVisao("realizado")}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    tipoVisao === "realizado"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Realizado
                </button>
                <button
                  onClick={() => setTipoVisao("projetado")}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    tipoVisao === "projetado"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Projetado
                </button>
              </div>
            </div>

            {/* Botões Utilitários */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={togglePrivacidade}
                title={privacidade ? "Exibir Valores" : "Modo Privacidade (Ocultar)"}
                className="p-2"
              >
                {privacidade ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>

              <Button
                variant="dark"
                size="sm"
                icon={<Printer size={15} />}
                onClick={handlePrint}
              >
                Imprimir Cockpit
              </Button>
            </div>
          </div>
        </Card>

        {/* =========================================================================
            2. AÇÕES RÁPIDAS TRANSACIONAIS (QUICK ACTIONS - 1 CLIQUE)
           ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <Link
            to={`/admin/${slug}/receber`}
            className="p-3 bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-2xl shadow-xs transition-all flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Plus size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 block leading-tight">
                Nova Receita
              </span>
              <span className="text-[10px] text-slate-400">{isPersonalPlan ? "Entrada / Salário" : "Cobrança PIX / Boleto"}</span>
            </div>
          </Link>

          <Link
            to={`/admin/${slug}/pagar`}
            className="p-3 bg-white hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-2xl shadow-xs transition-all flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingDown size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-rose-900 block leading-tight">
                Nova Despesa
              </span>
              <span className="text-[10px] text-slate-400">{isPersonalPlan ? "Contas / Cartão" : "Contas a Pagar"}</span>
            </div>
          </Link>

          {isPersonalPlan ? (
            <Link
              to={`/admin/${slug}/orcamento`}
              className="p-3 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-xs transition-all flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Target size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 block leading-tight">
                  Minhas Metas
                </span>
                <span className="text-[10px] text-slate-400">Orçamento 12M</span>
              </div>
            </Link>
          ) : (
            <Link
              to={`/admin/${slug}/conciliacao`}
              className="p-3 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-2xl shadow-xs transition-all flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Landmark size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-blue-900 block leading-tight">
                  Conciliação
                </span>
                <span className="text-[10px] text-slate-400">Importar Extratos</span>
              </div>
            </Link>
          )}

          {isPersonalPlan ? (
            <Link
              to={`/admin/${slug}/automacoes`}
              className="p-3 bg-white hover:bg-sky-50/60 border border-slate-200 hover:border-sky-300 rounded-2xl shadow-xs transition-all flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Bot size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-sky-900 block leading-tight">
                  Copiloto Cora
                </span>
                <span className="text-[10px] text-slate-400">WhatsApp & Telegram</span>
              </div>
            </Link>
          ) : (
            <Link
              to={`/admin/${slug}/precificacao`}
              className="p-3 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-2xl shadow-xs transition-all flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Calculator size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900 block leading-tight">
                  Simular Markup
                </span>
                <span className="text-[10px] text-slate-400">Precificação Ideal</span>
              </div>
            </Link>
          )}
        </div>

        {/* =========================================================================
            3. EMPTY STATE CONDICIONAL (QUANDO NÃO HÁ MOVIMENTAÇÕES)
           ========================================================================= */}
        {isPeriodoVazio && (
          <Card padding="lg" className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
              <Sparkles size={28} />
            </div>
            <div className="max-w-md mx-auto">
              <h2 className="text-lg font-bold text-slate-900">Seu Cockpit Financeiro está pronto para começar!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Você ainda não possui transações registradas para este período. Cadastre seu primeiro recebimento ou importe seu extrato bancário para alimentar os indicadores em tempo real.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => navigate(`/admin/${slug}/receber`)}
              >
                Criar Primeiro Lançamento
              </Button>
              <Button
                variant="secondary"
                icon={<Landmark size={16} />}
                onClick={() => navigate(`/admin/${slug}/conciliacao`)}
              >
                Importar Extrato Bancário (OFX)
              </Button>
            </div>
          </Card>
        )}

        {/* =========================================================================
            4. HERO GRID: KPIS PRIMÁRIOS (DESTAQUE NÍVEL 1)
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Patrimônio Líquido / Saldo Geral */}
          <Card padding="md" className="flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isPersonal ? "SALDO DISPONÍVEL GERAL" : "PATRIMÔNIO LÍQUIDO TOTAL"}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Wallet size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                {loading ? "..." : formatBRL(isPersonal ? kpis?.saldo_bancario : kpis?.patrimonio_total)}
              </div>
              {isPersonal ? (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500 font-medium">
                  <span>{contas.length} conta(s) e carteira(s) cadastradas</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 font-medium font-mono">
                  <span>Caixa: <strong>{formatBRL(kpis?.saldo_bancario)}</strong></span>
                  <span>•</span>
                  <span>B3: <strong>{formatBRL(kpis?.saldo_investimentos_b3)}</strong></span>
                </div>
              )}
            </div>
          </Card>

          {/* Card 2: Balanço do Mês / Lucro Líquido */}
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isPersonal ? "BALANÇO DO MÊS" : "LUCRO LÍQUIDO (DRE)"}
              </span>
              {isPersonal ? (
                <Badge variant={(kpis?.lucro_liquido || 0) >= 0 ? "success" : "danger"}>
                  {(kpis?.lucro_liquido || 0) >= 0 ? "Superávit" : "Déficit"}
                </Badge>
              ) : (
                <Badge variant={parseFloat(margemLiquidaPct) >= 0 ? "success" : "danger"}>
                  {margemLiquidaPct}% margem
                </Badge>
              )}
            </div>
            <div className="mt-3">
              <div
                className={`text-3xl font-black tracking-tight font-mono ${
                  (kpis?.lucro_liquido || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {loading ? "..." : formatBRL(kpis?.lucro_liquido)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1.5 block font-mono">
                {isPersonal ? "Entradas do período: " : "Receita Bruta: "}
                <strong>{formatBRL(kpis?.receita_realizada)}</strong>
              </span>
            </div>
          </Card>

          {/* Card 3: Contas a Pagar / Liquidez */}
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isPersonal ? "CONTAS A PAGAR DO MÊS" : "LIQUIDEZ IMEDIATA (CAIXA)"}
              </span>
              <div className={`w-8 h-8 rounded-xl ${isPersonal ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"} flex items-center justify-center`}>
                {isPersonal ? <TrendingDown size={16} /> : <Landmark size={16} />}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                {loading ? "..." : formatBRL(isPersonal ? kpis?.contas_pagar?.total : kpis?.saldo_bancario)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1.5 block truncate">
                {isPersonal
                  ? `${kpis?.contas_pagar?.quantidade || 0} contas/despesas previstas`
                  : `${contas.length} conta(s) ativas cadastradas`}
              </span>
            </div>
          </Card>

          {/* Card 4: Investimentos B3 OU Orçamento & Metas */}
          {hasInvestimentos ? (
            <Card padding="md" className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  CARTEIRA B3 & WEALTH
                </span>
                <Link
                  to={`/admin/${slug}/investimentos`}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5"
                >
                  Ver Carteira <ChevronRight size={12} />
                </Link>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-emerald-700 tracking-tight font-mono">
                  {loading ? "..." : formatBRL(kpis?.saldo_investimentos_b3)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1.5 block">
                  Cotações reais B3 ao vivo
                </span>
              </div>
            </Card>
          ) : (
            <Card padding="md" className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  METAS & ORÇAMENTO
                </span>
                <Link
                  to={`/admin/${slug}/orcamento`}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                  Ver Metas <ChevronRight size={12} />
                </Link>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-indigo-600 tracking-tight font-mono">
                  {loading ? "..." : formatBRL(kpis?.despesa_realizada || 0)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1.5 block">
                  Total já desembolsado no período
                </span>
              </div>
            </Card>
          )}
        </div>

        {/* =========================================================================
            5. SEÇÃO CENTRAL: FLUXO DE CONTAS A RECEBER & CONTAS A PAGAR
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* BLOCO RECEBÍVEIS & INADIMPLÊNCIA */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{isPersonal ? "Entradas Previstas" : "Contas a Receber"}</h3>
                  <p className="text-[11px] text-slate-400">{isPersonal ? "Salários, rendimentos e recebimentos do mês" : "Previsão e controle de recebíveis"}</p>
                </div>
              </div>
              <Link
                to={`/admin/${slug}/receber`}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Ver Todas
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">A Receber no Período</span>
                <p className="text-lg font-black text-emerald-700 font-mono mt-1">
                  {formatBRL(kpis?.contas_receber?.total)}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {kpis?.contas_receber?.quantidade || 0} {isPersonal ? "recebimento(s) agendado(s)" : "faturas abertas"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-800 uppercase">{isPersonal ? "Recebimentos Pendentes" : "Em Atraso (Clientes)"}</span>
                  <AlertTriangle size={12} className="text-rose-600" />
                </div>
                <p className="text-lg font-black text-rose-600 font-mono mt-1">
                  {formatBRL(kpis?.receber_vencido?.total)}
                </p>
                <span className="text-[10px] text-rose-500 font-medium">
                  {kpis?.receber_vencido?.quantidade || 0} {isPersonal ? "pendência(s)" : "clientes em atraso"}
                </span>
              </div>
            </div>
          </Card>

          {/* BLOCO CONTAS A PAGAR & VENCIDOS */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{isPersonal ? "Minhas Despesas" : "Contas a Pagar"}</h3>
                  <p className="text-[11px] text-slate-400">{isPersonal ? "Contas da casa, cartões e despesas" : "Compromissos e saídas de tesouraria"}</p>
                </div>
              </div>
              <Link
                to={`/admin/${slug}/pagar`}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                Ver Todas
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">A Pagar no Período</span>
                <p className="text-lg font-black text-slate-900 font-mono mt-1">
                  {formatBRL(kpis?.contas_pagar?.total)}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {kpis?.contas_pagar?.quantidade || 0} {isPersonal ? "contas agendadas" : "pagamentos previstos"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 uppercase">{isPersonal ? "Contas em Atraso" : "Pagamentos Vencidos"}</span>
                  <Clock size={12} className="text-amber-600" />
                </div>
                <p className="text-lg font-black text-amber-700 font-mono mt-1">
                  {formatBRL(kpis?.pagar_vencido?.total)}
                </p>
                <span className="text-[10px] text-amber-600 font-medium">
                  {kpis?.pagar_vencido?.quantidade || 0} {isPersonal ? "contas vencidas" : "contas pendentes"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* =========================================================================
            6. GRÁFICOS EXECUTIVOS REFORMULADOS (LUCRO LÍQUIDO & FLUXO DE CAIXA)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* GRÁFICO 1: LUCRO LÍQUIDO MENSAL (REGIME DE COMPETÊNCIA) */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{isPersonal ? "Economia Mensal & Entradas (12 Meses)" : "Lucro Líquido & Receita Bruta (12 Meses)"}</h3>
                <p className="text-[11px] text-slate-400">{isPersonal ? `Balanço financeiro consolidado (${ano})` : `Demonstração por Regime de Competência (${ano})`}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" /> {isPersonal ? "Total Entradas" : "Receita Bruta"}
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> {isPersonal ? "Economia Líquida" : "Lucro Líquido"}
                </span>
              </div>
            </div>

            {/* Gráfico Visual */}
            <div className="h-56 w-full pt-2">
              <ChartContainer
                config={{
                  receita_bruta: {
                    label: isPersonal ? "Total Entradas" : "Receita Bruta",
                    color: "#94a3b8",
                  },
                  lucro_liquido_dre: {
                    label: isPersonal ? "Economia Líquida" : "Lucro Líquido",
                    color: "#059669",
                  },
                }}
                className="h-full w-full aspect-auto"
              >
                <BarChart data={matriz12} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="#94a3b8" />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={10} stroke="#94a3b8" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatBRL(value)}
                      />
                    }
                  />
                  <Bar dataKey="receita_bruta" name={isPersonal ? "Total Entradas" : "Receita Bruta"} fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="lucro_liquido_dre" name={isPersonal ? "Economia Líquida" : "Lucro Líquido"} fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
            </div>
          </Card>

          {/* GRÁFICO 2: FLUXO DE CAIXA MENSAL & EVOLUÇÃO CONSOLIDADA */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Fluxo de Caixa Mensal (Entradas vs. Saídas)</h3>
                <p className="text-[11px] text-slate-400">Regime de Caixa / Liquidações Realizadas ({ano})</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> Entradas
                </span>
                <span className="flex items-center gap-1.5 text-rose-500">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Saídas
                </span>
              </div>
            </div>

            {/* Gráfico Visual */}
            <div className="h-56 w-full pt-2">
              <ChartContainer
                config={{
                  entradas_caixa: {
                    label: "Entradas",
                    color: "#2563eb",
                  },
                  saidas_caixa: {
                    label: "Saídas",
                    color: "#e11d48",
                  },
                }}
                className="h-full w-full aspect-auto"
              >
                <BarChart data={matriz12} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="#94a3b8" />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={10} stroke="#94a3b8" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatBRL(value)}
                      />
                    }
                  />
                  <Bar dataKey="entradas_caixa" name="Entradas" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="saidas_caixa" name="Saídas" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
            </div>
          </Card>
        </div>

        {/* =========================================================================
            7. SALDO CONSOLIDADO EM CONTAS & EVOLUÇÃO PATRIMONIAL
           ========================================================================= */}
        <Card padding="md" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Evolução do Saldo Consolidado de Caixa ({ano})</h3>
              <p className="text-[11px] text-slate-400">Curva de crescimento do saldo financeiro acumulado ao longo dos 12 meses</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {contas.map((c) => (
                <span
                  key={c.id}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor || "#059669" }} />
                  {c.nome}: <strong className="font-mono">{formatBRL(c.saldo_atual)}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="h-36 w-full pt-2">
            <ChartContainer
              config={{
                saldo_final: {
                  label: "Saldo Acumulado",
                  color: "#059669",
                },
              }}
              className="h-full w-full aspect-auto"
            >
              <AreaChart data={evolucaoConsolidada} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientSaldoDashboard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={10} stroke="#94a3b8" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatBRL(value)}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="saldo_final"
                  name="Saldo Acumulado"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradientSaldoDashboard)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
