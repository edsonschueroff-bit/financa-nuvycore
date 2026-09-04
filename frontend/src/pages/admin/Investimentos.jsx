import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Plus,
  RefreshCw,
  Landmark,
  DollarSign,
  PieChart,
  Shield,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle,
  Briefcase,
  Search,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";

export default function Investimentos() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [resumo, setResumo] = useState(null);
  const [ativos, setAtivos] = useState([]);
  const [carteiras, setCarteiras] = useState([]);
  const [proventos, setProventos] = useState([]);
  const [contasBancarias, setContasBancarias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [buscandoTicker, setBuscandoTicker] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState("ativos"); // ativos | proventos | carteiras
  const [filtroClasse, setFiltroClasse] = useState("");

  // Modal Novo Ativo
  const [modalAtivo, setModalAtivo] = useState(false);
  const [editandoAtivo, setEditandoAtivo] = useState(null);
  const [formAtivo, setFormAtivo] = useState({
    carteira_id: "",
    codigo_ticker: "",
    nome_ativo: "",
    classe_ativo: "acoes",
    quantidade: "1",
    preco_medio: "",
    preco_atual: "",
    data_aplicacao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
  });

  // Modal Nova Carteira
  const [modalCarteira, setModalCarteira] = useState(false);
  const [formCarteira, setFormCarteira] = useState({
    nome: "",
    tipo_titular: "pj",
    instituicao_corretora: "B3 - Área do Investidor",
    cor: "#059669",
  });

  // Modal Novo Provento
  const [modalProvento, setModalProvento] = useState(false);
  const [formProvento, setFormProvento] = useState({
    ativo_id: "",
    tipo_provento: "dividendo",
    valor_liquido: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    lancar_no_fluxo_caixa: false,
    conta_bancaria_id: "",
  });

  // Modal Importar Planilha B3 / Corretora
  const [modalImportar, setModalImportar] = useState(false);
  const [textoPlanilha, setTextoPlanilha] = useState("");
  const [carteiraImportacaoId, setCarteiraImportacaoId] = useState("");
  const [importando, setImportando] = useState(false);
  const fileImportRef = React.useRef(null);

  const corretorasDisponiveis = [
    "B3 - Área do Investidor",
    "XP Investimentos",
    "BTG Pactual Empresas",
    "Banco Inter Invest",
    "NuInvest / Nubank",
    "Rico Investimentos",
    "Clear Corretora",
    "Órama",
    "Safra",
    "C6 Invest",
  ];

  const carregarDados = async () => {
    try {
      setLoading(true);
      const urlAtivos = filtroClasse ? `/investimentos/ativos?classe=${filtroClasse}` : `/investimentos/ativos`;

      const [resRes, atRes, cartRes, provRes, cRes] = await Promise.all([
        api.get("/investimentos/resumo"),
        api.get(urlAtivos),
        api.get("/investimentos/carteiras"),
        api.get("/investimentos/proventos"),
        api.get("/contas-bancarias"),
      ]);

      setResumo(resRes.data);
      setAtivos(atRes.data || []);
      setCarteiras(cartRes.data || []);
      setProventos(provRes.data || []);
      setContasBancarias(cRes.data.contas || []);
    } catch (err) {
      console.error("Erro ao carregar investimentos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroClasse]);

  // Sincronização 100% Real com a B3
  const handleSincronizarB3 = async () => {
    try {
      setSincronizando(true);
      const res = await api.post("/investimentos/sincronizar-b3");
      toast.success(res.data.message || "Cotações atualizadas em tempo real com a B3!");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao sincronizar com a B3.");
    } finally {
      setSincronizando(false);
    }
  };

  // Buscar cotação real ao digitar o Ticker
  const handleBuscarTickerReal = async (ticker) => {
    if (!ticker || ticker.trim().length < 4) return;
    try {
      setBuscandoTicker(true);
      const clean = ticker.trim().toUpperCase();
      const res = await api.get(`/investimentos/cotacao/${clean}`);
      if (res.data && res.data.preco_atual) {
        setFormAtivo((prev) => ({
          ...prev,
          codigo_ticker: clean,
          preco_atual: res.data.preco_atual,
          nome_ativo: prev.nome_ativo || res.data.nome || clean,
          classe_ativo: res.data.classe || prev.classe_ativo,
        }));
      }
    } catch (err) {
      console.log("Ticker não encontrado ou ativo de balcão.");
    } finally {
      setBuscandoTicker(false);
    }
  };

  const handleLimparDadosDemo = async () => {
    const ok = await confirm({
      title: "Limpar dados de demonstração?",
      description: "Deseja realmente limpar todos os ativos e carteiras de demonstração?",
      confirmText: "Sim, limpar tudo",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.delete("/investimentos/reset-demo");
      toast.success("Dados de demonstração removidos com sucesso.");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao limpar dados de demonstração.");
    }
  };

  const handleSalvarAtivo = async (e) => {
    e.preventDefault();
    try {
      if (editandoAtivo) {
        await api.put(`/investimentos/ativos/${editandoAtivo.id}`, formAtivo);
        toast.success("Ativo atualizado com sucesso!");
      } else {
        await api.post("/investimentos/ativos", formAtivo);
        toast.success("Ativo adicionado à carteira!");
      }
      setModalAtivo(false);
      setEditandoAtivo(null);
      setFormAtivo({
        carteira_id: "",
        codigo_ticker: "",
        nome_ativo: "",
        classe_ativo: "acoes",
        quantidade: "1",
        preco_medio: "",
        preco_atual: "",
        data_aplicacao: new Date().toISOString().split("T")[0],
        data_vencimento: "",
      });
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar ativo.");
    }
  };

  const handleDeletarAtivo = async (id) => {
    const ok = await confirm({
      title: "Excluir ativo?",
      description: "Deseja realmente excluir este ativo da carteira de investimentos?",
      confirmText: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.delete(`/investimentos/ativos/${id}`);
      carregarDados();
      toast.success("Ativo excluído com sucesso!");
    } catch (err) {
      toast.error("Erro ao excluir ativo.");
    }
  };

  const handleSalvarCarteira = async (e) => {
    e.preventDefault();
    try {
      await api.post("/investimentos/carteiras", formCarteira);
      setModalCarteira(false);
      setFormCarteira({
        nome: "",
        tipo_titular: "pj",
        instituicao_corretora: "B3 - Área do Investidor",
        cor: "#059669",
      });
      carregarDados();
      toast.success("Carteira de investimentos criada!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar carteira.");
    }
  };

  const handleSalvarProvento = async (e) => {
    e.preventDefault();
    try {
      await api.post("/investimentos/proventos", formProvento);
      setModalProvento(false);
      setFormProvento({
        ativo_id: "",
        tipo_provento: "dividendo",
        valor_liquido: "",
        data_pagamento: new Date().toISOString().split("T")[0],
        lancar_no_fluxo_caixa: false,
        conta_bancaria_id: "",
      });
      carregarDados();
      toast.success("Provento registrado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao registrar provento.");
    }
  };

  // Parser de Planilha de Posição B3 / Corretoras (Excel CSV / Texto)
  const parseLinhasPlanilha = (conteudoTexto) => {
    const linhas = conteudoTexto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const ativosParsed = [];

    const sep = conteudoTexto.includes(";") ? ";" : conteudoTexto.includes("\t") ? "\t" : ",";

    for (const linha of linhas) {
      const colunas = linha.split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
      if (colunas.length < 2) continue;

      // Ignorar cabeçalhos
      const linhaBaixa = linha.toLowerCase();
      if (linhaBaixa.includes("código") || linhaBaixa.includes("ticker") || linhaBaixa.includes("produto") || linhaBaixa.includes("instituição") || linhaBaixa.includes("total")) {
        if (!/\b[A-Z]{4}\d{1,2}\b/.test(linha.toUpperCase())) continue;
      }

      // Procurar ticker da B3 (ex: PETR4, VALE3, MXRF11, HGLG11, IVVB11)
      let ticker = "";
      for (const col of colunas) {
        const m = col.toUpperCase().match(/\b([A-Z]{4}\d{1,2})\b/);
        if (m) {
          ticker = m[1];
          break;
        }
      }

      if (!ticker) continue;

      // Procurar quantidade e preço médio
      let quantidade = 1;
      let precoMedio = 0;

      const numeros = [];
      for (const col of colunas) {
        const limpo = col.replace(/R\$\s?/gi, "").replace(/\s/g, "");
        let n = null;
        if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(limpo)) {
          n = parseFloat(limpo.replace(/\./g, "").replace(",", "."));
        } else if (/^\d+,\d+$/.test(limpo)) {
          n = parseFloat(limpo.replace(",", "."));
        } else if (/^\d+(\.\d+)?$/.test(limpo)) {
          n = parseFloat(limpo);
        }
        if (n !== null && !isNaN(n) && n > 0) {
          numeros.push(n);
        }
      }

      if (numeros.length >= 2) {
        // Geralmente o menor ou inteiro é quantidade, ou se um for > 1000 e outro menor
        quantidade = numeros[0];
        precoMedio = numeros[1];
        // Se a quantidade parece ser invertida com preço
        if (Number.isInteger(numeros[1]) && !Number.isInteger(numeros[0])) {
          quantidade = numeros[1];
          precoMedio = numeros[0];
        }
      } else if (numeros.length === 1) {
        quantidade = numeros[0];
      }

      ativosParsed.push({
        codigo_ticker: ticker,
        quantidade: quantidade,
        preco_medio: precoMedio,
      });
    }

    return ativosParsed;
  };

  const handleImportarPlanilha = async (e) => {
    e.preventDefault();
    if (!textoPlanilha.trim()) {
      toast.warning("Por favor, cole as linhas da planilha ou selecione um arquivo.");
      return;
    }

    const parsed = parseLinhasPlanilha(textoPlanilha);
    if (parsed.length === 0) {
      toast.error("Nenhum ativo com código da B3 identificado (Ex: PETR4, VALE3, MXRF11). Verifique o formato.");
      return;
    }

    try {
      setImportando(true);
      const res = await api.post("/investimentos/importar", {
        carteira_id: carteiraImportacaoId || carteiras[0]?.id || null,
        itens: parsed,
      });

      toast.success(res.data?.message || "Posições importadas com sucesso!");
      setModalImportar(false);
      setTextoPlanilha("");
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao importar planilha.");
    } finally {
      setImportando(false);
    }
  };

  const handleUploadArquivoPlanilha = async (file) => {
    if (!file) return;
    try {
      const texto = await file.text();
      setTextoPlanilha(texto);
      toast.info("Arquivo de planilha carregado para importação.");
    } catch (err) {
      toast.error("Erro ao ler arquivo.");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const classesLabels = {
    renda_fixa: { label: "Renda Fixa (CDB/LCI)", cor: "bg-blue-500", badgeVariant: "info" },
    acoes: { label: "Ações Brasil (B3)", cor: "bg-emerald-500", badgeVariant: "success" },
    fiis: { label: "Fundos Imobiliários (FIIs)", cor: "bg-teal-500", badgeVariant: "neutral" },
    tesouro_direto: { label: "Tesouro Direto", cor: "bg-amber-500", badgeVariant: "warning" },
    etfs_bdrs: { label: "ETFs & BDRs", cor: "bg-indigo-500", badgeVariant: "info" },
    fundos: { label: "Fundos de Investimento", cor: "bg-rose-500", badgeVariant: "danger" },
  };

  const kpis = resumo?.kpis;
  const lucroPositivo = (kpis?.lucro_total || 0) >= 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header de Investimentos */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="text-emerald-600" size={24} /> Carteira de Investimentos & B3
            </h1>
            <p className="text-xs text-slate-500">
              Gestão patrimonial completa, cotações ao vivo na B3 e controle de dividendos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} className={sincronizando ? "animate-spin" : ""} />}
              onClick={handleSincronizarB3}
              disabled={sincronizando}
            >
              {sincronizando ? "Atualizando..." : "Sincronizar B3"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet size={14} />}
              onClick={() => setModalImportar(true)}
            >
              Importar Planilha
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setEditandoAtivo(null);
                setFormAtivo({
                  carteira_id: carteiras[0]?.id || "",
                  codigo_ticker: "",
                  nome_ativo: "",
                  classe_ativo: "acoes",
                  quantidade: "1",
                  preco_medio: "",
                  preco_atual: "",
                  data_aplicacao: new Date().toISOString().split("T")[0],
                  data_vencimento: "",
                });
                setModalAtivo(true);
              }}
            >
              Novo Ativo
            </Button>
          </div>
        </div>

        {/* 4 Cards de Métricas Principais (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Patrimônio Investido</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Landmark size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {loading ? "..." : formatBRL(kpis?.total_atual)}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
                Custo de aquisição: {formatBRL(kpis?.total_investido)}
              </span>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Rentabilidade Histórica</span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  lucroPositivo ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}
              >
                {lucroPositivo ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl font-black tracking-tight font-mono ${
                  lucroPositivo ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {loading ? "..." : `${kpis?.rentabilidade_pct > 0 ? "+" : ""}${kpis?.rentabilidade_pct}%`}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
                {lucroPositivo ? "Rendimento acumulado positivo" : "Rentabilidade em ajuste"}
              </span>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Lucro / Prejuízo Real</span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  lucroPositivo ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}
              >
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl font-black tracking-tight font-mono ${
                  lucroPositivo ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {loading ? "..." : formatBRL(kpis?.lucro_total)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                Ganho de capital real
              </span>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Dividendos no Mês</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-700 tracking-tight font-mono">
                {loading ? "..." : formatBRL(kpis?.proventos_mes)}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block font-mono">
                Acumulado ano: {formatBRL(kpis?.proventos_ano)}
              </span>
            </div>
          </Card>
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Posições em Custódia</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <PieChart size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {kpis?.total_ativos || 0} ativo(s)
              </div>
              <span className="text-[11px] text-emerald-600 font-bold mt-1 inline-block">
                Em {carteiras.length} conta(s) ativas
              </span>
            </div>
          </Card>
        </div>

        {/* Barra de Distribuição de Alocação */}
        {resumo?.distribuicao_classes && resumo.distribuicao_classes.length > 0 && (
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <PieChart size={14} className="text-emerald-600" /> Alocação por Classe de Investimento
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">100% da carteira</span>
            </div>

            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              {resumo.distribuicao_classes.map((c, i) => (
                <div
                  key={i}
                  title={`${classesLabels[c.classe]?.label || c.classe}: ${c.percentual}% (${formatBRL(c.valor_atual)})`}
                  style={{ width: `${c.percentual}%` }}
                  className={`h-full transition-all ${classesLabels[c.classe]?.cor || "bg-slate-400"}`}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              {resumo.distribuicao_classes.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className={`w-2.5 h-2.5 rounded-full ${classesLabels[c.classe]?.cor || "bg-slate-400"}`} />
                  <span>{classesLabels[c.classe]?.label || c.classe}</span>
                  <span className="font-bold text-slate-900 font-mono">({c.percentual}%)</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Alternador de Abas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs w-fit text-xs font-semibold">
            <button
              onClick={() => setAbaAtiva("ativos")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === "ativos"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Briefcase size={14} /> Ativos & Cotações B3 ({ativos.length})
            </button>
            <button
              onClick={() => setAbaAtiva("proventos")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === "proventos"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <DollarSign size={14} /> Proventos & Dividendos ({proventos.length})
            </button>
            <button
              onClick={() => setAbaAtiva("evolucao")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === "evolucao"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BarChart3 size={14} /> Evolução & Renda Passiva
            </button>
            <button
              onClick={() => setAbaAtiva("carteiras")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === "carteiras"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Landmark size={14} /> Carteiras & Corretoras ({carteiras.length})
            </button>
          </div>

          {abaAtiva === "ativos" && (
            <select
              value={filtroClasse}
              onChange={(e) => setFiltroClasse(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas as Classes de Ativo</option>
              <option value="acoes">Ações Brasil (B3)</option>
              <option value="fiis">Fundos Imobiliários (FIIs)</option>
              <option value="renda_fixa">Renda Fixa (CDB/LCI)</option>
              <option value="tesouro_direto">Tesouro Direto</option>
            </select>
          )}
        </div>

        {/* Aba 1: Tabela de Ativos da Carteira */}
        {abaAtiva === "ativos" && (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3.5">Ticker / Ativo</th>
                    <th className="px-4 py-3.5">Classe</th>
                    <th className="px-4 py-3.5">Carteira</th>
                    <th className="px-4 py-3.5 text-right">Qtd</th>
                    <th className="px-4 py-3.5 text-right">Preço Médio</th>
                    <th className="px-4 py-3.5 text-right">Cotação Atual (B3)</th>
                    <th className="px-4 py-3.5 text-right">Total Atual</th>
                    <th className="px-4 py-3.5 text-right">Lucro / Rentab.</th>
                    <th className="px-4 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        Carregando posições de investimento...
                      </td>
                    </tr>
                  ) : ativos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        Nenhum ativo cadastrado. Clique em <strong>"+ Nova Posição Real"</strong> para adicionar seus ativos!
                      </td>
                    </tr>
                  ) : (
                    ativos.map((a) => {
                      const lucro = parseFloat(a.lucro_prejuizo_reais || 0);
                      const isLucro = lucro >= 0;
                      const rentPct = parseFloat(a.rentabilidade_ativo_pct || 0).toFixed(2);

                      return (
                        <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <p className="font-extrabold text-slate-900 font-mono">{a.codigo_ticker}</p>
                              {["acoes", "fiis"].includes(a.classe_ativo) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Cotação oficial B3" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{a.nome_ativo}</p>
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant={classesLabels[a.classe_ativo]?.badgeVariant || "neutral"}>
                              {classesLabels[a.classe_ativo]?.label || a.classe_ativo}
                            </Badge>
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800">{a.carteira_nome}</p>
                            <p className="text-[10px] text-slate-400">{a.instituicao_corretora}</p>
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            {parseFloat(a.quantidade).toLocaleString("pt-BR")}
                          </td>

                          <td className="px-4 py-3 text-right text-slate-500 font-mono">
                            {formatBRL(a.preco_medio)}
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                            {formatBRL(a.preco_atual)}
                          </td>

                          <td className="px-4 py-3 text-right font-black text-slate-900 text-sm font-mono">
                            {formatBRL(a.valor_total_atual)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <p
                              className={`font-black font-mono ${
                                isLucro ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {isLucro ? "+" : ""}
                              {formatBRL(lucro)}
                            </p>
                            <span
                              className={`text-[10px] font-bold font-mono ${
                                isLucro ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {isLucro ? "+" : ""}
                              {rentPct}%
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1.5 h-auto text-slate-400 hover:text-slate-700"
                                onClick={() => {
                                  setEditandoAtivo(a);
                                  setFormAtivo({
                                    carteira_id: a.carteira_id,
                                    codigo_ticker: a.codigo_ticker,
                                    nome_ativo: a.nome_ativo,
                                    classe_ativo: a.classe_ativo,
                                    quantidade: a.quantidade,
                                    preco_medio: a.preco_medio,
                                    preco_atual: a.preco_atual,
                                    data_aplicacao: a.data_aplicacao ? a.data_aplicacao.split("T")[0] : "",
                                    data_vencimento: a.data_vencimento ? a.data_vencimento.split("T")[0] : "",
                                  });
                                  setModalAtivo(true);
                                }}
                                title="Editar Ativo"
                              >
                                <Edit2 size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1.5 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => handleDeletarAtivo(a.id)}
                                title="Excluir Ativo"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Aba 2: Histórico de Proventos & Dividendos */}
        {abaAtiva === "proventos" && (
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>Proventos, Dividendos e Juros Recebidos</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setModalProvento(true)}
              >
                + Registrar Provento
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Ticker / Ativo</th>
                    <th className="px-4 py-3">Tipo de Provento</th>
                    <th className="px-4 py-3 text-right">Valor Líquido</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium">
                  {proventos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        Nenhum dividendo registrado.
                      </td>
                    </tr>
                  ) : (
                    proventos.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {new Date(p.data_pagamento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 font-mono">
                          {p.codigo_ticker || "Aporte Geral"}
                        </td>
                        <td className="px-4 py-3 uppercase text-[11px] font-semibold text-slate-600">
                          {p.tipo_provento?.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600 text-sm font-mono">
                          +{formatBRL(p.valor_liquido)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="success">RECEBIDO</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Aba: Evolução do Patrimônio & Renda Passiva */}
        {abaAtiva === "evolucao" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Evolução dos Dividendos (Renda Passiva Mensal) */}
              <Card padding="md" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <DollarSign className="text-emerald-600" size={16} /> Fluxo de Dividendos Mensais (12 Meses)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Renda passiva creditada em conta</p>
                  </div>
                  <Badge variant="neutral">Proventos</Badge>
                </div>

                {(!resumo?.historico_dividendos || resumo.historico_dividendos.length === 0) ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    Nenhum dividendo recebido nos últimos 12 meses.
                    <p className="text-[11px] text-slate-400 mt-1">
                      Clique em "+ Provento / Dividendo" para lançar seus proventos recebidos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-48 w-full pt-2">
                      <ChartContainer
                        config={{
                          total: {
                            label: "Proventos Recebidos",
                            color: "#059669",
                          },
                        }}
                        className="h-full w-full aspect-auto"
                      >
                        <BarChart data={resumo.historico_dividendos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="mes_label" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} stroke="#94a3b8" />
                          <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={10} stroke="#94a3b8" tickFormatter={(v) => `R$${v}`} />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => formatBRL(value)}
                              />
                            }
                          />
                          <Bar dataKey="total" name="Proventos" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={22} />
                        </BarChart>
                      </ChartContainer>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 font-semibold pt-1">
                      <span>Total acumulado no ano:</span>
                      <strong className="text-emerald-700 font-mono text-sm">
                        {formatBRL(kpis?.proventos_ano)}
                      </strong>
                    </div>
                  </div>
                )}
              </Card>

              {/* Card de Curva de Crescimento & Yield on Cost */}
              <Card padding="md" className="space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <TrendingUp className="text-emerald-600" size={16} /> Curva Patrimonial & Yield On Cost
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">Comparativo de custo vs valor de mercado</p>
                    </div>
                    <Badge variant={lucroPositivo ? "success" : "danger"}>
                      {lucroPositivo ? "+" : ""}{kpis?.rentabilidade_pct}% Total
                    </Badge>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Capital Total Aportado</span>
                        <p className="text-xl font-black text-slate-800 font-mono mt-0.5">
                          {formatBRL(kpis?.total_investido)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">Base de Custo</span>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase">Patrimônio Atual (B3)</span>
                        <p className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                          {formatBRL(kpis?.total_atual)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Lucro Real</span>
                        <span className="text-xs font-black text-emerald-700 font-mono">
                          +{formatBRL(kpis?.lucro_total)}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-800 uppercase">Yield on Cost Estimado (YoC)</span>
                        <p className="text-xl font-black text-indigo-700 font-mono mt-0.5">
                          {kpis?.total_investido > 0
                            ? (((kpis?.proventos_ano || 0) / kpis.total_investido) * 100).toFixed(2)
                            : "0.00"}% a.a.
                        </p>
                      </div>
                      <span className="text-[11px] text-indigo-800 font-medium text-right max-w-[140px]">
                        Rendimento sobre o seu custo de aquisição
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 text-center pt-2">
                  Preços sincronizados com os dados oficiais da B3 ao vivo.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Aba 3: Carteiras & Corretoras */}
        {abaAtiva === "carteiras" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Corretoras e Carteiras Conectadas
              </h3>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setModalCarteira(true)}
              >
                + Nova Carteira / Corretora
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {carteiras.map((c) => (
                <Card
                  key={c.id}
                  padding="md"
                  hover
                  className="flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs"
                          style={{ backgroundColor: c.cor || "#059669" }}
                        >
                          <Landmark size={18} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">{c.nome}</h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {c.instituicao_corretora}
                          </span>
                        </div>
                      </div>
                      <Badge variant={c.tipo_titular === "pj" ? "info" : "neutral"}>
                        {c.tipo_titular === "pj" ? "Caixa PJ" : "Sócio PF"}
                      </Badge>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs">
                      <p className="text-slate-400">Patrimônio Alocado:</p>
                      <p className="text-xl font-black text-slate-900 font-mono">
                        {formatBRL(c.total_patrimonio)}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-semibold">
                        {c.total_ativos || 0} ativo(s) nesta carteira
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Modal 1: Novo / Editar Ativo */}
        <Modal
          isOpen={modalAtivo}
          onClose={() => setModalAtivo(false)}
          title={editandoAtivo ? "Editar Ativo" : "Cadastrar Posição Real na Carteira"}
          icon={<TrendingUp className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarAtivo} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Carteira / Corretora</label>
                <select
                  required
                  value={formAtivo.carteira_id}
                  onChange={(e) => setFormAtivo({ ...formAtivo, carteira_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione a carteira...</option>
                  {carteiras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.instituicao_corretora})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Classe do Ativo</label>
                <select
                  value={formAtivo.classe_ativo}
                  onChange={(e) => setFormAtivo({ ...formAtivo, classe_ativo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="acoes">Ações Brasil (B3)</option>
                  <option value="fiis">Fundos Imobiliários (FIIs)</option>
                  <option value="renda_fixa">Renda Fixa (CDB / LCI / LCA)</option>
                  <option value="tesouro_direto">Tesouro Direto</option>
                  <option value="etfs_bdrs">ETFs / BDRs</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">Código Ticker (B3)</label>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {buscandoTicker ? "Consultando B3..." : "Digite para buscar cotação real"}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ex: PETR4, VALE3, HGLG11, BBAS3, CDB 110%"
                  value={formAtivo.codigo_ticker}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormAtivo({ ...formAtivo, codigo_ticker: val });
                  }}
                  onBlur={(e) => handleBuscarTickerReal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => handleBuscarTickerReal(formAtivo.codigo_ticker)}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-emerald-600 cursor-pointer"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nome / Descrição da Empresa</label>
              <input
                type="text"
                placeholder="Ex: Petrobras PN, Vale S.A., CSHG Logística"
                value={formAtivo.nome_ativo}
                onChange={(e) => setFormAtivo({ ...formAtivo, nome_ativo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formAtivo.quantidade}
                  onChange={(e) => setFormAtivo({ ...formAtivo, quantidade: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preço Médio (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={formAtivo.preco_medio}
                  onChange={(e) => setFormAtivo({ ...formAtivo, preco_medio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cotação Atual B3 (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Preço da B3"
                  value={formAtivo.preco_atual}
                  onChange={(e) => setFormAtivo({ ...formAtivo, preco_atual: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-600 font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalAtivo(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Ativo
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 2: Nova Carteira */}
        <Modal
          isOpen={modalCarteira}
          onClose={() => setModalCarteira(false)}
          title="Nova Carteira / Corretora"
          icon={<Landmark className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarCarteira} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nome de Identificação</label>
              <input
                type="text"
                required
                placeholder="Ex: Reserva de Caixa PJ, Carteira de Ações Sócios..."
                value={formCarteira.nome}
                onChange={(e) => setFormCarteira({ ...formCarteira, nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Instituição / Corretora</label>
                <select
                  value={formCarteira.instituicao_corretora}
                  onChange={(e) =>
                    setFormCarteira({ ...formCarteira, instituicao_corretora: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {corretorasDisponiveis.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Titularidade</label>
                <select
                  value={formCarteira.tipo_titular}
                  onChange={(e) =>
                    setFormCarteira({ ...formCarteira, tipo_titular: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="pj">Empresa (Caixa PJ)</option>
                  <option value="socio">Sócio (Pessoa Física)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalCarteira(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Criar Carteira
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 3: Registrar Provento */}
        <Modal
          isOpen={modalProvento}
          onClose={() => setModalProvento(false)}
          title="Registrar Dividendo / Rendimento"
          icon={<DollarSign className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarProvento} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ativo de Origem</label>
              <select
                value={formProvento.ativo_id}
                onChange={(e) => setFormProvento({ ...formProvento, ativo_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Rendimento Geral / Caixa</option>
                {ativos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo_ticker} - {a.nome_ativo}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Provento</label>
                <select
                  value={formProvento.tipo_provento}
                  onChange={(e) => setFormProvento({ ...formProvento, tipo_provento: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="dividendo">Dividendo</option>
                  <option value="jcp">Juros sobre Capital (JCP)</option>
                  <option value="rendimento_fii">Rendimento de FII</option>
                  <option value="juros_renda_fixa">Rendimento Renda Fixa / CDI</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor Líquido (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={formProvento.valor_liquido}
                  onChange={(e) => setFormProvento({ ...formProvento, valor_liquido: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Data do Pagamento</label>
              <input
                type="date"
                required
                value={formProvento.data_pagamento}
                onChange={(e) => setFormProvento({ ...formProvento, data_pagamento: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-900">
                <input
                  type="checkbox"
                  checked={formProvento.lancar_no_fluxo_caixa}
                  onChange={(e) =>
                    setFormProvento({
                      ...formProvento,
                      lancar_no_fluxo_caixa: e.target.checked,
                      conta_bancaria_id: contasBancarias[0]?.id || "",
                    })
                  }
                  className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Creditar valor no Caixa da Empresa (DRE / Saldo)</span>
              </label>

              {formProvento.lancar_no_fluxo_caixa && (
                <div>
                  <label className="block font-bold text-emerald-800 text-[11px] mb-1">
                    Conta Bancária de Destino
                  </label>
                  <select
                    required
                    value={formProvento.conta_bancaria_id}
                    onChange={(e) =>
                      setFormProvento({ ...formProvento, conta_bancaria_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs"
                  >
                    {contasBancarias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalProvento(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Registrar Provento
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 4: Importar Planilha B3 / Corretoras */}
        <Modal
          isOpen={modalImportar}
          onClose={() => setModalImportar(false)}
          title="Importar Posição da B3 ou Corretora"
          subtitle="Cole linhas de extrato/Excel ou envie arquivo CSV (XP, NuInvest, Rico, Clear, BTG, Inter, B3)"
          icon={<Upload className="text-blue-600" size={18} />}
          size="lg"
        >
          <form onSubmit={handleImportarPlanilha} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Carteira de Destino</label>
              <select
                value={carteiraImportacaoId}
                onChange={(e) => setCarteiraImportacaoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                {carteiras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.instituicao_corretora})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                type="file"
                ref={fileImportRef}
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadArquivoPlanilha(f);
                }}
              />

              <div
                onClick={() => fileImportRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 rounded-2xl p-4 text-center cursor-pointer transition-all space-y-1 mb-3"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <FileSpreadsheet size={20} />
                </div>
                <p className="font-bold text-slate-800 text-xs">
                  Clique aqui para carregar um arquivo .CSV ou .TXT
                </p>
                <p className="text-[10px] text-slate-400">
                  Exportado da Área do Investidor B3, NuInvest, XP, Clear, Inter, BTG, etc.
                </p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ou cole o texto da Planilha (Código; Quantidade; Preço Médio)
              </label>
              <textarea
                rows={6}
                required
                placeholder={`PETR4; 100; 38.50\nVALE3; 50; 59.20\nMXRF11; 300; 10.15\nHGLG11; 20; 162.00\nIVVB11; 15; 340.00`}
                value={textoPlanilha}
                onChange={(e) => setTextoPlanilha(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                O sistema identifica automaticamente o código do ticker da B3 e busca a cotação real ao vivo!
              </p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalImportar(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={importando}>
                {importando ? "Sincronizando com a B3..." : "Processar & Atualizar Carteira"}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
