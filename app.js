const estado = {
  textos: [],
  textoAtualIndex: 0,
  faseAtualIndex: 0,
  unidadeAtualIndex: 0,
  modo: 'frases',
  palavrasOriginais: [],
  palavrasSelecionadas: [],
  unidadeAtual: null,
  errosUnidade: 0,
  unidadeConcluida: false,
  sessaoImportada: null,
  mudouDesdeExportacao: false,
  workout: {
    ativo: false,
    itens: [],
    index: 0,
  },
};

const MAX_PALAVRAS_POR_TRECHO = 12;
const MIN_PALAVRAS_POR_TRECHO = 5;
const STATS_KEY = 'memorizadorTextosStatsV3';
const SESSION_KEY = 'memorizadorTextosSessionV3';
const PROGRESS_TYPE = 'memorizador_textos_progresso';
const PROGRESS_VERSION = 3;

const inputJson = document.getElementById('input-json');
const inputProgresso = document.getElementById('input-progresso');
const btnBaixarProgresso = document.getElementById('btn-baixar-progresso');
const selectTexto = document.getElementById('select-texto');
const selectModo = document.getElementById('select-modo');
const selectFase = document.getElementById('select-fase');
const nomeArquivo = document.getElementById('nome-arquivo');
const erroArquivo = document.getElementById('erro-arquivo');

const painelFases = document.getElementById('painel-fases');
const listaFases = document.getElementById('lista-fases');
const resumoFase = document.getElementById('resumo-fase');
const btnRepetirFase = document.getElementById('btn-repetir-fase');
const btnWorkout = document.getElementById('btn-workout');
const btnSairWorkout = document.getElementById('btn-sair-workout');
const painelTecnico = document.getElementById('painel-tecnico');
const dadosTecnicos = document.getElementById('dados-tecnicos');

const telaVazia = document.getElementById('tela-vazia');
const textoRevelado = document.getElementById('texto-revelado');
const textoCorrido = document.getElementById('texto-corrido');
const elTitulo = document.getElementById('titulo-texto');
const elStatusCabecote = document.getElementById('status-cabecote');
const linhaProgressoFase = document.getElementById('linha-progresso-fase');
const labelProgressoFase = document.getElementById('label-progresso-fase');
const labelProgressoUnidade = document.getElementById('label-progresso-unidade');
const barraProgressoFase = document.getElementById('barra-progresso-fase');
const areaMontagem = document.getElementById('area-montagem');
const areaPalavras = document.getElementById('area-palavras');
const feedback = document.getElementById('feedback');
const rodapeTreino = document.getElementById('rodape-treino');
const btnAnterior = document.getElementById('btn-anterior');
const btnProximo = document.getElementById('btn-proximo');
const btnReiniciar = document.getElementById('btn-reiniciar');

inputJson.addEventListener('change', carregarArquivosJson);
inputProgresso.addEventListener('change', importarProgresso);
btnBaixarProgresso.addEventListener('click', baixarProgresso);
selectTexto.addEventListener('change', trocarTextoSelecionado);
selectModo.addEventListener('change', trocarModoTreino);
selectFase.addEventListener('change', () => irParaFase(Number(selectFase.value)));
btnRepetirFase.addEventListener('click', repetirFaseAtual);
btnWorkout.addEventListener('click', iniciarWorkoutDosErros);
btnSairWorkout.addEventListener('click', sairDoWorkout);
btnAnterior.addEventListener('click', unidadeAnterior);
btnProximo.addEventListener('click', proximaUnidade);
btnReiniciar.addEventListener('click', carregarUnidadeAtual);

window.addEventListener('beforeunload', event => {
  if (!estado.mudouDesdeExportacao) return;
  event.preventDefault();
  event.returnValue = '';
});

async function carregarArquivosJson(event) {
  limparErro();
  const arquivos = Array.from(event.target.files || []);
  if (!arquivos.length) return;

  const textosCarregados = [];
  const nomes = [];
  const erros = [];

  for (const arquivo of arquivos) {
    try {
      const conteudo = await arquivo.text();
      const json = JSON.parse(conteudo);
      textosCarregados.push(...normalizarJson(json, arquivo.name));
      nomes.push(arquivo.name);
    } catch (erro) {
      erros.push(`${arquivo.name}: ${erro.message}`);
    }
  }

  if (textosCarregados.length) {
    estado.textos = textosCarregados;
    estado.textoAtualIndex = 0;
    estado.faseAtualIndex = 0;
    estado.unidadeAtualIndex = 0;
    desativarWorkout();
    popularSelectTextos();
    popularSelectFases();
    nomeArquivo.textContent = `Carregado: ${nomes.join(', ')}`;
    painelFases.hidden = false;
    painelTecnico.hidden = false;
    telaVazia.hidden = true;
    textoRevelado.hidden = false;
    linhaProgressoFase.hidden = false;

    const restaurou = tentarRestaurarSessaoImportada() || tentarRestaurarSessaoLocal();
    if (!restaurou) carregarUnidadeAtual();
  }

  if (erros.length) mostrarErro(erros.join(' | '));
  inputJson.value = '';
}

