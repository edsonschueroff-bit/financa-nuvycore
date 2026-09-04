import React, { useState, useEffect } from "react";
import { Plus, Trash2, PieChart, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import Button from "./Button";

export default function RateioCentrosCustoInput({
  valorTotal = 0,
  centrosCusto = [],
  rateios = [],
  onChange,
}) {
  const [itens, setItens] = useState(rateios || []);

  useEffect(() => {
    setItens(rateios || []);
  }, [rateios]);

  const totalValor = parseFloat(valorTotal || 0);

  const somaPercentual = itens.reduce((acc, curr) => acc + (parseFloat(curr.percentual) || 0), 0);
  const somaValores = itens.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);
  const percentualRestante = Math.max(0, 100 - somaPercentual);
  const estaValido = Math.abs(somaPercentual - 100) < 0.01;

  const handleItemChange = (index, field, val) => {
    const updated = [...itens];
    const item = { ...updated[index] };

    if (field === "percentual") {
      const pct = parseFloat(val) || 0;
      item.percentual = val;
      item.valor = ((totalValor * pct) / 100).toFixed(2);
    } else if (field === "valor") {
      const v = parseFloat(val) || 0;
      item.valor = val;
      item.percentual = totalValor > 0 ? ((v / totalValor) * 100).toFixed(2) : 0;
    } else {
      item[field] = val;
    }

    updated[index] = item;
    setItens(updated);
    if (onChange) onChange(updated);
  };

  const handleAddCentro = () => {
    const sugeridoPct = percentualRestante > 0 ? percentualRestante.toFixed(2) : 0;
    const sugeridoVal = totalValor > 0 ? ((totalValor * parseFloat(sugeridoPct)) / 100).toFixed(2) : 0;

    const disponivel = centrosCusto.find(
      (c) => !itens.some((it) => String(it.centro_custo_id) === String(c.id))
    );

    const novo = {
      centro_custo_id: disponivel ? String(disponivel.id) : (centrosCusto[0]?.id ? String(centrosCusto[0]?.id) : ""),
      percentual: sugeridoPct,
      valor: sugeridoVal,
      observacao: "",
    };

    const updated = [...itens, novo];
    setItens(updated);
    if (onChange) onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = itens.filter((_, i) => i !== index);
    setItens(updated);
    if (onChange) onChange(updated);
  };

  const handleDividirIgualmente = () => {
    if (itens.length === 0) return;
    const pctIndividual = parseFloat((100 / itens.length).toFixed(2));
    const valIndividual = parseFloat(((totalValor * pctIndividual) / 100).toFixed(2));

    const updated = itens.map((it, idx) => {
      // Ajuste de arredondamento na última parcela se necessário
      const isLast = idx === itens.length - 1;
      const pctFinal = isLast ? (100 - pctIndividual * (itens.length - 1)).toFixed(2) : pctIndividual.toFixed(2);
      const valFinal = totalValor > 0 ? ((totalValor * parseFloat(pctFinal)) / 100).toFixed(2) : valIndividual;

      return {
        ...it,
        percentual: pctFinal,
        valor: valFinal,
      };
    });

    setItens(updated);
    if (onChange) onChange(updated);
  };

  return (
    <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <PieChart size={15} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Rateio por Centros de Custo</h4>
            <p className="text-[10px] text-slate-500">
              Distribua esta despesa proporcionalmente entre múltiplos departamentos
            </p>
          </div>
        </div>

        {itens.length > 1 && (
          <button
            type="button"
            onClick={handleDividirIgualmente}
            className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 cursor-pointer"
          >
            Dividir Igualmente
          </button>
        )}
      </div>

      {/* Lista de Centros */}
      {itens.length === 0 ? (
        <div className="py-3 text-center border border-dashed border-slate-300 rounded-xl bg-white/60">
          <p className="text-xs text-slate-500 mb-2">Nenhum rateio configurado (100% no centro padrão).</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus size={13} />}
            onClick={handleAddCentro}
          >
            Habilitar Rateio Múltiplo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex-1">
                <select
                  value={item.centro_custo_id}
                  onChange={(e) => handleItemChange(idx, "centro_custo_id", e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Selecione o Centro de Custo...</option>
                  {centrosCusto.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.codigo ? `(${c.codigo})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-20 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={item.percentual}
                  onChange={(e) => handleItemChange(idx, "percentual", e.target.value)}
                  className="w-full pl-2 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">%</span>
              </div>

              <div className="w-24 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="R$"
                  value={item.valor}
                  onChange={(e) => handleItemChange(idx, "valor", e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-bold">R$</span>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Remover Centro"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Barra de Progresso e Validação dos 100% */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span className="text-slate-600">Soma dos Rateios:</span>
              <span
                className={`font-mono ${
                  estaValido ? "text-emerald-600" : somaPercentual > 100 ? "text-rose-600" : "text-amber-600"
                }`}
              >
                {somaPercentual.toFixed(1)}% ({new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(somaValores)})
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${
                  estaValido
                    ? "bg-emerald-500"
                    : somaPercentual > 100
                    ? "bg-rose-500"
                    : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, somaPercentual)}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 text-[10px]">
                {estaValido ? (
                  <span className="text-emerald-700 flex items-center gap-1 font-bold">
                    <CheckCircle2 size={12} /> Rateio 100% equilibrado
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1 font-bold">
                    <AlertCircle size={12} />
                    {somaPercentual > 100
                      ? `Excesso de ${(somaPercentual - 100).toFixed(1)}%`
                      : `Faltam ${percentualRestante.toFixed(1)}% para fechar 100%`}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddCentro}
                className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Adicionar outro centro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
