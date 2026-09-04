import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import QRCode from "qrcode";
import { useAuth } from "../../contexts/AuthContext";
import { usePlanoContext } from "../../hooks/usePlanoContext";
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
import { exportToExcel, exportToCsv, exportReciboPdf } from "../../utils/exportHelper";
import {
  TrendingUp,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  QrCode,
  MessageCircle,
  Copy,
  Check,
  X,
  Trash2,
  RotateCcw,
  Send,
  Sparkles,
  Layers,
  ChevronRight,
  DollarSign,
  AlertTriangle,
  Edit2,
  Paperclip,
  Download,
  FileText,
  MoreHorizontal,
} from "lucide-react";

export default function ContasReceber() {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { isPersonal, termo } = usePlanoContext();
  const [transacoes, setTransacoes] = useState([]);
  const [contas, setContas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros e Abas Inteligentes
  const [abaAtiva, setAbaAtiva] = useState("todas"); // todas | vencidas | hoje | semana | recebidas
  const [search, setSearch] = useState("");

  // Seleção Múltipla para Ações em Lote
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
    forma_pagamento: "pix",
    documento_numero: "",
    observacoes: "",
    comprovante_url: "",
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

  // Modal Cobrança PIX / Gateway / WhatsApp
  const [modalPix, setModalPix] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [abaCobranca, setAbaCobranca] = useState("gateway"); // gateway | pix_rapido
  const [provedorGateway, setProvedorGateway] = useState("asaas");
  const [formaGateway, setFormaGateway] = useState("pix");
  const [loadingGateway, setLoadingGateway] = useState(false);
  const [resultadoGateway, setResultadoGateway] = useState(null);

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
    forma_pagamento: "pix",
    documento_numero: "",
    observacoes: "",
    comprovante_url: "",
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const url =
        abaAtiva === "todas"
          ? `/transacoes?tipo=receita&search=${search}`
          : `/transacoes?tipo=receita&aba=${abaAtiva}&search=${search}`;

      const [tRes, cRes, catRes, cliRes] = await Promise.all([
        api.get(url),
        api.get("/contas-bancarias"),
        api.get("/categorias?tipo=receita"),
        api.get("/contatos"),
      ]);

      setTransacoes(Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data || []));
      setContas(Array.isArray(cRes.data) ? cRes.data : (cRes.data?.contas || []));
      setCategorias(Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []));
      setClientes(Array.isArray(cliRes.data) ? cliRes.data : (cliRes.data?.data || cliRes.data?.contatos || []));
    } catch (err) {
      console.error("Erro ao carregar contas a receber:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [abaAtiva, search]);

  const handleCriarClienteRapido = async (nome) => {
    try {
      const res = await api.post("/contatos", {
        nome: nome.trim(),
        tipo: "cliente",
      });
      const novoCliente = res.data;
      setClientes((prev) => [...prev, novoCliente]);
      toast.success("Cliente rápido cadastrado com sucesso!");
      return novoCliente.id;
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao cadastrar cliente rápido.");
      return null;
    }
  };

  const handleCriar = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transacoes", {
        ...formNovo,
        tipo: "receita",
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
      toast.success("Receita criada com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar conta a receber");
    }
  };

  const handleBaixar = async (e) => {
    e.preventDefault();
    if (!modalBaixa) return;
    try {
      await api.post(`/transacoes/${modalBaixa.id}/baixar`, formBaixa);
      setModalBaixa(null);
      carregarDados();
      toast.success("Recebimento liquidado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao liquidar lançamento");
    }
  };

  const handleBaixaEmLote = async () => {
    if (selecionados.length === 0) return;
    const ok = await confirm({
      title: "Liquidar receitas em lote?",
      description: `Deseja confirmar o recebimento em lote de ${selecionados.length} fatura(s) selecionada(s)?`,
      confirmText: "Sim, confirmar recebimento",
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
      toast.success(`${selecionados.length} fatura(s) baixada(s) com sucesso!`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao processar baixa em lote");
    }
  };

  const handleExcluirSelecionados = async () => {
    if (selecionados.length === 0) return;
    const ok = await confirm({
      title: "Excluir faturas selecionadas?",
      description: `Deseja realmente excluir as ${selecionados.length} faturas selecionadas? Esta ação não poderá ser desfeita.`,
      confirmText: "Sim, excluir todas",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.post("/transacoes/deletar-lote", { ids: selecionados });
      setSelecionados([]);
      carregarDados();
      toast.success("Faturas selecionadas excluídas com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir itens em lote");
    }
  };

  const handleAbrirCobrancaPix = async (t) => {
    try {
      setResultadoGateway(null);
      const res = await api.get(`/transacoes/${t.id}/cobranca-pix`);
      setModalPix(res.data);
      if (res.data.payload_pix) {
        const qrUrl = await QRCode.toDataURL(res.data.payload_pix, { width: 220, margin: 1 });
        setQrCodeDataUrl(qrUrl);
      }
    } catch (err) {
      toast.error("Erro ao gerar dados de cobrança Pix.");
    }
  };

  const handleGerarGateway = async () => {
    if (!modalPix?.transacao?.id) return;
    try {
      setLoadingGateway(true);
      const res = await api.post("/gateways/gerar-cobranca", {
        transacao_id: modalPix.transacao.id,
        provedor: provedorGateway,
        forma: formaGateway,
      });
      setResultadoGateway(res.data);
      if (res.data?.pix?.payload) {
        const qrUrl = await QRCode.toDataURL(res.data.pix.payload, { width: 220, margin: 1 });
        setQrCodeDataUrl(qrUrl);
      }
      toast.success("Cobrança gerada no gateway com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao emitir cobrança no gateway.");
    } finally {
      setLoadingGateway(false);
    }
  };

  const handleCopiarChave = (texto) => {
    const chave = texto || resultadoGateway?.pix?.payload || modalPix?.payload_pix;
    if (chave) {
      navigator.clipboard.writeText(chave);
      setCopiadoPix(true);
      toast.info("Código Pix copiado para a área de transferência!");
      setTimeout(() => setCopiadoPix(false), 2500);
    }
  };

  const handleEstornar = async (id) => {
    const ok = await confirm({
      title: "Estornar recebimento?",
      description: "Deseja realmente estornar este recebimento e reabrir a conta como pendente?",
      confirmText: "Sim, estornar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.post(`/transacoes/${id}/estornar`);
      carregarDados();
      toast.success("Recebimento estornado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao estornar");
    }
  };

  const handleExcluir = async (id) => {
    const ok = await confirm({
      title: "Excluir receita?",
      description: "Tem certeza que deseja excluir esta receita permanentemente?",
      confirmText: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.delete(`/transacoes/${id}`);
      carregarDados();
      toast.success("Receita excluída com sucesso!");
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
      forma_pagamento: t.forma_pagamento || "pix",
      documento_numero: t.documento_numero || "",
      observacoes: t.observacoes || "",
      comprovante_url: t.comprovante_url || "",
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

  // Cálculos de Resumo
  const totalPendente = transacoes
    .filter((t) => t.status === "pendente")
    .reduce((acc, t) => acc + parseFloat(t.valor), 0);

  const totalRecebido = transacoes
    .filter((t) => t.status === "pago")
    .reduce((acc, t) => acc + parseFloat(t.valor_pago || t.valor), 0);

  const totalVencido = transacoes
    .filter((t) => t.status === "pendente" && t.dias_atraso > 0)
    .reduce((acc, t) => acc + parseFloat(t.valor), 0);

  const taxaInadimplencia =
    totalPendente + totalRecebido > 0
      ? ((totalVencido / (totalPendente + totalRecebido)) * 100).toFixed(1)
      : "0.0";

  const handleExportExcel = () => {
    if (!transacoes || transacoes.length === 0) return;
    const excelRows = transacoes.map((t) => ({
      "ID": t.id,
      "Vencimento": t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Competência": t.data_competencia ? new Date(t.data_competencia).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Cliente / Pagador": t.contato_nome || "Cliente Direto",
      "Descrição": t.descricao,
      "Categoria": t.categoria_nome || "Geral",
      "Conta Bancária Prevista": t.conta_nome || "—",
      "Valor Original (R$)": parseFloat(t.valor || 0),
      "Valor Recebido (R$)": parseFloat(t.valor_pago || 0),
      "Status": t.status === "pago" ? "RECEBIDO" : (t.dias_atraso > 0 ? `ATRASADO (${t.dias_atraso}d)` : "PENDENTE"),
      "Data Recebimento": t.data_pagamento ? new Date(t.data_pagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Forma Pagamento": (t.forma_pagamento || "").toUpperCase(),
      "Nº Documento": t.documento_numero || "",
      "Observações": t.observacoes || "",
      "Possui Anexo": t.comprovante_url ? "SIM" : "NÃO",
    }));
    exportToExcel(excelRows, `Contas_a_Receber_${abaAtiva}`, "Contas a Receber");
  };

  const handleExportCsv = () => {
    if (!transacoes || transacoes.length === 0) return;
    const csvRows = transacoes.map((t) => ({
      "ID": t.id,
      "Vencimento": t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
      "Cliente": t.contato_nome || "Cliente Direto",
      "Descrição": t.descricao,
      "Categoria": t.categoria_nome || "Geral",
      "Conta": t.conta_nome || "—",
      "Valor": parseFloat(t.valor || 0),
      "Status": t.status === "pago" ? "RECEBIDO" : "PENDENTE",
      "Recebimento": t.data_pagamento ? new Date(t.data_pagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
    }));
    exportToCsv(csvRows, `Contas_a_Receber_${abaAtiva}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-emerald-600" size={24} /> {isPersonal ? "Minhas Entradas & Recebimentos" : "Contas a Receber & Cobranças"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isPersonal
                ? "Controle de salários, rendimentos extras, vendas avulsas e transferências recebidas."
                : "Controle de recebíveis, régua de cobrança automática por WhatsApp e PIX Dinâmico."}
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
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setModalNovo(true)}
            >
              {isPersonal ? "Nova Entrada" : "Nova Conta a Receber"}
            </Button>
          </div>
        </div>

        {/* Resumo de Indicadores da Tela (Cards Padronizados) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">A Receber Total</span>
              <p className="text-xl font-black text-slate-900 mt-1">{formatBRL(totalPendente)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Previsão em aberto</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Recebido Liquidado</span>
              <p className="text-xl font-black text-emerald-600 mt-1">{formatBRL(totalRecebido)}</p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Dinheiro em conta</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">{isPersonal ? "Pendentes em Atraso" : "Inadimplência em Atraso"}</span>
              <p className="text-xl font-black text-rose-600 mt-1">{formatBRL(totalVencido)}</p>
              <p className="text-[10px] text-rose-700 font-bold mt-0.5">{isPersonal ? `${taxaInadimplencia}% do previsto` : `${taxaInadimplencia}% da carteira`}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={20} />
            </div>
          </Card>
        </div>

        {/* Abas Inteligentes de Filtragem */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto text-xs font-semibold">
            {[
              { key: "todas", label: isPersonal ? "Todas as Entradas" : "Todas as Faturas" },
              { key: "vencidas", label: isPersonal ? "⚠️ Em Atraso" : "⚠️ Em Atraso (Cobrar)" },
              { key: "hoje", label: "⏰ Vencem Hoje" },
              { key: "semana", label: "📅 Próximos 7 Dias" },
              { key: "recebidas", label: "✅ Recebidas" },
            ].map((aba) => (
              <button
                key={aba.key}
                onClick={() => setAbaAtiva(aba.key)}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  abaAtiva === aba.key
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
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
              placeholder={isPersonal ? "Buscar pagador, valor ou descrição..." : "Buscar cliente, valor ou descrição..."}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
          </div>
        </div>

        {/* Barra Flutuante de Ações em Lote (Quando itens são selecionados) */}
        {selecionados.length > 0 && (
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-900 font-black text-xs flex items-center justify-center">
                {selecionados.length}
              </span>
              <span className="text-xs font-semibold">fatura(s) selecionada(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle size={14} />}
                onClick={handleBaixaEmLote}
              >
                Liquidar Selecionadas
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
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3.5">Status & Régua</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5">Cliente / Pagador</th>
                  <th className="px-4 py-3.5">Descrição</th>
                  <th className="px-4 py-3.5">Conta Entrada</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-4 py-3.5 text-center">Cobrar & Liquidar</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      Carregando recebimentos...
                    </td>
                  </tr>
                ) : transacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      Nenhuma conta a receber encontrada.
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
                          selecionados.includes(t.id) ? "bg-emerald-50/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          {!isPago && (
                            <input
                              type="checkbox"
                              checked={selecionados.includes(t.id)}
                              onChange={() => handleToggleSelect(t.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {isPago ? (
                            <Badge variant="success" icon={<CheckCircle size={10} />}>
                              RECEBIDO
                            </Badge>
                          ) : isAtrasado ? (
                            <Badge variant="danger" icon={<AlertTriangle size={10} />}>
                              ATRASADO ({t.dias_atraso}d)
                            </Badge>
                          ) : isHoje ? (
                            <Badge variant="warning" icon={<Clock size={10} />}>
                              VENCE HOJE
                            </Badge>
                          ) : (
                            <Badge variant="info" icon={<Clock size={10} />}>
                              A VENCER
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-"}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{t.contato_nome || "Cliente Direto"}</p>
                          {t.contato_telefone && (
                            <p className="text-[11px] text-slate-400">{t.contato_telefone}</p>
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

                        <td className="px-4 py-3 text-slate-600">{t.conta_nome || "—"}</td>

                        <td className="px-4 py-3 text-right font-black text-emerald-600 text-sm font-mono">
                          {formatBRL(t.valor)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isPago ? (
                              <>
                                <Button
                                  variant="dark"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  icon={<QrCode size={12} className="text-emerald-400" />}
                                  onClick={() => handleAbrirCobrancaPix(t)}
                                  title="Cobrar via PIX / WhatsApp"
                                >
                                  Cobrar
                                </Button>

                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px]"
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
                                  Receber
                                </Button>
                              </>
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
                                    <span>Estornar Recebimento</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  variant="danger"
                                  onClick={() => handleExcluir(t.id)}
                                >
                                  <Trash2 size={13} />
                                  <span>Excluir Receita</span>
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

        {/* Modal 1: Cobrança PIX & Gateway */}
        <Modal
          isOpen={!!modalPix}
          onClose={() => setModalPix(null)}
          title="Emissão de Cobrança (PIX / Boleto / Gateway)"
          icon={<QrCode className="text-emerald-600" size={18} />}
          size="md"
        >
          {modalPix && (
            <div className="space-y-4 text-xs">
              {/* Header com Valor */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    Cliente: <strong>{modalPix.transacao?.contato_nome || "Consumidor Geral"}</strong>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{modalPix.transacao?.descricao}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Valor</span>
                  <h4 className="text-xl font-black text-emerald-800 font-mono">
                    {formatBRL(modalPix.transacao?.valor)}
                  </h4>
                </div>
              </div>

              {/* Alternador de Modo de Cobrança */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl font-semibold text-xs">
                <button
                  type="button"
                  onClick={() => setAbaCobranca("gateway")}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    abaCobranca === "gateway"
                      ? "bg-white text-slate-900 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ⚡ Gateway Próprio (Asaas / MP)
                </button>
                <button
                  type="button"
                  onClick={() => setAbaCobranca("pix_rapido")}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    abaCobranca === "pix_rapido"
                      ? "bg-white text-slate-900 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📱 PIX Chave Direta
                </button>
              </div>

              {abaCobranca === "gateway" ? (
                /* Modo Gateway Oficial */
                <div className="space-y-3">
                  {!resultadoGateway ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Provedor de Cobrança
                          </label>
                          <select
                            value={provedorGateway}
                            onChange={(e) => setProvedorGateway(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="asaas">Asaas Pagamentos</option>
                            <option value="mercadopago">Mercado Pago</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Método de Emissão
                          </label>
                          <select
                            value={formaGateway}
                            onChange={(e) => setFormaGateway(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="pix">PIX Dinâmico com Baixa Automática</option>
                            <option value="boleto">Boleto Bancário Registrado</option>
                          </select>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        disabled={loadingGateway}
                        onClick={handleGerarGateway}
                        className="w-full justify-center"
                      >
                        {loadingGateway ? "Emitindo no Gateway..." : `Gerar Cobrança Oficial no ${provedorGateway.toUpperCase()}`}
                      </Button>
                    </div>
                  ) : (
                    /* Resultado do Gateway */
                    <div className="space-y-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 text-xs flex items-center gap-1">
                          <CheckCircle size={14} className="text-emerald-600" /> Cobrança emitida no {resultadoGateway.provedor?.toUpperCase()}!
                        </span>
                        <Badge variant="neutral">Status: {resultadoGateway.status || "PENDING"}</Badge>
                      </div>

                      {/* QR Code se houver */}
                      {qrCodeDataUrl && (
                        <div className="flex justify-center my-2">
                          <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs">
                            <img src={qrCodeDataUrl} alt="QR Code PIX Gateway" className="w-36 h-36" />
                          </div>
                        </div>
                      )}

                      {/* PIX Copia e Cola */}
                      {resultadoGateway.pix?.payload && (
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">PIX Copia e Cola Oficial:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={resultadoGateway.pix.payload}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Copy size={13} />}
                              onClick={() => handleCopiarChave(resultadoGateway.pix.payload)}
                            >
                              Copiar
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Links do Boleto e Fatura */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {resultadoGateway.bank_slip_url && (
                          <a
                            href={resultadoGateway.bank_slip_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <FileText size={14} /> Abrir Boleto Bancário PDF
                          </a>
                        )}
                        {resultadoGateway.invoice_url && (
                          <a
                            href={resultadoGateway.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <ExternalLink size={14} /> Ver Fatura Online
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Modo PIX Chave Estática */
                <div className="space-y-4 text-center">
                  {qrCodeDataUrl && (
                    <div className="flex justify-center my-2">
                      <div className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm">
                        <img src={qrCodeDataUrl} alt="QR Code PIX" className="w-40 h-40" />
                      </div>
                    </div>
                  )}

                  <div className="text-left">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Código PIX Copia e Cola
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={modalPix.payload_pix}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
                      />
                      <Button
                        variant={copiadoPix ? "primary" : "secondary"}
                        size="sm"
                        icon={copiadoPix ? <Check size={14} /> : <Copy size={14} />}
                        onClick={() => handleCopiarChave(modalPix.payload_pix)}
                        className="shrink-0"
                      >
                        {copiadoPix ? "Copiado!" : "Copiar"}
                      </Button>
                    </div>
                  </div>

                  {modalPix.link_whatsapp && (
                    <a
                      href={modalPix.link_whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle size={15} /> Enviar Cobrança no WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Modal 2: Nova Receita */}
        <Modal
          isOpen={modalNovo}
          onClose={() => setModalNovo(false)}
          title="Nova Conta a Receber"
          icon={<TrendingUp className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleCriar} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Descrição do Recebimento</label>
              <input
                type="text"
                required
                placeholder="Ex: Mensalidade Contrato, Venda de Serviços..."
                value={formNovo.descricao}
                onChange={(e) => setFormNovo({ ...formNovo, descricao: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-bold text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={formNovo.data_vencimento}
                  onChange={(e) => setFormNovo({ ...formNovo, data_vencimento: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Categoria (Plano de Contas)</label>
                <select
                  value={formNovo.categoria_id}
                  onChange={(e) => setFormNovo({ ...formNovo, categoria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione a categoria...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Cliente / Pagador</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const nome = prompt("Nome completo ou Razão Social do novo cliente:");
                      if (nome && nome.trim()) {
                        const id = await handleCriarClienteRapido(nome);
                        if (id) setFormNovo((prev) => ({ ...prev, contato_id: id }));
                      }
                    }}
                    className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                  >
                    + Cadastrar Novo
                  </button>
                </div>
                <select
                  value={formNovo.contato_id}
                  onChange={(e) => setFormNovo({ ...formNovo, contato_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione o cliente (ou clique + Cadastrar)...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Conta Bancária de Destino</label>
                <select
                  value={formNovo.conta_bancaria_id}
                  onChange={(e) => setFormNovo({ ...formNovo, conta_bancaria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione a conta...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
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
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo_parcelamento_rec"
                      value="dividir"
                      checked={formNovo.tipo_parcelamento === "dividir"}
                      onChange={() => setFormNovo({ ...formNovo, tipo_parcelamento: "dividir" })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">➗ Dividir Valor Total</span>
                      <span className="text-[9px] text-slate-500 font-normal">Compra/Venda a prazo</span>
                    </div>
                  </label>

                  <label
                    className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                      formNovo.tipo_parcelamento === "fixo"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo_parcelamento_rec"
                      value="fixo"
                      checked={formNovo.tipo_parcelamento === "fixo"}
                      onChange={() => setFormNovo({ ...formNovo, tipo_parcelamento: "fixo" })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold block text-[11px]">🔁 Valor Fixo p/ Mês</span>
                      <span className="text-[9px] text-slate-500 font-normal">Mensalidade/Benefício</span>
                    </div>
                  </label>
                </div>

                {/* Resumo da Simulação de Parcelas */}
                {parseFloat(formNovo.valor) > 0 && (
                  <div className="pt-1 text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                    <Sparkles size={13} className="text-emerald-600 shrink-0" />
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

            <FileUploadDropzone
              value={formNovo.comprovante_url}
              onChange={(url) => setFormNovo({ ...formNovo, comprovante_url: url })}
            />

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalNovo(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Receita
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 3: Receber Pagamento */}
        <Modal
          isOpen={!!modalBaixa}
          onClose={() => setModalBaixa(null)}
          title="Confirmar Recebimento"
          size="sm"
        >
          {modalBaixa && (
            <form onSubmit={handleBaixar} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="font-bold text-slate-900">{modalBaixa.descricao}</p>
                <p className="text-emerald-800 font-black text-sm mt-0.5 font-mono">
                  Valor: {formatBRL(modalBaixa.valor)}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Conta Bancária / Caixa de Entrada</label>
                <select
                  required
                  value={formBaixa.conta_bancaria_id}
                  onChange={(e) => setFormBaixa({ ...formBaixa, conta_bancaria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione onde o valor entrou...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor Recebido (R$)</label>
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
                  <label className="block font-bold text-slate-700 mb-1">Data do Recebimento</label>
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
                  Liquidar e Dar Entrada
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal 4: Editar Lançamento */}
        <Modal
          isOpen={!!modalEditar}
          onClose={() => setModalEditar(null)}
          title="Editar Recebimento"
          icon={<Edit2 className="text-emerald-600" size={18} />}
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono text-emerald-600"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Cliente / Pagador</label>
                    <button
                      type="button"
                      onClick={async () => {
                        const nome = prompt("Nome completo ou Razão Social do novo cliente:");
                        if (nome && nome.trim()) {
                          const id = await handleCriarClienteRapido(nome);
                          if (id) setFormEditar((prev) => ({ ...prev, contato_id: id }));
                        }
                      }}
                      className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                    >
                      + Cadastrar Novo
                    </button>
                  </div>
                  <select
                    value={formEditar.contato_id}
                    onChange={(e) => setFormEditar({ ...formEditar, contato_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Cliente Avulso / Direto</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">Conta Bancária Prevista</label>
                <select
                  value={formEditar.conta_bancaria_id}
                  onChange={(e) =>
                    setFormEditar({ ...formEditar, conta_bancaria_id: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione a conta...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                    </option>
                  ))}
                </select>
              </div>

              <FileUploadDropzone
                value={formEditar.comprovante_url}
                onChange={(url) => setFormEditar({ ...formEditar, comprovante_url: url })}
                transacaoId={modalEditar?.id}
              />

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setModalEditar(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal: Visualizar Comprovante / Anexo */}
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
