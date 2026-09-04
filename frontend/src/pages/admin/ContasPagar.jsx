import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  Button,
  Badge,
  Modal,
  Card,
  FileUploadDropzone,
  ComprovanteModal,
  useConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui";
import { toast } from "sonner";
import RateioCentrosCustoInput from "../../components/ui/RateioCentrosCustoInput";
import { exportToExcel, exportToCsv, exportReciboPdf } from "../../utils/exportHelper";
import {
  TrendingDown,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Trash2,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  Edit2,
  Sparkles,
  Paperclip,
  Download,
  PieChart,
  MoreHorizontal,
} from "lucide-react";

export default function ContasPagar() {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [transacoes, setTransacoes] = useState([]);
  const [contas, setContas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros e Abas
  const [abaAtiva, setAbaAtiva] = useState("todas"); // todas | vencidas | hoje | semana | pagas
  const [search, setSearch] = useState("");

  // Seleção Múltipla para Baixa em Lote
  const [selecionados, setSelecionados] = useState([]);

  // Modal Visualizar Comprovante
  const [modalComprovante, setModalComprovante] = useState(null);

  // Modal Novo Lançamento
  const [modalNovo, setModalNovo] = useState(false);
  const [formNovo, setFormNovo] = useState({
    descricao: "",
    valor: "",
    data_vencimento: new Date().toISOString().split("T")[0],
    data_competencia: new Date().toISOString().split("T")[0],
    categoria_id: "",
    conta_bancaria_id: "",
    contato_id: "",
    centro_custo_id: "",
    forma_pagamento: "pix",
    documento_numero: "",
    observacoes: "",
    comprovante_url: "",
    rateios: [],
    total_parcelas: 1,
    tipo_parcelamento: "dividir", // 'dividir' ou 'fixo'
    recorrente: false,
    frequencia: "mensal",
    status: "pendente",
  });

  // Modal Baixa Individual
  const [modalBaixa, setModalBaixa] = useState(null);
  const [formBaixa, setFormBaixa] = useState({
    conta_bancaria_id: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    valor_pago: "",
    forma_pagamento: "pix",
  });

  // Modal Editar Lançamento
  const [modalEditar, setModalEditar] = useState(null);
  const [formEditar, setFormEditar] = useState({
    descricao: "",
    valor: "",
    data_vencimento: "",
    data_competencia: "",
    categoria_id: "",
    conta_bancaria_id: "",
    contato_id: "",
    centro_custo_id: "",
    forma_pagamento: "pix",
    documento_numero: "",
    observacoes: "",
    comprovante_url: "",
    rateios: [],
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const url =
        abaAtiva === "todas"
          ? `/transacoes?tipo=despesa&search=${search}`
          : `/transacoes?tipo=despesa&aba=${abaAtiva}&search=${search}`;

      const [tRes, cRes, catRes, fornRes, centrosRes] = await Promise.all([
        api.get(url),
        api.get("/contas-bancarias"),
        api.get("/categorias?tipo=despesa"),
        api.get("/contatos"),
        api.get("/categorias/centros-custo/todos"),
      ]);

      setTransacoes(Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data || []));
      setContas(Array.isArray(cRes.data?.contas) ? cRes.data.contas : []);
      setCategorias(Array.isArray(catRes.data) ? catRes.data : []);
      setFornecedores(Array.isArray(fornRes.data) ? fornRes.data : (fornRes.data?.data || []));
      setCentrosCusto(Array.isArray(centrosRes.data) ? centrosRes.data : []);
      setSelecionados([]);
    } catch (err) {
      console.error("Erro ao carregar contas a pagar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [abaAtiva, search]);

  const handleCriarFornecedorRapido = async (nome) => {
    try {
      const res = await api.post("/contatos", {
        nome: nome.trim(),
        tipo: "fornecedor",
      });
      const novoForn = res.data;
      setFornecedores((prev) => [...prev, novoForn]);
      toast.success("Fornecedor rápido cadastrado!");
      return novoForn.id;
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao cadastrar fornecedor rápido.");
      return null;
    }
  };

  const handleCriar = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transacoes", {
        ...formNovo,
        tipo: "despesa",
      });
      setModalNovo(false);
      setFormNovo({
        descricao: "",
        valor: "",
        data_vencimento: new Date().toISOString().split("T")[0],
        data_competencia: new Date().toISOString().split("T")[0],
        categoria_id: "",
        conta_bancaria_id: "",
        contato_id: "",
        forma_pagamento: "pix",
        documento_numero: "",
        observacoes: "",
        comprovante_url: "",
        total_parcelas: 1,
        tipo_parcelamento: "dividir",
        recorrente: false,
        frequencia: "mensal",
        status: "pendente",
      });
      carregarDados();
      toast.success("Conta a pagar criada com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar conta a pagar");
    }
  };

  const handleBaixar = async (e) => {
    e.preventDefault();
    if (!modalBaixa) return;
    try {
      await api.post(`/transacoes/${modalBaixa.id}/baixar`, formBaixa);
      setModalBaixa(null);
      carregarDados();
      toast.success("Pagamento liquidado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao liquidar lançamento");
    }
  };

  const handleBaixaEmLote = async () => {
    if (selecionados.length === 0) return;
    const ok = await confirm({
      title: "Liquidar despesas em lote?",
      description: `Deseja confirmar o pagamento de ${selecionados.length} despesa(s) selecionada(s)?`,
      confirmText: "Sim, liquidar",
      variant: "primary",
    });
    if (!ok) return;

    try {
      const contaPadrao = contas[0]?.id || null;
      await api.post("/transacoes/baixar-lote", {
        ids: selecionados,
        conta_bancaria_id: contaPadrao,
        data_pagamento: new Date().toISOString().split("T")[0],
      });
      setSelecionados([]);
      carregarDados();
      toast.success(`${selecionados.length} despesa(s) liquidada(s) com sucesso!`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao processar baixa em lote");
    }
  };

  const handleExcluirSelecionados = async () => {
    if (selecionados.length === 0) return;
    const ok = await confirm({
      title: "Excluir despesas selecionadas?",
      description: `Deseja realmente excluir as ${selecionados.length} despesas selecionadas? Esta ação é irreversível.`,
      confirmText: "Sim, excluir todas",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.post("/transacoes/deletar-lote", { ids: selecionados });
      setSelecionados([]);
      carregarDados();
      toast.success("Despesas selecionadas excluídas com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir itens em lote");
    }
  };

  const handleEstornar = async (id) => {
    const ok = await confirm({
      title: "Estornar pagamento?",
      description: "Deseja realmente estornar este pagamento e reabrir o lançamento como pendente?",
      confirmText: "Sim, estornar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.post(`/transacoes/${id}/estornar`);
      carregarDados();
      toast.success("Lançamento estornado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao estornar");
    }
  };

  const handleExcluir = async (id) => {
    const ok = await confirm({
      title: "Excluir despesa?",
      description: "Tem certeza que deseja excluir esta despesa permanentemente?",
      confirmText: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.delete(`/transacoes/${id}`);
      carregarDados();
      toast.success("Despesa excluída com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir");
    }
  };

  const handleAbrirEditar = (t) => {
    setModalEditar(t);
    setFormEditar({
      descricao: t.descricao || "",
      valor: t.valor || "",
      data_vencimento: t.data_vencimento ? t.data_vencimento.split("T")[0] : "",
      data_competencia: t.data_competencia ? t.data_competencia.split("T")[0] : "",
      categoria_id: t.categoria_id || "",
      conta_bancaria_id: t.conta_bancaria_id || "",
      contato_id: t.contato_id || "",
      centro_custo_id: t.centro_custo_id || "",
      forma_pagamento: t.forma_pagamento || "pix",
      documento_numero: t.documento_numero || "",
      observacoes: t.observacoes || "",
      comprovante_url: t.comprovante_url || "",
      rateios: Array.isArray(t.rateios) ? t.rateios : [],
    });
  };

  const handleSalvarEditar = async (e) => {
    e.preventDefault();
    if (!modalEditar) return;
    try {
      await api.put(`/transacoes/${modalEditar.id}`, formEditar);
      setModalEditar(null);
      carregarDados();
      toast.success("Lançamento atualizado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao atualizar lançamento.");
    }
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      const pendentesIds = transacoes.filter((t) => t.status === "pendente").map((t) => t.id);
      setSelecionados(pendentesIds);
    } else {
      setSelecionados([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const totalPendente = transacoes
    .filter((t) => t.status === "pendente")
    .reduce((acc, t) => acc + parseFloat(t.valor), 0);

  const totalPago = transacoes
    .filter((t) => t.status === "pago")
    .reduce((acc, t) => acc + parseFloat(t.valor_pago || t.valor), 0);

  const totalVencido = transacoes
    .filter((t) => t.status === "pendente" && t.dias_atraso > 0)
    .reduce((acc, t) => acc + parseFloat(t.valor), 0);

  const handleExportExcel = () => {
    if (!transacoes || transacoes.length === 0) return;
    const excelRows = transacoes.map((t) => ({
      "ID": t.id,
      "Vencimento": t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Competência": t.data_competencia ? new Date(t.data_competencia).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Fornecedor / Favorecido": t.contato_nome || "Fornecedor Direto",
      "Descrição": t.descricao,
      "Categoria": t.categoria_nome || "Geral",
      "Conta Bancária": t.conta_nome || "—",
      "Valor Original (R$)": parseFloat(t.valor || 0),
      "Valor Pago (R$)": parseFloat(t.valor_pago || 0),
      "Status": t.status === "pago" ? "PAGO" : (t.dias_atraso > 0 ? `ATRASADO (${t.dias_atraso}d)` : "PENDENTE"),
      "Data Pagamento": t.data_pagamento ? new Date(t.data_pagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Forma Pagamento": (t.forma_pagamento || "").toUpperCase(),
      "Nº Documento": t.documento_numero || "",
      "Observações": t.observacoes || "",
      "Possui Anexo": t.comprovante_url ? "SIM" : "NÃO",
    }));
    exportToExcel(excelRows, `Contas_a_Pagar_${abaAtiva}`, "Contas a Pagar");
  };

  const handleExportCsv = () => {
    if (!transacoes || transacoes.length === 0) return;
    const csvRows = transacoes.map((t) => ({
      "ID": t.id,
      "Vencimento": t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Fornecedor": t.contato_nome || "Fornecedor Direto",
      "Descrição": t.descricao,
      "Categoria": t.categoria_nome || "Geral",
      "Conta": t.conta_nome || "—",
      "Valor": parseFloat(t.valor || 0),
      "Status": t.status === "pago" ? "PAGO" : "PENDENTE",
      "Data Pagamento": t.data_pagamento ? new Date(t.data_pagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
    }));
    exportToCsv(csvRows, `Contas_a_Pagar_${abaAtiva}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="text-rose-600" size={24} /> Contas a Pagar & Tesouraria
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Controle de compras, fornecedores, impostos e liquidação bancária.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={14} className="text-emerald-600" />}
              onClick={handleExportExcel}
              title="Exportar dados para Excel (.XLSX)"
            >
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              title="Exportar dados para CSV"
            >
              CSV
            </Button>
            <Button
              variant="danger"
              icon={<Plus size={16} />}
              onClick={() => setModalNovo(true)}
            >
              Nova Conta a Pagar
            </Button>
          </div>
        </div>

        {/* Resumo de Indicadores da Tela (Cards Padronizados) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">A Pagar Total</span>
              <p className="text-xl font-black text-slate-900 mt-1">{formatBRL(totalPendente)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Compromissos pendentes</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Liquidado (Pago)</span>
              <p className="text-xl font-black text-emerald-600 mt-1">{formatBRL(totalPago)}</p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Debitado em conta</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Pagamentos Vencidos</span>
              <p className="text-xl font-black text-rose-600 mt-1">{formatBRL(totalVencido)}</p>
              <p className="text-[10px] text-rose-700 font-bold mt-0.5">Risco de juros e multas</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={20} />
            </div>
          </Card>
        </div>

        {/* Abas Rápidas de Filtragem */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto text-xs font-semibold">
            {[
              { key: "todas", label: "Todas as Despesas" },
              { key: "vencidas", label: "⚠️ Vencidas (Pagar)" },
              { key: "hoje", label: "⏰ Vencem Hoje" },
              { key: "semana", label: "📅 Próximos 7 Dias" },
              { key: "pagas", label: "✅ Pagas" },
            ].map((aba) => (
              <button
                key={aba.key}
                onClick={() => setAbaAtiva(aba.key)}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaAtiva === aba.key
                    ? "bg-rose-600 text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fornecedor, valor ou descrição..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
            />
          </div>
        </div>

        {/* Barra Flutuante de Ações em Lote */}
        {selecionados.length > 0 && (
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-rose-500 text-white font-black text-xs flex items-center justify-center">
                {selecionados.length}
              </span>
              <span className="text-xs font-semibold">despesa(s) selecionada(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle size={14} />}
                onClick={handleBaixaEmLote}
              >
                Liquidar Pagamento em Lote
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={handleExcluirSelecionados}
              >
                Apagar Selecionadas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
                onClick={() => setSelecionados([])}
              >
                Desmarcar
              </Button>
            </div>
          </div>
        )}

        {/* Tabela de Lançamentos em Card Padronizado */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleToggleSelectAll}
                      checked={
                        selecionados.length > 0 &&
                        selecionados.length ===
                          transacoes.filter((t) => t.status === "pendente").length
                      }
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3.5">Status & Régua</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5">Fornecedor</th>
                  <th className="px-4 py-3.5">Descrição</th>
                  <th className="px-4 py-3.5">Categoria DRE</th>
                  <th className="px-4 py-3.5">Conta Débito</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      Carregando despesas...
                    </td>
                  </tr>
                ) : transacoes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      Nenhuma conta a pagar encontrada.
                    </td>
                  </tr>
                ) : (
                  transacoes.map((t) => {
                    const isPago = t.status === "pago";
                    const isAtrasado = !isPago && t.dias_atraso > 0;
                    const isHoje = !isPago && t.dias_atraso === 0;

                    return (
                      <tr
                        key={t.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          selecionados.includes(t.id) ? "bg-rose-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          {!isPago && (
                            <input
                              type="checkbox"
                              checked={selecionados.includes(t.id)}
                              onChange={() => handleToggleSelect(t.id)}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {isPago ? (
                            <Badge variant="success" icon={<CheckCircle size={10} />}>
                              PAGO
                            </Badge>
                          ) : isAtrasado ? (
                            <Badge variant="danger" icon={<AlertTriangle size={10} />}>
                              VENCIDO ({t.dias_atraso}d)
                            </Badge>
                          ) : isHoje ? (
                            <Badge variant="warning" icon={<Clock size={10} />}>
                              VENCE HOJE
                            </Badge>
                          ) : (
                            <Badge variant="neutral" icon={<Clock size={10} />}>
                              NO PRAZO
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-"}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{t.contato_nome || "Fornecedor Direto"}</p>
                          {t.documento_numero && (
                            <p className="text-[10px] text-slate-400">Doc: {t.documento_numero}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{t.descricao}</span>
                            {t.total_parcelas > 1 && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({t.numero_parcela}/{t.total_parcelas})
                              </span>
                            )}
                            {t.comprovante_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  setModalComprovante({
                                    url: t.comprovante_url,
                                    id: t.id,
                                    descricao: t.descricao,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded text-[10px] font-bold transition"
                                title="Ver Comprovante Anexo"
                              >
                                <Paperclip size={10} />
                                <span>Anexo</span>
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          <div className="flex items-center">
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1.5"
                              style={{ backgroundColor: t.categoria_cor || "#f43f5e" }}
                            />
                            <span className="font-medium text-slate-800">{t.categoria_nome || "Geral"}</span>
                          </div>
                          {t.rateios?.length > 1 ? (
                            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold border border-emerald-200">
                              <PieChart size={9} />
                              <span>{t.rateios.length} Centros ({t.rateios.map((r) => `${parseFloat(r.percentual)}%`).join(" / ")})</span>
                            </div>
                          ) : t.centro_custo_nome ? (
                            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-semibold">
                              <span>{t.centro_custo_nome}</span>
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-slate-600">{t.conta_nome || "—"}</td>

                        <td className="px-4 py-3 text-right font-black text-slate-900 text-sm font-mono">
                          {formatBRL(t.valor)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isPago ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setModalBaixa(t);
                                  setFormBaixa({
                                    conta_bancaria_id: t.conta_bancaria_id || (contas[0]?.id || ""),
                                    data_pagamento: new Date().toISOString().split("T")[0],
                                    valor_pago: t.valor,
                                    forma_pagamento: t.forma_pagamento || "pix",
                                  });
                                }}
                              >
                                Pagar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px] font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() =>
                                  exportReciboPdf({
                                    transacao: t,
                                    empresaNome: user?.empresa_nome || "Nuvy Finance",
                                    empresaCnpj: user?.empresa_cnpj || "",
                                  })
                                }
                                title="Emitir Recibo de Quitação em PDF"
                              >
                                <FileText size={12} className="mr-1" />
                                Recibo
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                  title="Mais opções"
                                >
                                  <MoreHorizontal size={15} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleAbrirEditar(t)}>
                                  <Edit2 size={13} className="text-slate-500" />
                                  <span>Editar Detalhes</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() =>
                                    setModalComprovante({
                                      id: t.id,
                                      url: t.comprovante_url,
                                      descricao: t.descricao,
                                    })
                                  }
                                >
                                  <Paperclip size={13} className="text-slate-500" />
                                  <span>{t.comprovante_url ? "Ver Comprovante" : "Anexar Comprovante"}</span>
                                </DropdownMenuItem>

                                {isPago && (
                                  <DropdownMenuItem onClick={() => handleEstornar(t.id)}>
                                    <RotateCcw size={13} className="text-amber-500" />
                                    <span>Estornar Pagamento</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  variant="danger"
                                  onClick={() => handleExcluir(t.id)}
                                >
                                  <Trash2 size={13} />
                                  <span>Excluir Despesa</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

        {/* Modal 1: Nova Despesa */}
        <Modal
          isOpen={modalNovo}
          onClose={() => setModalNovo(false)}
          title="Nova Conta a Pagar"
          icon={<TrendingDown className="text-rose-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleCriar} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Descrição da Despesa</label>
              <input
                type="text"
                required
                placeholder="Ex: Aluguel Escritório, Servidor AWS, Folha..."
                value={formNovo.descricao}
                onChange={(e) => setFormNovo({ ...formNovo, descricao: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={formNovo.valor}
                  onChange={(e) => setFormNovo({ ...formNovo, valor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white font-bold text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={formNovo.data_vencimento}
                  onChange={(e) => setFormNovo({ ...formNovo, data_vencimento: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Categoria (Plano de Contas)</label>
                <select
                  value={formNovo.categoria_id}
                  onChange={(e) => setFormNovo({ ...formNovo, categoria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Selecione a categoria...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.dre_grupo?.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Fornecedor / Favorecido</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const nome = prompt("Nome completo ou Razão Social do novo fornecedor:");
                      if (nome && nome.trim()) {
                        const id = await handleCriarFornecedorRapido(nome);
                        if (id) setFormNovo((prev) => ({ ...prev, contato_id: id }));
                      }
                    }}
                    className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    + Cadastrar Novo
                  </button>
                </div>
                <select
                  value={formNovo.contato_id}
                  onChange={(e) => setFormNovo({ ...formNovo, contato_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Selecione o fornecedor (ou clique + Cadastrar)...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Conta Bancária / Débito</label>
                <select
                  value={formNovo.conta_bancaria_id}
                  onChange={(e) => setFormNovo({ ...formNovo, conta_bancaria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Selecione a conta...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Parcelamento / Recorrência</label>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={formNovo.total_parcelas}
                  onChange={(e) => setFormNovo({ ...formNovo, total_parcelas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold font-mono"
                />
              </div>
            </div>

            {/* Opções de Tipo de Parcelamento (Dividir vs Fixo) */}
            {parseInt(formNovo.total_parcelas, 10) > 1 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Como aplicar o valor de R$ {formNovo.valor || "0,00"}?
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <label
                    className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                      formNovo.tipo_parcelamento === "dividir"
                        ? "bg-rose-50 border-rose-300 text-rose-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo_parcelamento_pag"
                      value="dividir"
                      checked={formNovo.tipo_parcelamento === "dividir"}
                      onChange={() => setFormNovo({ ...formNovo, tipo_parcelamento: "dividir" })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">➗ Dividir Valor Total</span>
                      <span className="text-[9px] text-slate-500 font-normal">Compra parcelada no cartão</span>
                    </div>
                  </label>

                  <label
                    className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                      formNovo.tipo_parcelamento === "fixo"
                        ? "bg-rose-50 border-rose-300 text-rose-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo_parcelamento_pag"
                      value="fixo"
                      checked={formNovo.tipo_parcelamento === "fixo"}
                      onChange={() => setFormNovo({ ...formNovo, tipo_parcelamento: "fixo" })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">🔁 Valor Fixo p/ Mês</span>
                      <span className="text-[9px] text-slate-500 font-normal">Aluguel/Contrato fixo</span>
                    </div>
                  </label>
                </div>

                {/* Resumo da Simulação de Parcelas */}
                {parseFloat(formNovo.valor) > 0 && (
                  <div className="pt-1 text-[11px] text-rose-700 font-bold flex items-center gap-1.5">
                    <Sparkles size={13} className="text-rose-600 shrink-0" />
                    <span>
                      {formNovo.tipo_parcelamento === "dividir"
                        ? `Gerará ${formNovo.total_parcelas} parcelas de ${formatBRL(
                            parseFloat(formNovo.valor) / parseInt(formNovo.total_parcelas, 10)
                          )} (Total: ${formatBRL(parseFloat(formNovo.valor))})`
                        : `Gerará ${formNovo.total_parcelas} parcelas de ${formatBRL(
                            parseFloat(formNovo.valor)
                          )} por mês (Total no período: ${formatBRL(
                            parseFloat(formNovo.valor) * parseInt(formNovo.total_parcelas, 10)
                          )})`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nº Documento / Nota Fiscal</label>
                <input
                  type="text"
                  placeholder="Ex: NF-12345"
                  value={formNovo.documento_numero}
                  onChange={(e) => setFormNovo({ ...formNovo, documento_numero: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Forma de Pagamento</label>
                <select
                  value={formNovo.forma_pagamento}
                  onChange={(e) => setFormNovo({ ...formNovo, forma_pagamento: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="transferencia">Transferência / TED</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>

            <RateioCentrosCustoInput
              valorTotal={formNovo.valor}
              centrosCusto={centrosCusto}
              rateios={formNovo.rateios}
              onChange={(r) => setFormNovo((prev) => ({ ...prev, rateios: r }))}
            />

            <FileUploadDropzone
              value={formNovo.comprovante_url}
              onChange={(url) => setFormNovo({ ...formNovo, comprovante_url: url })}
            />

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalNovo(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger">
                Salvar Despesa
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 2: Baixar Pagamento */}
        <Modal
          isOpen={!!modalBaixa}
          onClose={() => setModalBaixa(null)}
          title="Liquidar Pagamento"
          size="sm"
        >
          {modalBaixa && (
            <form onSubmit={handleBaixar} className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <p className="font-bold text-slate-900">{modalBaixa.descricao}</p>
                <p className="text-rose-800 font-black text-sm mt-0.5 font-mono">
                  Valor: {formatBRL(modalBaixa.valor)}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Conta Bancária de Débito (Saída)</label>
                <select
                  required
                  value={formBaixa.conta_bancaria_id}
                  onChange={(e) => setFormBaixa({ ...formBaixa, conta_bancaria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione a conta para debitar...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor Pago (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formBaixa.valor_pago}
                    onChange={(e) => setFormBaixa({ ...formBaixa, valor_pago: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    value={formBaixa.data_pagamento}
                    onChange={(e) => setFormBaixa({ ...formBaixa, data_pagamento: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setModalBaixa(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary">
                  Confirmar Liquidação
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal 3: Editar Lançamento */}
        <Modal
          isOpen={!!modalEditar}
          onClose={() => setModalEditar(null)}
          title="Editar Despesa / Pagamento"
          icon={<Edit2 className="text-rose-600" size={18} />}
          size="md"
        >
          {modalEditar && (
            <form onSubmit={handleSalvarEditar} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={formEditar.descricao}
                  onChange={(e) => setFormEditar({ ...formEditar, descricao: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formEditar.valor}
                    onChange={(e) => setFormEditar({ ...formEditar, valor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold font-mono text-rose-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={formEditar.data_vencimento}
                    onChange={(e) =>
                      setFormEditar({ ...formEditar, data_vencimento: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Fornecedor / Favorecido</label>
                    <button
                      type="button"
                      onClick={async () => {
                        const nome = prompt("Nome completo ou Razão Social do novo fornecedor:");
                        if (nome && nome.trim()) {
                          const id = await handleCriarFornecedorRapido(nome);
                          if (id) setFormEditar((prev) => ({ ...prev, contato_id: id }));
                        }
                      }}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      + Cadastrar Novo
                    </button>
                  </div>
                  <select
                    value={formEditar.contato_id}
                    onChange={(e) => setFormEditar({ ...formEditar, contato_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Fornecedor Direto / Geral</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoria (DRE)</label>
                  <select
                    value={formEditar.categoria_id}
                    onChange={(e) =>
                      setFormEditar({ ...formEditar, categoria_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Selecione categoria...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Conta Bancária de Saída</label>
                  <select
                    value={formEditar.conta_bancaria_id}
                    onChange={(e) =>
                      setFormEditar({ ...formEditar, conta_bancaria_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Selecione a conta...</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Nota Fiscal / Doc</label>
                  <input
                    type="text"
                    placeholder="Opcional..."
                    value={formEditar.documento_numero}
                    onChange={(e) =>
                      setFormEditar({ ...formEditar, documento_numero: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <RateioCentrosCustoInput
                valorTotal={formEditar.valor}
                centrosCusto={centrosCusto}
                rateios={formEditar.rateios}
                onChange={(r) => setFormEditar((prev) => ({ ...prev, rateios: r }))}
              />

              <FileUploadDropzone
                value={formEditar.comprovante_url}
                onChange={(url) => setFormEditar({ ...formEditar, comprovante_url: url })}
                transacaoId={modalEditar?.id}
              />

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setModalEditar(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="danger">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal 4: Visualizar Comprovante / Anexo */}
        <ComprovanteModal
          isOpen={!!modalComprovante}
          onClose={() => setModalComprovante(null)}
          comprovanteUrl={modalComprovante?.url}
          transacaoId={modalComprovante?.id}
          transacaoDescricao={modalComprovante?.descricao}
          onComprovanteRemovido={() => carregarDados()}
        />

        {/* Modal de Confirmação Acessível (Radix UI / Shadcn) */}
        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
