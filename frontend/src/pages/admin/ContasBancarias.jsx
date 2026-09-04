import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  ArrowLeftRight,
  Wallet,
  Landmark,
  CreditCard,
  History,
  FileText,
  SlidersHorizontal,
  X,
  Trash2,
  Edit2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from "lucide-react";

export default function ContasBancarias() {
  const [contas, setContas] = useState([]);
  const [saldoConsolidado, setSaldoConsolidado] = useState(0);
  const [transferencias, setTransferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("contas"); // contas | transferencias
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Modal Nova Conta
  const [modalConta, setModalConta] = useState(false);
  const [editandoConta, setEditandoConta] = useState(null);
  const [formConta, setFormConta] = useState({
    nome: "",
    banco: "Inter",
    tipo: "corrente",
    agencia: "",
    conta: "",
    saldo_inicial: "0.00",
    cor: "#059669",
  });

  // Modal Transferência
  const [modalTransf, setModalTransf] = useState(false);
  const [formTransf, setFormTransf] = useState({
    conta_origem_id: "",
    conta_destino_id: "",
    valor: "",
    data_transferencia: new Date().toISOString().split("T")[0],
    observacoes: "",
  });

  // Modal Extrato Bancário
  const [modalExtrato, setModalExtrato] = useState(null);
  const [movimentacoesExtrato, setMovimentacoesExtrato] = useState([]);
  const [loadingExtrato, setLoadingExtrato] = useState(false);

  // Modal Ajuste de Saldo
  const [modalAjuste, setModalAjuste] = useState(null);
  const [formAjuste, setFormAjuste] = useState({
    novo_saldo: "",
    motivo: "Conferência de Saldo Real",
  });

  const carregarContas = async () => {
    try {
      setLoading(true);
      const [cRes, tRes] = await Promise.all([
        api.get("/contas-bancarias"),
        api.get("/contas-bancarias/transferencias"),
      ]);
      setContas(Array.isArray(cRes.data?.contas) ? cRes.data.contas : []);
      setSaldoConsolidado(cRes.data?.saldo_consolidado || 0);
      setTransferencias(Array.isArray(tRes.data) ? tRes.data : []);
    } catch (err) {
      console.error("Erro ao carregar contas bancárias:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarContas();
  }, []);

  const handleSalvarConta = async (e) => {
    e.preventDefault();
    try {
      if (editandoConta) {
        await api.put(`/contas-bancarias/${editandoConta.id}`, formConta);
      } else {
        await api.post("/contas-bancarias", formConta);
      }
      toast.success(editandoConta ? "Conta bancária atualizada com sucesso!" : "Conta bancária cadastrada com sucesso!");
      setModalConta(false);
      setEditandoConta(null);
      setFormConta({
        nome: "",
        banco: "Inter",
        tipo: "corrente",
        agencia: "",
        conta: "",
        saldo_inicial: "0.00",
        cor: "#059669",
      });
      carregarContas();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar conta bancária");
    }
  };

  const handleTransferir = async (e) => {
    e.preventDefault();
    try {
      await api.post("/contas-bancarias/transferir", formTransf);
      toast.success("Transferência entre contas realizada com sucesso!");
      setModalTransf(false);
      setFormTransf({
        conta_origem_id: "",
        conta_destino_id: "",
        valor: "",
        data_transferencia: new Date().toISOString().split("T")[0],
        observacoes: "",
      });
      carregarContas();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao realizar transferência");
    }
  };

  const handleAbrirExtrato = async (conta) => {
    try {
      setModalExtrato(conta);
      setLoadingExtrato(true);
      const res = await api.get(`/contas-bancarias/${conta.id}/extrato`);
      setMovimentacoesExtrato(Array.isArray(res.data) ? res.data : (res.data?.movimentacoes || []));
    } catch (err) {
      toast.error("Erro ao carregar extrato da conta.");
    } finally {
      setLoadingExtrato(false);
    }
  };

  const handleAjustarSaldo = async (e) => {
    e.preventDefault();
    if (!modalAjuste) return;
    try {
      await api.post(`/contas-bancarias/${modalAjuste.id}/ajustar-saldo`, formAjuste);
      toast.success("Saldo ajustado com sucesso!");
      setModalAjuste(null);
      carregarContas();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao ajustar saldo da conta.");
    }
  };

  const handleDeletar = async (id) => {
    const ok = await confirm({
      title: "Desativar Conta Bancária",
      description: "Deseja realmente desativar esta conta bancária? As movimentações continuarão salvas no histórico.",
      variant: "danger",
      confirmText: "Desativar",
    });
    if (!ok) return;

    try {
      await api.delete(`/contas-bancarias/${id}`);
      toast.success("Conta bancária desativada com sucesso.");
      carregarContas();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir conta bancária");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="text-emerald-600" size={24} /> Contas Bancárias & Caixas
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gestão de saldos consolidados, contas correntes, carteiras digitais e transferências.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              icon={<ArrowLeftRight size={16} />}
              onClick={() => setModalTransf(true)}
            >
              Transferência
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setEditandoConta(null);
                setFormConta({
                  nome: "",
                  banco: "Inter",
                  tipo: "corrente",
                  agencia: "",
                  conta: "",
                  saldo_inicial: "0.00",
                  cor: "#059669",
                });
                setModalConta(true);
              }}
            >
              Nova Conta
            </Button>
          </div>
        </div>

        {/* Card de Saldo Consolidado Geral */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl text-white shadow-md border border-emerald-900/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Patrimônio Líquido Disponível
            </span>
            <h2 className="text-3xl font-black text-white mt-1 tracking-tight font-mono">
              {loading ? "..." : formatBRL(saldoConsolidado)}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Soma de todos os saldos em {contas.length} conta(s) ativas e caixas da empresa.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
            <Wallet className="text-emerald-400" size={24} />
            <div className="text-xs">
              <p className="font-bold text-white">Liquidez Total</p>
              <p className="text-slate-300 text-[11px]">Disponível para operações imediatas</p>
            </div>
          </div>
        </div>

        {/* Alternador de Abas */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs w-fit text-xs font-semibold">
          <button
            onClick={() => setAbaAtiva("contas")}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              abaAtiva === "contas"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Cartões & Contas ({contas.length})
          </button>
          <button
            onClick={() => setAbaAtiva("transferencias")}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              abaAtiva === "transferencias"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Histórico de Transferências ({transferencias.length})
          </button>
        </div>

        {/* Conteúdo Aba: Cartões de Contas */}
        {abaAtiva === "contas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {contas.map((c) => (
              <Card
                key={c.id}
                padding="none"
                hover
                className="overflow-hidden flex flex-col justify-between"
              >
                {/* Faixa Superior do Cartão */}
                <div
                  className="p-5 text-white flex flex-col justify-between relative overflow-hidden"
                  style={{
                    backgroundColor: c.cor || "#059669",
                  }}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <Landmark size={18} className="opacity-90" />
                      <span className="font-bold text-xs uppercase tracking-wider">{c.banco}</span>
                    </div>
                    <Badge variant="neutral" className="bg-white/20 text-white border-white/30 backdrop-blur-xs">
                      {c.tipo}
                    </Badge>
                  </div>

                  <div className="mt-4 relative z-10">
                    <h3 className="font-black text-lg text-white truncate">{c.nome}</h3>
                    <p className="text-[11px] opacity-85 mt-0.5 font-mono">
                      {c.agencia ? `Ag: ${c.agencia} • ` : ""}
                      {c.conta ? `CC: ${c.conta}` : "Caixa Operacional"}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between relative z-10">
                    <span className="text-[11px] opacity-90 font-medium">Saldo Atual</span>
                    <span className="text-xl font-black font-mono">{formatBRL(c.saldo_atual)}</span>
                  </div>
                </div>

                {/* Corpo Inferior do Cartão com Ações */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{c.percentual_patrimonio}% do total</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Extrato */}
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<FileText size={12} />}
                      onClick={() => handleAbrirExtrato(c)}
                    >
                      Extrato
                    </Button>

                    {/* Ajuste de Saldo */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="p-1.5 h-auto"
                      onClick={() => {
                        setModalAjuste(c);
                        setFormAjuste({ novo_saldo: c.saldo_atual, motivo: "Conferência de Saldo Real" });
                      }}
                      title="Ajustar saldo real / reconciliar"
                    >
                      <Scale size={13} />
                    </Button>

                    {/* Editar */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="p-1.5 h-auto"
                      onClick={() => {
                        setEditandoConta(c);
                        setFormConta({
                          nome: c.nome,
                          banco: c.banco,
                          tipo: c.tipo,
                          agencia: c.agencia || "",
                          conta: c.conta || "",
                          saldo_inicial: c.saldo_inicial,
                          cor: c.cor || "#059669",
                        });
                        setModalConta(true);
                      }}
                      title="Editar Conta"
                    >
                      <Edit2 size={13} />
                    </Button>

                    {/* Excluir */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="p-1.5 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDeletar(c.id)}
                      title="Excluir Conta"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Conteúdo Aba: Histórico de Transferências */}
        {abaAtiva === "transferencias" && (
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              Movimentações e Transferências entre Contas
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Conta Origem (Saída)</th>
                    <th className="px-4 py-3">Conta Destino (Entrada)</th>
                    <th className="px-4 py-3">Observações</th>
                    <th className="px-4 py-3 text-right">Valor Transferido</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium">
                  {transferencias.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        Nenhuma transferência registrada.
                      </td>
                    </tr>
                  ) : (
                    transferencias.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {new Date(t.data_transferencia).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1.5"
                            style={{ backgroundColor: t.conta_origem_cor || "#ef4444" }}
                          />
                          <span className="font-bold text-slate-800">{t.conta_origem_nome}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1.5"
                            style={{ backgroundColor: t.conta_destino_cor || "#10b981" }}
                          />
                          <span className="font-bold text-slate-800">{t.conta_destino_nome}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{t.observacoes || "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 text-sm font-mono">
                          {formatBRL(t.valor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Modal 1: Nova / Editar Conta */}
        <Modal
          isOpen={modalConta}
          onClose={() => setModalConta(false)}
          title={editandoConta ? "Editar Conta Bancária" : "Nova Conta Bancária / Caixa"}
          icon={<Landmark className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarConta} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nome de Identificação</label>
              <input
                type="text"
                required
                placeholder="Ex: Inter Principal, Itaú Folha, Caixa Físico Gaveta..."
                value={formConta.nome}
                onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Instituição / Banco</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Inter, Nubank, Itaú, BB..."
                  value={formConta.banco}
                  onChange={(e) => setFormConta({ ...formConta, banco: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Conta</label>
                <select
                  value={formConta.tipo}
                  onChange={(e) => setFormConta({ ...formConta, tipo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="corrente">Conta Corrente</option>
                  <option value="investimento">Investimento</option>
                  <option value="poupanca">Poupança</option>
                  <option value="caixa_fisico">Caixa Físico / Gaveta</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Agência</label>
                <input
                  type="text"
                  placeholder="0001"
                  value={formConta.agencia}
                  onChange={(e) => setFormConta({ ...formConta, agencia: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Número da Conta</label>
                <input
                  type="text"
                  placeholder="12345-6"
                  value={formConta.conta}
                  onChange={(e) => setFormConta({ ...formConta, conta: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Saldo Inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!!editandoConta}
                  placeholder="0,00"
                  value={formConta.saldo_inicial}
                  onChange={(e) => setFormConta({ ...formConta, saldo_inicial: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cor do Cartão</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formConta.cor}
                    onChange={(e) => setFormConta({ ...formConta, cor: e.target.value })}
                    className="w-10 h-8 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">{formConta.cor}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalConta(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Conta
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 2: Transferência Rápida */}
        <Modal
          isOpen={modalTransf}
          onClose={() => setModalTransf(false)}
          title="Transferência entre Contas"
          icon={<ArrowLeftRight className="text-emerald-600" size={18} />}
          size="sm"
        >
          <form onSubmit={handleTransferir} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Conta Origem (Saída)</label>
              <select
                required
                value={formTransf.conta_origem_id}
                onChange={(e) => setFormTransf({ ...formTransf, conta_origem_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione a conta de saída...</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Conta Destino (Entrada)</label>
              <select
                required
                value={formTransf.conta_destino_id}
                onChange={(e) => setFormTransf({ ...formTransf, conta_destino_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione a conta de destino...</option>
                {contas
                  .filter((c) => c.id != formTransf.conta_origem_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (Saldo: {formatBRL(c.saldo_atual)})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={formTransf.valor}
                  onChange={(e) => setFormTransf({ ...formTransf, valor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data</label>
                <input
                  type="date"
                  required
                  value={formTransf.data_transferencia}
                  onChange={(e) => setFormTransf({ ...formTransf, data_transferencia: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Observações</label>
              <input
                type="text"
                placeholder="Ex: Aporte de capital, sangria..."
                value={formTransf.observacoes}
                onChange={(e) => setFormTransf({ ...formTransf, observacoes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalTransf(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Transferir Agora
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 3: Extrato Bancário */}
        <Modal
          isOpen={!!modalExtrato}
          onClose={() => setModalExtrato(null)}
          title={modalExtrato?.nome}
          subtitle={`Saldo Atual: ${formatBRL(modalExtrato?.saldo_atual)}`}
          icon={<Landmark className="text-emerald-600" size={18} />}
          size="lg"
        >
          {modalExtrato && (
            <div className="space-y-4">
              <div className="overflow-y-auto max-h-[50vh]">
                {loadingExtrato ? (
                  <div className="text-center py-12 text-slate-400 text-xs">Carregando extrato...</div>
                ) : movimentacoesExtrato.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Nenhuma movimentação liquidada nesta conta.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-3 py-2.5">Data</th>
                        <th className="px-3 py-2.5">Descrição</th>
                        <th className="px-3 py-2.5">Categoria</th>
                        <th className="px-3 py-2.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {movimentacoesExtrato.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-slate-500">
                            {new Date(m.data_pagamento).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-800">{m.descricao}</td>
                          <td className="px-3 py-2.5 text-slate-500">{m.categoria_nome || "—"}</td>
                          <td
                            className={`px-3 py-2.5 text-right font-black font-mono ${
                              m.tipo === "receita" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {m.tipo === "receita" ? "+" : "-"}
                            {formatBRL(m.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <Button variant="secondary" onClick={() => setModalExtrato(null)}>
                  Fechar Extrato
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal 4: Ajuste de Saldo */}
        <Modal
          isOpen={!!modalAjuste}
          onClose={() => setModalAjuste(null)}
          title="Ajustar Saldo / Reconciliação"
          icon={<Scale className="text-blue-600" size={18} />}
          size="sm"
        >
          {modalAjuste && (
            <form onSubmit={handleAjustarSaldo} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">{modalAjuste.nome}</p>
                <p className="text-slate-500 mt-0.5 font-medium">
                  Saldo no sistema atual: <strong className="font-mono">{formatBRL(modalAjuste.saldo_atual)}</strong>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Novo Saldo Real Conferido (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formAjuste.novo_saldo}
                  onChange={(e) => setFormAjuste({ ...formAjuste, novo_saldo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo do Ajuste</label>
                <input
                  type="text"
                  required
                  value={formAjuste.motivo}
                  onChange={(e) => setFormAjuste({ ...formAjuste, motivo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setModalAjuste(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary">
                  Confirmar Ajuste
                </Button>
              </div>
            </form>
          )}
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
