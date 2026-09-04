const cron = require("node-cron");
const db = require("../../db");
const {
  dispararResumoMatinalGeral,
  dispararReguaCobranca,
} = require("../controllers/integracaoWhatsappController");

/**
 * Inicializa os agendadores automáticos diários do sistema
 */
function iniciarAgendadores() {
  console.log("[CRON SCHEDULER]: Inicializando agendador financeiro automático (Resumo Matinal & Régua)...");

  // Roda a cada minuto checando os horários configurados no fuso horário do Brasil
  cron.schedule("* * * * *", async () => {
    try {
      const agoraBrasil = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());

      // 1. Resumo Matinal (WhatsApp + Telegram)
      const [empresasResumo] = await db.query(
        `SELECT c.empresa_id, c.resumo_matinal_horario
         FROM configuracoes_automacoes_whatsapp c
         JOIN empresas e ON e.id = c.empresa_id
         WHERE e.ativo = 1
           AND COALESCE(c.resumo_matinal_ativo, 1) = 1
           AND (c.ultimo_resumo_matinal IS NULL OR c.ultimo_resumo_matinal < CURDATE())
           AND TIME_FORMAT(COALESCE(c.resumo_matinal_horario, '08:30'), '%H:%i') = ?`,
        [agoraBrasil]
      );

      for (const row of empresasResumo) {
        console.log(`[CRON RESUMO MATINAL]: Disparando para empresa #${row.empresa_id} no horário ${agoraBrasil}...`);
        try {
          // Atualiza a marcação para evitar duplicidade
          await db.query(
            `UPDATE configuracoes_automacoes_whatsapp SET ultimo_resumo_matinal = CURDATE() WHERE empresa_id = ?`,
            [row.empresa_id]
          );

          // Executa envio
          const fakeReq = { body: { empresa_id: row.empresa_id } };
          const fakeRes = { json: () => {}, status: () => fakeRes };
          await dispararResumoMatinalGeral(fakeReq, fakeRes);
        } catch (errResumo) {
          console.error(`[CRON RESUMO MATINAL ERROR] Empresa #${row.empresa_id}:`, errResumo.message);
        }
      }

      // 2. Régua de Cobrança Automática
      const [empresasRegua] = await db.query(
        `SELECT c.empresa_id, c.regua_cobranca_horario
         FROM configuracoes_automacoes_whatsapp c
         JOIN empresas e ON e.id = c.empresa_id
         WHERE e.ativo = 1
           AND COALESCE(c.regua_cobranca_ativa, 1) = 1
           AND (c.ultima_regua_cobranca IS NULL OR c.ultima_regua_cobranca < CURDATE())
           AND TIME_FORMAT(COALESCE(c.regua_cobranca_horario, '09:00'), '%H:%i') = ?`,
        [agoraBrasil]
      );

      for (const row of empresasRegua) {
        console.log(`[CRON RÉGUA COBRANÇA]: Disparando para empresa #${row.empresa_id} no horário ${agoraBrasil}...`);
        try {
          await db.query(
            `UPDATE configuracoes_automacoes_whatsapp SET ultima_regua_cobranca = CURDATE() WHERE empresa_id = ?`,
            [row.empresa_id]
          );

          const fakeReq = { body: { empresa_id: row.empresa_id } };
          const fakeRes = { json: () => {}, status: () => fakeRes };
          await dispararReguaCobranca(fakeReq, fakeRes);
        } catch (errRegua) {
          console.error(`[CRON RÉGUA ERROR] Empresa #${row.empresa_id}:`, errRegua.message);
        }
      }
    } catch (loopErr) {
      console.error("[CRON SCHEDULER ERROR]:", loopErr.message);
    }
  });

  console.log("[CRON SCHEDULER]: Agendador ativo e monitorando minuto a minuto.");
}

module.exports = {
  iniciarAgendadores,
};