async function importarProgresso(event) {
  limparErro();
  const arquivo = event.target.files && event.target.files[0];
  if (!arquivo) return;

  try {
    const conteudo = await arquivo.text();
    const pacote = JSON.parse(conteudo);
    const statsImportados = extrairStatsDoProgresso(pacote);

    if (!statsImportados || typeof statsImportados !== 'object') {
      throw new Error('o arquivo não parece ser um JSON de progresso válido.');
    }

    if (estado.textos.length && pacote.current && pacote.current.textKey) {
      const texto = obterTextoAtual();
      if (texto && pacote.current.textKey !== chaveTexto(texto)) {
        throw new Error('este progresso não corresponde ao livro atualmente carregado.');
      }
    }

    salvarStats({ ...lerStats(), ...statsImportados });
    estado.sessaoImportada = pacote.current || null;
    estado.mudouDesdeExportacao = false;
    atualizarFeedback('Progresso importado.', 'ok');

    if (estado.textos.length) {
      const restaurou = tentarRestaurarSessaoImportada();
      if (!restaurou) carregarUnidadeAtual();
    }
    renderizarPainelFases();
  } catch (erro) {
    mostrarErro(`${arquivo.name}: ${erro.message}`);
  } finally {
    inputProgresso.value = '';
  }
}

function extrairStatsDoProgresso(pacote) {
  if (pacote && pacote.tipo === PROGRESS_TYPE && pacote.stats) return pacote.stats;
  if (pacote && pacote.stats) return pacote.stats;
  return pacote;
}

function baixarProgresso() {
  const pacote = criarPacoteProgresso();
  const texto = obterTextoAtual();
  const nomeTexto = texto ? slugificar(texto.titulo) : 'sem-texto-carregado';
  const nomeArquivoProgresso = `progresso_${nomeTexto}_${timestampParaArquivo()}.json`;
  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = nomeArquivoProgresso;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  estado.mudouDesdeExportacao = false;
  atualizarFeedback(`Progresso baixado: ${nomeArquivoProgresso}`, 'ok');
}

function criarPacoteProgresso() {
  return {
    tipo: PROGRESS_TYPE,
    versao: PROGRESS_VERSION,
    exportedAt: new Date().toISOString(),
    exportedAtLocal: timestampLegivelLocal(),
    current: criarEstadoAtualParaExportar(),
    stats: lerStats(),
  };
}

function criarEstadoAtualParaExportar() {
  const texto = obterTextoAtual();
  if (!texto) return null;
  return {
    textKey: chaveTexto(texto),
    titulo: texto.titulo,
    modo: estado.modo,
    faseAtualIndex: estado.faseAtualIndex,
    unidadeAtualIndex: estado.unidadeAtualIndex,
    unidadeConcluida: estado.unidadeConcluida,
    workoutAtivo: estado.workout.ativo,
    workoutIndex: estado.workout.index,
  };
}

function salvarSessaoLocal() {
  try {
    const current = criarEstadoAtualParaExportar();
    if (current) localStorage.setItem(SESSION_KEY, JSON.stringify(current));
  } catch (erro) {
    console.warn('Não foi possível salvar a sessão atual.', erro);
  }
}

function lerSessaoLocal() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch (erro) {
    return null;
  }
}

function tentarRestaurarSessaoLocal() {
  const sessao = lerSessaoLocal();
  if (!sessao) return false;
  estado.sessaoImportada = sessao;
  return tentarRestaurarSessaoImportada();
}

function tentarRestaurarSessaoImportada() {
  const textoAtual = obterTextoAtual();
  const sessao = estado.sessaoImportada;
  if (!textoAtual || !sessao || sessao.textKey !== chaveTexto(textoAtual)) return false;

  if (sessao.modo === 'frases' || sessao.modo === 'paragrafos') {
    estado.modo = sessao.modo;
    selectModo.value = estado.modo;
  }

  desativarWorkout();
  estado.faseAtualIndex = limitarNumero(sessao.faseAtualIndex, 0, textoAtual.fases.length - 1);
  popularSelectFases();

  const unidades = obterUnidadesDaFase();
  estado.unidadeAtualIndex = limitarNumero(sessao.unidadeAtualIndex || 0, 0, Math.max(0, unidades.length - 1));
  carregarUnidadeAtual();
  atualizarFeedback('Sessão restaurada a partir do progresso salvo.', 'ok');
  return true;
}

function limitarNumero(valor, minimo, maximo) {
  const numero = Number.isFinite(Number(valor)) ? Number(valor) : minimo;
  return Math.max(minimo, Math.min(maximo, numero));
}

function normalizarJson(json, nomeOrigem) {
  const lista = Array.isArray(json) ? json : [json];
  return lista.map((item, index) => normalizarTexto(item, index, nomeOrigem));
}

