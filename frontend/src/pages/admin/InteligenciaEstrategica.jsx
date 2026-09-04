import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import {
  BrainCircuit,
  Clock,
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Layers,
  Users,
  ChevronRight,
  Info,
} from "lucide-react";

export default function InteligenciaEstrategica() {
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [abaAtiva, setAbaAtiva] = useState("capital-giro"); // capital-giro | curva-abc
  const [dadosGiro, setDadosGiro] = useState(null);
  const [dadosAbc, setDadosAbc] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [giroRes, abcRes] = await Promise.all([
        api.get(`/inteligencia/capital-giro?ano=${ano}`),
        api.get(`/inteligencia/curva-abc?ano=${ano}`),
      ]);
      setDadosGiro(giroRes.data);
      setDadosAbc(abcRes.data);
    } catch (err) {
      console.error("Erro ao carregar inteligência financeira:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [ano]);

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BrainCircuit className="text-emerald-600" size={26} /> Inteligência Estratégica & Diagnósticos
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Ciclos Financeiros, Prazos Médios (PMR/PMP), Caixa Mínimo e Princípio de Pareto (Curva ABC 80/20).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
            >
              <option value="2026">Ano 2026</option>
              <option value="2025">Ano 2025</option>
              <option value="2024">Ano 2024</option>
            </select>
          </div>
        </div>

        {/* Navegação de Abas Estratégicas */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setAbaAtiva("capital-giro")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === "capital-giro"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Clock size={15} className={abaAtiva === "capital-giro" ? "text-emerald-400" : ""} />
            Capital de Giro & Prazos Médios (NCG)
          </button>

          <button
            onClick={() => setAbaAtiva("curva-abc")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === "curva-abc"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <PieChart size={15} className={abaAtiva === "curva-abc" ? "text-emerald-400" : ""} />
            Curva ABC (Regra 80/20 de Pareto)
          </button>
        </div>

        {/* =========================================================================
            ABA 1: CAPITAL DE GIRO & PRAZOS MÉDIOS (NCG)
           ========================================================================= */}
        {abaAtiva === "capital-giro" && (
          <div className="space-y-4">
            {/* Cards Executivos de Ciclos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* PMR */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                  PMR - PRAZO MÉDIO RECEBIMENTO
                </span>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {dadosGiro?.pmr_dias || 0} <span className="text-sm font-normal text-slate-400">dias</span>
                </p>
                <span className="text-[10px] text-slate-500">Tempo médio que seus clientes levam para pagar</span>
              </div>

              {/* PMP */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">
                  PMP - PRAZO MÉDIO PAGAMENTO
                </span>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {dadosGiro?.pmp_dias || 0} <span className="text-sm font-normal text-slate-400">dias</span>
                </p>
                <span className="text-[10px] text-slate-500">Prazo concedido pelos seus fornecedores</span>
              </div>

              {/* Ciclo Financeiro */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                  CICLO FINANCEIRO (GAP)
                </span>
                <p
                  className={`text-3xl font-black mt-1 ${
                    (dadosGiro?.ciclo_financeiro_dias || 0) <= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {dadosGiro?.ciclo_financeiro_dias || 0}{" "}
                  <span className="text-sm font-normal text-slate-400">dias</span>
                </p>
                <span className="text-[10px] text-slate-500">PMR menos PMP (Dias a financiar)</span>
              </div>

              {/* Caixa Mínimo de Segurança */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                  CAIXA MÍNIMO DE SEGURANÇA
                </span>
                <p className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatBRL(dadosGiro?.caixa_minimo_seguranca)}
                </p>
                <span className="text-[10px] text-slate-500">Reserva ideal para 45 dias de despesas</span>
              </div>
            </div>

            {/* Diagnóstico Inteligente & Saúde do Caixa */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
                  <Sparkles size={14} /> DIAGNÓSTICO DO CONSULTOR VIRTUAL
                </span>
                <p className="text-sm font-medium text-slate-200 max-w-2xl">
                  {dadosGiro?.diagnostico}
                </p>
              </div>

              <div className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700 text-center min-w-[200px]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status do Caixa</span>
                <p className="text-base font-black text-emerald-400 uppercase mt-0.5">
                  {dadosGiro?.status_saude_caixa === "confortavel"
                    ? "🟢 Caixa Confortável"
                    : dadosGiro?.status_saude_caixa === "atencao"
                    ? "🟡 Atenção ao Caixa"
                    : "🔴 Alerta de Liquidez"}
                </p>
                <span className="text-[10px] text-slate-400 font-mono">
                  Cobertura: {dadosGiro?.indice_cobertura}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ABA 2: CURVA ABC (REGRA 80/20 DE PARETO)
           ========================================================================= */}
        {abaAtiva === "curva-abc" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Curva ABC de Clientes / Faturamento */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Users size={16} className="text-emerald-400" /> Curva ABC de Clientes (80/20)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Classe A: os clientes mais vitais que respondem por até 80% do faturamento.
                  </p>
                </div>
                <span className="text-xs font-mono font-black text-emerald-400">
                  {formatBRL(dadosAbc?.total_faturamento)}
                </span>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Classe</th>
                      <th className="px-3 py-2">Cliente / Pagador</th>
                      <th className="px-3 py-2 text-right">Faturado</th>
                      <th className="px-3 py-2 text-right">% Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dadosAbc?.clientes?.lista?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-400">
                          Nenhum faturamento registrado no período.
                        </td>
                      </tr>
                    ) : (
                      dadosAbc?.clientes?.lista?.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                c.classe === "A"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.classe === "B"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              Classe {c.classe}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">{c.nome}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                            {formatBRL(c.valor_faturado)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500 font-bold">
                            {c.percentual_acumulado}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Curva ABC de Despesas / Gastos */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Layers size={16} className="text-rose-400" /> Curva ABC de Despesas (80/20)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Classe A: as categorias onde estão concentrados 80% dos gastos da empresa.
                  </p>
                </div>
                <span className="text-xs font-mono font-black text-rose-400">
                  {formatBRL(dadosAbc?.total_despesas)}
                </span>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Classe</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2 text-right">Gasto</th>
                      <th className="px-3 py-2 text-right">% Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dadosAbc?.despesas?.lista?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-400">
                          Nenhuma despesa registrada no período.
                        </td>
                      </tr>
                    ) : (
                      dadosAbc?.despesas?.lista?.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                d.classe === "A"
                                  ? "bg-rose-100 text-rose-800"
                                  : d.classe === "B"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              Classe {d.classe}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">{d.nome}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">
                            {formatBRL(d.valor_despesa)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500 font-bold">
                            {d.percentual_acumulado}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
