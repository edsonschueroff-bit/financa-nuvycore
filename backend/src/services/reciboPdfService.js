const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * Gera um Buffer PDF de um Recibo Financeiro Oficial
 */
const gerarReciboPDFBuffer = async ({
  empresa,
  transacao,
  adminNome,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Recibo #${transacao.id} - ${empresa.nome}`,
          Author: "Nuvy Finance AI",
        },
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const primaryColor = "#0f172a"; // Slate 900
      const accentColor = "#059669";  // Emerald 600
      const textMuted = "#64748b";     // Slate 500
      const borderLine = "#e2e8f0";    // Slate 200

      const formatBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
      const valorNum = parseFloat(transacao.valor_pago || transacao.valor || 0);
      const dataDoc = transacao.data_pagamento || transacao.data_vencimento || new Date().toISOString().split("T")[0];
      const dataFmt = new Date(dataDoc + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });

      // --- HEADER CONTAINER ---
      doc.rect(40, 40, 515, 80).fill("#f8fafc");
      doc.rect(40, 40, 515, 80).stroke(borderLine);

      // Logo / Nome Empresa
      doc.fillColor(primaryColor).fontSize(18).font("Helvetica-Bold").text(empresa.nome || "Nuvy Finance", 60, 58);
      doc.fillColor(textMuted).fontSize(9).font("Helvetica").text(empresa.cnpj_cpf ? `CNPJ/CPF: ${empresa.cnpj_cpf}` : "Gestão Financeira Inteligente", 60, 80);

      // Badge Recibo
      doc.rect(400, 52, 135, 28).fill(accentColor);
      doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text("RECIBO DE PAGAMENTO", 405, 61, { width: 125, align: "center" });
      doc.fillColor(textMuted).fontSize(8).font("Helvetica").text(`Nº ${String(transacao.id).padStart(6, '0')}`, 405, 85, { width: 125, align: "center" });

      // --- VALOR DESTAQUE ---
      doc.rect(40, 135, 515, 60).fill("#ecfdf5");
      doc.rect(40, 135, 515, 60).stroke("#a7f3d0");

      doc.fillColor("#065f46").fontSize(10).font("Helvetica-Bold").text("VALOR TOTAL QUITADO", 60, 147);
      doc.fillColor("#047857").fontSize(22).font("Helvetica-Bold").text(formatBRL(valorNum), 60, 162);

      doc.fillColor(textMuted).fontSize(9).font("Helvetica").text(`Data da Liquidação: ${dataFmt}`, 360, 160, { width: 175, align: "right" });
      doc.fillColor(textMuted).fontSize(8).font("Helvetica").text(`Status: CONCLUÍDO & PAGO`, 360, 174, { width: 175, align: "right" });

      // --- CORPO DO RECIBO ---
      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold").text("Declaração de Quitação", 40, 215);
      doc.moveTo(40, 230).lineTo(555, 230).stroke(borderLine);

      const tipoTransacao = transacao.tipo === "despesa" ? "pagamento efetuado a" : "recebimento proveniente de";
      const favorecido = transacao.contato_nome || transacao.descricao || "Favorecido Direto";

      doc.fillColor("#334155").fontSize(10).font("Helvetica").lineGap(4).text(
        `Declaramos para os devidos fins de direito que foi realizado com sucesso o ${tipoTransacao} ` +
        `"${favorecido}", referente à descrição "${transacao.descricao}", ` +
        `no valor total de ${formatBRL(valorNum)}, devidamente liquidado e registrado no sistema de controle financeiro.`,
        40, 245, { width: 515, align: "justify" }
      );

      // --- TABELA DE DETALHES ---
      const tableTop = 320;
      doc.rect(40, tableTop, 515, 120).fill("#ffffff").stroke(borderLine);
      doc.rect(40, tableTop, 515, 24).fill("#f1f5f9");

      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text("DETALHAMENTO DA TRANSAÇÃO", 50, tableTop + 7);

      const addRow = (y, label, value) => {
        doc.fillColor(textMuted).fontSize(9).font("Helvetica").text(label, 50, y);
        doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(value, 200, y);
        doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke("#f1f5f9");
      };

      addRow(tableTop + 32, "Descrição:", transacao.descricao || "-");
      addRow(tableTop + 50, "Categoria / DRE:", transacao.categoria_nome || "Geral");
      addRow(tableTop + 68, "Conta Bancária:", transacao.conta_nome || "Conta Principal / Caixa");
      addRow(tableTop + 86, "Forma de Pagamento:", (transacao.forma_pagamento || "PIX").toUpperCase());
      addRow(tableTop + 104, "Registrado por:", adminNome || "Administrador");

      // --- RODAPÉ DE AUTENTICIDADE ---
      const footerTop = 480;
      doc.rect(40, footerTop, 515, 75).fill("#f8fafc").stroke(borderLine);

      doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold").text("AUTENTICAÇÃO ELETRÔNICA DO SISTEMA", 50, footerTop + 10);
      const hashAuth = `NUVY-${transacao.id}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      doc.fillColor(textMuted).fontSize(8).font("Courier").text(`Código de Validação: ${hashAuth}`, 50, footerTop + 24);
      doc.fillColor(textMuted).fontSize(7).font("Helvetica").text(
        "Este documento é um recibo eletrônico oficial gerado pela Copiloto Inteligente Nuvy Finance. " +
        "Válido como comprovante de registro e quitação financeira interna.",
        50, footerTop + 40, { width: 495 }
      );

      // Linha de assinatura
      doc.moveTo(180, 680).lineTo(415, 680).stroke(primaryColor);
      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(empresa.nome || "Nuvy Finance", 180, 685, { width: 235, align: "center" });
      doc.fillColor(textMuted).fontSize(8).font("Helvetica").text("Departamento Financeiro", 180, 698, { width: 235, align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  gerarReciboPDFBuffer,
};