function normalizarTexto(item, index, nomeOrigem) {
  const titulo = String(item.titulo || item.title || `${nomeOrigem} — texto ${index + 1}`).trim();
  const autor = item.autor || item.author || '';
  const blocoParagrafos = item.paragrafos || item.paragraphs || item.textos || item.text || [];
  const blocoFrasesTopo = item.frases || item.sentences || [];
  const itensParagrafo = Array.isArray(blocoParagrafos) ? blocoParagrafos : [blocoParagrafos];
  const fases = [];

  itensParagrafo.forEach((itemParagrafo, phaseIndex) => {
    const fase = criarFaseVazia(phaseIndex);

    if (typeof itemParagrafo === 'string') {
      const texto = limparTexto(itemParagrafo);
      if (texto) preencherFaseComFrases(fase, [texto]);
    } else if (itemParagrafo && typeof itemParagrafo === 'object') {
      const textoParagrafo = limparTexto(itemParagrafo.texto || itemParagrafo.text || itemParagrafo.conteudo || '');
      const frasesJson = itemParagrafo.frases || itemParagrafo.sentences || [];
      const frases = extrairFrases(frasesJson);

      fase.texto = textoParagrafo || frases.join(' ');
      preencherFaseComFrases(fase, frases.length ? frases : [fase.texto]);
    }

    if (fase.texto || fase.unidadesPorTrecho.length) {
      if (!fase.texto) fase.texto = fase.unidadesPorTrecho.map(unidade => unidade.texto).join(' ');
      fase.unidadesPorParagrafo = [{
        texto: fase.texto,
        phaseIndex,
        paragraphIndex: phaseIndex,
        unitIndex: 0,
        sentenceId: `${phaseIndex}:p`,
        sentenceIndex: 0,
        partIndex: 0,
        partsInSentence: 1,
      }];
      fases.push(fase);
    }
  });

  if (!fases.length && Array.isArray(blocoFrasesTopo) && blocoFrasesTopo.length) {
    const fase = criarFaseVazia(0);
    preencherFaseComFrases(fase, extrairFrases(blocoFrasesTopo));
    fase.texto = fase.unidadesPorTrecho.map(unidade => unidade.texto).join(' ');
    fase.unidadesPorParagrafo = [{
      texto: fase.texto,
      phaseIndex: 0,
      paragraphIndex: 0,
      unitIndex: 0,
      sentenceId: '0:p',
      sentenceIndex: 0,
      partIndex: 0,
      partsInSentence: 1,
    }];
    if (fase.texto) fases.push(fase);
  }

  if (!fases.length) throw new Error('não encontrei textos válidos em paragrafos ou frases.');
  const texto = { titulo, autor, fases, origem: nomeOrigem };
  texto.key = chaveTexto(texto);
  return texto;
}

function criarFaseVazia(phaseIndex) {
  return {
    phaseIndex,
    paragraphIndex: phaseIndex,
    titulo: `Parágrafo ${phaseIndex + 1}`,
    texto: '',
    unidadesPorTrecho: [],
    unidadesPorParagrafo: [],
  };
}

function extrairFrases(frasesJson) {
  if (!Array.isArray(frasesJson)) return [];
  return frasesJson.map(itemFrase => {
    if (typeof itemFrase === 'string') return limparTexto(itemFrase);
    return limparTexto(itemFrase && (itemFrase.texto || itemFrase.text || itemFrase.conteudo || ''));
  }).filter(Boolean);
}

function preencherFaseComFrases(fase, frases) {
  let unitIndex = fase.unidadesPorTrecho.length;
  const frasesValidas = frases.map(limparTexto).filter(Boolean);
  if (!fase.texto) fase.texto = frasesValidas.join(' ');

  frasesValidas.forEach((frase, sentenceIndex) => {
    const partes = quebrarTextoEmTrechos(frase, MAX_PALAVRAS_POR_TRECHO);
    const sentenceId = `${fase.phaseIndex}:${sentenceIndex}`;
    partes.forEach((parte, partIndex) => {
      fase.unidadesPorTrecho.push({
        texto: parte,
        phaseIndex: fase.phaseIndex,
        paragraphIndex: fase.paragraphIndex,
        unitIndex,
        sentenceId,
        sentenceIndex,
        partIndex,
        partsInSentence: partes.length,
      });
      unitIndex += 1;
    });
  });
}

function limparTexto(valor) {
  return String(valor || '')
    .replaceAll(String.fromCharCode(13), ' ')
    .replaceAll(String.fromCharCode(10), ' ')
    .replaceAll(String.fromCharCode(9), ' ')
    .split(' ')
    .filter(Boolean)
    .join(' ')
    .trim();
}

function quebrarTextoEmTrechos(texto, maxPalavras) {
  const palavras = separarPalavras(texto);
  const total = palavras.length;
  if (total <= maxPalavras) return [limparTexto(texto)];

  const quantidadeTrechos = Math.ceil(total / maxPalavras);
  const tamanhoAlvo = total / quantidadeTrechos;
  const cortes = [];
  let corteAnterior = 0;

  for (let parte = 1; parte < quantidadeTrechos; parte++) {
    const corteIdeal = Math.round(parte * tamanhoAlvo);
    const cortesRestantes = quantidadeTrechos - parte;
    const minimo = Math.max(corteAnterior + MIN_PALAVRAS_POR_TRECHO, 1);
    const maximo = Math.min(total - cortesRestantes * MIN_PALAVRAS_POR_TRECHO, total - 1);
    const corte = escolherMelhorCorte(palavras, corteIdeal, minimo, maximo);
    cortes.push(corte);
    corteAnterior = corte;
  }

  const trechos = [];
  let inicio = 0;
  [...cortes, total].forEach(fim => {
    const trecho = palavras.slice(inicio, fim).join(' ').trim();
    if (trecho) trechos.push(trecho);
    inicio = fim;
  });
  return trechos;
}

