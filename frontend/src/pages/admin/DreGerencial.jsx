import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Badge, Card } from "../../components/ui";
import { exportDREtoPdf, exportToExcel, exportToCsv } from "../../utils/exportHelper";
import {
  FileSpreadsheet,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
  Printer,
  Download,
  FileText,
  Scale,
  Sparkles,
} from "lucide-react";

export default function DreGerencial() {
  const { user } = useAuth();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState("");
  const [modoVisao, setModoVisao] = useState("anual"); // anual | mensal
  const [analitico, setAnalitico] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState({
    receita_bruta: true,
    despesas_fixas: true,
    custos_variaveis: true,
    deducoes_impostos: false,
    resultado_financeiro: false,
  });

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const carregarDre = async () => {
    try {
      setLoading(true);
      const url = mes ? `/relatorios/dre?ano=${ano}&mes=${mes}` : `/relatorios/dre?ano=${ano}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error("Erro ao gerar DRE:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDre();
  }, [ano, mes]);

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const mesesHeaders = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const m = data?.matriz;
  const pe = data?.ponto_equilibrio;
  const lucroTotal = m?.lucro_liquido?.total || 0;
  const isLucroPositivo = lucroTotal >= 0;

  const handleExportPdf = () => {
    if (!data?.matriz) return;
    exportDREtoPdf({
      matriz: data.matriz,
      ponto_equilibrio: data.ponto_equilibrio,
      empresaNome: user?.empresa_nome || "Nuvy Finance",
      ano,
      mes: mes ? mesesHeaders[parseInt(mes, 10) - 1] : null,
    });
  };

  const handleExportExcel = () => {
    if (!m) return;
    const excelRows = [
      {
        "Estrutura DRE": "(+) RECEITA OPERACIONAL BRUTA",
        "Total Acumulado": m.receita_bruta?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.receita_bruta?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(-) Deduções e Impostos",
        "Total Acumulado": m.deducoes_impostos?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.deducoes_impostos?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(=) RECEITA OPERACIONAL LÍQUIDA",
        "Total Acumulado": m.receita_liquida?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.receita_liquida?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(-) Custos Variáveis",
        "Total Acumulado": m.custos_variaveis?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.custos_variaveis?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(=) MARGEM DE CONTRIBUIÇÃO",
        "Total Acumulado": m.margem_contribuicao?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.margem_contribuicao?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(-) Despesas Fixas Operacionais",
        "Total Acumulado": m.despesas_fixas?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.despesas_fixas?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(=) EBITDA OPERACIONAL",
        "Total Acumulado": m.resultado_operacional_ebitda?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.resultado_operacional_ebitda?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(+/-) Resultado Financeiro",
        "Total Acumulado": m.resultado_financeiro?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.resultado_financeiro?.meses?.[i + 1] || 0 }), {}),
      },
      {
        "Estrutura DRE": "(=) LUCRO LÍQUIDO DO EXERCÍCIO",
        "Total Acumulado": m.lucro_liquido?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.lucro_liquido?.meses?.[i + 1] || 0 }), {}),
      },
    ];
    exportToExcel(excelRows, `DRE_${ano}`, "DRE Gerencial");
  };

  const handleExportCsv = () => {
    if (!m) return;
    const csvRows = [
      {
        Linha: "(+) RECEITA BRUTA",
        Total: m.receita_bruta?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.receita_bruta?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(-) Deduções e Impostos",
        Total: m.deducoes_impostos?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.deducoes_impostos?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(=) RECEITA LÍQUIDA",
        Total: m.receita_liquida?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.receita_liquida?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(-) Custos Variáveis",
        Total: m.custos_variaveis?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.custos_variaveis?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(=) MARGEM DE CONTRIBUIÇÃO",
        Total: m.margem_contribuicao?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.margem_contribuicao?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(-) Despesas Fixas",
        Total: m.despesas_fixas?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.despesas_fixas?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(=) EBITDA",
        Total: m.resultado_operacional_ebitda?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.resultado_operacional_ebitda?.meses?.[i + 1] || 0 }), {}),
      },
      {
        Linha: "(=) LUCRO LÍQUIDO",
        Total: m.lucro_liquido?.total || 0,
        ...mesesHeaders.reduce((acc, mesName, i) => ({ ...acc, [mesName]: m.lucro_liquido?.meses?.[i + 1] || 0 }), {}),
      },
    ];
    exportToCsv(csvRows, `DRE_${ano}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header com Controles e Ações */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600" size={24} /> DRE Gerencial Multicoluna
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Demonstração do Resultado por regime de competência com matriz anual e ponto de equilíbrio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor Sintético / Analítico */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnalitico(!analitico)}
            >
              {analitico ? "Modo Analítico" : "Modo Sintético"}
            </Button>

            {/* Alternador de Visão */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
              <button
                onClick={() => {
                  setModoVisao("anual");
                  setMes("");
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  modoVisao === "anual" ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Matriz Anual (12M)
              </button>
              <button
                onClick={() => setModoVisao("mensal")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  modoVisao === "mensal" ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mês a Mês
              </button>
            </div>

            {/* Seletor de Ano */}
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>

            {/* Botões de Exportação Executiva */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPdf}
              icon={<FileText size={14} />}
              title="Gerar PDF Executivo Timbrado"
            >
              Exportar PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              icon={<Download size={14} className="text-emerald-600" />}
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
              onClick={handlePrint}
              title="Imprimir Relatório"
              className="p-2"
            >
              <Printer size={15} />
            </Button>
          </div>
        </div>

        {/* Linha 1: Cards Executivos de Performance DRE (Cards Padronizados) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Receita Líquida */}
          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Receita Líquida do Ano</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {loading ? "..." : formatBRL(m?.receita_liquida?.total)}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block font-mono">
                Bruta: {formatBRL(m?.receita_bruta?.total)}
              </span>
            </div>
          </Card>

          {/* Margem de Contribuição */}
          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Margem de Contribuição</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
                {loading ? "..." : `${pe?.margem_contribuicao_pct || 0}%`}
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 inline-block font-mono">
                Total: {formatBRL(m?.margem_contribuicao?.total)}
              </span>
            </div>
          </Card>

          {/* Ponto de Equilíbrio (Break-Even) */}
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Ponto de Equilíbrio</span>
              <Scale size={14} className="text-blue-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-blue-600 tracking-tight font-mono">
                {loading ? "..." : formatBRL(pe?.faturamento_minimo_mensal)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                Faturamento mensal mínimo
              </span>
            </div>
          </Card>

          {/* Lucro Líquido Acumulado */}
          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Lucro Líquido do Ano</span>
            <div className="mt-2">
              <div
                className={`text-2xl font-black tracking-tight font-mono ${
                  isLucroPositivo ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {loading ? "..." : formatBRL(m?.lucro_liquido?.total)}
              </div>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 inline-block font-mono">
                EBITDA: {formatBRL(m?.resultado_operacional_ebitda?.total)}
              </span>
            </div>
          </Card>
        </div>

        {/* Linha 2: Matriz Anual Multicoluna Completa */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                DRE Estruturada — Exercício {ano}
              </span>
              <Badge variant="success">Regime de Competência</Badge>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Valores em Reais (R$)
            </span>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3 min-w-[240px] sticky left-0 bg-slate-100 z-10">
                    Estrutura / Contas
                  </th>
                  <th className="px-3 py-3 text-right bg-slate-200/60 font-black min-w-[110px]">
                    Total Ano
                  </th>
                  {mesesHeaders.map((mesNome, i) => (
                    <th key={i} className="px-3 py-3 text-right min-w-[90px]">
                      {mesNome}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="text-center py-16 text-slate-400">
                      Calculando matriz financeira...
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* 1. RECEITA BRUTA */}
                    <tr
                      onClick={() => toggleExpand("receita_bruta")}
                      className="bg-emerald-50/60 hover:bg-emerald-50 cursor-pointer font-bold text-slate-900"
                    >
                      <td className="px-4 py-3 flex items-center gap-2 sticky left-0 bg-emerald-50/90 z-10">
                        {expanded.receita_bruta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="text-emerald-800">(+) RECEITA BRUTA</span>
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-800 bg-emerald-100/50 font-mono">
                        {formatBRL(m?.receita_bruta?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-3 text-right text-emerald-700 font-mono">
                          {formatBRL(m?.receita_bruta?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>
                    {analitico &&
                      expanded.receita_bruta &&
                      Object.entries(m?.receita_bruta?.categorias || {}).map(([catNome, obj], idx) => (
                        <tr key={idx} className="bg-slate-50/40 hover:bg-slate-50 text-slate-600 text-[11px]">
                          <td className="px-4 py-1.5 pl-9 sticky left-0 bg-slate-50/95 z-10 truncate max-w-[240px]">
                            {catNome}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold bg-slate-100/40 font-mono">
                            {formatBRL(obj.total)}
                          </td>
                          {mesesHeaders.map((_, i) => (
                            <td key={i} className="px-3 py-1.5 text-right text-slate-500 font-mono">
                              {formatBRL(obj.meses[i + 1])}
                            </td>
                          ))}
                        </tr>
                      ))}

                    {/* 2. DEDUÇÕES E IMPOSTOS */}
                    <tr
                      onClick={() => toggleExpand("deducoes_impostos")}
                      className="hover:bg-slate-50 cursor-pointer font-semibold text-rose-700"
                    >
                      <td className="px-4 py-2.5 flex items-center gap-2 sticky left-0 bg-white z-10">
                        {expanded.deducoes_impostos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>(-) Deduções da Receita & Impostos</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-rose-700 bg-slate-50 font-mono">
                        -{formatBRL(m?.deducoes_impostos?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-2.5 text-right text-rose-600 font-mono">
                          -{formatBRL(m?.deducoes_impostos?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>

                    {/* 3. RECEITA LÍQUIDA */}
                    <tr className="bg-slate-100 font-extrabold text-slate-900">
                      <td className="px-4 py-3 sticky left-0 bg-slate-100 z-10">
                        (=) RECEITA OPERACIONAL LÍQUIDA
                      </td>
                      <td className="px-3 py-3 text-right font-black bg-slate-200/80 font-mono">
                        {formatBRL(m?.receita_liquida?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-3 text-right font-mono">
                          {formatBRL(m?.receita_liquida?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>

                    {/* 4. CUSTOS VARIÁVEIS */}
                    <tr
                      onClick={() => toggleExpand("custos_variaveis")}
                      className="hover:bg-slate-50 cursor-pointer font-semibold text-rose-700"
                    >
                      <td className="px-4 py-2.5 flex items-center gap-2 sticky left-0 bg-white z-10">
                        {expanded.custos_variaveis ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>(-) Custos Variáveis & Mercadorias</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-rose-700 bg-slate-50 font-mono">
                        -{formatBRL(m?.custos_variaveis?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-2.5 text-right text-rose-600 font-mono">
                          -{formatBRL(m?.custos_variaveis?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>

                    {/* 5. MARGEM DE CONTRIBUIÇÃO */}
                    <tr className="bg-emerald-50 font-bold text-emerald-900">
                      <td className="px-4 py-3 sticky left-0 bg-emerald-50 z-10">
                        (=) MARGEM DE CONTRIBUIÇÃO BRUTA
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-900 bg-emerald-100 font-mono">
                        {formatBRL(m?.margem_contribuicao?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-3 text-right text-emerald-800 font-mono">
                          {formatBRL(m?.margem_contribuicao?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>

                    {/* 6. DESPESAS FIXAS */}
                    <tr
                      onClick={() => toggleExpand("despesas_fixas")}
                      className="hover:bg-slate-50 cursor-pointer font-semibold text-rose-700"
                    >
                      <td className="px-4 py-2.5 flex items-center gap-2 sticky left-0 bg-white z-10">
                        {expanded.despesas_fixas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>(-) Despesas Fixas Operacionais</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-rose-700 bg-slate-50 font-mono">
                        -{formatBRL(m?.despesas_fixas?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-2.5 text-right text-rose-600 font-mono">
                          -{formatBRL(m?.despesas_fixas?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>
                    {analitico &&
                      expanded.despesas_fixas &&
                      Object.entries(m?.despesas_fixas?.categorias || {}).map(([catNome, obj], idx) => (
                        <tr key={idx} className="bg-slate-50/40 hover:bg-slate-50 text-slate-600 text-[11px]">
                          <td className="px-4 py-1.5 pl-9 sticky left-0 bg-slate-50/95 z-10 truncate max-w-[240px]">
                            {catNome}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold bg-slate-100/40 font-mono text-rose-600">
                            -{formatBRL(obj.total)}
                          </td>
                          {mesesHeaders.map((_, i) => (
                            <td key={i} className="px-3 py-1.5 text-right text-slate-500 font-mono">
                              -{formatBRL(obj.meses[i + 1])}
                            </td>
                          ))}
                        </tr>
                      ))}

                    {/* 7. EBITDA */}
                    {(() => {
                      const ebitdaVal = m?.resultado_operacional_ebitda?.total || 0;
                      const isEbitdaPositivo = ebitdaVal >= 0;
                      return (
                        <tr className="bg-slate-100 font-extrabold text-slate-900">
                          <td className="px-4 py-3 sticky left-0 bg-slate-100 z-10">
                            (=) RESULTADO OPERACIONAL (EBITDA)
                          </td>
                          <td className={`px-3 py-3 text-right font-black bg-slate-200/80 font-mono ${isEbitdaPositivo ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatBRL(ebitdaVal)}
                          </td>
                          {mesesHeaders.map((_, i) => {
                            const valMes = m?.resultado_operacional_ebitda?.meses[i + 1] || 0;
                            return (
                              <td key={i} className={`px-3 py-3 text-right font-mono ${valMes >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                {formatBRL(valMes)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })()}

                    {/* 8. RESULTADO FINANCEIRO */}
                    <tr className="hover:bg-slate-50 font-medium text-slate-700">
                      <td className="px-4 py-2 pl-9 sticky left-0 bg-white z-10">
                        (+/-) Resultado Financeiro
                      </td>
                      <td className="px-3 py-2 text-right bg-slate-50 font-mono text-rose-600">
                        -{formatBRL(m?.resultado_financeiro?.total)}
                      </td>
                      {mesesHeaders.map((_, i) => (
                        <td key={i} className="px-3 py-2 text-right font-mono text-rose-600">
                          -{formatBRL(m?.resultado_financeiro?.meses[i + 1])}
                        </td>
                      ))}
                    </tr>

                    {/* 9. LUCRO LÍQUIDO FINAL */}
                    <tr className={`${isLucroPositivo ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"} font-black text-xs`}>
                      <td className={`px-4 py-3.5 sticky left-0 ${isLucroPositivo ? "bg-emerald-600" : "bg-rose-600"} z-10`}>
                        (=) LUCRO / PREJUÍZO LÍQUIDO
                      </td>
                      <td className={`px-3 py-3.5 text-right font-black ${isLucroPositivo ? "bg-emerald-700" : "bg-rose-700"} font-mono`}>
                        {formatBRL(lucroTotal)}
                      </td>
                      {mesesHeaders.map((_, i) => {
                        const valMes = m?.lucro_liquido?.meses[i + 1] || 0;
                        return (
                          <td key={i} className="px-3 py-3.5 text-right font-bold font-mono">
                            {formatBRL(valMes)}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
