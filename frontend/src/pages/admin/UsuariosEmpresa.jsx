import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Lock,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmDialog } from "../../components/ui";

export default function UsuariosEmpresa() {
  const { empresaSlug } = useParams();
  const { user } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [modulosDisponiveis, setModulosDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    cargo: "Colaborador",
    senha: "",
    role: "operador",
    permissoes: [],
    ativo: true,
  });

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      const res = await api.get("/usuarios");
      setUsuarios(Array.isArray(res.data.usuarios) ? res.data.usuarios : []);
      setModulosDisponiveis(Array.isArray(res.data.modulos_disponiveis) ? res.data.modulos_disponiveis : []);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, [empresaSlug]);

  const handleOpenModal = (usuario = null) => {
    setErrorMsg("");
    setShowPassword(false);
    if (usuario) {
      setEditingUser(usuario);
      setFormData({
        nome: usuario.nome || "",
        email: usuario.email || "",
        telefone: usuario.telefone || "",
        cargo: usuario.cargo || "Colaborador",
        senha: "",
        role: usuario.role || "operador",
        permissoes: usuario.permissoes || [],
        ativo: Boolean(usuario.ativo),
      });
    } else {
      setEditingUser(null);
      setFormData({
        nome: "",
        email: "",
        telefone: "",
        cargo: "Assistente Financeiro",
        senha: "",
        role: "operador",
        permissoes: ["dashboard", "receber", "pagar", "contas", "contatos", "categorias"],
        ativo: true,
      });
    }
    setModalOpen(true);
  };

  const handleRoleChange = (selectedRole) => {
    let perms = [];
    if (selectedRole === "proprietario") {
      perms = modulosDisponiveis.map((m) => m.key);
    } else if (selectedRole === "gerente_financeiro") {
      perms = modulosDisponiveis.filter((m) => m.key !== "usuarios").map((m) => m.key);
    } else if (selectedRole === "operador") {
      perms = ["dashboard", "receber", "pagar", "contas", "contatos", "categorias"];
    } else if (selectedRole === "contador") {
      perms = ["dashboard", "dre", "conciliacao", "contas", "categorias"];
    } else if (selectedRole === "visualizador") {
      perms = ["dashboard", "dre"];
    } else if (selectedRole === "personalizado") {
      perms = formData.permissoes.length > 0 ? formData.permissoes : ["dashboard"];
    }

    setFormData((prev) => ({
      ...prev,
      role: selectedRole,
      permissoes: perms,
    }));
  };

  const togglePermission = (modKey) => {
    setFormData((prev) => {
      const exists = prev.permissoes.includes(modKey);
      const newPerms = exists
        ? prev.permissoes.filter((k) => k !== modKey)
        : [...prev.permissoes, modKey];
      return {
        ...prev,
        role: "personalizado",
        permissoes: newPerms,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSaving(true);

    try {
      if (editingUser) {
        await api.put(`/usuarios/${editingUser.id}`, formData);
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await api.post("/usuarios", formData);
        toast.success("Novo usuário cadastrado com sucesso!");
      }
      setModalOpen(false);
      await carregarUsuarios();
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao salvar usuário.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (usuario) => {
    try {
      await api.put(`/usuarios/${usuario.id}`, {
        ativo: !usuario.ativo,
      });
      toast.success(
        usuario.ativo
          ? `Usuário ${usuario.nome} desativado.`
          : `Usuário ${usuario.nome} ativado com sucesso.`
      );
      await carregarUsuarios();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao alterar status do usuário.");
    }
  };

  const handleDeleteUser = async (usuario) => {
    const ok = await confirm({
      title: "Desvincular Usuário",
      description: `Tem certeza que deseja desvincular o usuário "${usuario.nome}" desta empresa? Ele perderá o acesso imediato ao painel.`,
      confirmText: "Desvincular",
      variant: "danger",
    });

    if (!ok) return;

    try {
      await api.delete(`/usuarios/${usuario.id}`);
      toast.success("Usuário desvinculado com sucesso.");
      await carregarUsuarios();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao remover usuário.");
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "proprietario":
        return {
          label: "Proprietário (Admin)",
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: ShieldCheck,
        };
      case "gerente_financeiro":
        return {
          label: "Gerente Financeiro",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: Shield,
        };
      case "operador":
        return {
          label: "Operador Financeiro",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: Briefcase,
        };
      case "contador":
        return {
          label: "Contador / Auditor",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Eye,
        };
      case "visualizador":
        return {
          label: "Visualizador",
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          icon: Eye,
        };
      default:
        return {
          label: "Personalizado",
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: Sparkles,
        };
    }
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.cargo && u.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalAtivos = usuarios.filter((u) => u.ativo).length;
  const totalAdmins = usuarios.filter((u) => u.role === "proprietario" || u.role === "gerente_financeiro").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Equipe & Usuários</h1>
                <p className="text-sm text-slate-500">
                  Gerencie os membros da equipe e defina o que cada colaborador pode ver e acessar.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-xs transition-colors text-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total de Membros
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{usuarios.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Usuários Ativos
              </span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{totalAtivos}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                Gestores & Admins
              </span>
              <p className="text-2xl font-bold text-indigo-700 mt-1">{totalAdmins}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tabela de Usuários */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <span className="text-xs text-slate-500">
              Exibindo <strong>{filteredUsuarios.length}</strong> de {usuarios.length}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Carregando equipe...
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-700">Nenhum usuário encontrado</p>
              <p className="text-sm text-slate-400 mt-1">
                Clique em "+ Novo Usuário" para convidar o primeiro colaborador.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">Cargo / Função</th>
                    <th className="px-6 py-4">Perfil & Permissões</th>
                    <th className="px-6 py-4">WhatsApp Copiloto</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsuarios.map((u) => {
                    const badge = getRoleBadge(u.role);
                    const Icon = badge.icon;
                    const isMe = user?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                              {u.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-2">
                                {u.nome}
                                {isMe && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-medium">
                                    Você
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3" />
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-800">{u.cargo}</span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.bg}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {u.role === "proprietario"
                                ? "Acesso total aos 14 módulos"
                                : `${(Array.isArray(u.permissoes) ? u.permissoes : []).length} módulos liberados`}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {u.telefone ? (
                            <div className="flex items-center gap-1 text-slate-700 font-mono text-xs">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              {u.telefone}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Não informado</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={u.role === "proprietario" && isMe}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${u.ativo
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                              }`}
                          >
                            {u.ativo ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Inativo
                              </>
                            )}
                          </button>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(u)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Editar Usuário"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!(u.role === "proprietario" && isMe) && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remover Acesso"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Criação / Edição */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      {editingUser ? "Editar Membro da Equipe" : "Adicionar Novo Usuário"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Defina as informações de acesso e permissões na empresa.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {/* Dados Pessoais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="Ex: Carlos Eduardo Silva"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail de Acesso *
                    </label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(editingUser)}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden ${editingUser ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                        }`}
                      placeholder="carlos@empresa.com.br"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cargo na Empresa
                    </label>
                    <input
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="Ex: Gerente Financeiro, Analista"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefone WhatsApp (Copiloto IA)
                    </label>
                    <input
                      type="text"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="(67) 99999-9999"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser ? "Nova Senha (deixe em branco para não alterar)" : "Senha de Acesso *"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editingUser}
                      minLength={6}
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="w-full px-3.5 py-2 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder={editingUser ? "••••••••" : "Mínimo 6 caracteres"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Perfil de Acesso */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Perfil de Acesso & Nível de Permissão
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: "proprietario",
                        title: "Administrador",
                        desc: "Acesso total a tudo",
                        icon: ShieldCheck,
                      },
                      {
                        id: "gerente_financeiro",
                        title: "Gerente",
                        desc: "Tudo exceto gestão de usuários",
                        icon: Shield,
                      },
                      {
                        id: "operador",
                        title: "Operador",
                        desc: "Contas, Caixas e Contatos",
                        icon: Briefcase,
                      },
                      {
                        id: "contador",
                        title: "Contador",
                        desc: "DRE, Conciliação e Extratos",
                        icon: Eye,
                      },
                      {
                        id: "visualizador",
                        title: "Visualizador",
                        desc: "Apenas leitura de relatórios",
                        icon: Eye,
                      },
                      {
                        id: "personalizado",
                        title: "Personalizado",
                        desc: "Escolha módulo por módulo",
                        icon: Sparkles,
                      },
                    ].map((p) => {
                      const isSelected = formData.role === p.id;
                      const PIcon = p.icon;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleRoleChange(p.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                            ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <PIcon
                              className={`w-4 h-4 ${isSelected ? "text-emerald-600" : "text-slate-400"
                                }`}
                            />
                            {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <div className="font-semibold text-xs text-slate-900 mt-2">{p.title}</div>
                          <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            {p.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid de Permissões Personalizadas */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Módulos Liberados ({formData.permissoes.length} de {modulosDisponiveis.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Clique para alternar permissão
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {modulosDisponiveis.map((m) => {
                      const isChecked = formData.permissoes.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          onClick={() => togglePermission(m.key)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border cursor-pointer select-none transition-colors ${isChecked
                            ? "bg-white border-emerald-500 text-emerald-800 shadow-2xs"
                            : "bg-slate-100/80 border-transparent text-slate-400 hover:bg-slate-200/60"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => { }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          <span className="truncate">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : editingUser ? "Atualizar Usuário" : "Cadastrar Usuário"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