function escolherMelhorCorte(palavras, corteIdeal, minimo, maximo) {
  const candidatos = [];
  for (let i = minimo; i <= maximo; i++) {
    if (terminaComPontuacaoDeCorte(palavras[i - 1] || '')) candidatos.push(i);
  }
  if (!candidatos.length) return Math.max(minimo, Math.min(maximo, corteIdeal));
  return candidatos.reduce((melhor, atual) => {
    const distanciaMelhor = Math.abs(melhor - corteIdeal);
    const distanciaAtual = Math.abs(atual - corteIdeal);
    return distanciaAtual < distanciaMelhor ? atual : melhor;
  }, candidatos[0]);
}

function terminaComPontuacaoDeCorte(palavra) {
  let texto = palavra.trim();
  const envoltorios = ['"', "'", '”', '’', ')', ']', '}'];
  while (texto && envoltorios.includes(texto[texto.length - 1])) texto = texto.slice(0, -1);
  return ['.', ',', ';', ':', '?', '!', '…'].includes(texto[texto.length - 1]);
}

function obterTextoAtual() {
  return estado.textos[estado.textoAtualIndex];
}

function obterFaseAtual() {
  const texto = obterTextoAtual();
  return texto ? texto.fases[estado.faseAtualIndex] : null;
}

function obterUnidadesDaFase() {
  const fase = obterFaseAtual();
  if (!fase) return [];
  return estado.modo === 'paragrafos' ? fase.unidadesPorParagrafo : fase.unidadesPorTrecho;
}

function obterUnidadeAtual() {
  if (estado.workout.ativo) return estado.workout.itens[estado.workout.index] || null;
  return obterUnidadesDaFase()[estado.unidadeAtualIndex] || null;
}

function rotuloModo() {
  if (estado.workout.ativo) return 'Workout';
  return estado.modo === 'paragrafos' ? 'Parágrafo' : 'Trecho';
}

function popularSelectTextos() {
  selectTexto.innerHTML = '';
  estado.textos.forEach((texto, index) => {
    const totalTrechos = texto.fases.reduce((soma, fase) => soma + fase.unidadesPorTrecho.length, 0);
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${texto.titulo} (${texto.fases.length} fases / ${totalTrechos} trechos)`;
    selectTexto.appendChild(option);
  });
  selectTexto.disabled = estado.textos.length <= 1;
  selectModo.disabled = false;
  selectModo.value = estado.modo;
  selectTexto.value = String(estado.textoAtualIndex);
}

function popularSelectFases() {
  const texto = obterTextoAtual();
  if (!texto) return;
  selectFase.innerHTML = '';
  texto.fases.forEach((fase, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${fase.titulo}`;
    selectFase.appendChild(option);
  });
  selectFase.disabled = texto.fases.length <= 1;
  selectFase.value = String(estado.faseAtualIndex);
  renderizarPainelFases();
}

function trocarTextoSelecionado() {
  estado.textoAtualIndex = Number(selectTexto.value);
  estado.faseAtualIndex = 0;
  estado.unidadeAtualIndex = 0;
  desativarWorkout();
  popularSelectFases();
  carregarUnidadeAtual();
}

function trocarModoTreino() {
  estado.modo = selectModo.value;
  estado.unidadeAtualIndex = 0;
  desativarWorkout();
  carregarUnidadeAtual();
  renderizarPainelFases();
}

function irParaFase(index) {
  const texto = obterTextoAtual();
  if (!texto || index < 0 || index >= texto.fases.length) return;
  estado.faseAtualIndex = index;
  estado.unidadeAtualIndex = 0;
  desativarWorkout();
  selectFase.value = String(index);
  carregarUnidadeAtual();
}

function repetirFaseAtual() {
  desativarWorkout();
  estado.unidadeAtualIndex = 0;
  carregarUnidadeAtual();
}

function carregarUnidadeAtual() {
  const texto = obterTextoAtual();
  const unidade = obterUnidadeAtual();
  if (!texto || !unidade) return;

  if (!estado.workout.ativo) {
    estado.faseAtualIndex = unidade.phaseIndex;
    selectFase.value = String(estado.faseAtualIndex);
  }

  estado.unidadeAtual = unidade;
  estado.palavrasOriginais = separarPalavras(unidade.texto);
  estado.palavrasSelecionadas = [];
  estado.errosUnidade = 0;
  estado.unidadeConcluida = false;

  feedback.textContent = '';
  feedback.className = 'feedback';
  telaVazia.hidden = true;
  textoRevelado.hidden = false;
  linhaProgressoFase.hidden = false;
  areaMontagem.hidden = false;
  areaPalavras.hidden = false;
  rodapeTreino.hidden = false;

  btnAnterior.disabled = estado.workout.ativo ? estado.workout.index === 0 : false;
  btnProximo.disabled = false;
  btnReiniciar.hidden = false;

  renderizarCabecote();
  renderizarTextoRevelado();
  renderizarMontagem();
  renderizarBancoDePalavras();
  renderizarPainelFases();
  renderizarDadosTecnicos();
  salvarSessaoLocal();
}

