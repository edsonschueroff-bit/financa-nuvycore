import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Formata valores numéricos para moeda BRL (R$)
 */
export const formatBRL = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
};

/**
 * Exporta array de objetos para arquivo Excel (.xlsx)
 */
export function exportToExcel(data, fileName = "relatorio", sheetName = "Dados") {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  } catch (err) {
    console.error("Erro ao exportar Excel:", err);
  }
}

/**
 * Exporta array de objetos para CSV formatado em padrão brasileiro (UTF-8 com BOM e ponto-e-vírgula)
 */
export function exportToCsv(data, fileName = "relatorio") {
  try {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    let csv = headers.join(";") + "\n";

    data.forEach((row) => {
      const line = headers
        .map((header) => {
          let val = row[header] !== undefined && row[header] !== null ? String(row[header]) : "";
          // Escapar aspas e quebras de linha
          if (val.includes(";") || val.includes("\n") || val.includes('"')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(";");
      csv += line + "\n";
    });

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  } catch (err) {
    console.error("Erro ao exportar CSV:", err);
  }
}

/**
 * Gera PDF Executivo de DRE Gerencial
 */
export function exportDREtoPdf({ matriz, ponto_equilibrio, empresaNome = "Nuvy Finance", ano, mes = null }) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [15, 23, 42]; // Slate 900
  const lightBg = [248, 250, 252]; // Slate 50

  // Cabeçalho
  doc.setFillColor(...darkColor);
  doc.rect(0, 0, 297, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DRE GERENCIAL — DEMONSTRAÇÃO DO RESULTADO", 14, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  const subtitle = `${empresaNome} • Exercício: ${ano}${mes ? ` / Mês: ${mes}` : " (Anual 12 Meses)"} • Emitido em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`;
  doc.text(subtitle, 14, 19);

  // Cards de Destaque no Topo
  const receitaLiquida = matriz?.receita_liquida?.total || 0;
  const margemContrib = matriz?.margem_contribuicao?.total || 0;
  const ebitda = matriz?.resultado_operacional_ebitda?.total || 0;
  const lucroLiquido = matriz?.lucro_liquido?.total || 0;
  const margemLucro = receitaLiquida > 0 ? ((lucroLiquido / receitaLiquida) * 100).toFixed(1) : "0.0";

  const cardY = 32;
  const cardW = 64;
  const cardH = 18;

  const drawKpiCard = (x, label, value, sub, isPositive = true) => {
    doc.setFillColor(...lightBg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x + 4, cardY + 5.5);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    if (isPositive) {
      doc.setTextColor(5, 150, 105);
    } else {
      doc.setTextColor(225, 29, 72);
    }
    doc.text(value, x + 4, cardY + 12);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(sub, x + 4, cardY + 16);
  };

  drawKpiCard(14, "Receita Líquida", formatBRL(receitaLiquida), "Base de Operação", true);
  drawKpiCard(82, "Margem Contribuição", formatBRL(margemContrib), `${receitaLiquida > 0 ? ((margemContrib / receitaLiquida) * 100).toFixed(1) : 0}% da Receita`, margemContrib >= 0);
  drawKpiCard(150, "EBITDA Operacional", formatBRL(ebitda), "Geração de Caixa Oper.", ebitda >= 0);
  drawKpiCard(218, "Lucro Líquido Final", formatBRL(lucroLiquido), `Margem Líquida: ${margemLucro}%`, lucroLiquido >= 0);

  // Tabela DRE
  const mesesHeaders = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const tableHeaders = ["Estrutura Contábil / DRE", "Total Acum.", ...mesesHeaders];

  const tableBody = [];

  const addLine = (label, obj, isGroupHeader = false, isTotal = false) => {
    if (!obj) return;
    const row = [
      label,
      formatBRL(obj.total || 0),
      ...mesesHeaders.map((_, i) => formatBRL(obj.meses?.[i + 1] || 0)),
    ];
    row._isGroupHeader = isGroupHeader;
    row._isTotal = isTotal;
    tableBody.push(row);
  };

  addLine("(+) RECEITA OPERACIONAL BRUTA", matriz?.receita_bruta, true);
  addLine("(-) Deduções da Receita & Impostos", matriz?.deducoes_impostos);
  addLine("(=) RECEITA OPERACIONAL LÍQUIDA", matriz?.receita_liquida, false, true);
  addLine("(-) Custos das Mercadorias / Serviços (Variáveis)", matriz?.custos_variaveis);
  addLine("(=) MARGEM DE CONTRIBUIÇÃO BRUTA", matriz?.margem_contribuicao, false, true);
  addLine("(-) Despesas Fixas Operacionais & Administrativas", matriz?.despesas_fixas);
  addLine("(=) RESULTADO OPERACIONAL (EBITDA)", matriz?.resultado_operacional_ebitda, false, true);
  addLine("(+/-) Resultado Financeiro Líquido", matriz?.resultado_financeiro);
  addLine("(=) RESULTADO / LUCRO LÍQUIDO DO EXERCÍCIO", matriz?.lucro_liquido, false, true);

  autoTable(doc, {
    startY: 55,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: darkColor,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 6.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 55 },
      1: { halign: "right", fontStyle: "bold", cellWidth: 26 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right" },
      12: { halign: "right" },
      13: { halign: "right" },
    },
    didParseCell: function (data) {
      const rawRow = tableBody[data.row.index];
      if (rawRow?._isTotal) {
        data.cell.styles.fillColor = [236, 253, 245]; // Emerald 50
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 0) {
          data.cell.styles.textColor = [4, 120, 87];
        }
      } else if (rawRow?._isGroupHeader) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Nuvy Finance ERP • Gestão Financeira B2B & Inteligência Estratégica • Página ${i} de ${pageCount}`,
      14,
      202
    );
  }

  doc.save(`DRE_${ano}_${empresaNome.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Gera Recibo / Comprovante de Pagamento Timbrado em PDF
 */
export function exportReciboPdf({ transacao, empresaNome = "Nuvy Finance", empresaCnpj = "" }) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const darkColor = [15, 23, 42];
  const emeraldColor = [5, 150, 105];

  // Moldura / Cabeçalho
  doc.setFillColor(...darkColor);
  doc.rect(0, 0, 210, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE PAGAMENTO / QUITAÇÃO", 14, 15);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${empresaNome}${empresaCnpj ? ` • CNPJ/CPF: ${empresaCnpj}` : ""} • Emissão: ${new Date().toLocaleDateString("pt-BR")}`,
    14,
    23
  );

  // Valor em Destaque
  const valor = parseFloat(transacao.valor_pago || transacao.valor || 0);
  doc.setFillColor(240, 253, 244); // Green 50
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 40, 182, 24, 3, 3, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text("VALOR LIQUIDADO", 20, 48);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(5, 150, 105);
  doc.text(formatBRL(valor), 20, 58);

  // Detalhes da Operação
  const details = [
    ["Documento / Identificador", `Lançamento #${transacao.id}${transacao.documento_numero ? ` (Doc: ${transacao.documento_numero})` : ""}`],
    ["Tipo de Operação", transacao.tipo === "receita" ? "Recebimento / Quitação de Cliente" : "Pagamento de Despesa / Fornecedor"],
    ["Descrição", transacao.descricao || "—"],
    ["Favorecido / Pagador", transacao.contato_nome || "—"],
    ["CPF / CNPJ do Contato", transacao.contato_cpf_cnpj || "Não informado"],
    ["Data do Pagamento", transacao.data_pagamento ? new Date(transacao.data_pagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : new Date().toLocaleDateString("pt-BR")],
    ["Data de Vencimento Original", transacao.data_vencimento ? new Date(transacao.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"],
    ["Forma de Pagamento", (transacao.forma_pagamento || "PIX").toUpperCase()],
    ["Conta Bancária / Caixa", transacao.conta_nome ? `${transacao.conta_nome} (${transacao.conta_banco || "Conta Principal"})` : "Caixa Geral"],
    ["Categoria Financeira", transacao.categoria_nome || "Geral"],
    ["Status da Operação", "LIQUIDADO / PAGO COM SUCESSO"],
  ];

  autoTable(doc, {
    startY: 72,
    body: details,
    theme: "striped",
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, textColor: [71, 85, 105] },
      1: { cellWidth: 122 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Texto de Declaração de Quitação
  const finalY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  const declaracao = `Declaramos para os devidos fins de direito e quitação plena que o valor acima especificado de ${formatBRL(valor)} foi devidamente liquidado e processado pelo sistema de gestão financeira.`;
  doc.text(declaracao, 14, finalY, { maxWidth: 182 });

  // Linhas de Assinatura
  const signY = finalY + 35;
  doc.setDrawColor(203, 213, 225);
  doc.line(20, signY, 95, signY);
  doc.line(115, signY, 190, signY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(empresaNome, 57.5, signY + 5, { align: "center" });
  doc.text(transacao.contato_nome || "Favorecido / Responsável", 152.5, signY + 5, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Emissor do Recibo", 57.5, signY + 9, { align: "center" });
  doc.text("Assinatura do Recebedor/Pagador", 152.5, signY + 9, { align: "center" });

  // Rodapé
  doc.text(
    `Comprovante gerado eletronicamente por Nuvy Finance • Autenticação: REC-${transacao.id}-${Date.now().toString(36).toUpperCase()}`,
    14,
    285
  );

  doc.save(`Recibo_${transacao.id}_${new Date().toISOString().split("T")[0]}.pdf`);
}
