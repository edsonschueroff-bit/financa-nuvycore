import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card } from "../../components/ui";
import { exportToExcel, exportToCsv } from "../../utils/exportHelper";
import {
  PieChart as PieChartIcon,
  TrendingDown,
  TrendingUp,
  Target,
  DollarSign,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Building,
  User,
} from "lucide-react";

export default function RelatorioCentrosCusto() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1); // 1-12 ou "" para o ano todo
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centroExpandido, setCentroExpandido] = useState(null);

  const meses = [
    { num: "", label: "Ano Todo" },
    { num: 1, label: "Janeiro" },
    { num: 2, label: "Fevereiro" },
    { num: 3, label: "Março" },
    { num: 4, label: "Abril" },
    { num: 5, label: "Maio" },
    { num: 6, label: "Junho" },
    { num: 7, label: "Julho" },
    { num: 8, label: "Agosto" },
    { num: 9, label: "Setembro" },
    { num: 10, label: "Outubro" },
    { num: 11, label: "Novembro" },
    { num: 12, label: "Dezembro" },
  ];

  const carregarRelatorio = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ ano });
      if (mes) params.append("mes", mes);

      const res = await api.get(`/relatorios/rateio-centros-custo?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error("Erro ao carregar relatório de rateio:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarRelatorio();
  }, [ano, mes]);

  const formatBRL = (val) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const r = data?.resumo;
  const centros = data?.centros || [];

  const handleExportExcel = () => {
    if (!centros || centros.length === 0) return;
    const rows = centros.map((c) => ({
      "Centro de Custo": c.nome,
      Código: c.codigo || "—",
      Responsável: c.responsavel || "—",
      "Despesas Alocadas (R$)": c.total_despesas,
      "Receitas Alocadas (R$)": c.total_receitas,
      "Saldo Resultado (R$)": c.saldo_resultado,
      "Orçamento Período (R$)": c.orcamento_periodo || "—",
      "% Orçamento Consumido": c.pct_orcamento_utilizado ? `${c.pct_orcamento_utilizado}%` : "—",
      "% Despesa Geral da Empresa": `${c.pct_despesa_geral}%`,
      "Qtd Lançamentos": c.qtd_lancamentos,
    }));
    exportToExcel(rows, `Rateio_Centros_Custo_${ano}_${mes || "Anual"}`, "Centros de Custo");
  };

  const handleExportCsv = () => {
    if (!centros || centros.length === 0) return;
    const rows = centros.map((c) => ({
      Centro: c.nome,
      Codigo: c.codigo || "—",
      Despesas: c.total_despesas,
      Receitas: c.total_receitas,
      Orcamento: c.orcamento_periodo || 0,
      PctGeral: `${c.pct_despesa_geral}%`,
    }));
    exportToCsv(rows, `Rateio_Centros_Custo_${ano}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon className="text-emerald-600" size={24} /> Rateio de Centros de Custo
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Acompanhamento analítico de despesas e receitas distribuídas por departamentos e projetos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Ano */}
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[2024, 2025, 2026, 2027].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            {/* Seletor de Mês */}
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : "")}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {meses.map((m) => (
                <option key={m.num} value={m.num}>
                  {m.label}
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              icon={<Download size={14} className="text-emerald-600" />}
              onClick={handleExportExcel}
              title="Exportar para Excel (.XLSX)"
            >
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              title="Exportar para CSV"
            >
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              title="Imprimir Relatório"
              className="p-2"
            >
              <Printer size={15} />
            </Button>
          </div>
        </div>

        {/* 4 Cards de Indicadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Centros Mapeados
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                {r?.total_centros || 0}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Departamentos ativos
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Building size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Despesas Rateadas
              </span>
              <p className="text-xl font-black text-rose-600 mt-1">
                {formatBRL(r?.total_geral_despesas)}
              </p>
              <p className="text-[10px] text-rose-700 font-medium mt-0.5">
                Total distribuído no período
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <TrendingDown size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Receitas Alocadas
              </span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {formatBRL(r?.total_geral_receitas)}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Faturamento atribuído
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Resultado Líquido
              </span>
              <p
                className={`text-xl font-black mt-1 ${
                  (r?.resultado_liquido_geral || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatBRL(r?.resultado_liquido_geral)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Saldo geral rateado
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign size={20} />
            </div>
          </Card>
        </div>

        {/* Tabela Analítica de Centros de Custo */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Distribuição por Centro de Custo</h3>
              <p className="text-xs text-slate-500">
                Detalhamento de gastos, receitas e controle orçamentário
              </p>
            </div>
            <Badge variant="neutral">{centros.length} Departamentos</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3">Centro de Custo</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Despesas Rateadas</th>
                  <th className="px-4 py-3 text-right">% do Total</th>
                  <th className="px-4 py-3 text-right">Orçamento Período</th>
                  <th className="px-4 py-3 text-center">Consumo Orçamento</th>
                  <th className="px-4 py-3 text-center">Lançamentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      Carregando dados de rateio...
                    </td>
                  </tr>
                ) : centros.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      Nenhum centro de custo cadastrado ou com lançamentos no período.
                    </td>
                  </tr>
                ) : (
                  centros.map((c) => {
                    const isExpanded = centroExpandido === c.centro_id;
                    const orcConsumido = parseFloat(c.pct_orcamento_utilizado || 0);

                    return (
                      <React.Fragment key={c.centro_id}>
                        <tr
                          onClick={() => setCentroExpandido(isExpanded ? null : c.centro_id)}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isExpanded ? "bg-emerald-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: c.cor || "#059669" }}
                              />
                              <div>
                                <span className="font-bold text-slate-900 text-xs">{c.nome}</span>
                                {c.codigo && (
                                  <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                                    ({c.codigo})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {c.responsavel || "—"}
                          </td>

                          <td className="px-4 py-3 text-right font-black text-rose-600 font-mono">
                            {formatBRL(c.total_despesas)}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-mono">{c.pct_despesa_geral}%</span>
                              <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-rose-500 rounded-full"
                                  style={{ width: `${Math.min(100, parseFloat(c.pct_despesa_geral))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right text-slate-600 font-mono">
                            {c.orcamento_periodo > 0 ? formatBRL(c.orcamento_periodo) : "—"}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {c.orcamento_periodo > 0 ? (
                              <div className="inline-flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    orcConsumido > 100
                                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                                      : orcConsumido > 80
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  }`}
                                >
                                  {c.pct_orcamento_utilizado}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Sem meta</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold text-[11px]">
                              <span>{c.qtd_lancamentos} itens</span>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                          </td>
                        </tr>

                        {/* Detalhamento dos Lançamentos do Centro de Custo */}
                        {isExpanded && (
                          <tr>
                            <td colSpan="7" className="p-0 bg-slate-50/80 border-y border-slate-200">
                              <div className="p-4 space-y-2">
                                <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                  <Layers size={13} className="text-emerald-600" /> Lançamentos alocados em{" "}
                                  <span className="text-slate-900">"{c.nome}"</span>:
                                </h4>

                                {c.itens?.length === 0 ? (
                                  <p className="text-slate-400 text-xs italic py-2">
                                    Nenhum lançamento individual encontrado.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                                          <th className="px-3 py-2">Competência</th>
                                          <th className="px-3 py-2">Descrição</th>
                                          <th className="px-3 py-2">Contato</th>
                                          <th className="px-3 py-2">Categoria</th>
                                          <th className="px-3 py-2 text-center">% Rateado</th>
                                          <th className="px-3 py-2 text-right">Valor Rateado</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {c.itens.map((it, iIdx) => (
                                          <tr key={iIdx} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 text-slate-500 font-mono">
                                              {formatDate(it.data_competencia)}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-slate-800">
                                              {it.descricao}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">
                                              {it.contato_nome || "—"}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">
                                              {it.categoria_nome || "—"}
                                            </td>
                                            <td className="px-3 py-2 text-center font-bold text-emerald-700">
                                              {parseFloat(it.percentual)}%
                                            </td>
                                            <td
                                              className={`px-3 py-2 text-right font-black font-mono ${
                                                it.tipo === "receita"
                                                  ? "text-emerald-600"
                                                  : "text-rose-600"
                                              }`}
                                            >
                                              {formatBRL(it.valor_rateado)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