function separarPalavras(texto) {
  return limparTexto(texto).split(' ').map(palavra => palavra.trim()).filter(Boolean);
}

function renderizarCabecote() {
  const texto = obterTextoAtual();
  const fase = obterFaseAtual();
  if (!texto) return;

  if (estado.workout.ativo) {
    const item = estado.workout.itens[estado.workout.index];
    elTitulo.textContent = `${texto.titulo} — Workout dos erros`;
    elStatusCabecote.textContent = `Item ${estado.workout.index + 1}/${estado.workout.itens.length} · origem: fase ${item.phaseIndex + 1}`;
    labelProgressoFase.textContent = 'Workout';
    labelProgressoUnidade.textContent = `${estado.workout.index + 1}/${estado.workout.itens.length}`;
    barraProgressoFase.style.width = `${((estado.workout.index) / Math.max(1, estado.workout.itens.length)) * 100}%`;
    btnProximo.textContent = estado.workout.index >= estado.workout.itens.length - 1 ? 'Concluir workout' : 'Próximo item';
    return;
  }

  const unidades = obterUnidadesDaFase();
  elTitulo.textContent = `${texto.titulo} — ${fase.titulo}`;
  elStatusCabecote.textContent = `Cabeçote na fase ${estado.faseAtualIndex + 1}, ${rotuloModo().toLowerCase()} ${estado.unidadeAtualIndex + 1}`;
  labelProgressoFase.textContent = `Fase ${estado.faseAtualIndex + 1}/${texto.fases.length}`;
  labelProgressoUnidade.textContent = `${rotuloModo()} ${estado.unidadeAtualIndex + 1}/${unidades.length}`;
  atualizarProgressoFase(false);
  btnProximo.textContent = estado.unidadeAtualIndex >= unidades.length - 1
    ? (estado.faseAtualIndex >= texto.fases.length - 1 ? 'Concluir treino' : 'Próxima fase')
    : 'Próximo trecho';
}

function renderizarTextoRevelado() {
  const texto = obterTextoAtual();
  textoCorrido.innerHTML = '';
  if (!texto) {
    textoCorrido.classList.add('vazio');
    textoCorrido.textContent = 'Carregue um livro JSON para começar.';
    return;
  }

  const limite = obterLimiteRevelacao();
  if (limite.phaseIndex === 0 && limite.unitIndex === 0 && !estado.unidadeConcluida) {
    textoCorrido.classList.add('vazio');
    textoCorrido.textContent = 'Complete ou avance o primeiro trecho para revelar o texto.';
    return;
  }

  textoCorrido.classList.remove('vazio');
  const fragmento = document.createDocumentFragment();

  for (let phaseIndex = 0; phaseIndex < texto.fases.length; phaseIndex++) {
    if (phaseIndex > limite.phaseIndex) break;

    const fase = texto.fases[phaseIndex];
    const p = document.createElement('p');
    p.className = 'paragrafo-revelado';

    if (phaseIndex < limite.phaseIndex) {
      p.textContent = fase.texto;
    } else {
      const unidades = estado.modo === 'paragrafos' ? fase.unidadesPorParagrafo : fase.unidadesPorTrecho;
      const fim = Math.min(limite.unitIndex, unidades.length);
      p.textContent = unidades.slice(0, fim).map(unidade => unidade.texto).join(' ');
    }

    if (p.textContent.trim()) fragmento.appendChild(p);
  }

  if (!fragmento.childNodes.length) {
    textoCorrido.classList.add('vazio');
    textoCorrido.textContent = 'Complete ou avance este trecho para revelar o texto.';
  } else {
    textoCorrido.appendChild(fragmento);
    textoCorrido.scrollTop = textoCorrido.scrollHeight;
  }
}

function obterLimiteRevelacao() {
  if (estado.workout.ativo) {
    const item = estado.workout.itens[estado.workout.index] || { phaseIndex: 0, unitIndex: 0 };
    return { phaseIndex: item.phaseIndex, unitIndex: item.unitIndex };
  }
  return {
    phaseIndex: estado.faseAtualIndex,
    unitIndex: estado.unidadeAtualIndex + (estado.unidadeConcluida ? 1 : 0),
  };
}

function renderizarBancoDePalavras() {
  areaPalavras.innerHTML = '';
  const blocos = estado.palavrasOriginais.map((palavra, index) => ({ palavra, index }));
  embaralhar(blocos);

  blocos.forEach(bloco => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = bloco.palavra;
    btn.dataset.indexOriginal = String(bloco.index);
    btn.addEventListener('click', () => verificarPalavra(btn, bloco.index));
    areaPalavras.appendChild(btn);
  });
}

