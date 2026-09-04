import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { toast } from "sonner";
import {
  Target,
  Calendar,
  Save,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function OrcamentoMetas() {
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estado local para edição em lote das metas dos 12 meses
  const [metasEditaveis, setMetasEditaveis] = useState({});

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orcamento/matriz?ano=${ano}`);
      setDados(res.data);

      // Preencher estado editável: { [`${catId}_${mes}`]: valor }
      const mapa = {};
      res.data.linhas?.forEach((linha) => {
        linha.meses.forEach((m) => {
          mapa[`${linha.categoria_id}_${m.mes}`] = m.planejado || "";
        });
      });
      setMetasEditaveis(mapa);
    } catch (err) {
      console.error("Erro ao carregar orçamento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [ano]);

  const handleMetaChange = (catId, mes, valor) => {
    setMetasEditaveis((prev) => ({
      ...prev,
      [`${catId}_${mes}`]: valor,
    }));
  };

  const handleReplicarMes1ParaTodos = (catId) => {
    const valorMes1 = metasEditaveis[`${catId}_1`];
    if (valorMes1 === undefined || valorMes1 === "") return;

    setMetasEditaveis((prev) => {
      const novo = { ...prev };
      for (let m = 2; m <= 12; m++) {
        novo[`${catId}_${m}`] = valorMes1;
      }
      return novo;
    });
  };

  const handleSalvarTodasMetas = async () => {
    try {
      setSalvando(true);
      const payloadMetas = [];

      Object.entries(metasEditaveis).forEach(([key, val]) => {
        const [catId, mes] = key.split("_");
        payloadMetas.push({
          categoria_id: parseInt(catId, 10),
          mes: parseInt(mes, 10),
          valor_planejado: parseFloat(val) || 0,
        });
      });

      await api.post("/orcamento/salvar-lote", {
        ano: parseInt(ano, 10),
        metas: payloadMetas,
      });

      toast.success("Orçamento e Metas salvos com sucesso!");
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar metas orçamentárias.");
    } finally {
      setSalvando(false);
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const resumo = dados?.resumo_anual;
  const linhas = dados?.linhas || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Target className="text-emerald-600" size={26} /> Orçamento Empresarial & Metas (Budget 12M)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Planejamento de receitas e teto de gastos mensais com acompanhamento em tempo real (Orçado vs. Realizado).
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

            <button
              onClick={handleSalvarTodasMetas}
              disabled={salvando}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={16} /> {salvando ? "Salvando..." : "Salvar Metas do Ano"}
            </button>
          </div>
        </div>

        {/* Cards de Resumo Anual (Projetado vs. Realizado) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Receitas */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                META DE RECEITA ANUAL
              </span>
              <span className="text-xs font-black text-emerald-700 font-mono">
                {resumo?.receita_atingimento}% atingido
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Orçado:</span>
                <p className="font-mono font-bold text-slate-600 text-sm">
                  {formatBRL(resumo?.receita_planejada)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-600 font-bold block">Realizado:</span>
                <p className="font-mono font-black text-emerald-600 text-lg">
                  {formatBRL(resumo?.receita_realizada)}
                </p>
              </div>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, parseFloat(resumo?.receita_atingimento || 0))}%` }}
                className="bg-emerald-500 h-full rounded-full transition-all"
              />
            </div>
          </div>

          {/* Despesas */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                TETO DE DESPESAS ANUAL
              </span>
              <span className="text-xs font-black text-slate-700 font-mono">
                {resumo?.despesa_atingimento}% consumido
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Teto Orçado:</span>
                <p className="font-mono font-bold text-slate-600 text-sm">
                  {formatBRL(resumo?.despesa_planejada)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-rose-600 font-bold block">Gasto Realizado:</span>
                <p className="font-mono font-black text-rose-600 text-lg">
                  {formatBRL(resumo?.despesa_realizada)}
                </p>
              </div>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, parseFloat(resumo?.despesa_atingimento || 0))}%` }}
                className={`h-full rounded-full transition-all ${
                  parseFloat(resumo?.despesa_atingimento || 0) > 100 ? "bg-rose-600" : "bg-blue-600"
                }`}
              />
            </div>
          </div>

          {/* Lucro Projetado vs. Realizado */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                LUCRO OPERACIONAL LÍQUIDO
              </span>
              <Sparkles size={15} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-[10px] text-slate-400 block">Projetado:</span>
                <p className="font-mono font-bold text-slate-300 text-sm">
                  {formatBRL(resumo?.lucro_planejado)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-bold block">Realizado:</span>
                <p className="font-mono font-black text-emerald-400 text-lg">
                  {formatBRL(resumo?.lucro_realizado)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Meta atingida quando o Realizado supera o Projetado.
            </p>
          </div>
        </div>

        {/* Tabela Matriz Orçamentária 12 Meses */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">
                Matriz Orçamentária por Plano de Contas ({ano})
              </h3>
              <p className="text-[11px] text-slate-500">
                Edite os valores previstos para cada mês e clique em "Salvar Metas". Use o botão de seta para replicar o valor de Janeiro para o ano inteiro.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-3 py-3 sticky left-0 bg-slate-900 z-10 min-w-[200px]">Categoria</th>
                  {mesesNomes.map((mes, idx) => (
                    <th key={idx} className="px-2 py-3 text-center min-w-[90px]">
                      {mes}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right bg-slate-800 min-w-[110px]">Total Ano</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-slate-400">
                      Carregando matriz orçamentária...
                    </td>
                  </tr>
                ) : linhas.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-slate-400">
                      Nenhuma categoria encontrada no Plano de Contas.
                    </td>
                  </tr>
                ) : (
                  linhas.map((linha) => {
                    const isReceita = linha.tipo === "receita";

                    return (
                      <tr key={linha.categoria_id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Nome da Categoria */}
                        <td className="px-3 py-2 sticky left-0 bg-white shadow-xs z-10">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: linha.cor || (isReceita ? "#10b981" : "#f43f5e") }}
                              />
                              <span className="font-bold text-slate-900 truncate" title={linha.nome}>
                                {linha.nome}
                              </span>
                            </div>
                            <button
                              onClick={() => handleReplicarMes1ParaTodos(linha.categoria_id)}
                              title="Replicar valor de Jan para todos os meses"
                              className="text-[9px] text-blue-600 hover:text-blue-800 font-bold p-0.5 hover:bg-blue-50 rounded cursor-pointer shrink-0"
                            >
                              » Ano
                            </button>
                          </div>
                          <span className="text-[9px] text-slate-400 block truncate">
                            {linha.dre_grupo?.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* 12 Meses (Inputs Editáveis + Valor Realizado) */}
                        {linha.meses.map((m) => {
                          const valKey = `${linha.categoria_id}_${m.mes}`;
                          const valInput = metasEditaveis[valKey] || "";

                          return (
                            <td key={m.mes} className="px-1.5 py-2 text-center border-l border-slate-100">
                              {/* Input de Meta Orçada */}
                              <input
                                type="number"
                                step="10"
                                placeholder="0"
                                value={valInput}
                                onChange={(e) =>
                                  handleMetaChange(linha.categoria_id, m.mes, e.target.value)
                                }
                                className="w-full text-center text-[10px] font-mono px-1 py-1 rounded bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />

                              {/* Valor Realizado no Mês */}
                              <div className="mt-1 flex items-center justify-between text-[9px] px-0.5">
                                <span className="text-slate-400 font-mono">Real:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    isReceita
                                      ? m.realizado >= (parseFloat(valInput) || 0) && (parseFloat(valInput) || 0) > 0
                                        ? "text-emerald-600"
                                        : "text-slate-700"
                                      : m.realizado > (parseFloat(valInput) || 0) && (parseFloat(valInput) || 0) > 0
                                      ? "text-rose-600"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {m.realizado > 0 ? formatBRL(m.realizado).replace("R$", "") : "0"}
                                </span>
                              </div>
                            </td>
                          );
                        })}

                        {/* Total Anual */}
                        <td className="px-3 py-2 text-right bg-slate-50/80 font-mono border-l border-slate-200">
                          <p className="font-bold text-slate-800 text-xs">
                            {formatBRL(linha.total_planejado)}
                          </p>
                          <span
                            className={`text-[10px] font-black ${
                              isReceita
                                ? linha.total_realizado >= linha.total_planejado
                                  ? "text-emerald-600"
                                  : "text-slate-500"
                                : linha.total_realizado > linha.total_planejado
                                ? "text-rose-600"
                                : "text-slate-500"
                            }`}
                          >
                            Real: {formatBRL(linha.total_realizado)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
