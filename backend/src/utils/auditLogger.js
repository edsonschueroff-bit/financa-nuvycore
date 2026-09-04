const db = require("../../db");

/**
 * Registra um evento de auditoria no banco de dados
 * @param {Object} params
 * @param {Object} [params.req] - Objeto Express Request (opcional para capturar IP/User-Agent e usuário da sessão)
 * @param {number} [params.empresaId] - ID da empresa
 * @param {number} [params.adminId] - ID do usuário admin
 * @param {string} [params.usuarioNome] - Nome do usuário
 * @param {string} [params.usuarioEmail] - Email do usuário
 * @param {string} params.acao - 'CRIAR' | 'EDITAR' | 'EXCLUIR' | 'BAIXAR' | 'ESTORNAR' | 'UPLOAD_ANEXO' | 'EXCLUIR_ANEXO' | 'LOGIN' | 'LOGOUT'
 * @param {string} params.modulo - 'TRANSACOES' | 'CONTAS_BANCARIAS' | 'CONTATOS' | 'CATEGORIAS' | 'CENTROS_CUSTO' | 'USUARIOS' | 'CONFIGURACOES' | 'AUTH'
 * @param {number} [params.registroId] - ID do registro afetado
 * @param {Object} [params.detalhes] - Objeto com detalhes adicionais
 */
async function registrarAuditoria({
  req = null,
  empresaId = null,
  adminId = null,
  usuarioNome = null,
  usuarioEmail = null,
  acao,
  modulo,
  registroId = null,
  detalhes = null,
}) {
  try {
    const finalEmpresaId = empresaId || req?.user?.empresa_id || req?.user?.activeEmpresaId || null;
    const finalAdminId = adminId || req?.user?.id || null;
    const finalNome = usuarioNome || req?.user?.nome || null;
    const finalEmail = usuarioEmail || req?.user?.email || null;

    if (!finalEmpresaId) {
      return null;
    }

    const ipOrigem =
      req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      "127.0.0.1";
    const userAgent = req?.headers?.["user-agent"] || "Sistema/API";

    const detalhesJson = detalhes ? JSON.stringify(detalhes) : null;

    const [res] = await db.query(
      `INSERT INTO logs_auditoria (
        empresa_id, admin_id, usuario_nome, usuario_email,
        acao, modulo, registro_id, detalhes, ip_origem, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalEmpresaId,
        finalAdminId,
        finalNome,
        finalEmail,
        acao.toUpperCase(),
        modulo.toUpperCase(),
        registroId,
        detalhesJson,
        ipOrigem.slice(0, 45),
        userAgent.slice(0, 255),
      ]
    );

    return res.insertId;
  } catch (err) {
    console.error("[AUDIT_ERROR] Falha ao registrar log de auditoria:", err.message);
    return null;
  }
}

module.exports = {
  registrarAuditoria,
};
