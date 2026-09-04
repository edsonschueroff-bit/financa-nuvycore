import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Check,
  X,
  Star,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Building,
  Users,
  Receipt,
  CheckSquare,
  Square,
  Calendar,
  Wand2,
  AlertTriangle,
  User,
  Building2,
} from "lucide-react";

// =============================================================================
// TEMPLATES DE FEATURES POR TIPO DE PLANO
// =============================================================================

// Features disponíveis no sistema com metadados
const RECURSOS_PADRAO = [
  {
    key: "copiloto_ia",
    label: "Copiloto IA Cora (WhatsApp/Telegram)",
    desc: "Lançamentos por áudio, OCR de notas e consultas",
    pessoal: true,
    empresarial: true,
  },
  {
    key: "orcamento_metas",
    label: "Metas & Orçamento (Budget 12M)",
    desc: "Teto de gastos por categoria e planejamento",
    pessoal: true,
    empresarial: true,
  },
  {
    key: "contas_cartoes",
    label: "Contas Bancárias & Cartões",
    desc: "Múltiplas contas correntes, caixas e cartões",
    pessoal: true,
    empresarial: true,
  },
  {
    key: "investimentos_b3",
    label: "Carteira B3 & Investimentos",
    desc: "Ações, FIIs, Renda Fixa e patrimônio pessoal",
    pessoal: true,
    empresarial: true,
  },
  {
    key: "dre",
    label: "DRE Gerencial em Tempo Real",
    desc: "Apuração de lucro líquido e custos da empresa",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "fluxo_caixa",
    label: "Fluxo de Caixa Projetado",
    desc: "Projeção de liquidez e saldo futuro a 30/60/90 dias",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "recibos_pdf",
    label: "Recibos Oficiais em PDF",
    desc: "Geração de recibos com código de autenticação",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "regua_cobranca",
    label: "Régua de Cobrança WhatsApp",
    desc: "Disparos automáticos D-3, D-0 e D+3 para inadimplentes",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "gateways_proprios",
    label: "Gateways Próprios (Asaas/MP)",
    desc: "Emissão de boletos e Pix diretamente para clientes",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "centros_custo",
    label: "Centros de Custo & Rateio",
    desc: "Filiais, departamentos e projetos",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "open_finance",
    label: "Conciliação Bancária & OFX",
    desc: "Importação de extratos OFX/CSV e conciliação inteligente",
    pessoal: false,
    empresarial: true,
  },
  {
    key: "suporte_vip",
    label: "Suporte Técnico VIP",
    desc: "Atendimento prioritário na central de chamados",
    pessoal: true,
    empresarial: true,
  },
];

// Template base: Plano Pessoal (Pessoa Física / Família / Autônomos)
const TEMPLATE_PESSOAL = {
  copiloto_ia: true,
  orcamento_metas: true,
  contas_cartoes: true,
  investimentos_b3: false,  // opcional — admin libera individualmente
  dre: false,               // exclusivo empresarial
  fluxo_caixa: false,       // exclusivo empresarial
  recibos_pdf: false,       // exclusivo empresarial
  regua_cobranca: false,    // exclusivo empresarial
  gateways_proprios: false, // exclusivo empresarial
  centros_custo: false,     // exclusivo empresarial
  open_finance: false,      // exclusivo empresarial
  suporte_vip: false,       // opcional — admin libera individualmente
};

// Template base: Plano Empresarial (PMEs / Negócios / PJ)
const TEMPLATE_EMPRESARIAL = {
  copiloto_ia: true,
  orcamento_metas: true,
  contas_cartoes: true,
  investimentos_b3: false,  // opcional — admin libera individualmente
  dre: true,
  fluxo_caixa: true,
  recibos_pdf: true,
  regua_cobranca: false,    // opcional — admin libera individualmente
  gateways_proprios: false, // opcional — admin libera individualmente
  centros_custo: false,     // opcional — admin libera individualmente
  open_finance: false,      // opcional — admin libera individualmente
  suporte_vip: false,       // opcional — admin libera individualmente
};

const TEMPLATES = {
  pessoal: TEMPLATE_PESSOAL,
  empresarial: TEMPLATE_EMPRESARIAL,
};

