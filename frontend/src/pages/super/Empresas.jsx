import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import EmpresaDossieModal from "../../components/super/EmpresaDossieModal";
import {
  Building2,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  X,
  ExternalLink,
  Edit2,
  Lock,
  Unlock,
  Trash2,
  ShieldAlert,
  BarChart3,
} from "lucide-react";

export default function Empresas() {
  const navigate = useNavigate();
  const { switchEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalDossie, setModalDossie] = useState(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const handleAcessarTenant = async (emp) => {
    try {
      const updatedUser = await switchEmpresa(emp.id);
      navigate(`/admin/${updatedUser.empresa_slug || emp.slug}`);
    } catch (err) {
      toast.error("Erro ao alternar para a empresa " + emp.nome);
    }
  };

  const [form, setForm] = useState({
    nome: "",
    razao_social: "",
    cnpj_cpf: "",
    slug: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    plano_saas_id: "",
    status_saas: "ativo",
    trial_dias: 14,
  });

  const [buscandoCnpjSuper, setBuscandoCnpjSuper] = useState(false);
  const [buscandoCepSuper, setBuscandoCepSuper] = useState(false);

  const [formEdit, setFormEdit] = useState({
    id: "",
    nome: "",
    razao_social: "",
    cnpj_cpf: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    plano_saas_id: "",
    status_saas: "ativo",
    limite_filiais: 1,
    limite_usuarios: 5,
  });

  const handleBuscarCnpjSuper = async (cnpj) => {
    const clean = (cnpj || "").replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.warning("Digite os 14 dígitos do CNPJ.");
      return;
    }
    try {
      setBuscandoCnpjSuper(true);
      const res = await api.get(`/empresas/cnpj/${clean}`);
      if (res.data?.sucesso) {
        const d = res.data;
        const slugSugerido = (d.nome_fantasia || d.razao_social || "")
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");

        setForm((prev) => ({
          ...prev,
          cnpj_cpf: clean,
          nome: d.nome_fantasia || d.razao_social || prev.nome,
          razao_social: d.razao_social || prev.razao_social,
          slug: prev.slug || slugSugerido,
          email: d.email || prev.email,
          telefone: d.telefone || prev.telefone,
          cep: d.cep || prev.cep,
          endereco: d.logradouro ? `${d.logradouro}${d.numero ? `, ${d.numero}` : ""}` : prev.endereco,
          cidade: d.cidade || prev.cidade,
          estado: d.estado || prev.estado,
        }));
        toast.success("Dados preenchidos pela Receita!");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "CNPJ não encontrado automaticamente.");
    } finally {
      setBuscandoCnpjSuper(false);
    }
  };

  const handleBuscarCepSuper = async (cep) => {
    const clean = (cep || "").replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      setBuscandoCepSuper(true);
      const res = await api.get(`/empresas/cep/${clean}`);
      if (res.data?.sucesso) {
        setForm((prev) => ({
          ...prev,
          cep: clean,
          endereco: res.data.logradouro || prev.endereco,
          cidade: res.data.cidade || prev.cidade,
          estado: res.data.estado || prev.estado,
        }));
      }
    } catch (err) {
      // silencioso
    } finally {
      setBuscandoCepSuper(false);
    }
  };

  const handleBuscarCnpjEdit = async (cnpj) => {
    const clean = (cnpj || "").replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.warning("Digite os 14 dígitos do CNPJ.");
      return;
    }
    try {
      setBuscandoCnpjSuper(true);
      const res = await api.get(`/empresas/cnpj/${clean}`);
      if (res.data?.sucesso) {
        const d = res.data;
        setFormEdit((prev) => ({
          ...prev,
          cnpj_cpf: clean,
          nome: d.nome_fantasia || d.razao_social || prev.nome,
          razao_social: d.razao_social || prev.razao_social,
          email: d.email || prev.email,
          telefone: d.telefone || prev.telefone,
          cep: d.cep || prev.cep,
          endereco: d.logradouro ? `${d.logradouro}${d.numero ? `, ${d.numero}` : ""}` : prev.endereco,
          cidade: d.cidade || prev.cidade,
          estado: d.estado || prev.estado,
        }));
        toast.success("Dados atualizados pela Receita!");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "CNPJ não encontrado automaticamente.");
    } finally {
      setBuscandoCnpjSuper(false);
    }
  };

  const handleBuscarCepEdit = async (cep) => {
    const clean = (cep || "").replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      setBuscandoCepSuper(true);
      const res = await api.get(`/empresas/cep/${clean}`);
      if (res.data?.sucesso) {
        setFormEdit((prev) => ({
          ...prev,
          cep: clean,
          endereco: res.data.logradouro || prev.endereco,
          cidade: res.data.cidade || prev.cidade,
          estado: res.data.estado || prev.estado,
        }));
      }
    } catch (err) {
      // silencioso
    } finally {
      setBuscandoCepSuper(false);
    }
  };

  const carregar = async () => {
    try {
      setLoading(true);
      const [empRes, plaRes] = await Promise.all([
        api.get("/empresas/todas"),
        api.get("/saas-planos"),
      ]);
      setEmpresas(Array.isArray(empRes.data) ? empRes.data : []);
      setPlanos(Array.isArray(plaRes.data) ? plaRes.data : []);
    } catch (err) {
      console.error("Erro ao listar empresas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleSalvarNovo = async (e) => {
    e.preventDefault();
    try {
      await api.post("/empresas/nova", form);
      toast.success("Empresa cadastrada com sucesso!");
      setModalNovo(false);
      setForm({
        nome: "",
        slug: "",
        email: "",
        telefone: "",
        plano_saas_id: "",
        status_saas: "ativo",
        trial_dias: 14,
      });
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar empresa");
    }
  };

  const abrirEditar = (emp) => {
    setEmpresaSelecionada(emp);
    setFormEdit({
      id: emp.id,
      nome: emp.nome || "",
      razao_social: emp.razao_social || "",
      cnpj_cpf: emp.cnpj_cpf || "",
      email: emp.email || "",
      telefone: emp.telefone || "",
      endereco: emp.endereco || "",
      cidade: emp.cidade || "",
      estado: emp.estado || "",
      cep: emp.cep || "",
      plano_saas_id: emp.plano_saas_id || "",
      status_saas: emp.status_saas || "ativo",
      limite_filiais: emp.limite_filiais || 1,
      limite_usuarios: emp.limite_usuarios || 5,
    });
    setModalEditar(true);
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    if (!empresaSelecionada) return;
    try {
      await api.put(`/empresas/${empresaSelecionada.id}`, formEdit);
      setModalEditar(false);
      toast.success("Dados da empresa atualizados com sucesso!");
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao atualizar dados da empresa");
    }
  };

  const handleEstenderTrial = async (emp, dias = 7) => {
    try {
      await api.post(`/empresas/${emp.id}/estender-trial`, { dias });
      toast.success(`Trial estendido em +${dias} dias!`);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao estender trial");
    }
  };

  const handleAlternarStatus = async (emp) => {
    const novoStatus = emp.status_saas === "bloqueado" ? "ativo" : "bloqueado";
    const ok = await confirm({
      title: novoStatus === "bloqueado" ? "Bloquear Empresa" : "Desbloquear Empresa",
      description: novoStatus === "bloqueado"
        ? `Deseja BLOQUEAR o acesso da empresa "${emp.nome}"? Todos os usuários dessa empresa perderão o acesso ao painel.`
        : `Deseja DESBLOQUEAR e reativar a empresa "${emp.nome}"?`,
      variant: novoStatus === "bloqueado" ? "danger" : "primary",
      confirmText: novoStatus === "bloqueado" ? "Bloquear" : "Desbloquear",
    });

    if (!ok) return;

    try {
      await api.patch(`/empresas/${emp.id}/status`, { status_saas: novoStatus });
      toast.success(`Empresa ${novoStatus === "bloqueado" ? "bloqueada" : "ativada"} com sucesso.`);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao alterar status da empresa");
    }
  };

  const handleExcluir = async (emp) => {
    if (emp.id === 1) {
      toast.warning("A empresa matriz principal (ID 1) não pode ser excluída.");
      return;
    }

    const conf = prompt(`ATENÇÃO: Isso excluirá permanentemente a empresa "${emp.nome}" e todas as suas transações e dados.\n\nPara confirmar, digite o nome da empresa abaixo:`);
    if (conf !== emp.nome) {
      if (conf !== null) toast.error("Nome não confere. Exclusão cancelada.");
      return;
    }

    try {
      await api.delete(`/empresas/${emp.id}`);
      toast.success("Empresa excluída com sucesso.");
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir empresa");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="text-slate-800" size={24} /> Empresas Assinantes
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Tenants ativos, controle de planos, edição, bloqueio de acesso e auditoria.
            </p>
          </div>

          <Button
            variant="dark"
            icon={<Plus size={16} />}
            onClick={() => setModalNovo(true)}
          >
            Nova Empresa Tenant
          </Button>
        </div>

        {/* Tabela de Empresas */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Empresa</th>
                  <th className="px-4 py-3.5">Slug URL</th>
                  <th className="px-4 py-3.5">Contato</th>
                  <th className="px-4 py-3.5">Plano SaaS</th>
                  <th className="px-4 py-3.5">Status & Trial</th>
                  <th className="px-4 py-3.5 text-right">Lançamentos</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Carregando empresas...
                    </td>
                  </tr>
                ) : empresas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Nenhuma empresa cadastrada.
                    </td>
                  </tr>
                ) : (
                  empresas.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>{e.nome}</div>
                        {e.cnpj_cpf && <div className="text-[10px] text-slate-400 font-normal">{e.cnpj_cpf}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{e.slug}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{e.email || "—"}</div>
                        {e.telefone && <div className="text-[10px] text-slate-400">{e.telefone}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{e.plano_nome || "Trial Padrão"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant={
                              e.status_saas === "ativo"
                                ? "success"
                                : e.status_saas === "trial"
                                  ? "info"
                                  : "danger"
                            }
                          >
                            {e.status_saas?.toUpperCase()}
                          </Badge>
                          {e.status_saas === "trial" && e.trial_ate && (
                            <span className="text-[10px] text-amber-700 font-medium">
                              Até {new Date(e.trial_ate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">{e.total_transacoes || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {e.status_saas === "trial" && (
                            <button
                              onClick={() => handleEstenderTrial(e, 7)}
                              title="Estender Trial em +7 dias"
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              +7d Trial
                            </button>
                          )}

                          <button
                            onClick={() => abrirEditar(e)}
                            title="Editar Dados da Empresa"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleAlternarStatus(e)}
                            title={e.status_saas === "bloqueado" ? "Desbloquear Empresa" : "Bloquear Acesso"}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${e.status_saas === "bloqueado"
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-amber-600 hover:bg-amber-50"
                              }`}
                          >
                            {e.status_saas === "bloqueado" ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>

                          <button
                            onClick={() => setModalDossie(e.id)}
                            title="Ver Dossiê 360° (Uso, LTV, Faturas, Suporte)"
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            <BarChart3 size={14} />
                          </button>

                          <button
                            onClick={() => handleAcessarTenant(e)}
                            title="Acessar Painel Financeiro do Tenant"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <ExternalLink size={14} />
                          </button>

                          {e.id !== 1 && (
                            <button
                              onClick={() => handleExcluir(e)}
                              title="Excluir Empresa"
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
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

        {/* Modal: Nova Empresa */}
        <Modal
          isOpen={modalNovo}
          onClose={() => setModalNovo(false)}
          title="Cadastrar Novo Tenant"
          icon={<Building2 className="text-slate-800" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarNovo} className="space-y-4 text-xs">
            {/* CNPJ com Consulta na Receita */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">CNPJ (Opcional - Busca Automática)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj_cpf}
                  onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono"
                />
                <button
                  type="button"
                  disabled={buscandoCnpjSuper}
                  onClick={() => handleBuscarCnpjSuper(form.cnpj_cpf)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  {buscandoCnpjSuper ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Buscar CNPJ
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nome da Empresa / Nome Fantasia *</label>
              <input
                type="text"
                required
                placeholder="Ex: Ótica Alpha, Academia Pro..."
                value={form.nome}
                onChange={(e) => {
                  const n = e.target.value;
                  const s = n.toLowerCase().replace(/[^a-z0-9]/g, "");
                  setForm({ ...form, nome: n, slug: form.slug ? form.slug : s });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Razão Social</label>
              <input
                type="text"
                placeholder="Razão social oficial"
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Slug de Acesso (URL) *</label>
              <input
                type="text"
                required
                placeholder="ex: otica-alpha"
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">
                Endereço: financas.nuvycore.online/admin/<b>{form.slug || "slug"}</b>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail do Responsável</label>
                <input
                  type="email"
                  placeholder="admin@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* Endereço e CEP */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-700 block text-[11px]">Endereço da Empresa</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="text"
                    maxLength="9"
                    placeholder="CEP: 00000-000"
                    value={form.cep}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, cep: v });
                      if (v.replace(/\D/g, "").length === 8) handleBuscarCepSuper(v);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Rua, Avenida, Número..."
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    maxLength="2"
                    placeholder="UF (SP)"
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Plano SaaS</label>
                <select
                  value={form.plano_saas_id}
                  onChange={(e) => setForm({ ...form, plano_saas_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold"
                >
                  <option value="">Plano Padrão / Custom</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (R$ {parseFloat(p.valor || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Inicial</label>
                <select
                  value={form.status_saas}
                  onChange={(e) => setForm({ ...form, status_saas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold"
                >
                  <option value="ativo">Ativo</option>
                  <option value="trial">Trial (Período de Testes)</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalNovo(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="dark"
              >
                Criar Tenant
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Editar Empresa */}
        <Modal
          isOpen={modalEditar}
          onClose={() => setModalEditar(false)}
          title="Editar Dados da Empresa Tenant"
          icon={<Edit2 className="text-slate-800" size={18} />}
          size="lg"
        >
          <form onSubmit={handleSalvarEdicao} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  required
                  value={formEdit.nome}
                  onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Razão Social</label>
                <input
                  type="text"
                  value={formEdit.razao_social}
                  onChange={(e) => setFormEdit({ ...formEdit, razao_social: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">CNPJ / CPF</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={formEdit.cnpj_cpf}
                    onChange={(e) => setFormEdit({ ...formEdit, cnpj_cpf: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono"
                  />
                  {formEdit.cnpj_cpf?.replace(/\D/g, "").length === 14 && (
                    <button
                      type="button"
                      disabled={buscandoCnpjSuper}
                      onClick={() => handleBuscarCnpjEdit(formEdit.cnpj_cpf)}
                      className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1 text-[11px] cursor-pointer shrink-0"
                      title="Preencher dados pela Receita"
                    >
                      <Search size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={formEdit.email}
                  onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={formEdit.telefone}
                  onChange={(e) => setFormEdit({ ...formEdit, telefone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* Endereço da Empresa na Edição */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-700 block text-[11px]">Endereço da Empresa</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="text"
                    maxLength="9"
                    placeholder="CEP: 00000-000"
                    value={formEdit.cep || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormEdit({ ...formEdit, cep: v });
                      if (v.replace(/\D/g, "").length === 8) handleBuscarCepEdit(v);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Rua, Avenida, Número..."
                    value={formEdit.endereco || ""}
                    onChange={(e) => setFormEdit({ ...formEdit, endereco: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={formEdit.cidade || ""}
                    onChange={(e) => setFormEdit({ ...formEdit, cidade: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    maxLength="2"
                    placeholder="UF (SP)"
                    value={formEdit.estado || ""}
                    onChange={(e) => setFormEdit({ ...formEdit, estado: e.target.value.toUpperCase() })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Plano SaaS</label>
                <select
                  value={formEdit.plano_saas_id}
                  onChange={(e) => setFormEdit({ ...formEdit, plano_saas_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold"
                >
                  <option value="">Plano Padrão / Custom</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (R$ {parseFloat(p.valor || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status da Assinatura</label>
                <select
                  value={formEdit.status_saas}
                  onChange={(e) => setFormEdit({ ...formEdit, status_saas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold"
                >
                  <option value="ativo">Ativo (Acesso Liberado)</option>
                  <option value="trial">Trial (Em Período de Testes)</option>
                  <option value="bloqueado">Bloqueado (Acesso Suspenso)</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalEditar(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="dark"
              >
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Dossiê 360° da Empresa */}
        <EmpresaDossieModal
          isOpen={!!modalDossie}
          onClose={() => setModalDossie(null)}
          empresaId={modalDossie}
          onImpersonate={(emp) => {
            setModalDossie(null);
            handleAcessarTenant(emp);
          }}
        />

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