function renderizarMontagem() {
  areaMontagem.innerHTML = '';
  areaMontagem.classList.toggle('vazia', estado.palavrasSelecionadas.length === 0);

  estado.palavrasSelecionadas.forEach((item, posicao) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip selecionada';
    btn.textContent = item.palavra;
    btn.title = posicao === estado.palavrasSelecionadas.length - 1 ? 'Clique para desfazer esta palavra' : 'Só a última palavra pode ser desfeita';
    if (posicao === estado.palavrasSelecionadas.length - 1) btn.addEventListener('click', desfazerUltimaPalavra);
    areaMontagem.appendChild(btn);
  });
}

function verificarPalavra(btn, indexOriginal) {
  if (estado.unidadeConcluida || btn.classList.contains('erro')) return;

  const indiceEsperado = estado.palavrasSelecionadas.length;
  const palavraEsperada = estado.palavrasOriginais[indiceEsperado];
  const palavraClicada = estado.palavrasOriginais[indexOriginal];

  if (palavraClicada === palavraEsperada) {
    limparErrosVisuaisDoBanco();
    estado.palavrasSelecionadas.push({ palavra: palavraEsperada, indexOriginal });
    btn.classList.add('oculta');
    renderizarMontagem();
    atualizarFeedback('Boa.', 'ok');

    if (estado.palavrasSelecionadas.length === estado.palavrasOriginais.length) concluirUnidade();
    return;
  }

  btn.classList.add('erro');
  estado.errosUnidade++;
  estado.mudouDesdeExportacao = true;
  registrarErroUnidade();
  atualizarFeedback('Marcado em vermelho. Agora encontre a palavra certa.', 'erro');
}

function limparErrosVisuaisDoBanco() {
  areaPalavras.querySelectorAll('.chip.erro').forEach(btn => btn.classList.remove('erro'));
}

function desfazerUltimaPalavra() {
  if (estado.unidadeConcluida) return;
  const removida = estado.palavrasSelecionadas.pop();
  if (!removida) return;
  const botaoOriginal = areaPalavras.querySelector(`[data-index-original="${removida.indexOriginal}"]`);
  if (botaoOriginal) botaoOriginal.classList.remove('oculta');
  atualizarFeedback('Última palavra removida.', '');
  renderizarMontagem();
}

function concluirUnidade() {
  estado.unidadeConcluida = true;
  estado.mudouDesdeExportacao = true;
  registrarAcertoUnidade();

  if (estado.workout.ativo) reduzirErroPorWorkoutAcertado();

  renderizarTextoRevelado();
  renderizarCabecote();
  renderizarPainelFases();
  renderizarDadosTecnicos();
  atualizarFeedback(`${rotuloModo()} completo.`, 'ok');
  salvarSessaoLocal();
}

function unidadeAnterior() {
  if (estado.workout.ativo) {
    if (estado.workout.index <= 0) return;
    estado.workout.index--;
    const item = estado.workout.itens[estado.workout.index];
    estado.faseAtualIndex = item.phaseIndex;
    estado.unidadeAtualIndex = item.unitIndex;
    carregarUnidadeAtual();
    return;
  }

  if (estado.unidadeAtualIndex > 0) {
    estado.unidadeAtualIndex--;
  } else if (estado.faseAtualIndex > 0) {
    estado.faseAtualIndex--;
    const unidades = obterUnidadesDaFase();
    estado.unidadeAtualIndex = Math.max(0, unidades.length - 1);
  } else {
    return;
  }
  carregarUnidadeAtual();
}

function proximaUnidade() {
  if (estado.workout.ativo) {
    if (estado.workout.index >= estado.workout.itens.length - 1) {
      finalizarWorkout();
      return;
    }
    estado.workout.index++;
    const item = estado.workout.itens[estado.workout.index];
    estado.faseAtualIndex = item.phaseIndex;
    estado.unidadeAtualIndex = item.unitIndex;
    carregarUnidadeAtual();
    return;
  }

  const texto = obterTextoAtual();
  const unidades = obterUnidadesDaFase();
  if (!texto || !unidades.length) return;

  if (estado.unidadeAtualIndex < unidades.length - 1) {
    estado.unidadeAtualIndex++;
  } else if (estado.faseAtualIndex < texto.fases.length - 1) {
    estado.faseAtualIndex++;
    estado.unidadeAtualIndex = 0;
  } else {
    finalizarTreino();
    return;
  }

  carregarUnidadeAtual();
}

function finalizarTreino() {
  atualizarFeedback('Treino concluído. Use o workout para atacar os erros acumulados.', 'ok');
  salvarSessaoLocal();
}

function atualizarProgressoFase(contarAtualComoConcluido) {
  const total = obterUnidadesDaFase().length;
  const concluidas = estado.unidadeAtualIndex + (contarAtualComoConcluido ? 1 : 0);
  const progresso = total <= 0 ? 0 : (concluidas / total) * 100;
  barraProgressoFase.style.width = `${Math.max(0, Math.min(100, progresso))}%`;
}

