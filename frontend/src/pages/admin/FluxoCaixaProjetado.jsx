import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { exportToExcel } from "../../utils/exportHelper";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  Sparkles,
  Layers,
  Info,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export default function FluxoCaixaProjetado() {
  const [dias, setDias] = useState(30); // 30, 60, 90
  const [visao, setVisao] = useState("diaria"); // diaria | semanal
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const carregarFluxo = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/relatorios/fluxo-caixa-projetado?dias=${dias}`);
      setData(res.data);
      if (res.data?.curva_diaria?.length > 0) {
        setDiaSelecionado(res.data.curva_diaria[0]);
      }
    } catch (err) {
      console.error("Erro ao carregar fluxo projetado:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFluxo();
  }, [dias]);

  const formatBRL = (val) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const r = data?.resumo;
  const curva = (data?.curva_diaria || []).map((d) => ({
    ...d,
    data_formatada: d.data_formatada || (d.data ? `${d.data.split("-")[2]}/${d.data.split("-")[1]}` : ""),
  }));
  const semanas = data?.semanas || [];

  const handleExportExcel = () => {
    if (!curva || curva.length === 0) return;
    const rows = curva.map((d) => ({
      Data: formatDate(d.data),
      "Dia da Semana": d.dia_semana,
      "Entradas Previstas (R$)": d.entradas,
      "Saídas Previstas (R$)": d.saidas,
      "Resultado do Dia (R$)": d.resultado_dia,
      "Saldo Projetado (R$)": d.saldo_acumulado,
      "Status Liquidez": d.saldo_acumulado < 0 ? "DÉFICIT / NEGATIVO" : "POSITIVO",
      "Qtd Lançamentos": d.qtd_lancamentos,
    }));
    exportToExcel(rows, `Fluxo_Caixa_Projetado_${dias}_Dias`, "Fluxo Projetado");
  };

  // Gráfico vetorial responsivo com Recharts e Shadcn ChartContainer
  const configCurva = {
    saldo_acumulado: {
      label: "Saldo Acumulado",
      color: "#059669",
    },
    entradas: {
      label: "Entradas Previstas",
      color: "#10b981",
    },
    saidas: {
      label: "Saídas Previstas",
      color: "#e11d48",
    },
  };

  const renderChart = () => {
    if (!curva || curva.length === 0) return null;

    return (
      <div className="w-full h-72 pt-2">
        <ChartContainer config={configCurva} className="h-full w-full aspect-auto">
          <ComposedChart data={curva} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradSaldoFluxo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="data_formatada" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="#94a3b8" />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={10}
              stroke="#94a3b8"
              tickFormatter={(v) => Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatBRL(value)}
                />
              }
            />
            <Bar dataKey="entradas" name="Entradas Previstas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="saidas" name="Saídas Previstas" fill="#e11d48" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Area
              type="monotone"
              dataKey="saldo_acumulado"
              name="Saldo Acumulado"
              stroke="#059669"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#gradSaldoFluxo)"
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header com Controles de Horizonte */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="text-emerald-600" size={24} /> Projeção de Fluxo de Caixa Futuro
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Simulação de liquidez, saldo diário e previsão de caixa a partir do saldo bancário consolidado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Horizonte de Projeção */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDias(d)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    dias === d
                      ? "bg-emerald-600 text-white font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {d} Dias
                </button>
              ))}
            </div>

            {/* Alternador Visão Diária / Semanal */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
              <button
                onClick={() => setVisao("diaria")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  visao === "diaria"
                    ? "bg-slate-900 text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Diária
              </button>
              <button
                onClick={() => setVisao("semanal")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  visao === "semanal"
                    ? "bg-slate-900 text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semanal
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<Download size={14} className="text-emerald-600" />}
              onClick={handleExportExcel}
              title="Exportar dados para Excel (.XLSX)"
            >
              Excel
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

        {/* 4 Cards de Indicadores de Projeção */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Saldo Atual em Caixa
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                {formatBRL(r?.saldo_inicial)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Consolidado em {data?.contas_bancarias?.length || 0} conta(s)
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Wallet size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                (+) Entradas Previstas
              </span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {formatBRL(r?.total_entradas_previstas)}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Recebíveis em {dias} dias
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ArrowUpRight size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                (-) Saídas Previstas
              </span>
              <p className="text-xl font-black text-rose-600 mt-1">
                {formatBRL(r?.total_saidas_previstas)}
              </p>
              <p className="text-[10px] text-rose-700 font-medium mt-0.5">
                Despesas em {dias} dias
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <ArrowDownRight size={20} />
            </div>
          </Card>

          <Card
            padding="sm"
            className={`flex items-center justify-between ${
              r?.saldo_final_projetado < 0
                ? "border-rose-300 bg-rose-50/40"
                : "border-emerald-200 bg-emerald-50/30"
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                (=) Saldo Final Projetado
              </span>
              <p
                className={`text-xl font-black mt-1 ${
                  r?.saldo_final_projetado < 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {formatBRL(r?.saldo_final_projetado)}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Posição ao fim de {dias} dias
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                r?.saldo_final_projetado < 0
                  ? "bg-rose-100 text-rose-600"
                  : "bg-emerald-100 text-emerald-600"
              }`}
            >
              <TrendingUp size={20} />
            </div>
          </Card>
        </div>

        {/* Banner de Alerta de Déficit de Liquidez (Se houver) */}
        {r?.possui_deficit && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 animate-in fade-in">
            <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="font-bold text-sm">
                Atenção: Risco de saldo negativo projetado!
              </p>
              <p className="text-xs text-rose-700 mt-1">
                A projeção indica que a partir do dia{" "}
                <strong>{formatDate(r.primeiro_dia_deficit?.data)}</strong> haverá um déficit de caixa
                de aproximadamente <strong>{formatBRL(r.primeiro_dia_deficit?.deficit)}</strong>. É
                recomendável antecipar recebíveis ou renegociar prazos com fornecedores.
              </p>
            </div>
          </div>
        )}

        {/* Gráfico Interativo de Curva de Caixa */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600" />
                Curva de Liquidez & Projeção Diária
              </h2>
              <p className="text-xs text-slate-500">
                Passe o mouse ou clique em qualquer ponto do gráfico para inspecionar os lançamentos do dia.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span>Saldo Projetado</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded bg-emerald-400/60 inline-block" />
                <span>Entradas</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded bg-rose-400/60 inline-block" />
                <span>Saídas</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              Carregando curva de projeção...
            </div>
          ) : (
            renderChart()
          )}
        </Card>

        {/* Tabela de Detalhamento Diário ou Semanal */}
        {visao === "diaria" ? (
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Cronograma Diário de Caixa</h3>
                <p className="text-xs text-slate-500">Detalhamento dia a dia com lançamentos previstos</p>
              </div>
              <Badge variant="neutral">{curva.length} Dias Mapeados</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3 text-right">Entradas Previstas</th>
                    <th className="px-4 py-3 text-right">Saídas Previstas</th>
                    <th className="px-4 py-3 text-right">Resultado do Dia</th>
                    <th className="px-4 py-3 text-right">Saldo Projetado</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {curva.map((d, i) => (
                    <tr
                      key={i}
                      onClick={() => setDiaSelecionado(d)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        diaSelecionado?.data === d.data ? "bg-emerald-50/50" : ""
                      } ${d.saldo_acumulado < 0 ? "bg-rose-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {formatDate(d.data)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium">
                        {d.dia_semana}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                        {d.entradas > 0 ? `+${formatBRL(d.entradas)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 font-mono">
                        {d.saidas > 0 ? `-${formatBRL(d.saidas)}` : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold font-mono ${
                          d.resultado_dia > 0
                            ? "text-emerald-600"
                            : d.resultado_dia < 0
                            ? "text-rose-600"
                            : "text-slate-400"
                        }`}
                      >
                        {d.resultado_dia !== 0 ? formatBRL(d.resultado_dia) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-black font-mono text-sm ${
                          d.saldo_acumulado < 0 ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {formatBRL(d.saldo_acumulado)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.saldo_acumulado < 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            Déficit
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Positivo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAINEL DE DETALHAMENTO DO DIA SELECIONADO */}
            {diaSelecionado && (
              <div className="border-t border-slate-200 bg-slate-50/70 p-5 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                      <Calendar size={16} />
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Movimentações de {formatDate(diaSelecionado.data)} ({diaSelecionado.dia_semana})
                    </h4>
                    <span className="text-xs text-slate-500">
                      • Saldo no final do dia: <strong className="text-slate-900 font-mono">{formatBRL(diaSelecionado.saldo_acumulado)}</strong>
                    </span>
                  </div>
                  <Badge variant={diaSelecionado.itens?.length > 0 ? "primary" : "neutral"}>
                    {diaSelecionado.itens?.length || 0} lançamento(s)
                  </Badge>
                </div>

                {diaSelecionado.itens && diaSelecionado.itens.length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <th className="px-3.5 py-2.5">Status</th>
                          <th className="px-3.5 py-2.5">Tipo</th>
                          <th className="px-3.5 py-2.5">Descrição</th>
                          <th className="px-3.5 py-2.5">Categoria</th>
                          <th className="px-3.5 py-2.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {diaSelecionado.itens.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-3.5 py-2.5">
                              {item.status === "pago" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 size={11} className="text-emerald-600" />
                                  Pago / Quitado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <Clock size={11} className="text-amber-600" />
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5">
                              {item.tipo === "receita" ? (
                                <span className="font-bold text-emerald-600">🟢 Entrada</span>
                              ) : (
                                <span className="font-bold text-rose-600">🔴 Saída</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-slate-900">
                              {item.descricao}
                              {item.contato_nome && (
                                <span className="text-[11px] text-slate-400 block font-normal">
                                  Favorecido: {item.contato_nome}
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600">
                              {item.categoria_nome || "Geral"}
                            </td>
                            <td className={`px-3.5 py-2.5 text-right font-mono font-bold ${
                              item.tipo === "receita" ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {item.tipo === "receita" ? `+${formatBRL(item.valor)}` : `-${formatBRL(item.valor)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    Nenhum lançamento previsto ou realizado nesta data.
                  </p>
                )}
              </div>
            )}
          </Card>
        ) : (
          /* Visão Semanal Executiva */
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Resumo Semanal Executivo</h3>
                <p className="text-xs text-slate-500">Agrupamento por períodos de 7 dias</p>
              </div>
              <Badge variant="neutral">{semanas.length} Semanas</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Semana</th>
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3 text-right">Entradas</th>
                    <th className="px-4 py-3 text-right">Saídas</th>
                    <th className="px-4 py-3 text-right">Resultado do Período</th>
                    <th className="px-4 py-3 text-right">Saldo Final da Semana</th>
                    <th className="px-4 py-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {semanas.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        Semana #{s.semana}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(s.data_inicio)} até {formatDate(s.data_fim)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                        +{formatBRL(s.entradas)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 font-mono">
                        -{formatBRL(s.saidas)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold font-mono ${
                          s.resultado >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatBRL(s.resultado)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-black font-mono text-sm ${
                          s.saldo_final_semana < 0 ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {formatBRL(s.saldo_final_semana)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.saldo_final_semana < 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            Crítico
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Saudável
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
