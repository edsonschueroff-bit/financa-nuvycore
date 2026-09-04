import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Paperclip,
  Check,
  Trash2,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function NotificationDropdown({ basePath = "/admin" }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [resumo, setResumo] = useState(null);
  const dropdownRef = useRef(null);

  const carregarNotificacoes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notificacoes");
      setNotificacoes(res.data?.notificacoes || []);
      setTotalNaoLidas(res.data?.totalNaoLidas || 0);
      setResumo(res.data?.resumo || null);
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotificacoes();
    // Atualizar notificações a cada 60 segundos
    const interval = setInterval(carregarNotificacoes, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarcarLida = async (n) => {
    try {
      if (!n.id.startsWith("rt_")) {
        await api.post(`/notificacoes/${n.id}/marcar-lida`);
      }
      setNotificacoes((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, lida: 1 } : item))
      );
      setTotalNaoLidas((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Erro ao marcar lida:", err);
    }
  };

  const handleMarcarTodasLidas = async () => {
    try {
      await api.post("/notificacoes/marcar-todas-lidas");
      setNotificacoes((prev) => prev.map((item) => ({ ...item, lida: 1 })));
      setTotalNaoLidas(0);
    } catch (err) {
      console.error("Erro ao marcar todas lidas:", err);
    }
  };

  const handleClickItem = (n) => {
    handleMarcarLida(n);
    setIsOpen(false);
    if (n.link) {
      // Ajustar se link for relativo
      if (n.link.startsWith("/admin/contas-pagar")) {
        navigate(`${basePath}/contas-pagar${n.link.replace("/admin/contas-pagar", "")}`);
      } else if (n.link.startsWith("/admin/contas-receber")) {
        navigate(`${basePath}/contas-receber${n.link.replace("/admin/contas-receber", "")}`);
      } else {
        navigate(n.link);
      }
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case "alerta_atraso":
        return <AlertTriangle size={15} className="text-rose-600" />;
      case "vencimento_pagar":
        return <Clock size={15} className="text-amber-600" />;
      case "alerta_receber":
      case "vencimento_receber":
        return <TrendingUp size={15} className="text-emerald-600" />;
      case "whatsapp":
        return <MessageSquare size={15} className="text-emerald-500" />;
      default:
        return <Sparkles size={15} className="text-blue-500" />;
    }
  };

  const getBadgeColor = (tipo) => {
    switch (tipo) {
      case "alerta_atraso":
        return "bg-rose-50 border-rose-200 text-rose-700";
      case "vencimento_pagar":
        return "bg-amber-50 border-amber-200 text-amber-700";
      case "alerta_receber":
      case "vencimento_receber":
        return "bg-emerald-50 border-emerald-200 text-emerald-700";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão de Sino de Notificações */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
        title="Central de Notificações"
      >
        <Bell size={18} />
        {totalNaoLidas > 0 && (
          <>
            <span className="absolute top-1 right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[10px] font-black text-white items-center justify-center">
                {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
              </span>
            </span>
          </>
        )}
      </button>

      {/* Menu Dropdown Suspenso */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-0 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header do Dropdown */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-emerald-400" />
              <span className="font-bold text-xs">Central de Alertas & Notificações</span>
              {totalNaoLidas > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-600 rounded-full text-[10px] font-black">
                  {totalNaoLidas} pendentes
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={carregarNotificacoes}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Atualizar"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Ações Rápidas do Topo */}
          {totalNaoLidas > 0 && (
            <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Avisos financeiros em tempo real</span>
              <button
                type="button"
                onClick={handleMarcarTodasLidas}
                className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Check size={12} /> Marcar lidas
              </button>
            </div>
          )}

          {/* Lista de Notificações */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-2">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-slate-800">Tudo em dia por aqui!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Não há contas atrasadas ou avisos pendentes para hoje.
                </p>
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                    !n.lida ? "bg-slate-50/80 hover:bg-slate-100/90 font-medium" : "bg-white hover:bg-slate-50 opacity-75"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border ${getBadgeColor(
                      n.tipo
                    )}`}
                  >
                    {getIcon(n.tipo)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-bold truncate ${!n.lida ? "text-slate-900" : "text-slate-700"}`}>
                        {n.titulo}
                      </p>
                      {!n.lida && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                      {n.mensagem}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{new Date(n.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      {n.link && (
                        <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                          Ver detalhes <ChevronRight size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer do Dropdown */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Monitoramento Ativo</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(`${basePath}/contas-pagar`);
              }}
              className="text-slate-700 hover:text-emerald-600 font-bold"
            >
              Abrir Tesouraria →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
