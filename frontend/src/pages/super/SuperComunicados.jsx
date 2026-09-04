import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  AlertTriangle,
  Sparkles,
  Info,
  CheckCircle2,
  X,
  Radio,
  Eye,
} from "lucide-react";

export default function SuperComunicados() {
  const [comunicados, setComunicados] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Modal Novo/Editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    titulo: "",
    mensagem: "",
    tipo: "novidade",
    destinatarios: "todas",
    plano_id: "",
    empresa_id: "",
    ativo: 1,
    data_inicio: new Date().toISOString().split("T")[0],
    data_fim: "",
  });
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [comRes, empRes, planRes] = await Promise.all([
        api.get("/comunicados/admin"),
        api.get("/empresas/todas"),
        api.get("/saas-planos"),
      ]);
      setComunicados(comRes.data?.comunicados || []);
      setEmpresas(Array.isArray(empRes.data) ? empRes.data : []);
      setPlanos(Array.isArray(planRes.data) ? planRes.data : []);
    } catch (err) {
      console.error("Erro ao carregar comunicados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      setSalvando(true);
      if (editandoId) {
        await api.put(`/comunicados/admin/${editandoId}`, form);
      } else {
        await api.post("/comunicados/admin", form);
      }
      setModalAberto(false);
      toast.success(editandoId ? "Comunicado atualizado com sucesso!" : "Comunicado publicado com sucesso!");
      setForm({
        titulo: "",
        mensagem: "",
        tipo: "novidade",
        destinatarios: "todas",
        plano_id: "",
        empresa_id: "",
        ativo: 1,
        data_inicio: new Date().toISOString().split("T")[0],
        data_fim: "",
      });
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar comunicado.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    const ok = await confirm({
      title: "Excluir Comunicado",
      description: "Deseja realmente excluir este comunicado?",
      variant: "danger",
      confirmText: "Excluir",
    });
    if (!ok) return;

    try {
      await api.delete(`/comunicados/admin/${id}`);
      toast.success("Comunicado excluído com sucesso.");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao excluir comunicado.");
    }
  };

  const handleToggleAtivo = async (c) => {
    try {
      await api.put(`/comunicados/admin/${c.id}`, {
        ...c,
        ativo: c.ativo ? 0 : 1,
      });
      toast.success(c.ativo ? "Comunicado desativado." : "Comunicado ativado.");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao alternar status.");
    }
  };

  const getTipoBadge = (tipo) => {
    switch (tipo) {
      case "urgente":
        return <Badge variant="danger">🔴 Urgente / Bloqueio</Badge>;
      case "aviso":
        return <Badge variant="warning">⚠️ Aviso Importante</Badge>;
      case "novidade":
        return <Badge variant="info">🚀 Novidade / Atualização</Badge>;
      case "info":
      default:
        return <Badge variant="primary">ℹ️ Informativo</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="text-indigo-600" size={24} /> Banners & Comunicados Globais
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Dispare avisos no topo do painel de todas as empresas ou de planos específicos (manutenção, novidades, etc).
            </p>
          </div>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditandoId(null);
              setForm({
                titulo: "",
                mensagem: "",
                tipo: "novidade",
                destinatarios: "todas",
                plano_id: "",
                empresa_id: "",
                ativo: 1,
                data_inicio: new Date().toISOString().split("T")[0],
                data_fim: "",
              });
              setModalAberto(true);
            }}
          >
            Criar Comunicado
          </Button>
        </div>

        {/* Lista de Comunicados */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Tipo & Título</th>
                  <th className="px-4 py-3">Público-Alvo</th>
                  <th className="px-4 py-3">Vigência</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      Carregando comunicados...
                    </td>
                  </tr>
                ) : comunicados.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      Nenhum comunicado cadastrado no momento.
                    </td>
                  </tr>
                ) : (
                  comunicados.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {getTipoBadge(c.tipo)}
                            <strong className="text-slate-900 text-xs">{c.titulo}</strong>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{c.mensagem}</p>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {c.destinatarios === "todas" ? (
                          <span className="font-bold text-slate-900">🌐 Todas as Empresas</span>
                        ) : c.destinatarios === "plano_especifico" ? (
                          <span>Plano: <strong>{c.plano_nome || "—"}</strong></span>
                        ) : (
                          <span>Empresa: <strong>{c.empresa_nome || "—"}</strong></span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "Imediato"}
                        {c.data_fim ? ` até ${new Date(c.data_fim).toLocaleDateString("pt-BR")}` : " (Sem expiração)"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(c)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            c.ativo
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {c.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoId(c.id);
                              setForm({
                                titulo: c.titulo,
                                mensagem: c.mensagem,
                                tipo: c.tipo,
                                destinatarios: c.destinatarios,
                                plano_id: c.plano_id || "",
                                empresa_id: c.empresa_id || "",
                                ativo: c.ativo,
                                data_inicio: c.data_inicio ? c.data_inicio.split("T")[0] : "",
                                data_fim: c.data_fim ? c.data_fim.split("T")[0] : "",
                              });
                              setModalAberto(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal Novo / Editar Comunicado */}
        <Modal
          isOpen={modalAberto}
          onClose={() => setModalAberto(false)}
          title={editandoId ? "Editar Comunicado" : "Criar Novo Comunicado"}
          icon={<Megaphone className="text-indigo-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvar} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Título do Banner</label>
              <input
                type="text"
                required
                placeholder="Ex: Manutenção Programada / Nova Versão 2.0 Liberada!"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Comunicado</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="novidade">🚀 Novidade / Atualização</option>
                  <option value="aviso">⚠️ Aviso / Alerta</option>
                  <option value="urgente">🔴 Urgente / Manutenção</option>
                  <option value="info">ℹ️ Informativo Geral</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destinatários</label>
                <select
                  value={form.destinatarios}
                  onChange={(e) => setForm({ ...form, destinatarios: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="todas">🌐 Todas as Empresas (Geral)</option>
                  <option value="plano_especifico">📦 Plano Específico</option>
                  <option value="empresa_especifica">🏢 Empresa Específica</option>
                </select>
              </div>
            </div>

            {form.destinatarios === "plano_especifico" && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Selecione o Plano</label>
                <select
                  required
                  value={form.plano_id}
                  onChange={(e) => setForm({ ...form, plano_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="">Selecione o plano...</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {form.destinatarios === "empresa_especifica" && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Selecione a Empresa</label>
                <select
                  required
                  value={form.empresa_id}
                  onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="">Selecione a empresa...</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nome} ({emp.slug})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mensagem do Comunicado</label>
              <textarea
                rows={3}
                required
                placeholder="Escreva a mensagem completa que será exibida para os usuários..."
                value={form.mensagem}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Data Início (Exibição)</label>
                <input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data Fim (Expiração)</label>
                <input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Pré-Visualização do Banner */}
            <div className="pt-2">
              <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                Pré-visualização do Banner no Painel do Cliente:
              </label>
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  form.tipo === "urgente"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : form.tipo === "aviso"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : form.tipo === "novidade"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                {form.tipo === "urgente" ? (
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                ) : form.tipo === "novidade" ? (
                  <Sparkles className="text-indigo-600 shrink-0 mt-0.5" size={16} />
                ) : (
                  <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />
                )}
                <div>
                  <strong className="font-bold">{form.titulo || "Título do Comunicado"}</strong>
                  <p className="text-[11px] mt-0.5 opacity-90">{form.mensagem || "Mensagem de demonstração..."}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={salvando}>
                {salvando ? "Publicando..." : "Publicar Comunicado"}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
