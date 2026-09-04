import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  LifeBuoy,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  ShieldCheck,
  Tag,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Radio,
} from "lucide-react";

export default function ChamadosSuporte() {
  const { user } = useAuth();
  const [chamados, setChamados] = useState([]);
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [detalhesChamado, setDetalhesChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Modal Novo Chamado
  const [modalNovo, setModalNovo] = useState(false);
  const [novoForm, setNovoForm] = useState({
    assunto: "",
    categoria: "duvida",
    prioridade: "media",
    mensagem: "",
  });
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // Chat / Nova Mensagem
  const [novaMensagem, setNovaMensagem] = useState("");
  const [enviandoMsg, setEnviandoMsg] = useState(false);

  // Ref para auto-scroll interno no container de mensagens
  const chatContainerRef = useRef(null);
  const chatEndRef = useRef(null);

  const scrollToBottom = (behavior = "smooth") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const carregarChamados = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/suporte/chamados?status=${filtroStatus}&search=${search}`);
      const lista = res.data?.chamados || [];
      setChamados(lista);
      if (lista.length > 0 && !chamadoSelecionado) {
        setChamadoSelecionado(lista[0]);
      }
    } catch (err) {
      console.error("Erro ao carregar chamados:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const carregarDetalhes = async (id, silent = false) => {
    try {
      if (!silent) setLoadingChat(true);
      const res = await api.get(`/suporte/chamados/${id}`);
      setDetalhesChamado(res.data);
    } catch (err) {
      console.error("Erro ao carregar detalhes do chamado:", err);
    } finally {
      if (!silent) setLoadingChat(false);
    }
  };

  // Carregamento inicial
  useEffect(() => {
    carregarChamados(false);
  }, [filtroStatus, search]);

  // Carregar detalhes ao selecionar chamado
  useEffect(() => {
    if (chamadoSelecionado?.id) {
      carregarDetalhes(chamadoSelecionado.id, false);
    }
  }, [chamadoSelecionado?.id]);

  // Auto-scroll sempre que chegarem novas mensagens
  useEffect(() => {
    if (detalhesChamado?.mensagens) {
      scrollToBottom("smooth");
    }
  }, [detalhesChamado?.mensagens?.length]);

  // Polling automático e silencioso a cada 3.5s (Tempo Real sem F5)
  useEffect(() => {
    const interval = setInterval(() => {
      if (chamadoSelecionado?.id) {
        carregarDetalhes(chamadoSelecionado.id, true);
      }
      carregarChamados(true);
    }, 3500);

    return () => clearInterval(interval);
  }, [chamadoSelecionado?.id, filtroStatus, search]);

  const handleCriarChamado = async (e) => {
    e.preventDefault();
    try {
      setSalvandoNovo(true);
      const res = await api.post("/suporte/chamados", novoForm);
      setModalNovo(false);
      setNovoForm({ assunto: "", categoria: "duvida", prioridade: "media", mensagem: "" });
      toast.success("Chamado de suporte aberto com sucesso! Nossa equipe responderá em breve.");
      carregarChamados(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao abrir chamado.");
    } finally {
      setSalvandoNovo(false);
    }
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !chamadoSelecionado) return;
    const msgTexto = novaMensagem.trim();
    try {
      setEnviandoMsg(true);
      setNovaMensagem("");
      await api.post(`/suporte/chamados/${chamadoSelecionado.id}/mensagens`, {
        mensagem: msgTexto,
      });
      await carregarDetalhes(chamadoSelecionado.id, true);
      carregarChamados(true);
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao enviar resposta.");
      setNovaMensagem(msgTexto);
    } finally {
      setEnviandoMsg(false);
    }
  };

  const handleResolverChamado = async () => {
    const ok = await confirm({
      title: "Finalizar Chamado",
      description: "Deseja marcar este chamado como resolvido?",
      variant: "primary",
      confirmText: "Marcar como Resolvido",
    });
    if (!ok) return;

    try {
      await api.patch(`/suporte/chamados/${chamadoSelecionado.id}/status`, {
        status: "resolvido",
      });
      toast.success("Chamado marcado como resolvido!");
      await carregarDetalhes(chamadoSelecionado.id, true);
      carregarChamados(true);
    } catch (err) {
      toast.error("Erro ao finalizar chamado.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "aberto":
        return <Badge variant="warning">Aberto</Badge>;
      case "em_atendimento":
        return <Badge variant="primary">Em Atendimento</Badge>;
      case "aguardando_cliente":
        return <Badge variant="info">Resposta Disponível</Badge>;
      case "resolvido":
        return <Badge variant="success">Resolvido</Badge>;
      case "fechado":
        return <Badge variant="neutral">Fechado</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getCategoriaLabel = (cat) => {
    const map = {
      duvida: "Dúvida Geral",
      financeiro: "Faturamento & Planos",
      bug: "Instabilidade / Erro",
      melhoria: "Sugestão de Recurso",
      outro: "Outro Assunto",
    };
    return map[cat] || cat;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LifeBuoy className="text-blue-600" size={24} /> Central de Ajuda & Suporte
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Abra chamados técnicos, tire dúvidas operacionais e acompanhe suas solicitações com o suporte oficial.
            </p>
          </div>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setModalNovo(true)}
          >
            Novo Chamado
          </Button>
        </div>

        {/* Layout Master-Detail (Lista de Chamados à esquerda e Chat à direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna 1: Lista de Chamados */}
          <div className="lg:col-span-5 space-y-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar ticket..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="aberto">Abertos</option>
                  <option value="em_atendimento">Em Atendimento</option>
                  <option value="resolvido">Resolvidos</option>
                </select>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Carregando chamados...</div>
              ) : chamados.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <MessageSquare className="mx-auto text-slate-300" size={32} />
                  <p className="text-xs font-bold text-slate-600">Nenhum chamado encontrado</p>
                  <p className="text-[11px] text-slate-400">
                    Clique em "+ Novo Chamado" para abrir uma solicitação.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {chamados.map((c) => {
                    const isSel = chamadoSelecionado?.id === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setChamadoSelecionado(c)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSel
                            ? "bg-blue-50/70 border-blue-400 shadow-xs"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-blue-600">
                            {c.codigo}
                          </span>
                          {getStatusBadge(c.status)}
                        </div>

                        <h4 className="font-bold text-slate-900 text-xs mt-1 truncate">
                          {c.assunto}
                        </h4>

                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {c.ultima_mensagem || "Sem mensagens"}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100/60 pt-1.5">
                          <span className="font-medium">{getCategoriaLabel(c.categoria)}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(c.atualizado_em).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Coluna 2: Chat & Histórico do Chamado */}
          <div className="lg:col-span-7">
            {chamadoSelecionado && detalhesChamado ? (
              <Card className="p-0 overflow-hidden flex flex-col h-[680px]">
                {/* Header do Chat */}
                <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {detalhesChamado.chamado.codigo}
                      </span>
                      {getStatusBadge(detalhesChamado.chamado.status)}
                      <span className="text-[11px] font-semibold text-slate-500">
                        • {getCategoriaLabel(detalhesChamado.chamado.categoria)}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">
                      {detalhesChamado.chamado.assunto}
                    </h3>
                  </div>

                  {detalhesChamado.chamado.status !== "resolvido" && detalhesChamado.chamado.status !== "fechado" && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<CheckCircle2 size={13} className="text-emerald-600" />}
                      onClick={handleResolverChamado}
                    >
                      Marcar Resolvido
                    </Button>
                  )}
                </div>

                {/* Mensagens do Chat */}
                <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                  {detalhesChamado.mensagens.map((msg) => {
                    const isAdmin = Boolean(msg.is_admin);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? "items-start" : "items-end"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                          {isAdmin ? (
                            <>
                              <ShieldCheck size={12} className="text-blue-600" />
                              <strong className="text-blue-700">Suporte Nuvy Finance</strong>
                            </>
                          ) : (
                            <>
                              <User size={12} />
                              <span>{msg.autor_nome || "Você"}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {new Date(msg.criado_em).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isAdmin
                              ? "bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-tl-xs"
                              : "bg-blue-600 text-white shadow-xs rounded-tr-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.mensagem}</p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Elemento de ancoragem para auto-scroll suave */}
                  <div ref={chatEndRef} />
                </div>

                {/* Caixa de Envio de Resposta */}
                {detalhesChamado.chamado.status === "resolvido" || detalhesChamado.chamado.status === "fechado" ? (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border-t border-emerald-200 text-center text-xs font-bold">
                    ✅ Este chamado foi marcado como concluído. Para novas dúvidas, abra um novo chamado.
                  </div>
                ) : (
                  <form
                    onSubmit={handleEnviarMensagem}
                    className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Escreva sua resposta..."
                      value={novaMensagem}
                      onChange={(e) => setNovaMensagem(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={enviandoMsg || !novaMensagem.trim()}
                      icon={<Send size={14} />}
                    >
                      Enviar
                    </Button>
                  </form>
                )}
              </Card>
            ) : (
              <Card className="p-12 text-center text-slate-400 space-y-2">
                <LifeBuoy className="mx-auto text-slate-300" size={40} />
                <p className="text-xs font-bold text-slate-600">Selecione um chamado para visualizar a conversa</p>
              </Card>
            )}
          </div>
        </div>

        {/* Modal: Novo Chamado */}
        <Modal
          isOpen={modalNovo}
          onClose={() => setModalNovo(false)}
          title="Abrir Novo Chamado de Suporte"
          icon={<LifeBuoy className="text-blue-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleCriarChamado} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Assunto / Título Resumido</label>
              <input
                type="text"
                required
                placeholder="Ex: Dúvida sobre conciliação bancária..."
                value={novoForm.assunto}
                onChange={(e) => setNovoForm({ ...novoForm, assunto: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Categoria</label>
                <select
                  value={novoForm.categoria}
                  onChange={(e) => setNovoForm({ ...novoForm, categoria: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="duvida">Dúvida Geral de Uso</option>
                  <option value="financeiro">Faturamento / Meu Plano</option>
                  <option value="bug">Relatar Erro / Bug</option>
                  <option value="melhoria">Sugestão de Recurso</option>
                  <option value="outro">Outro Assunto</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prioridade</label>
                <select
                  value={novoForm.prioridade}
                  onChange={(e) => setNovoForm({ ...novoForm, prioridade: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="baixa">Baixa (Dúvida comum)</option>
                  <option value="media">Média (Impacto parcial)</option>
                  <option value="alta">Alta (Impacta operação)</option>
                  <option value="urgente">Urgente (Sistema inoperante)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Descrição Detalhada</label>
              <textarea
                rows={5}
                required
                placeholder="Descreva com detalhes o que você precisa ou o que aconteceu..."
                value={novoForm.mensagem}
                onChange={(e) => setNovoForm({ ...novoForm, mensagem: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalNovo(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={salvandoNovo}>
                {salvandoNovo ? "Enviando..." : "Abrir Chamado"}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
