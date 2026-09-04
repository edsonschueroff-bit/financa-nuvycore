/**
 * Gerador de Payload PIX Padrão Banco Central do Brasil (EMV BR Code)
 */
function formatField(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(buffer) {
  let crc = 0xffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function gerarPayloadPix({ chave, nomeRecebedor, cidade = "SAO PAULO", valor, txid = "***" }) {
  const cleanChave = chave || "contato@nuvycore.online";
  const cleanNome = (nomeRecebedor || "Nuvy Finance").slice(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanCidade = (cidade || "SAO PAULO").slice(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const valorStr = valor ? parseFloat(valor).toFixed(2) : "0.00";

  let payload = "";
  payload += formatField("00", "01"); // Format Indicator
  payload += formatField("01", "12"); // Dynamic / Static

  // Merchant Account Info
  let merchantInfo = "";
  merchantInfo += formatField("00", "BR.GOV.BCB.PIX");
  merchantInfo += formatField("01", cleanChave);
  payload += formatField("26", merchantInfo);

  payload += formatField("52", "0000"); // Category Code
  payload += formatField("53", "986");  // Currency BRL
  payload += formatField("54", valorStr);
  payload += formatField("58", "BR");   // Country
  payload += formatField("59", cleanNome);
  payload += formatField("60", cleanCidade);

  // Additional Data Field (TxID)
  let addData = formatField("05", txid);
  payload += formatField("62", addData);

  // Checksum CRC16
  payload += "6304";
  const checksum = crc16(payload);
  return `${payload}${checksum}`;
}

module.exports = { gerarPayloadPix };
