import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { Sparkles, Check, X, ShieldCheck, Zap, ArrowRight, Phone } from "lucide-react";

export default function TrialModal({ isOpen, onClose, isExpired = false, diasRestantes = 0 }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlano, setSelectedPlano] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const fetchPlanos = async () => {
        try {
          setLoading(true);
          const res = await api.get("/saas-planos");
          const arrayPlanos = Array.isArray(res.data) ? res.data : [];
          setPlanos(arrayPlanos);
          if (arrayPlanos.length > 0) {
            setSelectedPlano(arrayPlanos[0]);
          }
        } catch (e) {
          console.error("Erro ao carregar planos:", e);
        } finally {
          setLoading(false);
        }
      };
      fetchPlanos();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative">
          {!isExpired && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs text-amber-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-200">
                {isExpired ? "Período de Teste Concluído" : "Upgrade de Plano"}
              </span>
              <h2 className="text-xl font-extrabold text-white">
                {isExpired
                  ? "Seu período de teste gratuito expirou"
                  : `Você tem ${diasRestantes} dias restantes de Teste Gratuito`}
              </h2>
            </div>
          </div>
          <p className="text-xs text-emerald-100 max-w-xl">
            {isExpired
              ? "Escolha um plano abaixo para desbloquear o acesso total e continuar acelerando a gestão financeira da sua empresa."
              : "Garanta a continuidade de todos os recursos avançados, Copiloto IA WhatsApp e relatórios DRE em tempo real."}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando planos disponíveis...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {planos.map((p) => {
                const isSelected = selectedPlano?.id === p.id;
                let recursos = [];
                try {
                  recursos = typeof p.recursos === "string" ? JSON.parse(p.recursos) : p.recursos || [];
                } catch {
                  recursos = ["Copiloto IA no WhatsApp", "DRE em Tempo Real", "Contas a Pagar/Receber"];
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlano(p)}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between cursor-pointer ${isSelected
                        ? "border-emerald-600 bg-emerald-50/40 ring-4 ring-emerald-500/10 shadow-md"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 text-base">{p.nome}</h3>
                        {isSelected && (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                            Selecionado
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <span className="text-2xl font-extrabold text-slate-900">
                          {formatBRL(p.valor)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium"> /mês</span>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 font-medium">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Até {p.max_usuarios || 5} usuários</span>
                        </div>
                        <div className="flex items-center gap-2 font-medium">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Até {p.max_filiais || 1} filial</span>
                        </div>
                        {recursos.map((rec, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`w-full mt-5 py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isSelected
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                      {isSelected ? "Plano Selecionado" : "Escolher este"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Destaque PIX & Contratação */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Ativação Imediata via WhatsApp / PIX</h4>
                <p className="text-xs text-slate-500">
                  Fale com a nossa equipe para emissão da fatura ou chave PIX instantânea.
                </p>
              </div>
            </div>

            <a
              href="https://wa.me/5567992553089?text=Ol%C3%A1!%20Gostaria%20de%20assinar%20o%20plano%20do%20Nuvy%20Finance."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Phone className="w-4 h-4" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
