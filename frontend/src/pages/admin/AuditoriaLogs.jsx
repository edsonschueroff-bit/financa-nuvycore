import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, Modal } from "../../components/ui";
import { exportToExcel, exportToCsv } from "../../utils/exportHelper";
import {
  Shield,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  Activity,
  AlertTriangle,
  FileText,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Globe,
  Laptop,
} from "lucide-react";

export default function AuditoriaLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [search, setSearch] = useState("");
  const [modulo, setModulo] = useState("");
  const [acao, setAcao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Modal de Detalhes
  const [modalDetalhes, setModalDetalhes] = useState(null);

  const carregarLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 25,
      });
      if (search) params.append("search", search);
      if (modulo) params.append("modulo", modulo);
      if (acao) params.append("acao", acao);
      if (dataInicio) params.append("data_inicio", dataInicio);
      if (dataFim) params.append("data_fim", dataFim);

      const [logsRes, statsRes] = await Promise.all([
        api.get(`/auditoria?${params.toString()}`),
        api.get("/auditoria/estatisticas"),
      ]);

      setLogs(logsRes.data?.data || []);
      setTotalPages(logsRes.data?.meta?.totalPages || 1);
      setTotal(logsRes.data?.meta?.total || 0);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error("Erro ao carregar logs de auditoria:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, [page, modulo, acao, dataInicio, dataFim]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    carregarLogs();
  };

  const handleLimparFiltros = () => {
    setSearch("");
    setModulo("");
    setAcao("");
    setDataInicio("");
    setDataFim("");
    setPage(1);
  };

  const handleExportExcel = () => {
    if (!logs || logs.length === 0) return;
    const rows = logs.map((l) => ({
      "Data e Hora": new Date(l.criado_em).toLocaleString("pt-BR"),
      Usuário: l.usuario_nome || "Sistema",
      Email: l.usuario_email || "—",
      Ação: l.acao,
      Módulo: l.modulo,
      "Registro ID": l.registro_id || "—",
      "IP Origem": l.ip_origem || "—",
      Detalhes: typeof l.detalhes === "object" ? JSON.stringify(l.detalhes) : l.detalhes || "—",
    }));
    exportToExcel(rows, "Trilha_Auditoria_Logs", "Logs");
  };

  const handleExportCsv = () => {
    if (!logs || logs.length === 0) return;
    const rows = logs.map((l) => ({
      "Data/Hora": new Date(l.criado_em).toLocaleString("pt-BR"),
      Usuario: l.usuario_nome || "Sistema",
      Email: l.usuario_email || "—",
      Acao: l.acao,
      Modulo: l.modulo,
      RegistroID: l.registro_id || "—",
      IP: l.ip_origem || "—",
    }));
    exportToCsv(rows, "Trilha_Auditoria_Logs");
  };

  const getAcaoBadge = (acaoNome) => {
    switch (acaoNome) {
      case "CRIAR":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">CRIAR</span>;
      case "EDITAR":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">EDITAR</span>;
      case "BAIXAR":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">BAIXAR</span>;
      case "ESTORNAR":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">ESTORNAR</span>;
      case "EXCLUIR":
      case "EXCLUIR_ANEXO":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">EXCLUIR</span>;
      case "UPLOAD_ANEXO":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">ANEXO</span>;
      case "LOGIN":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">LOGIN</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">{acaoNome}</span>;
    }
  };

  const formatDetalhesResumo = (detalhes) => {
    if (!detalhes) return "—";
    let obj = detalhes;
    if (typeof detalhes === "string") {
      try {
        obj = JSON.parse(detalhes);
      } catch {
        return detalhes;
      }
    }
    if (typeof obj !== "object") return String(obj);

    const parts = [];
    if (obj.descricao) parts.push(`"${obj.descricao}"`);
    if (obj.valor) parts.push(`R$ ${parseFloat(obj.valor).toFixed(2)}`);
    if (obj.valor_pago) parts.push(`Pago R$ ${parseFloat(obj.valor_pago).toFixed(2)}`);
    if (obj.tipo) parts.push(`(${obj.tipo})`);
    if (obj.filename) parts.push(`Arquivo: ${obj.filename}`);
    if (obj.empresa_nome) parts.push(`Empresa: ${obj.empresa_nome}`);

    return parts.length > 0 ? parts.join(" • ") : JSON.stringify(obj).slice(0, 60);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="text-emerald-600" size={24} /> Trilha de Auditoria & Logs
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Rastreabilidade completa de todas as operações, exclusões e acessos realizados no sistema.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={14} className="text-emerald-600" />}
              onClick={handleExportExcel}
              title="Exportar logs para Excel (.XLSX)"
            >
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              title="Exportar logs para CSV"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
              onClick={carregarLogs}
              title="Atualizar Logs"
            >
              Atualizar
            </Button>
          </div>
        </div>

        {/* 4 Cards de Métricas de Auditoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total de Eventos
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                {stats?.totalAcoes || 0}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Histórico auditado
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Activity size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Atividades Hoje
              </span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {stats?.acoesHoje || 0}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Ações nas últimas 24h
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Exclusões / Críticos
              </span>
              <p className="text-xl font-black text-rose-600 mt-1">
                {stats?.acoesCriticas || 0}
              </p>
              <p className="text-[10px] text-rose-700 font-medium mt-0.5">
                Exclusões e estornos
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Usuários Ativos
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                {stats?.totalUsuariosAtivos || 0}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Operadores registrados
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
          </Card>
        </div>

        {/* Barra de Filtros */}
        <Card className="p-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 relative">
              <input
                type="text"
                placeholder="Buscar por usuário, email, IP ou detalhe..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            </div>

            <div>
              <select
                value={modulo}
                onChange={(e) => {
                  setModulo(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todos os Módulos</option>
                <option value="TRANSACOES">Transações Financeiras</option>
                <option value="CONTAS_BANCARIAS">Contas Bancárias</option>
                <option value="CONTATOS">Contatos / Clientes</option>
                <option value="CATEGORIAS">Categorias</option>
                <option value="AUTH">Autenticação & Login</option>
              </select>
            </div>

            <div>
              <select
                value={acao}
                onChange={(e) => {
                  setAcao(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas as Ações</option>
                <option value="CRIAR">Criação (CRIAR)</option>
                <option value="EDITAR">Alteração (EDITAR)</option>
                <option value="BAIXAR">Liquidação (BAIXAR)</option>
                <option value="ESTORNAR">Estorno (ESTORNAR)</option>
                <option value="EXCLUIR">Exclusão (EXCLUIR)</option>
                <option value="UPLOAD_ANEXO">Upload Anexo</option>
                <option value="EXCLUIR_ANEXO">Exclusão Anexo</option>
                <option value="LOGIN">Login no Sistema</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="Data Início"
              />
            </div>

            <div>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="Data Fim"
              />
            </div>
          </form>

          {(search || modulo || acao || dataInicio || dataFim) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Filtros ativos aplicados</span>
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
              >
                Limpar todos os filtros
              </button>
            </div>
          )}
        </Card>

        {/* Tabela Principal de Logs */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Registro Cronológico de Eventos</h3>
              <p className="text-xs text-slate-500">
                Mostrando página {page} de {totalPages} ({total} eventos registrados)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3">Data e Hora</th>
                  <th className="px-4 py-3">Usuário / Operador</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Resumo da Operação</th>
                  <th className="px-4 py-3">IP Origem</th>
                  <th className="px-4 py-3 text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      Carregando trilha de auditoria...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      Nenhum registro de auditoria encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setModalDetalhes(l)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(l.criado_em).toLocaleTimeString("pt-BR")}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {(l.usuario_nome || "U").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{l.usuario_nome || "Sistema"}</p>
                            <p className="text-[10px] text-slate-400 truncate">{l.usuario_email || "—"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {getAcaoBadge(l.acao)}
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-semibold text-[11px]">
                        {l.modulo}
                      </td>

                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate font-mono text-[11px]">
                        {formatDetalhesResumo(l.detalhes)}
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                        {l.ip_origem || "127.0.0.1"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalDetalhes(l);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                          title="Inspecionar Detalhes Técnicos"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  icon={<ChevronLeft size={14} />}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  icon={<ChevronRight size={14} />}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Modal de Detalhes Técnicos do Log */}
        <Modal
          isOpen={!!modalDetalhes}
          onClose={() => setModalDetalhes(null)}
          title="Inspeção Técnica de Evento de Auditoria"
        >
          {modalDetalhes && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Data / Hora</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {new Date(modalDetalhes.criado_em).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Ação / Módulo</span>
                  <span className="font-bold text-slate-800">
                    {modalDetalhes.acao} • {modalDetalhes.modulo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Usuário / Email</span>
                  <span className="font-bold text-slate-800">
                    {modalDetalhes.usuario_nome || "Sistema"} ({modalDetalhes.usuario_email || "—"})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">IP de Origem</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {modalDetalhes.ip_origem || "127.0.0.1"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">User-Agent / Navegador:</label>
                <div className="p-2 bg-slate-900 text-slate-300 font-mono text-[11px] rounded-lg break-all">
                  {modalDetalhes.user_agent || "Desconhecido"}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payload / Metadados da Operação (JSON):</label>
                <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60">
                  <pre>
                    {typeof modalDetalhes.detalhes === "object"
                      ? JSON.stringify(modalDetalhes.detalhes, null, 2)
                      : (() => {
                          try {
                            return JSON.stringify(JSON.parse(modalDetalhes.detalhes), null, 2);
                          } catch {
                            return modalDetalhes.detalhes || "{}";
                          }
                        })()}
                  </pre>
                </div>
              </div>

              <div className="pt-3 flex justify-end border-t border-slate-100">
                <Button variant="secondary" onClick={() => setModalDetalhes(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}