function registrarErroUnidade() {
  const texto = obterTextoAtual();
  const unidade = estado.unidadeAtual;
  if (!texto || !unidade) return;

  const stats = garantirRegistroUnidade(texto, unidade);
  stats.faseStats.erros += 1;
  stats.unidadeStats.erros += 1;
  stats.faseStats.ultimaPratica = new Date().toISOString();
  stats.unidadeStats.ultimaPratica = stats.faseStats.ultimaPratica;
  salvarStats(stats.todosStats);
  renderizarPainelFases();
  renderizarDadosTecnicos();
}

function registrarAcertoUnidade() {
  const texto = obterTextoAtual();
  const unidade = estado.unidadeAtual;
  if (!texto || !unidade) return;

  const stats = garantirRegistroUnidade(texto, unidade);
  stats.faseStats.tentativas += 1;
  stats.faseStats.acertos += 1;
  stats.unidadeStats.tentativas += 1;
  stats.unidadeStats.acertos += 1;
  stats.faseStats.ultimaPratica = new Date().toISOString();
  stats.unidadeStats.ultimaPratica = stats.faseStats.ultimaPratica;
  salvarStats(stats.todosStats);
}

function reduzirErroPorWorkoutAcertado() {
  const texto = obterTextoAtual();
  const unidade = estado.unidadeAtual;
  if (!texto || !unidade) return;

  const stats = garantirRegistroUnidade(texto, unidade);
  if (stats.unidadeStats.erros > 0) {
    stats.unidadeStats.erros -= 1;
    stats.faseStats.erros = Math.max(0, stats.faseStats.erros - 1);
    salvarStats(stats.todosStats);
  }
}

function garantirRegistroUnidade(texto, unidade) {
  const todosStats = lerStats();
  const chave = chaveTexto(texto);
  if (!todosStats[chave]) todosStats[chave] = { titulo: texto.titulo, fases: {} };

  const faseId = String(unidade.phaseIndex);
  if (!todosStats[chave].fases[faseId]) {
    todosStats[chave].fases[faseId] = { erros: 0, tentativas: 0, acertos: 0, unidades: {} };
  }

  const faseStats = todosStats[chave].fases[faseId];
  const unidadeId = String(unidade.unitIndex);
  if (!faseStats.unidades[unidadeId]) {
    faseStats.unidades[unidadeId] = {
      erros: 0,
      tentativas: 0,
      acertos: 0,
      sentenceId: unidade.sentenceId,
      partIndex: unidade.partIndex,
      texto: unidade.texto,
    };
  }

  return { todosStats, faseStats, unidadeStats: faseStats.unidades[unidadeId] };
}

function iniciarWorkoutDosErros() {
  const itens = montarItensWorkout();
  if (!itens.length) {
    atualizarFeedback('Ainda não há erros registrados para montar um workout.', 'ok');
    return;
  }

  estado.workout.ativo = true;
  estado.workout.itens = itens;
  estado.workout.index = 0;
  const primeiro = itens[0];
  estado.faseAtualIndex = primeiro.phaseIndex;
  estado.unidadeAtualIndex = primeiro.unitIndex;
  btnSairWorkout.hidden = false;
  btnWorkout.hidden = true;
  carregarUnidadeAtual();
  atualizarFeedback(`Workout iniciado com ${itens.length} trecho(s).`, 'ok');
}

function montarItensWorkout() {
  const texto = obterTextoAtual();
  if (!texto) return [];
  const statsTexto = lerStats()[chaveTexto(texto)];
  if (!statsTexto || !statsTexto.fases) return [];

  const grupos = new Map();

  texto.fases.forEach((fase, phaseIndex) => {
    const faseStats = statsTexto.fases[String(phaseIndex)];
    if (!faseStats || !faseStats.unidades) return;

    fase.unidadesPorTrecho.forEach(unidade => {
      const unidadeStats = faseStats.unidades[String(unidade.unitIndex)];
      if (!unidadeStats || unidadeStats.erros <= 0) return;

      const chaveGrupo = `${phaseIndex}:${unidade.sentenceId}`;
      if (!grupos.has(chaveGrupo)) {
        const partes = fase.unidadesPorTrecho.filter(u => u.sentenceId === unidade.sentenceId);
        grupos.set(chaveGrupo, { erros: 0, phaseIndex, sentenceId: unidade.sentenceId, partes });
      }
      grupos.get(chaveGrupo).erros += unidadeStats.erros;
    });
  });

  return Array.from(grupos.values())
    .sort((a, b) => b.erros - a.erros || a.phaseIndex - b.phaseIndex)
    .flatMap(grupo => grupo.partes.map(unidade => ({ ...unidade, workoutGroupErrors: grupo.erros })));
}

function sairDoWorkout() {
  desativarWorkout();
  carregarUnidadeAtual();
  atualizarFeedback('Workout encerrado.', 'ok');
}