const FORM_DEFAULTS_PESSOAL = {
  max_filiais: 1,
  max_usuarios: 1,
  max_transacoes_mes: 300,
};

const FORM_DEFAULTS_EMPRESARIAL = {
  max_filiais: 1,
  max_usuarios: 3,
  max_transacoes_mes: 1000,
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export default function SaasPlanos() {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [planoIdEdicao, setPlanoIdEdicao] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [templateAplicado, setTemplateAplicado] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    valor: "",
    valor_anual: "",
    ciclo: "mensal",
    tipo_publico: "empresarial",
    max_filiais: 1,
    max_usuarios: 3,
    max_transacoes_mes: 1000,
    is_popular: false,
    ativo: true,
    recursos: { ...TEMPLATE_EMPRESARIAL },
  });

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await api.get("/saas-planos");
      setPlanos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erro ao carregar planos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const resetForm = (tipo = "empresarial") => {
    const defaults = tipo === "pessoal" ? FORM_DEFAULTS_PESSOAL : FORM_DEFAULTS_EMPRESARIAL;
    setForm({
      nome: "",
      descricao: "",
      valor: "",
      valor_anual: "",
      ciclo: "mensal",
      tipo_publico: tipo,
      ...defaults,
      is_popular: false,
      ativo: true,
      recursos: { ...TEMPLATES[tipo] },
    });
    setModoEdicao(false);
    setPlanoIdEdicao(null);
    setTemplateAplicado(false);
  };

  const abrirModalCriar = () => {
    resetForm("empresarial");
    setModalOpen(true);
  };

  const abrirModalEditar = (p) => {
    setModoEdicao(true);
    setPlanoIdEdicao(p.id);
    setTemplateAplicado(false);

    // Mescla os recursos do plano com o template do tipo (garante que novas chaves apareçam)
    const templateBase = TEMPLATES[p.tipo_publico] || TEMPLATE_EMPRESARIAL;
    const rec = {
      ...templateBase,
      ...(typeof p.recursos === "object" && p.recursos !== null ? p.recursos : {}),
    };

    setForm({
      nome: p.nome || "",
      descricao: p.descricao || "",
      valor: p.valor || "",
      valor_anual: p.valor_anual || "",
      ciclo: p.ciclo || "mensal",
      tipo_publico: p.tipo_publico || "empresarial",
      max_filiais: p.max_filiais || 1,
      max_usuarios: p.max_usuarios || 3,
      max_transacoes_mes: p.max_transacoes_mes || 1000,
      is_popular: Boolean(p.is_popular),
      ativo: Boolean(p.ativo ?? true),
      recursos: rec,
    });

    setModalOpen(true);
  };

  // Quando o admin muda o tipo_publico, aplica o template automaticamente
  const handleChangeTipo = (novoTipo) => {
    setForm((prev) => ({
      ...prev,
      tipo_publico: novoTipo,
      recursos: { ...TEMPLATES[novoTipo] },
      ...(novoTipo === "pessoal" ? FORM_DEFAULTS_PESSOAL : FORM_DEFAULTS_EMPRESARIAL),
    }));
    setTemplateAplicado(true);
    setTimeout(() => setTemplateAplicado(false), 4000);
  };

  // Resetar para o template padrão do tipo atual
  const handleResetarTemplate = () => {
    setForm((prev) => ({
      ...prev,
      recursos: { ...TEMPLATES[prev.tipo_publico] },
    }));
    setTemplateAplicado(true);
    setTimeout(() => setTemplateAplicado(false), 4000);
  };

  const handleToggleRecurso = (key) => {
    setForm((prev) => ({
      ...prev,
      recursos: {
        ...prev.recursos,
        [key]: !prev.recursos[key],
      },
    }));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        valor: parseFloat(form.valor),
        valor_anual: form.valor_anual ? parseFloat(form.valor_anual) : null,
        max_filiais: parseInt(form.max_filiais) || 1,
        max_usuarios: parseInt(form.max_usuarios) || 1,
        max_transacoes_mes: parseInt(form.max_transacoes_mes) || 100,
      };

      if (modoEdicao && planoIdEdicao) {
        await api.put(`/saas-planos/${planoIdEdicao}`, payload);
        toast.success("Plano SaaS atualizado com sucesso!");
      } else {
        await api.post("/saas-planos", payload);
        toast.success("Novo plano SaaS criado com sucesso!");
      }

      setModalOpen(false);
      resetForm();
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar plano");
    }
  };

  const handleToggleAtivo = async (id) => {
    try {
      await api.patch(`/saas-planos/${id}/toggle-ativo`);
      toast.success("Status do plano alterado com sucesso.");
      carregar();
    } catch (err) {
      toast.error("Erro ao alterar status do plano");
    }
  };

  const handleTogglePopular = async (id) => {
    try {
      await api.patch(`/saas-planos/${id}/toggle-popular`);
      toast.success("Destaque do plano atualizado.");
      carregar();
    } catch (err) {
      toast.error("Erro ao alterar destaque popular");
    }
  };

  const handleDeletar = async (p) => {
    const ok = await confirm({
      title: "Excluir Plano SaaS",
      description: `Tem certeza que deseja excluir o plano "${p.nome}"? Se houver empresas assinantes, ele será desativado automaticamente.`,
      variant: "danger",
      confirmText: "Excluir Plano",
    });
    if (!ok) return;

    try {
      const res = await api.delete(`/saas-planos/${p.id}`);
      toast.success(res.data.message || "Plano excluído com sucesso!");
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir plano");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const isPessoalForm = form.tipo_publico === "pessoal";
  const planosFiltrados = planos.filter(
    (p) => filtroTipo === "todos" || (p.tipo_publico || "empresarial") === filtroTipo
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="text-slate-800" size={24} /> Planos de Assinatura SaaS
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gerencie os planos de mensalidade com templates automáticos por tipo de público.
            </p>
          </div>

          <Button variant="dark" icon={<Plus size={16} />} onClick={abrirModalCriar}>
            Novo Plano SaaS
          </Button>
        </div>

        {/* Filtros de Segmentação */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setFiltroTipo("todos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filtroTipo === "todos"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos os Planos ({planos.length})
          </button>

          <button
            onClick={() => setFiltroTipo("pessoal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filtroTipo === "pessoal"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>👤</span> Finanças Pessoais ({planos.filter((p) => p.tipo_publico === "pessoal").length})
          </button>

          <button
            onClick={() => setFiltroTipo("empresarial")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filtroTipo === "empresarial"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>🏢</span> Empresas & PMEs ({planos.filter((p) => p.tipo_publico === "empresarial" || !p.tipo_publico).length})
          </button>
        </div>

        {/* Grade de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 text-center py-12 text-slate-400 font-medium">
              Carregando planos SaaS...
            </div>
          ) : planosFiltrados.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-slate-400 font-medium">
              Nenhum plano encontrado para este filtro.
            </div>
          ) : (
            planosFiltrados.map((p) => (
              <Card
                key={p.id}
                padding="md"
                className={`flex flex-col justify-between relative transition-all ${
                  p.is_popular
                    ? "border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-md bg-gradient-to-b from-amber-50/20 to-white"
                    : !p.ativo
                    ? "opacity-60 bg-slate-50 border-slate-200"
                    : "hover:border-slate-300"
                }`}
              >
                {/* Badges superiores */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Boolean(p.is_popular) && (
                      <span className="px-2.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-extrabold flex items-center gap-1 uppercase tracking-wider shadow-xs">
                        <Sparkles size={11} /> Mais Popular
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        p.tipo_publico === "pessoal"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {p.tipo_publico === "pessoal" ? (
                        <><User size={10} /> Pessoal</>
                      ) : (
                        <><Building2 size={10} /> Empresa</>
                      )}
                    </span>
                    <Badge variant={p.ativo ? "success" : "secondary"}>
                      {p.ativo ? "ATIVO" : "INATIVO"}
                    </Badge>
                  </div>

                  <span className="text-[11px] text-slate-400 font-bold">
                    {p.total_assinantes || 0} cliente(s)
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-xl">{p.nome}</h3>
                  <p className="text-xs text-slate-500 mb-4 min-h-[32px] line-clamp-2">
                    {p.descricao || "Sem descrição comercial."}
                  </p>

                  {/* Preço Mensal / Anual */}
                  <div className="mb-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 font-mono">
                        {formatBRL(p.valor)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium"> / mês</span>
                    </div>

                    {p.valor_anual && (
                      <div className="text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-slate-200/60 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          Anual: {formatBRL(p.valor_anual)}/ano (equivale a {formatBRL(p.valor_anual / 12)}/mês)
                        </div>
                        {p.valor * 12 > p.valor_anual && (
                          <span className="text-[10px] text-emerald-800 font-extrabold block">
                            Economia de {formatBRL(p.valor * 12 - p.valor_anual)}/ano (2 meses grátis) 🎉
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Limites de Uso */}
                  <div className="space-y-2 text-xs text-slate-700 font-medium border-t border-slate-100 pt-3 mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Limites Operacionais:
                    </span>
                    <div className="flex items-center gap-2">
                      <Building size={14} className="text-slate-400" />
                      <span>
                        Até <strong>{p.max_filiais}</strong>{" "}
                        {p.tipo_publico === "pessoal" ? "carteira(s)/caixa" : "filial(is)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      <span>
                        Até <strong>{p.max_usuarios}</strong> usuário(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Receipt size={14} className="text-slate-400" />
                      <span>
                        Até <strong>{p.max_transacoes_mes}</strong> lançamentos/mês
                      </span>
                    </div>
                  </div>

                  {/* Recursos Liberados */}
                  <div className="space-y-1.5 text-[11px] border-t border-slate-100 pt-3 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Módulos Inclusos:
                    </span>
                    {RECURSOS_PADRAO.map((rec) => {
                      const ativoNoPlano = p.recursos?.[rec.key] ?? false;
                      return (
                        <div key={rec.key} className="flex items-center gap-1.5">
                          {ativoNoPlano ? (
                            <Check size={13} className="text-emerald-600 shrink-0" />
                          ) : (
                            <X size={13} className="text-slate-300 shrink-0" />
                          )}
                          <span
                            className={
                              ativoNoPlano
                                ? "text-slate-800 font-semibold"
                                : "text-slate-400 line-through"
                            }
                          >
                            {rec.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ações do Card */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePopular(p.id)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        p.is_popular
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-amber-600"
                      }`}
                      title={p.is_popular ? "Remover destaque popular" : "Marcar como Mais Popular"}
                    >
                      <Star size={15} className={p.is_popular ? "fill-amber-500" : ""} />
                    </button>

                    <button
                      onClick={() => handleToggleAtivo(p.id)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        p.ativo
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                      }`}
                      title={p.ativo ? "Desativar plano" : "Ativar plano"}
                    >
                      {p.ativo ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirModalEditar(p)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit2 size={13} /> Editar
                    </button>

                    <button
                      onClick={() => handleDeletar(p)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                      title="Excluir Plano"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Modal Criar / Editar Plano */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modoEdicao ? `Editar Plano: ${form.nome}` : "Novo Plano de Assinatura SaaS"}
          icon={<Layers className="text-slate-800" size={18} />}
          size="lg"
        >
          <form onSubmit={handleSalvar} className="space-y-4 text-xs">

            {/* Seletor de Tipo: Pessoal vs Empresarial — PRIMEIRO campo */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block font-bold text-slate-800 mb-2 text-xs">
                Tipo de Público / Perfil do Plano
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChangeTipo("pessoal")}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    isPessoalForm
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <User size={15} />
                  👤 Pessoal & Família (B2C)
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeTipo("empresarial")}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    !isPessoalForm
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400"
                  }`}
                >
                  <Building2 size={15} />
                  🏢 Empresas & PMEs (B2B)
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Ao mudar o tipo, o template de módulos é aplicado automaticamente. Você pode customizar depois.
              </p>
            </div>

            {/* Aviso de template aplicado */}
            {templateAplicado && (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-bold animate-pulse">
                <Wand2 size={14} className="text-emerald-600 shrink-0" />
                Template {isPessoalForm ? "Pessoal" : "Empresarial"} aplicado automaticamente! Customize abaixo se necessário.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">Nome do Plano *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    isPessoalForm
                      ? "Ex: Cora Pessoal Solo, Pessoal Pro..."
                      : "Ex: Empresarial Starter, Empresarial Pro..."
                  }
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Descrição Comercial</label>
              <input
                type="text"
                placeholder={
                  isPessoalForm
                    ? "Ex: Ideal para controlar gastos pessoais com IA no WhatsApp..."
                    : "Ex: Solução completa para PMEs com DRE, Fluxo de Caixa e IA..."
                }
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Preços */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Valor Mensal (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="29.90"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Valor Anual (R$/ano)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="299.00"
                  value={form.valor_anual}
                  onChange={(e) => setForm({ ...form, valor_anual: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Limites Operacionais */}
            <div>
              <span className="font-bold text-slate-800 block mb-2">Limites de Uso Operacional</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-semibold">
                    {isPessoalForm ? "Max Carteiras/Caixas" : "Max Filiais"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.max_filiais}
                    onChange={(e) => setForm({ ...form, max_filiais: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-semibold">
                    Max Usuários
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.max_usuarios}
                    onChange={(e) => setForm({ ...form, max_usuarios: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-semibold">
                    Max Lançamentos/Mês
                  </label>
                  <input
                    type="number"
                    min="50"
                    required
                    value={form.max_transacoes_mes}
                    onChange={(e) => setForm({ ...form, max_transacoes_mes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-center font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Checkboxes de Recursos com template visual */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">
                  Módulos Liberados para o Assinante
                </span>
                <button
                  type="button"
                  onClick={handleResetarTemplate}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                  title="Resetar para o template padrão do tipo selecionado"
                >
                  <Wand2 size={12} />
                  Resetar Template {isPessoalForm ? "Pessoal" : "Empresarial"}
                </button>
              </div>

              {/* Módulos do Perfil */}
              <div className="space-y-2">
                {/* Features dentro do perfil */}
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Check size={11} className="text-emerald-500" />
                  Módulos do Perfil {isPessoalForm ? "Pessoal" : "Empresarial"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {RECURSOS_PADRAO.filter((rec) => rec[form.tipo_publico]).map((rec) => {
                    const marcado = form.recursos?.[rec.key] ?? false;
                    return (
                      <div
                        key={rec.key}
                        onClick={() => handleToggleRecurso(rec.key)}
                        className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all select-none ${
                          marcado
                            ? "bg-white border-emerald-300 shadow-xs text-slate-900"
                            : "bg-slate-100/50 border-slate-200 text-slate-400"
                        }`}
                      >
                        {marcado ? (
                          <CheckSquare size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square size={16} className="text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-bold block text-[11px] leading-tight">{rec.label}</span>
                          <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                            {rec.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Features fora do perfil (aviso visual) */}
                {RECURSOS_PADRAO.filter((rec) => !rec[form.tipo_publico]).length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mt-3">
                      <AlertTriangle size={11} />
                      Módulos fora do perfil {isPessoalForm ? "pessoal" : "empresarial"} — use com cautela
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                      {RECURSOS_PADRAO.filter((rec) => !rec[form.tipo_publico]).map((rec) => {
                        const marcado = form.recursos?.[rec.key] ?? false;
                        return (
                          <div
                            key={rec.key}
                            onClick={() => handleToggleRecurso(rec.key)}
                            className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all select-none ${
                              marcado
                                ? "bg-white border-amber-300 shadow-xs text-slate-900"
                                : "bg-amber-50/30 border-amber-200/50 text-slate-400"
                            }`}
                          >
                            {marcado ? (
                              <CheckSquare size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <Square size={16} className="text-slate-300 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="font-bold block text-[11px] leading-tight">
                                {rec.label}
                              </span>
                              <span className="text-[10px] text-amber-600/80 block leading-tight mt-0.5">
                                ⚠️ Fora do perfil {isPessoalForm ? "pessoal" : "empresarial"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Opções adicionais */}
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_popular}
                  onChange={(e) => setForm({ ...form, is_popular: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded-sm cursor-pointer"
                />
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                  Destacar como Plano Mais Popular
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                />
                <span className="font-bold text-slate-800 text-xs">Plano Ativo para Vendas</span>
              </label>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="dark">
                {modoEdicao ? "Salvar Alterações" : "Criar Plano SaaS"}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
