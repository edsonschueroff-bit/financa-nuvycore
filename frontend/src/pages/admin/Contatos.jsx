import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  MessageCircle,
  Mail,
  MapPin,
  Building2,
  UserCheck,
  Edit2,
  Trash2,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export default function Contatos() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("todos"); // todos | cliente | fornecedor | inadimplentes
  const [search, setSearch] = useState("");
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Modal Novo / Editar Contato
  const [modalContato, setModalContato] = useState(false);
  const [editando, setEditando] = useState(null);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [formContato, setFormContato] = useState({
    tipo: "cliente",
    nome: "",
    razao_social: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    cep: "",
    endereco: "",
    cidade: "",
    estado: "",
    observacoes: "",
  });

  // Modal Ficha 360º
  const [modalFicha, setModalFicha] = useState(null);
  const [dadosFicha, setDadosFicha] = useState(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  const carregarContatos = async () => {
    try {
      setLoading(true);
      let url = `/contatos?search=${search}`;
      if (abaAtiva === "cliente" || abaAtiva === "fornecedor") {
        url += `&tipo=${abaAtiva}`;
      } else if (abaAtiva === "inadimplentes") {
        url += `&aba=inadimplentes`;
      }
      const res = await api.get(url);
      setContatos(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarContatos();
  }, [abaAtiva, search]);

  const handleBuscarCnpj = async () => {
    const clean = formContato.cpf_cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.warning("Por favor, digite um CNPJ válido com 14 dígitos.");
      return;
    }

    try {
      setBuscandoCnpj(true);
      const res = await api.get(`/contatos/cnpj/${clean}`);
      setFormContato((prev) => ({
        ...prev,
        nome: res.data.nome || prev.nome,
        razao_social: res.data.razao_social || prev.razao_social,
        email: res.data.email || prev.email,
        telefone: res.data.telefone || prev.telefone,
        cep: res.data.cep || prev.cep,
        endereco: res.data.endereco || prev.endereco,
        cidade: res.data.cidade || prev.cidade,
        estado: res.data.estado || prev.estado,
      }));
      toast.success("Dados do CNPJ preenchidos automaticamente!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao consultar CNPJ na Receita Federal.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleSalvarContato = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await api.put(`/contatos/${editando.id}`, formContato);
        toast.success("Contato atualizado com sucesso!");
      } else {
        await api.post("/contatos", formContato);
        toast.success("Contato cadastrado com sucesso!");
      }
      setModalContato(false);
      setEditando(null);
      setFormContato({
        tipo: "cliente",
        nome: "",
        razao_social: "",
        cpf_cnpj: "",
        email: "",
        telefone: "",
        cep: "",
        endereco: "",
        cidade: "",
        estado: "",
        observacoes: "",
      });
      carregarContatos();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar contato");
    }
  };

  const handleAbrirFicha360 = async (contato) => {
    setModalFicha(contato);
    setLoadingFicha(true);
    try {
      const res = await api.get(`/contatos/${contato.id}/ficha360`);
      setDadosFicha(res.data);
    } catch (err) {
      toast.error("Erro ao carregar Ficha 360º do contato.");
    } finally {
      setLoadingFicha(false);
    }
  };

  const handleDeletar = async (id) => {
    const ok = await confirm({
      title: "Desativar Contato",
      description: "Deseja realmente desativar este contato? Ele não aparecerá mais nas listas para novos lançamentos.",
      variant: "danger",
      confirmText: "Desativar",
    });
    if (!ok) return;

    try {
      await api.delete(`/contatos/${id}`);
      toast.success("Contato desativado com sucesso.");
      carregarContatos();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao desativar contato");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const totalClientes = contatos.filter((c) => c.tipo === "cliente" || c.tipo === "ambos").length;
  const totalFornecedores = contatos.filter((c) => c.tipo === "fornecedor" || c.tipo === "ambos").length;
  const totalInadimplentes = contatos.filter((c) => c.faturas_vencidas_count > 0).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-emerald-600" size={24} /> Clientes & Fornecedores (Contatos)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gestão da carteira, ficha financeira 360º e consulta automática de CNPJ.
            </p>
          </div>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditando(null);
              setFormContato({
                tipo: "cliente",
                nome: "",
                razao_social: "",
                cpf_cnpj: "",
                email: "",
                telefone: "",
                cep: "",
                endereco: "",
                cidade: "",
                estado: "",
                observacoes: "",
              });
              setModalContato(true);
            }}
          >
            Novo Contato
          </Button>
        </div>

        {/* Resumo de Indicadores (Cards Padronizados) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Clientes Cadastrados</span>
              <p className="text-xl font-black text-slate-900 mt-1 font-mono">{totalClientes}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Base ativa de clientes</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <UserCheck size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Fornecedores</span>
              <p className="text-xl font-black text-slate-900 mt-1 font-mono">{totalFornecedores}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Parceiros e serviços</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Clientes Inadimplentes</span>
              <p className="text-xl font-black text-rose-600 mt-1 font-mono">{totalInadimplentes}</p>
              <p className="text-[10px] text-rose-700 font-bold mt-0.5">Com contas em atraso</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={20} />
            </div>
          </Card>
        </div>

        {/* Abas e Filtro de Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto text-xs font-semibold">
            {[
              { key: "todos", label: "Todos os Contatos" },
              { key: "cliente", label: "👤 Clientes" },
              { key: "fornecedor", label: "🏢 Fornecedores" },
              { key: "inadimplentes", label: "⚠️ Em Atraso" },
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
              placeholder="Buscar por nome, CNPJ, e-mail ou cidade..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
          </div>
        </div>

        {/* Tabela de Contatos em Card Padronizado */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Nome / Razão Social</th>
                  <th className="px-4 py-3.5">CPF / CNPJ</th>
                  <th className="px-4 py-3.5">Contato & WhatsApp</th>
                  <th className="px-4 py-3.5">Localização</th>
                  <th className="px-4 py-3.5 text-right">Saldo Aberto</th>
                  <th className="px-4 py-3.5 text-center">Ficha 360º & Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Carregando contatos...
                    </td>
                  </tr>
                ) : contatos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Nenhum contato encontrado.
                    </td>
                  </tr>
                ) : (
                  contatos.map((c) => {
                    const cleanPhone = c.telefone ? c.telefone.replace(/\D/g, "") : "";
                    const whatsappLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              c.tipo === "cliente"
                                ? "success"
                                : c.tipo === "fornecedor"
                                ? "info"
                                : "neutral"
                            }
                          >
                            {c.tipo}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{c.nome}</p>
                          {c.razao_social && (
                            <p className="text-[11px] text-slate-400">{c.razao_social}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {c.cpf_cnpj || "—"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700 font-medium">{c.telefone || "—"}</span>
                            {whatsappLink && (
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir WhatsApp"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              >
                                <MessageCircle size={15} />
                              </a>
                            )}
                          </div>
                          {c.email && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{c.email}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {c.cidade ? `${c.cidade} - ${c.estado || "BR"}` : "—"}
                        </td>

                        <td className="px-4 py-3 text-right font-mono">
                          {parseFloat(c.saldo_em_aberto) > 0 ? (
                            <span className="font-extrabold text-rose-600">
                              {formatBRL(c.saldo_em_aberto)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">R$ 0,00</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Botão Ficha 360 */}
                            <Button
                              variant="dark"
                              size="sm"
                              icon={<FileText size={12} className="text-emerald-400" />}
                              onClick={() => handleAbrirFicha360(c)}
                            >
                              Ficha 360º
                            </Button>

                            {/* Editar */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-slate-700"
                              onClick={() => {
                                setEditando(c);
                                setFormContato({
                                  tipo: c.tipo,
                                  nome: c.nome,
                                  razao_social: c.razao_social || "",
                                  cpf_cnpj: c.cpf_cnpj || "",
                                  email: c.email || "",
                                  telefone: c.telefone || "",
                                  cep: c.cep || "",
                                  endereco: c.endereco || "",
                                  cidade: c.cidade || "",
                                  estado: c.estado || "",
                                  observacoes: c.observacoes || "",
                                });
                                setModalContato(true);
                              }}
                              title="Editar Contato"
                            >
                              <Edit2 size={13} />
                            </Button>

                            {/* Excluir */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => handleDeletar(c.id)}
                              title="Excluir Contato"
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

        {/* Modal 1: Ficha Financeira 360º */}
        <Modal
          isOpen={!!modalFicha}
          onClose={() => setModalFicha(null)}
          title={modalFicha?.nome}
          subtitle={
            modalFicha
              ? `${modalFicha.cpf_cnpj ? `Documento: ${modalFicha.cpf_cnpj} • ` : ""}${
                  modalFicha.cidade ? `${modalFicha.cidade}/${modalFicha.estado}` : "Sem localização"
                }`
              : undefined
          }
          icon={<UserCheck className="text-emerald-600" size={18} />}
          size="lg"
        >
          {modalFicha && (
            <div className="space-y-4">
              {/* KPIs 360 do Cliente */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">
                    Total Já Faturado (LTV)
                  </span>
                  <p className="text-base font-black text-emerald-900 mt-0.5 font-mono">
                    {formatBRL(dadosFicha?.resumo?.total_faturado)}
                  </p>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">
                    Saldo em Aberto (Pendente)
                  </span>
                  <p className="text-base font-black text-rose-900 mt-0.5 font-mono">
                    {formatBRL(dadosFicha?.resumo?.total_pendente)}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">
                    Total Lançamentos
                  </span>
                  <p className="text-base font-black text-slate-900 mt-0.5 font-mono">
                    {dadosFicha?.resumo?.total_lancamentos || 0}
                  </p>
                </div>
              </div>

              {/* Lista de Transações */}
              <div className="overflow-y-auto max-h-[40vh] border rounded-xl border-slate-100">
                {loadingFicha ? (
                  <div className="text-center py-8 text-slate-400 text-xs">Carregando histórico...</div>
                ) : dadosFicha?.transacoes?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Nenhum lançamento vinculado a este contato.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Vencimento</th>
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {dadosFicha?.transacoes?.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            {t.status === "pago" ? (
                              <Badge variant="success">LIQUIDADO</Badge>
                            ) : (
                              <Badge variant="warning">PENDENTE</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-"}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-800">{t.descricao}</td>
                          <td
                            className={`px-3 py-2 text-right font-black font-mono ${
                              t.tipo === "receita" ? "text-emerald-600" : "text-slate-900"
                            }`}
                          >
                            {formatBRL(t.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <Button variant="secondary" onClick={() => setModalFicha(null)}>
                  Fechar Ficha
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal 2: Novo / Editar Contato */}
        <Modal
          isOpen={modalContato}
          onClose={() => setModalContato(false)}
          title={editando ? "Editar Contato" : "Novo Cliente ou Fornecedor"}
          icon={<Users className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarContato} className="space-y-4 text-xs">
            {/* Tipo de Contato */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipo de Cadastro</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "cliente", label: "Cliente" },
                  { key: "fornecedor", label: "Fornecedor" },
                  { key: "ambos", label: "Ambos" },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => setFormContato({ ...formContato, tipo: t.key })}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formContato.tipo === t.key
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CPF / CNPJ com Busca na Receita Federal */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">CPF ou CNPJ</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="00.000.000/0001-00 ou CPF"
                  value={formContato.cpf_cnpj}
                  onChange={(e) => setFormContato({ ...formContato, cpf_cnpj: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <Button
                  type="button"
                  variant="dark"
                  size="sm"
                  loading={buscandoCnpj}
                  icon={<Sparkles size={14} className="text-emerald-400" />}
                  onClick={handleBuscarCnpj}
                  className="shrink-0"
                >
                  Autopreencher CNPJ
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Fantasia / Nome</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ACME Tech Ltda"
                  value={formContato.nome}
                  onChange={(e) => setFormContato({ ...formContato, nome: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Razão Social</label>
                <input
                  type="text"
                  placeholder="Razão Social completa"
                  value={formContato.razao_social}
                  onChange={(e) => setFormContato({ ...formContato, razao_social: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={formContato.telefone}
                  onChange={(e) => setFormContato({ ...formContato, telefone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail Financeiro</label>
                <input
                  type="email"
                  placeholder="financeiro@empresa.com"
                  value={formContato.email}
                  onChange={(e) => setFormContato({ ...formContato, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  placeholder="São Paulo"
                  value={formContato.cidade}
                  onChange={(e) => setFormContato({ ...formContato, cidade: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">UF (Estado)</label>
                <input
                  type="text"
                  maxLength="2"
                  placeholder="SP"
                  value={formContato.estado}
                  onChange={(e) => setFormContato({ ...formContato, estado: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalContato(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Contato
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