function finalizarWorkout() {
  desativarWorkout();
  renderizarPainelFases();
  renderizarDadosTecnicos();
  atualizarFeedback('Workout concluído. Um acerto reduz um erro; erros feitos no workout também ficam registrados.', 'ok');
  carregarUnidadeAtual();
}

function desativarWorkout() {
  estado.workout.ativo = false;
  estado.workout.itens = [];
  estado.workout.index = 0;
  if (btnSairWorkout) btnSairWorkout.hidden = true;
  if (btnWorkout) btnWorkout.hidden = false;
}

function obterStatsDaFase(texto, faseIndex) {
  const stats = lerStats();
  const registroTexto = stats[chaveTexto(texto)];
  if (!registroTexto || !registroTexto.fases) return { erros: 0, tentativas: 0, acertos: 0, unidades: {} };
  return registroTexto.fases[String(faseIndex)] || { erros: 0, tentativas: 0, acertos: 0, unidades: {} };
}

function renderizarPainelFases() {
  const texto = obterTextoAtual();
  if (!texto || painelFases.hidden) return;

  listaFases.innerHTML = '';
  texto.fases.forEach((fase, index) => {
    const stats = obterStatsDaFase(texto, index);
    const media = stats.tentativas ? (stats.erros / stats.tentativas) : stats.erros;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'fase-btn';
    botao.textContent = String(index + 1);
    botao.title = `Fase ${index + 1} · erros: ${stats.erros || 0} · média: ${Number(media || 0).toFixed(2)}`;

    if (index === estado.faseAtualIndex && !estado.workout.ativo) botao.classList.add('ativa');
    if ((stats.acertos || 0) > 0) botao.classList.add('concluida');
    if (media > 0 && media < 1) botao.classList.add('amarela');
    if (media >= 1) botao.classList.add('vermelha');

    botao.addEventListener('click', () => irParaFase(index));
    listaFases.appendChild(botao);
  });

  const faseStats = obterStatsDaFase(texto, estado.faseAtualIndex);
  const mediaAtual = faseStats.tentativas ? (faseStats.erros / faseStats.tentativas) : faseStats.erros || 0;
  resumoFase.textContent = `Fase atual: ${estado.faseAtualIndex + 1}. Erros: ${faseStats.erros || 0}. Média: ${Number(mediaAtual).toFixed(2)}.`;
}

function renderizarDadosTecnicos() {
  const texto = obterTextoAtual();
  const fase = obterFaseAtual();
  if (!texto || !fase) return;
  const stats = obterStatsDaFase(texto, estado.faseAtualIndex);
  const unidade = estado.unidadeAtual;

  dadosTecnicos.innerHTML = '';
  const resumo = document.createElement('div');
  resumo.textContent = `Livro: ${texto.titulo} · Fase: ${estado.faseAtualIndex + 1} · Erros da fase: ${stats.erros || 0} · Tentativas: ${stats.tentativas || 0}`;

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify({
    modo: estado.modo,
    workoutAtivo: estado.workout.ativo,
    faseAtualIndex: estado.faseAtualIndex,
    unidadeAtualIndex: estado.unidadeAtualIndex,
    unidadeAtual: unidade,
    statsFase: stats,
  }, null, 2);

  dadosTecnicos.appendChild(resumo);
  dadosTecnicos.appendChild(pre);
}

function lerStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  } catch (erro) {
    return {};
  }
}

function salvarStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    estado.mudouDesdeExportacao = true;
  } catch (erro) {
    console.warn('Não foi possível salvar estatísticas.', erro);
  }
}

function chaveTexto(texto) {
  if (texto.key) return texto.key;
  const base = `${texto.titulo}\n${texto.fases.map(fase => fase.texto).join('\n')}`;
  return `${slugificar(texto.titulo)}::${texto.fases.length}::${hashString(base)}`;
}

function hashString(texto) {
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function atualizarFeedback(mensagem, tipo) {
  feedback.textContent = mensagem;
  feedback.className = `feedback ${tipo || ''}`.trim();
}

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function mostrarErro(mensagem) {
  erroArquivo.style.display = 'block';
  erroArquivo.textContent = mensagem;
}

function limparErro() {
  erroArquivo.style.display = 'none';
  erroArquivo.textContent = '';
}

function slugificar(texto) {
  return String(texto || 'texto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'texto';
}

function timestampParaArquivo() {
  const data = new Date();
  const pad = (valor, tamanho = 2) => String(valor).padStart(tamanho, '0');
  const offsetMinutos = -data.getTimezoneOffset();
  const sinal = offsetMinutos >= 0 ? 'mais' : 'menos';
  const abs = Math.abs(offsetMinutos);
  return [
    data.getFullYear(),
    pad(data.getMonth() + 1),
    pad(data.getDate()),
    pad(data.getHours()),
    pad(data.getMinutes()),
    pad(data.getSeconds()),
    pad(data.getMilliseconds(), 3),
    `gmt-${sinal}-${pad(Math.floor(abs / 60))}-${pad(abs % 60)}`,
  ].join('-');
}

function timestampLegivelLocal() {
  const data = new Date();
  return data.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  });
}
