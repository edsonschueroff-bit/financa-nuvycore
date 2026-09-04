import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card } from "../../components/ui";
import { toast } from "sonner";
import {
  LifeBuoy,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Building2,
  ShieldCheck,
  Tag,
  Filter,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Radio,
} from "lucide-react";

export default function SuperChamados() {
  const [chamados, setChamados] = useState([]);
  const [metricas, setMetricas] = useState({});
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [detalhesChamado, setDetalhesChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas");
  const [search, setSearch] = useState("");

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
      const res = await api.get(
        `/suporte/admin/chamados?status=${filtroStatus}&prioridade=${filtroPrioridade}&search=${search}`
      );
      const lista = res.data?.chamados || [];
      setChamados(lista);
      setMetricas(res.data?.metricas || {});
      if (lista.length > 0 && !chamadoSelecionado) {
        setChamadoSelecionado(lista[0]);
      }
    } catch (err) {
      console.error("Erro ao carregar chamados globais:", err);
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

  // Carregamento inicial ao mudar filtros
  useEffect(() => {
    carregarChamados(false);
  }, [filtroStatus, filtroPrioridade, search]);

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
  }, [chamadoSelecionado?.id, filtroStatus, filtroPrioridade, search]);

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
      toast.error(err.response?.data?.error || "Erro ao responder chamado.");
      setNovaMensagem(msgTexto);
    } finally {
      setEnviandoMsg(false);
    }
  };

  const handleAlterarStatus = async (novoStatus) => {
    try {
      await api.patch(`/suporte/chamados/${chamadoSelecionado.id}/status`, {
        status: novoStatus,
      });
      toast.success("Status do chamado atualizado!");
      await carregarDetalhes(chamadoSelecionado.id, true);
      carregarChamados(true);
    } catch (err) {
      toast.error("Erro ao alterar status do chamado.");
    }
  };

  const handleAlterarPrioridade = async (novaPrioridade) => {
    try {
      await api.patch(`/suporte/chamados/${chamadoSelecionado.id}/status`, {
        prioridade: novaPrioridade,
      });
      toast.success("Prioridade do chamado atualizada!");
      await carregarDetalhes(chamadoSelecionado.id, true);
      carregarChamados(true);
    } catch (err) {
      toast.error("Erro ao alterar prioridade.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "aberto":
        return <Badge variant="warning">Aberto</Badge>;
      case "em_atendimento":
        return <Badge variant="primary">Em Atendimento</Badge>;
      case "aguardando_cliente":
        return <Badge variant="info">Aguardando Cliente</Badge>;
      case "resolvido":
        return <Badge variant="success">Resolvido</Badge>;
      case "fechado":
        return <Badge variant="neutral">Fechado</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPrioridadeBadge = (p) => {
    switch (p) {
      case "urgente":
        return <Badge variant="danger">🔴 Urgente</Badge>;
      case "alta":
        return <Badge variant="warning">🟠 Alta</Badge>;
      case "media":
        return <Badge variant="primary">🔵 Média</Badge>;
      case "baixa":
        return <Badge variant="neutral">⚪ Baixa</Badge>;
      default:
        return <Badge variant="neutral">{p}</Badge>;
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
              <LifeBuoy className="text-blue-600" size={24} /> Central de Chamados & Helpdesk SaaS
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gerenciamento e atendimento em tempo real de todos os tickets de suporte abertos pelos assinantes.
            </p>
          </div>
        </div>

        {/* Cards de Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-amber-200 bg-amber-50/40">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Abertos
            </span>
            <h3 className="text-2xl font-black text-amber-900 mt-1 font-mono">
              {metricas.abertos || 0}
            </h3>
          </Card>

          <Card className="p-4 border-blue-200 bg-blue-50/40">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Em Atendimento
            </span>
            <h3 className="text-2xl font-black text-blue-900 mt-1 font-mono">
              {metricas.em_atendimento || 0}
            </h3>
          </Card>

          <Card className="p-4 border-indigo-200 bg-indigo-50/40">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
              Aguardando Cliente
            </span>
            <h3 className="text-2xl font-black text-indigo-900 mt-1 font-mono">
              {metricas.aguardando || 0}
            </h3>
          </Card>

          <Card className="p-4 border-emerald-200 bg-emerald-50/40">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Resolvidos
            </span>
            <h3 className="text-2xl font-black text-emerald-900 mt-1 font-mono">
              {metricas.resolvidos || 0}
            </h3>
          </Card>
        </div>

        {/* Layout Master-Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna 1: Lista de Chamados */}
          <div className="lg:col-span-5 space-y-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar por empresa, código..."
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
                  <option value="todos">Status: Todos</option>
                  <option value="aberto">Abertos</option>
                  <option value="em_atendimento">Em Atendimento</option>
                  <option value="aguardando_cliente">Aguardando Cliente</option>
                  <option value="resolvido">Resolvidos</option>
                </select>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Carregando tickets...</div>
              ) : chamados.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                  <p className="text-xs font-bold text-slate-600">Nenhum chamado pendente</p>
                  <p className="text-[11px] text-slate-400">Todos os tickets foram atendidos!</p>
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
                          <div className="flex items-center gap-1">
                            {getPrioridadeBadge(c.prioridade)}
                            {getStatusBadge(c.status)}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-800">
                          <Building2 size={12} className="text-slate-400" />
                          <span>{c.empresa_nome}</span>
                        </div>

                        <h4 className="font-medium text-slate-900 text-xs mt-0.5 truncate">
                          {c.assunto}
                        </h4>

                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {c.ultima_mensagem || "Sem mensagens"}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100/60 pt-1.5">
                          <span>{c.usuario_nome || "Operador"}</span>
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

          {/* Coluna 2: Chat & Painel de Atendimento do Super Admin */}
          <div className="lg:col-span-7">
            {loadingChat ? (
              <Card className="p-16 text-center space-y-3">
                <RefreshCw className="mx-auto text-blue-600 animate-spin" size={32} />
                <p className="text-xs font-bold text-slate-700">Carregando histórico do chamado...</p>
              </Card>
            ) : chamadoSelecionado && detalhesChamado ? (
              <Card className="p-0 overflow-hidden flex flex-col h-[680px]">
                {/* Header do Chat com Ações Rápidas */}
                <div className="p-4 border-b border-slate-100 bg-white space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {detalhesChamado.chamado.codigo}
                      </span>
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <Building2 size={13} className="text-slate-500" />
                        {detalhesChamado.chamado.empresa_nome}
                      </span>
                      <span className="text-[11px] text-slate-400">• {detalhesChamado.chamado.usuario_nome} ({detalhesChamado.chamado.usuario_email})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Botão de Ação Rápida de Atendimento */}
                      {detalhesChamado.chamado.status === "aberto" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAlterarStatus("em_atendimento")}
                        >
                          ▶ Iniciar Atendimento
                        </Button>
                      )}

                      {detalhesChamado.chamado.status !== "resolvido" && detalhesChamado.chamado.status !== "fechado" && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleAlterarStatus("resolvido")}
                        >
                          ✓ Resolver
                        </Button>
                      )}

                      {detalhesChamado.chamado.status === "resolvido" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAlterarStatus("em_atendimento")}
                        >
                          🔄 Reabrir
                        </Button>
                      )}

                      <select
                        value={detalhesChamado.chamado.status}
                        onChange={(e) => handleAlterarStatus(e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="aberto">Aberto</option>
                        <option value="em_atendimento">Em Atendimento</option>
                        <option value="aguardando_cliente">Aguardando Cliente</option>
                        <option value="resolvido">Resolvido</option>
                        <option value="fechado">Fechado</option>
                      </select>

                      <select
                        value={detalhesChamado.chamado.prioridade}
                        onChange={(e) => handleAlterarPrioridade(e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="baixa">Prioridade: Baixa</option>
                        <option value="media">Prioridade: Média</option>
                        <option value="alta">Prioridade: Alta</option>
                        <option value="urgente">Prioridade: Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      {detalhesChamado.chamado.assunto}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Ao Vivo
                      </span>
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      Categoria: <strong className="text-slate-600">{getCategoriaLabel(detalhesChamado.chamado.categoria)}</strong>
                    </span>
                  </div>
                </div>

                {/* Mensagens do Chat */}
                <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                  {detalhesChamado.mensagens.map((msg) => {
                    const isAdmin = Boolean(msg.is_admin);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                          {isAdmin ? (
                            <>
                              <ShieldCheck size={12} className="text-blue-600" />
                              <strong className="text-blue-700">Você (Super Admin)</strong>
                            </>
                          ) : (
                            <>
                              <User size={12} />
                              <span className="font-bold text-slate-700">{msg.autor_nome || "Cliente"}</span>
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
                              ? "bg-blue-600 text-white shadow-xs rounded-tr-xs"
                              : "bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-tl-xs"
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

                {/* Caixa de Envio de Resposta do Super Admin */}
                <form
                  onSubmit={handleEnviarMensagem}
                  className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Digite sua resposta para o cliente..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={enviandoMsg || !novaMensagem.trim()}
                    icon={<Send size={14} />}
                  >
                    Responder
                  </Button>
                </form>
              </Card>
            ) : (
              <Card className="p-16 text-center text-slate-400 space-y-2">
                <LifeBuoy className="mx-auto text-slate-300" size={40} />
                <p className="text-xs font-bold text-slate-600">Selecione um ticket de suporte à esquerda para atender</p>
                <p className="text-[11px] text-slate-400">Clique em qualquer chamado da lista para abrir o chat de atendimento</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
