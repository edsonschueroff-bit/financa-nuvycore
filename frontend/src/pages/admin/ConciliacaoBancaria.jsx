import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  Sparkles,
  Landmark,
  ArrowRight,
  CheckCircle,
  Upload,
  RefreshCw,
  Plus,
  EyeOff,
  Check,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  FolderUp,
  Trash2,
} from "lucide-react";

export default function ConciliacaoBancaria() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [extratoItens, setExtratoItens] = useState([]);
  const [contas, setContas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [centros, setCentros] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtro por Conta Bancária
  const [contaFiltroId, setContaFiltroId] = useState("");

  // Modal Criar e Conciliar
  const [modalCriar, setModalCriar] = useState(null);
  const [formCriar, setFormCriar] = useState({
    descricao: "",
    categoria_id: "",
    centro_custo_id: "",
    contato_id: "",
    conta_bancaria_id: "",
  });

  // Modal Importar Extrato (OFX / CSV / Linhas)
  const [modalImportar, setModalImportar] = useState(false);
  const [contaImportacaoId, setContaImportacaoId] = useState("");
  const [modoImportacao, setModoImportacao] = useState("arquivo"); // arquivo | texto
  const [textoOfx, setTextoOfx] = useState("");
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [processandoArquivo, setProcessandoArquivo] = useState(false);
  const fileInputRef = useRef(null);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const urlExtrato = contaFiltroId 
        ? `/conciliacao/extrato-pendente?conta_bancaria_id=${contaFiltroId}`
        : "/conciliacao/extrato-pendente";

      const [extRes, cRes, catRes, ccRes, contRes] = await Promise.all([
        api.get(urlExtrato),
        api.get("/contas-bancarias"),
        api.get("/categorias"),
        api.get("/categorias/centros-custo/todos"),
        api.get("/contatos"),
      ]);

      setExtratoItens(Array.isArray(extRes.data) ? extRes.data : (extRes.data?.data || extRes.data?.itens || []));
      const listaContas = Array.isArray(cRes.data?.contas) ? cRes.data.contas : [];
      setContas(listaContas);
      if (listaContas.length > 0 && !contaImportacaoId) {
        setContaImportacaoId(listaContas[0].id);
      }
      setCategorias(Array.isArray(catRes.data) ? catRes.data : []);
      setCentros(Array.isArray(ccRes.data) ? ccRes.data : []);
      setContatos(Array.isArray(contRes.data) ? contRes.data : (contRes.data?.data || []));
    } catch (err) {
      console.error("Erro ao carregar conciliação bancária:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [contaFiltroId]);

  const handleConciliarSugestao = async (item) => {
    if (!item.sugestao_match) return;
    try {
      await api.post("/conciliacao/conciliar", {
        openfinance_transacao_id: item.extrato.id,
        transacao_financeira_id: item.sugestao_match.id,
        conta_bancaria_id: item.extrato.conta_bancaria_id || item.sugestao_match.conta_bancaria_id,
      });
      toast.success("Lançamento conciliado com sucesso!");
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao conciliar transação.");
    }
  };

  const handleIgnorar = async (id) => {
    try {
      await api.post(`/conciliacao/ignorar/${id}`);
      toast.info("Lançamento ignorado da fila.");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao ignorar item.");
    }
  };

  const handleLimparFila = async () => {
    const ok = await confirm({
      title: "Limpar fila de conciliação?",
      description: "Deseja realmente limpar todos os lançamentos pendentes da fila para reimportar o extrato bancário?",
      confirmText: "Sim, limpar fila",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.post("/conciliacao/limpar-fila", {
        conta_bancaria_id: contaFiltroId || null,
      });
      toast.success("Fila de conciliação limpa com sucesso!");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao limpar fila de conciliação.");
    }
  };

  const handleCriarEConciliar = async (e) => {
    e.preventDefault();
    if (!modalCriar) return;

    try {
      await api.post("/conciliacao/criar-e-conciliar", {
        openfinance_transacao_id: modalCriar.id,
        ...formCriar,
      });
      setModalCriar(null);
      toast.success("Lançamento criado e conciliado com sucesso!");
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar lançamento e conciliar.");
    }
  };

  // Parser universal de OFX e CSV de qualquer banco (Bradesco, Nubank, Inter, etc.)
  const extrairTransacoesOFX = (conteudoTexto) => {
    const transacoes = [];

    // 1. OFX (<STMTTRN>)
    const regexBloco = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = regexBloco.exec(conteudoTexto)) !== null) {
      const bloco = match[1];
      const dataMatch = bloco.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/i);
      const valorMatch = bloco.match(/<TRNAMT>([^<\r\n]+)/i);
      const descMatch = bloco.match(/<MEMO>([^<\r\n]+)/i) || bloco.match(/<NAME>([^<\r\n]+)/i);

      if (valorMatch) {
        const val = parseFloat(valorMatch[1].trim().replace(",", "."));
        if (!isNaN(val)) {
          let dataFormatada = new Date().toISOString().split("T")[0];
          if (dataMatch) {
            dataFormatada = `${dataMatch[1]}-${dataMatch[2]}-${dataMatch[3]}`;
          }

          const descLimpa = descMatch ? descMatch[1].trim() : (val >= 0 ? "Crédito Bancário" : "Débito Bancário");
          transacoes.push({
            descricao_banco: descLimpa,
            valor: Math.abs(val),
            tipo: val >= 0 ? "credito" : "debito",
            data_ocorrencia: dataFormatada,
          });
        }
      }
    }

    if (transacoes.length > 0) return transacoes;

    // 2. CSV Bancos Brasileiros (Bradesco, Nubank, Itaú, Inter, etc.)
    const linhas = conteudoTexto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (linhas.length === 0) return [];

    let sep = ";";
    if (linhas[0].includes(";")) sep = ";";
    else if (linhas[0].includes("\t")) sep = "\t";
    else if (linhas[0].includes(",")) sep = ",";

    // Encontrar cabeçalho se houver
    let headerCols = [];
    let startIdx = 0;

    for (let i = 0; i < Math.min(10, linhas.length); i++) {
      const l = linhas[i].toLowerCase();
      if ((l.includes("data") || l.includes("dt")) && (l.includes("historico") || l.includes("histórico") || l.includes("descri") || l.includes("valor") || l.includes("lançamento"))) {
        headerCols = linhas[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim().toLowerCase());
        startIdx = i + 1;
        break;
      }
    }

    // Identificar índices no cabeçalho
    let idxData = headerCols.findIndex((c) => c.includes("data") || c.includes("dt"));
    let idxDesc = headerCols.findIndex((c) => c.includes("hist") || c.includes("desc") || c.includes("transa"));
    let idxCredito = headerCols.findIndex((c) => c.includes("crédito") || c.includes("credito") || c.includes("entrada"));
    let idxDebito = headerCols.findIndex((c) => c.includes("débito") || c.includes("debito") || c.includes("saída") || c.includes("saida"));
    let idxValorUnico = headerCols.findIndex((c) => c === "valor" || (c.includes("valor") && !c.includes("saldo")));

    // Função auxiliar para parsear valores brasileiros
    const parseMoeda = (str) => {
      if (!str) return null;
      let s = str.replace(/R\$\s?/gi, "").replace(/\s/g, "");
      // Checar se termina com 'D' (Débito) ou 'C' (Crédito) como faz o Bradesco (ex: "595,78 D")
      let isExplicitDebito = false;
      let isExplicitCredito = false;

      if (/[dD]$/.test(s)) {
        isExplicitDebito = true;
        s = s.replace(/[dD]$/, "");
      } else if (/[cC]$/.test(s)) {
        isExplicitCredito = true;
        s = s.replace(/[cC]$/, "");
      }

      let val = null;
      if (/^[+-]?\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) {
        val = parseFloat(s.replace(/\./g, "").replace(",", "."));
      } else if (/^[+-]?\d+,\d{2}$/.test(s)) {
        val = parseFloat(s.replace(",", "."));
      } else if (/^[+-]?\d+(\.\d{2})?$/.test(s)) {
        val = parseFloat(s);
      }

      if (val === null || isNaN(val)) return null;

      if (isExplicitDebito) val = -Math.abs(val);
      else if (isExplicitCredito) val = Math.abs(val);

      return val;
    };

    for (let i = startIdx; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      const colunas = linha.split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
      if (colunas.length < 2) continue;

      // Pular linhas de saldo ou totalizadores
      const linhaBaixa = linha.toLowerCase();
      if (linhaBaixa.includes("saldo anterior") || linhaBaixa.includes("total do período") || linhaBaixa.includes("saldo em conta") || linhaBaixa.includes("saldo atual") || linhaBaixa.includes("saldo final")) {
        continue;
      }

      let dataVal = new Date().toISOString().split("T")[0];
      let descVal = "";
      let valorFinal = null;
      let tipoFinal = "debito";

      // 1. Se achou cabeçalho explícito com colunas de Crédito e Débito separadas
      if (idxCredito !== -1 || idxDebito !== -1) {
        const vCred = idxCredito !== -1 ? parseMoeda(colunas[idxCredito]) : null;
        const vDeb = idxDebito !== -1 ? parseMoeda(colunas[idxDebito]) : null;

        if (vCred !== null && vCred > 0) {
          valorFinal = vCred;
          tipoFinal = "credito";
        } else if (vDeb !== null && vDeb !== 0) {
          valorFinal = Math.abs(vDeb);
          tipoFinal = "debito";
        }
      }

      // 2. Se achou cabeçalho com coluna única de valor
      if (valorFinal === null && idxValorUnico !== -1) {
        const v = parseMoeda(colunas[idxValorUnico]);
        if (v !== null && v !== 0) {
          valorFinal = Math.abs(v);
          tipoFinal = v >= 0 ? "credito" : "debito";
        }
      }

      // 3. Fallback: procurar coluna com valor se não identificou no cabeçalho
      if (valorFinal === null) {
        for (let c = colunas.length - 1; c >= 0; c--) {
          const v = parseMoeda(colunas[c]);
          if (v !== null && v !== 0) {
            valorFinal = Math.abs(v);
            tipoFinal = v >= 0 ? "credito" : "debito";
            break;
          }
        }
      }

      if (valorFinal === null || valorFinal === 0) continue;

      // Pegar Data
      if (idxData !== -1 && colunas[idxData]) {
        const m = colunas[idxData].match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
          let ano = m[3];
          if (ano.length === 2) ano = "20" + ano;
          dataVal = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
      } else {
        for (let c = 0; c < colunas.length; c++) {
          const m = colunas[c].match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
          if (m) {
            let ano = m[3];
            if (ano.length === 2) ano = "20" + ano;
            dataVal = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
            break;
          }
        }
      }

      // Pegar Descrição Real
      if (idxDesc !== -1 && colunas[idxDesc]) {
        descVal = colunas[idxDesc];
      } else {
        // Encontrar coluna de texto mais representativa que não seja data nem número
        for (let c = 0; c < colunas.length; c++) {
          const col = colunas[c];
          if (col.length > descVal.length && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(col) && parseMoeda(col) === null) {
            descVal = col;
          }
        }
      }

      if (!descVal || descVal.length < 2) {
        descVal = tipoFinal === "credito" ? "Recebimento / Crédito" : "Pagamento / Débito";
      }

      transacoes.push({
        descricao_banco: descVal,
        valor: valorFinal,
        tipo: tipoFinal,
        data_ocorrencia: dataVal,
      });
    }

    return transacoes;
  };

  const handleProcessarArquivo = async (file) => {
    if (!file) return;
    setProcessandoArquivo(true);
    try {
      const texto = await file.text();
      const parsed = extrairTransacoesOFX(texto);

      if (parsed.length === 0) {
        toast.error(
          "Não foi possível identificar linhas válidas. Verifique se o arquivo possui colunas com Data, Histórico e Valor."
        );
        setProcessandoArquivo(false);
        return;
      }

      await api.post("/openfinance/importar-extrato", {
        conta_bancaria_id: contaImportacaoId || null,
        transacoes: parsed,
      });

      toast.success(`${parsed.length} movimentação(ões) importada(s) com sucesso para conciliação!`);
      setModalImportar(false);
      setArquivoSelecionado(null);
      setTextoOfx("");
      carregarDados();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Erro ao processar arquivo de extrato.");
    } finally {
      setProcessandoArquivo(false);
    }
  };

  const handleImportarManual = async (e) => {
    e.preventDefault();
    if (modoImportacao === "arquivo") {
      if (!arquivoSelecionado) {
        toast.warning("Por favor, selecione ou arraste um arquivo OFX ou CSV.");
        return;
      }
      await handleProcessarArquivo(arquivoSelecionado);
      return;
    }

    if (!textoOfx.trim()) {
      toast.warning("Por favor, cole as linhas do extrato.");
      return;
    }

    const parsed = extrairTransacoesOFX(textoOfx);
    if (parsed.length === 0) {
      toast.error("Nenhuma transação válida identificada. Verifique o formato.");
      return;
    }

    try {
      await api.post("/openfinance/importar-extrato", {
        conta_bancaria_id: contaImportacaoId || null,
        transacoes: parsed,
      });
      setModalImportar(false);
      setTextoOfx("");
      carregarDados();
      toast.success("Extrato importado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao importar extrato.");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Superior com Indicadores e Ações */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Conciliação Bancária</h1>
              <Badge variant="success" icon={<Sparkles size={11} />}>
                Auto-Match Inteligente
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Importe o extrato (OFX ou CSV) do seu banco e concilie lançamentos em 1 clique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {extratoItens.length > 0 && (
              <Button
                variant="outline"
                className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                icon={<Trash2 size={14} />}
                onClick={handleLimparFila}
                title="Limpar lançamentos pendentes desta fila"
              >
                Limpar Fila
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Upload size={15} />}
              onClick={() => setModalImportar(true)}
            >
              Importar Extrato (OFX / CSV)
            </Button>
          </div>
        </div>

        {/* Card Executivo de Status da Conciliação */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Extrato a Conciliar</span>
              <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{extratoItens.length}</p>
              <p className="text-[10px] text-amber-700 font-bold mt-0.5">Aguardando conferência</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <RefreshCw size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Sugestões de Auto-Match</span>
              <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {extratoItens.filter((i) => i.sugestao_match).length}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Prontas para conciliar em 1 clique</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
          </Card>

          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Contas no Sistema</span>
              <p className="text-2xl font-black text-blue-600 mt-1 font-mono">
                {contas.length}
              </p>
              <p className="text-[10px] text-blue-700 font-bold mt-0.5">Contas e caixas cadastrados</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Landmark size={20} />
            </div>
          </Card>
        </div>

        {/* Fila de Conciliação Lado a Lado */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600" />
                Fila de Conciliação ({extratoItens.length})
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                Cruze os registros do extrato com os lançamentos do sistema
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar por Conta:</label>
              <select
                value={contaFiltroId}
                onChange={(e) => setContaFiltroId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              >
                <option value="">Todas as Contas ({contas.length})</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <Card padding="lg" className="text-center text-slate-400 text-xs">
              Carregando motor de conciliação...
            </Card>
          ) : extratoItens.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={24} />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Tudo 100% Conciliado! 🎉</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Não há nenhuma movimentação pendente no extrato bancário. Para importar novos lançamentos, clique no botão <strong>"Importar Extrato (OFX / CSV)"</strong> acima.
              </p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  icon={<Upload size={14} />}
                  onClick={() => setModalImportar(true)}
                >
                  Importar Novo Extrato
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {extratoItens.map((item) => {
                const ext = item.extrato;
                const match = item.sugestao_match;
                const isCredito = ext.tipo === "credito";

                return (
                  <Card
                    key={ext.id}
                    padding="md"
                    className="hover:border-emerald-500/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Lado Esquerdo: Transação do Banco (Extrato) */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={isCredito ? "success" : "danger"}>
                          {isCredito ? "ENTRADA (CRÉDITO)" : "SAÍDA (DÉBITO)"}
                        </Badge>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {new Date(ext.data_ocorrencia).toLocaleDateString("pt-BR")} •{" "}
                          {ext.conta_nome || "Extrato Bancário"}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-900 text-sm">{ext.descricao_banco}</h4>

                      <p
                        className={`text-lg font-black tracking-tight font-mono ${
                          isCredito ? "text-emerald-600" : "text-slate-900"
                        }`}
                      >
                        {isCredito ? "+" : "-"}
                        {formatBRL(ext.valor)}
                      </p>
                    </div>

                    {/* Ícone de Ligação Central */}
                    <div className="hidden lg:flex items-center justify-center text-slate-300">
                      <ArrowRight size={20} />
                    </div>

                    {/* Lado Direito: Sugestão de Auto-Match ou Botão de Novo Lançamento */}
                    <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      {match ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Badge variant="primary" icon={<Sparkles size={10} />}>
                              {match.score_confianca}% de Confiança
                            </Badge>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Venc: {new Date(match.data_vencimento).toLocaleDateString("pt-BR")}
                            </span>
                          </div>

                          <p className="font-bold text-slate-800 text-xs truncate">{match.descricao}</p>
                          <p className="text-[11px] text-slate-500">
                            {match.contato_nome || "Sem contato"} • {match.categoria_nome || "Sem categoria"}
                          </p>

                          <div className="pt-2 flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Check size={13} />}
                              onClick={() => handleConciliarSugestao(item)}
                            >
                              Conciliar Agora
                            </Button>
                          </div>
                        </div>
                      ) : item.alerta_ja_pago ? (
                        <div className="space-y-2 bg-amber-50/80 p-3 rounded-xl border border-amber-200">
                          <div className="flex items-center justify-between">
                            <Badge variant="warning" icon={<AlertCircle size={10} />}>
                              Possível Lançamento Já Liquidado
                            </Badge>
                            <span className="text-[10px] text-amber-800 font-bold">
                              {new Date(item.alerta_ja_pago.data_pagamento).toLocaleDateString("pt-BR")}
                            </span>
                          </div>

                          <div>
                            <p className="font-bold text-slate-900 text-xs truncate">
                              "{item.alerta_ja_pago.descricao}"
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Valor exato de <strong>{formatBRL(item.alerta_ja_pago.valor)}</strong> já registrado no sistema como pago.
                            </p>
                          </div>

                          <div className="pt-2 flex items-center justify-end gap-2 border-t border-amber-200/60">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs bg-white text-slate-700 hover:bg-slate-50"
                              onClick={() => handleIgnorar(ext.id)}
                            >
                              Já Lançado (Descartar Extrato)
                            </Button>
                            <Button
                              variant="dark"
                              size="sm"
                              icon={<Plus size={12} />}
                              onClick={() => {
                                setModalCriar(ext);
                                setFormCriar({
                                  descricao: ext.descricao_banco,
                                  categoria_id: categorias[0]?.id || "",
                                  centro_custo_id: "",
                                  contato_id: "",
                                  conta_bancaria_id: ext.conta_bancaria_id || (contas[0]?.id || ""),
                                });
                              }}
                            >
                              Criar Novo Assim Mesmo
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-between h-full space-y-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              Sem lançamento provisionado correspondente
                            </span>
                            <p className="text-xs text-slate-600 font-medium mt-0.5">
                              Deseja registrar e classificar essa movimentação no plano de contas?
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              variant="dark"
                              size="sm"
                              icon={<Plus size={13} />}
                              onClick={() => {
                                setModalCriar(ext);
                                setFormCriar({
                                  descricao: ext.descricao_banco,
                                  categoria_id: categorias[0]?.id || "",
                                  centro_custo_id: "",
                                  contato_id: "",
                                  conta_bancaria_id: ext.conta_bancaria_id || (contas[0]?.id || ""),
                                });
                              }}
                            >
                              Criar & Conciliar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-slate-600"
                              onClick={() => handleIgnorar(ext.id)}
                              title="Ignorar movimentação"
                            >
                              <EyeOff size={14} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal 1: Criar e Conciliar */}
        <Modal
          isOpen={!!modalCriar}
          onClose={() => setModalCriar(null)}
          title="Classificar & Conciliar Lançamento"
          size="md"
        >
          {modalCriar && (
            <form onSubmit={handleCriarEConciliar} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">{modalCriar.descricao_banco}</p>
                <p className="text-slate-600 font-bold mt-0.5">
                  Valor no Extrato:{" "}
                  <strong className={modalCriar.tipo === "credito" ? "text-emerald-600 font-mono" : "text-rose-600 font-mono"}>
                    {formatBRL(modalCriar.valor)}
                  </strong>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição Contábil</label>
                <input
                  type="text"
                  required
                  value={formCriar.descricao}
                  onChange={(e) => setFormCriar({ ...formCriar, descricao: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Categoria (Plano de Contas DRE)</label>
                <select
                  required
                  value={formCriar.categoria_id}
                  onChange={(e) => setFormCriar({ ...formCriar, categoria_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione a categoria...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.dre_grupo?.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Centro de Custo</label>
                  <select
                    value={formCriar.centro_custo_id}
                    onChange={(e) => setFormCriar({ ...formCriar, centro_custo_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Opcional...</option>
                    {centros.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cliente / Fornecedor</label>
                  <select
                    value={formCriar.contato_id}
                    onChange={(e) => setFormCriar({ ...formCriar, contato_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Opcional...</option>
                    {contatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setModalCriar(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary">
                  Salvar e Conciliar
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal 2: Importar Extrato (OFX / CSV / Arquivo) */}
        <Modal
          isOpen={modalImportar}
          onClose={() => setModalImportar(false)}
          title="Importar Extrato Bancário"
          subtitle="Suporta arquivos .OFX e .CSV de qualquer banco brasileiro"
          icon={<Upload className="text-emerald-600" size={18} />}
          size="lg"
        >
          <form onSubmit={handleImportarManual} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Conta Bancária de Destino
              </label>
              <select
                required
                value={contaImportacaoId}
                onChange={(e) => setContaImportacaoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="">Selecione a conta...</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (Saldo atual: {formatBRL(c.saldo_atual)})
                  </option>
                ))}
              </select>
            </div>

            {/* Alternador de Método de Importação */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setModoImportacao("arquivo")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoImportacao === "arquivo"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FolderUp size={14} /> Arquivo OFX / CSV
              </button>
              <button
                type="button"
                onClick={() => setModoImportacao("texto")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoImportacao === "texto"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText size={14} /> Colar Linhas de Texto
              </button>
            </div>

            {modoImportacao === "arquivo" ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".ofx,.csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setArquivoSelecionado(f);
                  }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Upload size={22} />
                  </div>
                  {arquivoSelecionado ? (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        📄 {arquivoSelecionado.name}
                      </p>
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        {(arquivoSelecionado.size / 1024).toFixed(1)} KB • Pronto para importar
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-slate-800">
                        Clique aqui para escolher ou arraste seu arquivo .OFX ou .CSV
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Compatível com Bradesco, Nubank, Itaú, Inter, Santander, Banco do Brasil, Cora, C6, etc.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cole as Linhas do Extrato (Descrição; Valor)
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder={`PIX RECEBIDO CLIENTE XYZ; 1500.00\nPAGAMENTO BOLETO LUZ; -280.50\nTARIFA BANCARIA; -49.90`}
                  value={textoOfx}
                  onChange={(e) => setTextoOfx(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Formato aceito: Linhas com Descrição e Valor separados por ponto-e-vírgula ou tabulação.
                </p>
              </div>
            )}

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalImportar(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={processandoArquivo || (modoImportacao === "arquivo" && !arquivoSelecionado)}
              >
                {processandoArquivo ? "Processando..." : "Importar Extrato"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal de Confirmação Acessível (Radix UI / Shadcn) */}
        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
