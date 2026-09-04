import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, Modal, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle,
  Clock,
  QrCode,
  Settings,
  ShieldCheck,
  Send,
  Copy,
  ExternalLink,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Lock,
  Trash2,
  Sparkles,
  Zap,
} from "lucide-react";

export default function SaasFaturas() {
  const [faturas, setFaturas] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Modais
  const [modalGatewayOpen, setModalGatewayOpen] = useState(false);
  const [modalPagamentoOpen, setModalPagamentoOpen] = useState(false);
  const [faturaSelecionada, setFaturaSelecionada] = useState(null);
  const [metodoPagamento, setMetodoPagamento] = useState("pix"); // "pix" | "cartao"

  // Pix State
  const [pixData, setPixData] = useState(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [solicitarCpf, setSolicitarCpf] = useState(false);
  const [cpfInput, setCpfInput] = useState("");

  // Cartão State
  const [cartaoForm, setCartaoForm] = useState({
    numero_cartao: "",
    nome_impresso: "",
    validade_mes: "",
    validade_ano: "",
    cvv: "",
    cpf_cnpj: "",
    parcelas: 1,
  });
  const [processandoCartao, setProcessandoCartao] = useState(false);

  // Form Gateways
  const [gatewayAba, setGatewayAba] = useState("asaas"); // "asaas" | "mercadopago"
  const [asaasForm, setAsaasForm] = useState({
    access_token: "",
    public_key: "",
    sandbox: false,
    ativo: true,
  });
  const [mpForm, setMpForm] = useState({
    access_token: "",
    public_key: "",
    sandbox: false,
    ativo: false,
  });
  const [salvandoGateway, setSalvandoGateway] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const [fatRes, gatRes] = await Promise.all([
        api.get("/saas-faturas"),
        api.get("/saas-faturas/gateways"),
      ]);
      setFaturas(Array.isArray(fatRes.data) ? fatRes.data : []);
      setGateways(Array.isArray(gatRes.data) ? gatRes.data : []);

      const mp = (Array.isArray(gatRes.data) ? gatRes.data : []).find(
        (g) => g.provider === "mercadopago"
      );
      if (mp) {
        setMpForm({
          access_token: mp.access_token || "",
          public_key: mp.public_key || "",
          sandbox: Boolean(mp.sandbox),
          ativo: Boolean(mp.ativo),
        });
      }

      const asaas = (Array.isArray(gatRes.data) ? gatRes.data : []).find(
        (g) => g.provider === "asaas"
      );
      if (asaas) {
        setAsaasForm({
          access_token: asaas.access_token || "",
          public_key: asaas.public_key || "",
          sandbox: Boolean(asaas.sandbox),
          ativo: Boolean(asaas.ativo),
        });
        if (asaas.ativo) {
          setGatewayAba("asaas");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar faturas/gateways:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleSalvarGateway = async (provedor) => {
    try {
      setSalvandoGateway(true);
      const payload = provedor === "asaas" ? asaasForm : mpForm;
      await api.post("/saas-faturas/gateways", {
        provider: provedor,
        ...payload,
      });
      toast.success(`Credenciais do ${provedor === "asaas" ? "Asaas" : "Mercado Pago"} salvas com sucesso!`);
      setModalGatewayOpen(false);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || `Erro ao salvar credenciais do ${provedor}`);
    } finally {
      setSalvandoGateway(false);
    }
  };

  const abrirModalPagamento = async (fatura) => {
    setFaturaSelecionada(fatura);
    setMetodoPagamento("pix");
    setPixData(null);
    setSolicitarCpf(false);
    setCpfInput(fatura.empresa_cnpj || "");
    setCartaoForm({
      numero_cartao: "",
      nome_impresso: "",
      validade_mes: "",
      validade_ano: "",
      cvv: "",
      cpf_cnpj: fatura.empresa_cnpj || "",
      parcelas: 1,
    });
    setModalPagamentoOpen(true);
    handleGerarPix(fatura);
  };

  const handleGerarPix = async (fatura, customCpf = null) => {
    try {
      setGerandoPix(true);
      const payload = customCpf
        ? { cpf_cnpj: customCpf }
        : cpfInput
        ? { cpf_cnpj: cpfInput }
        : {};
      const res = await api.post(`/saas-faturas/${fatura.id}/gerar-pix`, payload);
      setPixData({
        ...res.data,
        empresa_nome: fatura.empresa_nome,
        valor: fatura.valor,
      });
      setSolicitarCpf(false);
    } catch (err) {
      if (err.response?.data?.exige_cpf) {
        setSolicitarCpf(true);
      } else {
        toast.error(err.response?.data?.error || "Erro ao gerar cobrança.");
      }
    } finally {
      setGerandoPix(false);
    }
  };

  const handlePagarCartao = async (e) => {
    e.preventDefault();
    if (!faturaSelecionada) return;

    try {
      setProcessandoCartao(true);
      const res = await api.post(`/saas-faturas/${faturaSelecionada.id}/pagar-cartao`, cartaoForm);
      toast.success(res.data.message || "Pagamento via cartão aprovado!");
      setModalPagamentoOpen(false);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao processar pagamento no cartão.");
    } finally {
      setProcessandoCartao(false);
    }
  };

  const handleLiquidar = async (id) => {
    const ok = await confirm({
      title: "Liquidação Manual",
      description: "Confirmar baixa manual desta fatura SaaS? A empresa será renovada por +30 dias.",
      variant: "primary",
      confirmText: "Confirmar Baixa",
    });
    if (!ok) return;

    try {
      await api.post(`/saas-faturas/${id}/liquidar`);
      toast.success("Fatura liquidada e plano renovado!");
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao liquidar fatura");
    }
  };

  const handleDeletarFatura = async (id, status) => {
    if (status === "pago") {
      toast.warning("Faturas pagas não podem ser excluídas para proteger o histórico financeiro e métricas de MRR.");
      return;
    }
    const ok = await confirm({
      title: "Excluir Fatura",
      description: `Tem certeza que deseja excluir a fatura #${id}? Esta ação não poderá ser desfeita.`,
      variant: "danger",
      confirmText: "Excluir",
    });
    if (!ok) return;

    try {
      await api.delete(`/saas-faturas/${id}`);
      toast.success("Fatura excluída com sucesso.");
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir fatura.");
    }
  };

  const copiarPix = (texto) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    toast.info("Código Pix Copia e Cola copiado para a área de transferência!");
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  // Métricas
  const totalRecebido = faturas
    .filter((f) => f.status === "pago")
    .reduce((acc, f) => acc + parseFloat(f.valor || 0), 0);

  const totalPendente = faturas
    .filter((f) => f.status === "pendente" || f.status === "vencido")
    .reduce((acc, f) => acc + parseFloat(f.valor || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="text-slate-800" size={24} /> Faturas & Cobranças SaaS
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Controle de mensalidades, integração Pix com Asaas e Mercado Pago.
            </p>
          </div>

          <Button
            variant="secondary"
            icon={<Settings size={16} />}
            onClick={() => setModalGatewayOpen(true)}
          >
            Configurar Gateways (Asaas / Mercado Pago)
          </Button>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="md" className="border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Recebido (Pago)
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {formatBRL(totalRecebido)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
            </div>
          </Card>

          <Card padding="md" className="border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  A Receber / Pendente
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {formatBRL(totalPendente)}
                </h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={20} />
              </div>
            </div>
          </Card>

          <Card padding="md" className="border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Gateway SaaS Ativo
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-blue-600" />
                  {asaasForm.ativo && asaasForm.access_token
                    ? "Asaas (Principal)"
                    : mpForm.ativo && mpForm.access_token
                    ? "Mercado Pago (Principal)"
                    : "Configurar Gateway"}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CreditCard size={20} />
              </div>
            </div>
          </Card>
        </div>

        {/* Tabela de Faturas */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Empresa Tenant</th>
                  <th className="px-4 py-3.5">Plano SaaS</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-4 py-3.5 text-center">Ações de Cobrança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      Carregando faturas...
                    </td>
                  </tr>
                ) : faturas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      Nenhuma fatura cadastrada.
                    </td>
                  </tr>
                ) : (
                  faturas.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            f.status === "pago"
                              ? "success"
                              : f.status === "vencido"
                                ? "danger"
                                : "warning"
                          }
                          icon={f.status === "pago" ? <CheckCircle size={11} /> : <Clock size={11} />}
                        >
                          {f.status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {f.empresa_nome}
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {f.empresa_email || "sem email"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{f.plano_nome || "Plano Profissional"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(f.data_vencimento).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                        {formatBRL(f.valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {f.status !== "pago" && (
                            <>
                              <button
                                onClick={() => abrirModalPagamento(f)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <DollarSign size={13} />
                                Pagar Fatura
                              </button>

                              <button
                                onClick={() => handleLiquidar(f.id)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                Baixar
                              </button>

                              <button
                                onClick={() => handleDeletarFatura(f.id, f.status)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                                title="Excluir Fatura"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}

                          {f.status === "pago" && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle size={13} /> Pago com Sucesso
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Configuração de Gateways SaaS (Asaas & Mercado Pago) */}
        <Modal
          isOpen={modalGatewayOpen}
          onClose={() => setModalGatewayOpen(false)}
          title="Gateways de Pagamento SaaS"
          icon={<Settings className="text-slate-800" size={18} />}
          size="md"
        >
          <div className="space-y-4 text-xs">
            {/* Abas de Escolha do Gateway */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setGatewayAba("asaas")}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  gatewayAba === "asaas"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                Asaas Pagamentos
                {asaasForm.ativo && asaasForm.access_token && (
                  <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    Ativo Padrão
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGatewayAba("mercadopago")}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  gatewayAba === "mercadopago"
                    ? "bg-white text-sky-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                Mercado Pago
                {mpForm.ativo && mpForm.access_token && (
                  <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    Ativo Padrão
                  </span>
                )}
              </button>
            </div>

            {/* Formulário Asaas */}
            {gatewayAba === "asaas" && (
              <form onSubmit={(e) => { e.preventDefault(); handleSalvarGateway("asaas"); }} className="space-y-4">
                <p className="text-slate-500 text-xs">
                  Insira a Chave de API da sua conta Asaas para emitir cobranças por Pix com conciliação e baixa automática das mensalidades SaaS.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">API Key do Asaas *</label>
                  <input
                    type="text"
                    required
                    placeholder="$aact_YTU5YTE0M2M6N2Z..."
                    value={asaasForm.access_token}
                    onChange={(e) => setAsaasForm({ ...asaasForm, access_token: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Gere sua chave em: Asaas → Minha Conta → Integrações → Gerar Chave de API
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">Definir como Gateway Principal</span>
                      <span className="text-[10px] text-slate-500">Usar o Asaas para receber as mensalidades dos assinantes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={asaasForm.ativo}
                      onChange={(e) => setAsaasForm({ ...asaasForm, ativo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-sm cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">Ambiente Sandbox (Testes)</span>
                      <span className="text-[10px] text-slate-500">Usar ambiente de homologação sandbox.asaas.com</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={asaasForm.sandbox}
                      onChange={(e) => setAsaasForm({ ...asaasForm, sandbox: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-sm cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 space-y-1">
                  <span className="font-bold block">Webhook de Baixa Automática SaaS:</span>
                  <p className="font-mono text-[10px] bg-white p-1.5 rounded-lg border border-blue-200 break-all select-all">
                    {window.location.origin}/api/saas-faturas/webhook/asaas
                  </p>
                  <p className="text-[10px] text-blue-700">
                    Configure essa URL no Asaas (Menu Integrações → Webhooks) marcando o evento <b>"Pagamento Recebido"</b>.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setModalGatewayOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={salvandoGateway}
                  >
                    Salvar Credenciais Asaas
                  </Button>
                </div>
              </form>
            )}

            {/* Formulário Mercado Pago */}
            {gatewayAba === "mercadopago" && (
              <form onSubmit={(e) => { e.preventDefault(); handleSalvarGateway("mercadopago"); }} className="space-y-4">
                <p className="text-slate-500 text-xs">
                  Insira suas credenciais da API do Mercado Pago para liberar cobranças por Pix e Cartão de Crédito.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Access Token (Produção) *</label>
                  <input
                    type="text"
                    required
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={mpForm.access_token}
                    onChange={(e) => setMpForm({ ...mpForm, access_token: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Public Key (Produção)</label>
                  <input
                    type="text"
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={mpForm.public_key}
                    onChange={(e) => setMpForm({ ...mpForm, public_key: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-[11px]"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">Definir como Gateway Principal</span>
                      <span className="text-[10px] text-slate-500">Usar o Mercado Pago para receber as mensalidades</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={mpForm.ativo}
                      onChange={(e) => setMpForm({ ...mpForm, ativo: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">Modo Sandbox (Testes)</span>
                      <span className="text-[10px] text-slate-500">Usar ambiente de testes do Mercado Pago</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={mpForm.sandbox}
                      onChange={(e) => setMpForm({ ...mpForm, sandbox: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setModalGatewayOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="dark"
                    loading={salvandoGateway}
                  >
                    Salvar Credenciais Mercado Pago
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>

        {/* Modal Seletor de Pagamento: Pix ou Cartão */}
        <Modal
          isOpen={modalPagamentoOpen}
          onClose={() => setModalPagamentoOpen(false)}
          title={`Pagar Fatura - ${faturaSelecionada?.empresa_nome || ''}`}
          icon={<DollarSign className="text-emerald-600" size={18} />}
          size="md"
        >
          {faturaSelecionada && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Empresa Assinante</span>
                  <span className="font-bold text-slate-900 text-sm">{faturaSelecionada.empresa_nome}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Valor da Fatura</span>
                  <span className="font-extrabold text-slate-900 text-base font-mono">
                    {formatBRL(faturaSelecionada.valor)}
                  </span>
                </div>
              </div>

              {/* Abas Pix vs Cartão */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMetodoPagamento("pix")}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${metodoPagamento === "pix"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <QrCode size={15} />
                  Pix Instantâneo
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPagamento("cartao")}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${metodoPagamento === "cartao"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <CreditCard size={15} />
                  Cartão de Crédito
                </button>
              </div>

              {/* CONTEÚDO PIX */}
              {metodoPagamento === "pix" && (
                <div className="space-y-4 text-center py-2">
                  {gerandoPix ? (
                    <div className="py-8 text-slate-400 font-medium">Gerando dados de cobrança no Asaas...</div>
                  ) : solicitarCpf ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left space-y-3">
                      <div className="flex items-center gap-2 text-amber-800 font-bold">
                        <AlertTriangle size={18} className="shrink-0 text-amber-600" />
                        <span>CPF ou CNPJ do Pagador</span>
                      </div>
                      <p className="text-slate-600 text-xs">
                        Para registrar a cobrança oficial na <b>Asaas</b> com baixa automática, é necessário informar o CPF ou CNPJ do cliente:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Digite o CPF ou CNPJ (apenas números)..."
                          value={cpfInput}
                          onChange={(e) => setCpfInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          loading={gerandoPix}
                          onClick={() => handleGerarPix(faturaSelecionada, cpfInput)}
                        >
                          Confirmar e Gerar
                        </Button>
                      </div>
                    </div>
                  ) : pixData ? (
                    <>
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl inline-block mx-auto">
                        {pixData.pix_qr_code_url ? (
                          <img
                            src={pixData.pix_qr_code_url}
                            alt="QR Code Pix"
                            className="w-44 h-44 mx-auto rounded-lg shadow-xs"
                          />
                        ) : (
                          <div className="w-44 h-44 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg">
                            Sem imagem QR Code
                          </div>
                        )}
                      </div>

                      <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Pix Copia e Cola:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={pixData.pix_copia_cola || ""}
                            className="w-full text-[10px] font-mono p-2 bg-white border border-slate-200 rounded-lg text-slate-600 select-all"
                          />
                          <button
                            onClick={() => copiarPix(pixData.pix_copia_cola)}
                            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shrink-0"
                            title="Copiar Código Pix"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Links extras do Asaas (Boleto Bancário e Cartão/Fatura Online) */}
                      <div className="flex flex-col gap-2 pt-1">
                        {pixData.bank_slip_url && (
                          <a
                            href={pixData.bank_slip_url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <ExternalLink size={14} /> Abrir Boleto Bancário Oficial (PDF)
                          </a>
                        )}

                        {pixData.invoice_url && (
                          <a
                            href={pixData.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <ExternalLink size={14} /> Pagar com Cartão ou Boleto Online
                          </a>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 leading-tight">
                        O pagamento é reconhecido automaticamente em 2 segundos via Webhook.
                      </p>
                    </>
                  ) : null}
                </div>
              )}

              {/* CONTEÚDO CARTÃO DE CRÉDITO */}
              {metodoPagamento === "cartao" && (
                <div className="space-y-4 pt-1">
                  {/* Opção Rápida: Checkout Asaas Oficial */}
                  {pixData?.invoice_url && (
                    <div className="p-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md space-y-2 text-center">
                      <p className="font-bold text-xs">Pagar com Cartão com 1 Clique</p>
                      <p className="text-[11px] text-blue-100">
                        Abra a página segura da Asaas com validação 3D Secure e todas as bandeiras.
                      </p>
                      <a
                        href={pixData.invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-white text-slate-900 rounded-xl font-extrabold text-xs shadow hover:bg-slate-100 transition"
                      >
                        <ExternalLink size={14} /> Abrir Fatura Segura na Asaas
                      </a>
                    </div>
                  )}

                  {/* Formulário Direto de Cartão */}
                  <form onSubmit={handlePagarCartao} className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="font-bold text-slate-800 text-xs block mb-2">Dados do Cartão de Crédito</span>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">Número do Cartão *</label>
                          <input
                            type="text"
                            required
                            placeholder="4532 •••• •••• ••••"
                            maxLength="19"
                            value={cartaoForm.numero_cartao}
                            onChange={(e) => setCartaoForm({ ...cartaoForm, numero_cartao: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">Nome Impresso no Cartão *</label>
                          <input
                            type="text"
                            required
                            placeholder="NOME COMO NO CARTÃO"
                            value={cartaoForm.nome_impresso}
                            onChange={(e) => setCartaoForm({ ...cartaoForm, nome_impresso: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1 text-[11px]">Mês *</label>
                            <input
                              type="text"
                              required
                              placeholder="MM"
                              maxLength="2"
                              value={cartaoForm.validade_mes}
                              onChange={(e) => setCartaoForm({ ...cartaoForm, validade_mes: e.target.value })}
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono text-xs focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1 text-[11px]">Ano *</label>
                            <input
                              type="text"
                              required
                              placeholder="AA"
                              maxLength="4"
                              value={cartaoForm.validade_ano}
                              onChange={(e) => setCartaoForm({ ...cartaoForm, validade_ano: e.target.value })}
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono text-xs focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1 text-[11px]">CVV *</label>
                            <input
                              type="password"
                              required
                              placeholder="•••"
                              maxLength="4"
                              value={cartaoForm.cvv}
                              onChange={(e) => setCartaoForm({ ...cartaoForm, cvv: e.target.value })}
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono text-xs focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        {/* Se for plano ANUAL, exibe parcelamento de até 12x. Se for MENSAL, exibe aviso de recorrência sem parcelas */}
                        {(() => {
                          const isAnual = faturaSelecionada.ciclo === "anual" || parseFloat(faturaSelecionada.valor) > 250;
                          return (
                            <div className="space-y-2.5">
                              <div className={isAnual ? "grid grid-cols-2 gap-2" : ""}>
                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">CPF do Titular *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="000.000.000-00"
                                    value={cartaoForm.cpf_cnpj}
                                    onChange={(e) => setCartaoForm({ ...cartaoForm, cpf_cnpj: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-600"
                                  />
                                </div>

                                {isAnual && (
                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                                      Parcelamento do Plano Anual
                                    </label>
                                    <select
                                      value={cartaoForm.parcelas}
                                      onChange={(e) => setCartaoForm({ ...cartaoForm, parcelas: parseInt(e.target.value, 10) })}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-blue-600"
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                                        <option key={n} value={n}>
                                          {n}x de {formatBRL(faturaSelecionada.valor / n)} {n === 1 ? "à vista" : "sem juros"}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>

                              {isAnual ? (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                                  <Sparkles size={14} className="text-emerald-600 shrink-0" />
                                  <span><b>Plano Anual:</b> Acesso liberado por 1 ano inteiro (365 dias) após a confirmação!</span>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-blue-800 text-xs">
                                  <Zap size={14} className="text-blue-600 shrink-0" />
                                  <span><b>Cobrança Recorrente Mensal:</b> Seu cartão será debitado mensalmente no valor de {formatBRL(faturaSelecionada.valor)}. Cancele quando quiser.</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setModalPagamentoOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={processandoCartao}
                        icon={<Lock size={14} />}
                      >
                        Pagar no Cartão de Crédito
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
