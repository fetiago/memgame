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
  modoRevisaoUnidade: false,
  forcarPraticaUnidade: false,
  workout: null,
  reveladasPorModo: { frases: {}, paragrafos: {} },
  sessaoImportada: null,
  mudouDesdeExportacao: false,
};

const MAX_PALAVRAS_POR_TRECHO = 12;
const MIN_PALAVRAS_POR_TRECHO = 5;
const STATS_KEY = 'memorizadorTextosStatsV3';
const SESSION_KEY = 'memorizadorTextosSessionV3';
const PROGRESS_TYPE = 'memorizador_textos_progresso';
const PROGRESS_VERSION = 5;
const MAX_GRUPOS_WORKOUT = 8;

const inputJson = document.getElementById('input-json');
const inputProgresso = document.getElementById('input-progresso');
const btnBaixarProgresso = document.getElementById('btn-baixar-progresso');
const selectTexto = document.getElementById('select-texto');
const selectModo = document.getElementById('select-modo');
const nomeArquivo = document.getElementById('nome-arquivo');
const erroArquivo = document.getElementById('erro-arquivo');

const telaVazia = document.getElementById('tela-vazia');
const jogo = document.getElementById('jogo');
const painelFases = document.getElementById('painel-fases');
const listaFases = document.getElementById('lista-fases');
const resumoFase = document.getElementById('resumo-fase');
const btnRepetirFase = document.getElementById('btn-repetir-fase');
const btnWorkoutErros = document.getElementById('btn-workout-erros');
const painelDados = document.getElementById('painel-dados');
const dadosFaseJson = document.getElementById('dados-fase-json');

const textoCorrido = document.getElementById('texto-corrido');
const resumoTextoRevelado = document.getElementById('resumo-texto-revelado');
const elTitulo = document.getElementById('titulo-texto');
const elFaseAtual = document.getElementById('fase-atual');
const elTotalFases = document.getElementById('total-fases');
const elRotuloUnidade = document.getElementById('rotulo-unidade');
const elUnidadeAtual = document.getElementById('unidade-atual');
const elTotalUnidades = document.getElementById('total-unidades');
const elContadorErros = document.getElementById('contador-erros');
const barraProgressoTexto = document.getElementById('barra-progresso-texto');
const barraProgressoFase = document.getElementById('barra-progresso-fase');
const barraProgressoFrase = document.getElementById('barra-progresso-frase');
const areaMontagem = document.getElementById('area-montagem');
const areaPalavras = document.getElementById('area-palavras');
const feedback = document.getElementById('feedback');
const btnAnterior = document.getElementById('btn-anterior');
const btnProximo = document.getElementById('btn-proximo');
const btnReiniciar = document.getElementById('btn-reiniciar');

inputJson.addEventListener('change', carregarArquivosJson);
inputProgresso.addEventListener('change', importarProgresso);
btnBaixarProgresso.addEventListener('click', baixarProgresso);
selectTexto.addEventListener('change', trocarTextoSelecionado);
selectModo.addEventListener('change', trocarModoTreino);
btnRepetirFase.addEventListener('click', repetirFaseAtual);
btnWorkoutErros.addEventListener('click', iniciarWorkoutErros);
btnAnterior.addEventListener('click', unidadeAnterior);
btnProximo.addEventListener('click', proximaUnidade);
btnReiniciar.addEventListener('click', reiniciarTrechoAtual);

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
      const textos = normalizarJson(json, arquivo.name);
      textosCarregados.push(...textos);
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
    estado.reveladasPorModo = { frases: {}, paragrafos: {} };
    estado.workout = null;
    popularSelectTextos();
    nomeArquivo.textContent = `Carregado: ${nomes.join(', ')}`;
    telaVazia.hidden = true;
    jogo.hidden = false;
    painelFases.hidden = false;
    painelDados.hidden = false;

    const restaurou = tentarRestaurarSessaoImportada() || tentarRestaurarSessaoLocal();
    if (!restaurou) carregarUnidade();
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

    salvarStats({ ...lerStats(), ...statsImportados });
    estado.sessaoImportada = pacote.current || null;
    estado.mudouDesdeExportacao = false;

    if (estado.sessaoImportada && estado.sessaoImportada.reveladasPorModo) {
      estado.reveladasPorModo = estado.sessaoImportada.reveladasPorModo;
    }

    atualizarFeedback('Progresso importado.', 'ok');
    renderizarPainelFases();

    if (estado.textos.length) {
      const restaurou = tentarRestaurarSessaoImportada();
      if (!restaurou) carregarUnidade();
    }
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
  const fase = obterFaseAtual();
  if (!texto || !fase) return null;

  return {
    textKey: chaveTexto(texto),
    titulo: texto.titulo,
    modo: estado.modo,
    faseAtualIndex: estado.faseAtualIndex,
    unidadeAtualIndex: estado.unidadeAtualIndex,
    unidadeConcluida: estado.unidadeConcluida,
    faseTitulo: fase.titulo,
    reveladasPorModo: estado.reveladasPorModo,
    workout: estado.workout,
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

  if (sessao.reveladasPorModo) estado.reveladasPorModo = sessao.reveladasPorModo;

  const faseIndex = limitarNumero(sessao.faseAtualIndex, 0, textoAtual.fases.length - 1);
  estado.faseAtualIndex = faseIndex;

  const unidades = obterUnidadesDaFase();
  if (!unidades.length) return false;

  estado.unidadeAtualIndex = limitarNumero(sessao.unidadeAtualIndex || 0, 0, unidades.length - 1);
  estado.unidadeConcluida = Boolean(sessao.unidadeConcluida);
  estado.workout = sessao.workout || null;
  carregarUnidade();
  atualizarFeedback('Sessão restaurada a partir do progresso salvo.', 'ok');
  return true;
}

function limitarNumero(valor, minimo, maximo) {
  const numero = Number.isFinite(Number(valor)) ? Number(valor) : minimo;
  return Math.max(minimo, Math.min(maximo, numero));
}

function normalizarJson(json, nomeOrigem) {
  const lista = Array.isArray(json) ? json : [json];

  return lista.map((item, index) => {
    const titulo = String(item.titulo || item.title || `${nomeOrigem} — texto ${index + 1}`).trim();
    const blocoParagrafos = item.paragrafos || item.paragraphs || item.textos || item.text || [];
    const blocoFrasesTopo = item.frases || item.sentences || [];
    const itensParagrafo = Array.isArray(blocoParagrafos) ? blocoParagrafos : [blocoParagrafos];
    const fases = [];

    itensParagrafo.forEach((itemParagrafo, indiceParagrafoOriginal) => {
      const paragraphIndex = indiceParagrafoOriginal;
      const fase = {
        paragraphIndex,
        titulo: `Parágrafo ${paragraphIndex + 1}`,
        texto: '',
        unidadesPorTrecho: [],
        unidadesPorParagrafo: [],
      };

      if (typeof itemParagrafo === 'string') {
        const texto = limparTexto(itemParagrafo);
        if (texto) {
          fase.texto = texto;
          adicionarTrechos(texto, paragraphIndex, fase.unidadesPorTrecho, `p${paragraphIndex}:texto`);
        }
      } else if (itemParagrafo && typeof itemParagrafo === 'object') {
        const textoParagrafo = limparTexto(
          itemParagrafo.texto || itemParagrafo.text || itemParagrafo.conteudo || ''
        );
        const frasesDoParagrafo = itemParagrafo.frases || itemParagrafo.sentences || [];
        const frasesLimpas = [];

        if (Array.isArray(frasesDoParagrafo) && frasesDoParagrafo.length) {
          frasesDoParagrafo.forEach(itemFrase => {
            const textoFrase = typeof itemFrase === 'string'
              ? limparTexto(itemFrase)
              : limparTexto(itemFrase && (itemFrase.texto || itemFrase.text || itemFrase.conteudo || ''));
            if (textoFrase) frasesLimpas.push(textoFrase);
          });
        }

        fase.texto = textoParagrafo || frasesLimpas.join(' ');

        if (frasesLimpas.length) {
          frasesLimpas.forEach((frase, fraseIndex) => adicionarTrechos(frase, paragraphIndex, fase.unidadesPorTrecho, `p${paragraphIndex}:s${fraseIndex}`));
        } else if (fase.texto) {
          adicionarTrechos(fase.texto, paragraphIndex, fase.unidadesPorTrecho, `p${paragraphIndex}:texto`);
        }
      }

      if (fase.texto) fase.unidadesPorParagrafo.push({ texto: fase.texto, paragraphIndex });
      if (fase.texto || fase.unidadesPorTrecho.length) fases.push(fase);
    });

    if (!fases.length && Array.isArray(blocoFrasesTopo) && blocoFrasesTopo.length) {
      const fase = {
        paragraphIndex: 0,
        titulo: 'Parágrafo 1',
        texto: '',
        unidadesPorTrecho: [],
        unidadesPorParagrafo: [],
      };

      blocoFrasesTopo.forEach(itemFrase => {
        const textoFrase = typeof itemFrase === 'string'
          ? limparTexto(itemFrase)
          : limparTexto(itemFrase && (itemFrase.texto || itemFrase.text || itemFrase.conteudo || ''));
        if (textoFrase) adicionarTrechos(textoFrase, 0, fase.unidadesPorTrecho, `p0:s${fase.unidadesPorTrecho.length}`);
      });

      fase.texto = fase.unidadesPorTrecho.map(unidade => unidade.texto).join(' ');
      if (fase.texto) fase.unidadesPorParagrafo.push({ texto: fase.texto, paragraphIndex: 0 });
      if (fase.texto) fases.push(fase);
    }

    if (!fases.length) throw new Error('não encontrei textos válidos em paragrafos ou frases.');
    return { titulo, fases, origem: nomeOrigem };
  });
}

function adicionarTrechos(texto, paragraphIndex, destino, sentenceGroup = `p${paragraphIndex}:g${destino.length}`) {
  const fraseCompleta = limparTexto(texto);
  const trechos = quebrarTextoEmTrechos(fraseCompleta, MAX_PALAVRAS_POR_TRECHO);
  trechos.forEach((trecho, parteIndex) => {
    destino.push({
      texto: trecho,
      paragraphIndex,
      sentenceGroup,
      parteIndex,
      totalPartes: trechos.length,
      fraseCompleta,
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
    const palavraAntesDoCorte = palavras[i - 1] || '';
    if (terminaComPontuacaoDeCorte(palavraAntesDoCorte)) candidatos.push(i);
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
  const ultimo = texto[texto.length - 1];
  return ['.', ',', ';', ':', '?', '!', '…'].includes(ultimo);
}

function obterTextoAtual() {
  return estado.textos[estado.textoAtualIndex];
}

function obterFaseAtual() {
  const texto = obterTextoAtual();
  return texto ? texto.fases[estado.faseAtualIndex] : null;
}

function obterUnidadesDaFase(fase = obterFaseAtual()) {
  if (!fase) return [];
  return estado.modo === 'paragrafos' ? fase.unidadesPorParagrafo : fase.unidadesPorTrecho;
}

function rotuloModo() {
  return estado.modo === 'paragrafos' ? 'Parágrafo' : 'Trecho';
}

function obterMapaReveladas(modo = estado.modo) {
  if (!estado.reveladasPorModo[modo]) estado.reveladasPorModo[modo] = {};
  return estado.reveladasPorModo[modo];
}

function obterSetReveladasDaFase(faseIndex = estado.faseAtualIndex, modo = estado.modo) {
  const mapa = obterMapaReveladas(modo);
  if (!Array.isArray(mapa[String(faseIndex)])) mapa[String(faseIndex)] = [];
  return new Set(mapa[String(faseIndex)]);
}

function marcarUnidadeRevelada(faseIndex, unidadeIndex) {
  const mapa = obterMapaReveladas();
  const chaveFase = String(faseIndex);
  if (!Array.isArray(mapa[chaveFase])) mapa[chaveFase] = [];
  if (!mapa[chaveFase].includes(unidadeIndex)) {
    mapa[chaveFase].push(unidadeIndex);
    mapa[chaveFase].sort((a, b) => a - b);
  }
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

function trocarTextoSelecionado() {
  estado.textoAtualIndex = Number(selectTexto.value);
  estado.faseAtualIndex = 0;
  estado.workout = null;
  reiniciarFluxoDaFase(false);
  carregarUnidade();
}

function trocarModoTreino() {
  estado.modo = selectModo.value;
  estado.workout = null;
  reiniciarFluxoDaFase(false);
  carregarUnidade();
  renderizarPainelFases();
}

function irParaFase(index) {
  const texto = obterTextoAtual();
  if (!texto || index < 0 || index >= texto.fases.length) return;
  estado.faseAtualIndex = index;
  estado.workout = null;
  reiniciarFluxoDaFase(false);
  carregarUnidade();
}

function repetirFaseAtual() {
  estado.workout = null;
  reiniciarFluxoDaFase(false);
  carregarUnidade();
}

function reiniciarFluxoDaFase(limparRevelacaoDaFase = false) {
  if (limparRevelacaoDaFase) {
    const mapa = obterMapaReveladas();
    delete mapa[String(estado.faseAtualIndex)];
  }
  estado.unidadeAtualIndex = primeiroIndiceNaoReveladoDaFase(estado.faseAtualIndex);
  estado.unidadeAtual = null;
  estado.errosUnidade = 0;
  estado.unidadeConcluida = false;
  estado.modoRevisaoUnidade = false;
  estado.forcarPraticaUnidade = false;
  renderizarTextoRevelado();
}

function primeiroIndiceNaoReveladoDaFase(faseIndex) {
  const texto = obterTextoAtual();
  if (!texto) return 0;
  const fase = texto.fases[faseIndex];
  const unidades = obterUnidadesDaFase(fase);
  const reveladas = obterSetReveladasDaFase(faseIndex);
  for (let i = 0; i < unidades.length; i++) {
    if (!reveladas.has(i)) return i;
  }
  return 0;
}

function carregarUnidade() {
  const texto = obterTextoAtual();
  const fase = obterFaseAtual();
  const unidades = obterUnidadesDaFase();
  if (!texto || !fase || !unidades.length) return;

  if (estado.unidadeAtualIndex >= unidades.length) estado.unidadeAtualIndex = 0;
  if (estado.unidadeAtualIndex < 0) estado.unidadeAtualIndex = 0;

  const unidadeAtual = unidades[estado.unidadeAtualIndex];
  const unidadeJaRevelada = obterSetReveladasDaFase(estado.faseAtualIndex).has(estado.unidadeAtualIndex);
  const mostrarComoRevisao = unidadeJaRevelada && !estado.forcarPraticaUnidade;

  estado.unidadeAtual = unidadeAtual;
  estado.palavrasOriginais = separarPalavras(unidadeAtual.texto);
  estado.palavrasSelecionadas = [];
  estado.errosUnidade = 0;
  estado.unidadeConcluida = unidadeJaRevelada;
  estado.modoRevisaoUnidade = mostrarComoRevisao;
  estado.forcarPraticaUnidade = false;

  const workoutAtivo = Boolean(estado.workout && estado.workout.ativo);
  const prefixoWorkout = workoutAtivo ? `Workout ${estado.workout.pos + 1}/${estado.workout.fila.length} — ` : '';

  elTitulo.textContent = `${prefixoWorkout}${texto.titulo} — ${fase.titulo}`;
  elFaseAtual.textContent = estado.faseAtualIndex + 1;
  elTotalFases.textContent = texto.fases.length;
  elRotuloUnidade.textContent = rotuloModo();
  elUnidadeAtual.textContent = estado.unidadeAtualIndex + 1;
  elTotalUnidades.textContent = unidades.length;
  elContadorErros.textContent = estado.errosUnidade;
  btnProximo.textContent = textoBotaoProximo();
  feedback.textContent = '';
  feedback.className = 'feedback';

  telaVazia.hidden = true;
  jogo.hidden = false;
  painelFases.hidden = false;
  painelDados.hidden = false;
  btnAnterior.hidden = !podeVoltar();
  btnReiniciar.hidden = false;

  if (mostrarComoRevisao) {
    areaMontagem.hidden = true;
    areaPalavras.hidden = true;
    btnProximo.style.display = podeAvancar() ? 'inline-block' : 'none';
    atualizarFeedback('Trecho já revelado. Avance para voltar ao ponto atual ou reinicie para praticar de novo.', 'ok');
  } else {
    areaMontagem.hidden = false;
    areaPalavras.hidden = false;
    btnProximo.style.display = 'none';
    renderizarMontagem();
    renderizarBancoDePalavras();
  }

  renderizarTextoRevelado();
  renderizarPainelFases();
  atualizarTodosProgressos();
  renderizarDadosFase();
  salvarSessaoLocal();
}


function podeVoltar() {
  if (estado.workout && estado.workout.ativo) return estado.workout.pos > 0;
  return estado.unidadeAtualIndex > 0;
}

function podeAvancar() {
  if (estado.workout && estado.workout.ativo) return true;
  const unidades = obterUnidadesDaFase();
  if (estado.unidadeAtualIndex >= unidades.length - 1) {
    const texto = obterTextoAtual();
    return Boolean(texto && estado.faseAtualIndex < texto.fases.length - 1) || estado.unidadeConcluida;
  }
  return estado.unidadeConcluida || obterSetReveladasDaFase(estado.faseAtualIndex).has(estado.unidadeAtualIndex);
}

function textoBotaoProximo() {
  if (estado.workout && estado.workout.ativo) {
    return estado.workout.pos >= estado.workout.fila.length - 1 ? 'Concluir workout' : 'Próximo do workout';
  }

  const unidades = obterUnidadesDaFase();
  const ultimaUnidadeDaFase = estado.unidadeAtualIndex >= unidades.length - 1;
  if (ultimaUnidadeDaFase) {
    const texto = obterTextoAtual();
    const existeProximaFase = texto && estado.faseAtualIndex < texto.fases.length - 1;
    return existeProximaFase ? 'Próxima fase' : 'Concluir treino';
  }

  return estado.modo === 'paragrafos' ? 'Próximo parágrafo' : 'Próximo trecho';
}

function reiniciarTrechoAtual() {
  estado.forcarPraticaUnidade = true;
  estado.modoRevisaoUnidade = false;
  carregarUnidade();
}

function separarPalavras(texto) {
  return limparTexto(texto).split(' ').map(palavra => palavra.trim()).filter(Boolean);
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
    btn.title = posicao === estado.palavrasSelecionadas.length - 1
      ? 'Clique para desfazer esta palavra'
      : 'Só a última palavra pode ser desfeita';

    if (posicao === estado.palavrasSelecionadas.length - 1) {
      btn.addEventListener('click', desfazerUltimaPalavra);
    }

    areaMontagem.appendChild(btn);
  });
}

function renderizarTextoRevelado() {
  const texto = obterTextoAtual();
  textoCorrido.innerHTML = '';

  if (!texto) {
    textoCorrido.classList.add('vazio');
    textoCorrido.textContent = 'Carregue um livro JSON para começar.';
    resumoTextoRevelado.textContent = '0% revelado';
    return;
  }

  const total = contarUnidadesTexto();
  const reveladasTotal = contarUnidadesReveladasTexto();
  const percentual = total ? Math.round((reveladasTotal / total) * 100) : 0;
  resumoTextoRevelado.textContent = `${percentual}% revelado`;

  if (reveladasTotal === 0) {
    textoCorrido.classList.add('vazio');
    textoCorrido.textContent = 'Complete o primeiro trecho para começar a revelar o texto.';
    return;
  }

  textoCorrido.classList.remove('vazio');

  texto.fases.forEach((fase, faseIndex) => {
    const unidades = obterUnidadesDaFase(fase);
    const reveladas = obterSetReveladasDaFase(faseIndex);
    const p = document.createElement('p');
    p.className = 'paragrafo-revelado';

    if (reveladas.size === 0) {
      p.classList.add('paragrafo-oculto');
      p.textContent = `Fase ${faseIndex + 1} ainda oculta.`;
      textoCorrido.appendChild(p);
      return;
    }

    unidades.forEach((unidade, unidadeIndex) => {
      if (reveladas.has(unidadeIndex)) {
        const span = document.createElement('span');
        span.className = 'trecho-revelado';
        span.textContent = unidade.texto;
        p.appendChild(span);
      } else if (unidadeIndex > Math.max(...Array.from(reveladas))) {
        const lacuna = document.createElement('span');
        lacuna.className = 'lacuna';
        lacuna.textContent = 'oculto';
        p.appendChild(lacuna);
      }
    });

    textoCorrido.appendChild(p);
  });
}

function verificarPalavra(btn, indexOriginal) {
  if (btn.classList.contains('erro')) return;

  const indiceEsperado = estado.palavrasSelecionadas.length;
  const palavraEsperada = estado.palavrasOriginais[indiceEsperado];
  const palavraClicada = estado.palavrasOriginais[indexOriginal];

  if (palavraClicada === palavraEsperada) {
    limparErrosVisuaisDoBanco();
    estado.palavrasSelecionadas.push({ palavra: palavraEsperada, indexOriginal });
    btn.classList.add('oculta');
    renderizarMontagem();
    atualizarTodosProgressos();
    atualizarFeedback('Boa.', 'ok');

    if (estado.palavrasSelecionadas.length === estado.palavrasOriginais.length) concluirUnidade();
    return;
  }

  btn.classList.add('erro');
  estado.errosUnidade++;
  estado.mudouDesdeExportacao = true;
  elContadorErros.textContent = estado.errosUnidade;
  atualizarFeedback('Marcado em vermelho. Agora encontre a palavra certa.', 'erro');
}

function limparErrosVisuaisDoBanco() {
  areaPalavras.querySelectorAll('.chip.erro').forEach(btn => btn.classList.remove('erro'));
}

function desfazerUltimaPalavra() {
  const removida = estado.palavrasSelecionadas.pop();
  if (!removida) return;

  const botaoOriginal = areaPalavras.querySelector(`[data-index-original="${removida.indexOriginal}"]`);
  if (botaoOriginal) botaoOriginal.classList.remove('oculta');
  btnProximo.style.display = 'none';
  atualizarFeedback('Última palavra removida.', '');
  renderizarMontagem();
  atualizarTodosProgressos();
}

function concluirUnidade() {
  estado.unidadeConcluida = true;
  estado.modoRevisaoUnidade = true;
  estado.mudouDesdeExportacao = true;
  marcarUnidadeRevelada(estado.faseAtualIndex, estado.unidadeAtualIndex);
  registrarConclusaoDaUnidade();
  renderizarTextoRevelado();
  renderizarPainelFases();
  renderizarDadosFase();
  atualizarTodosProgressos();
  atualizarFeedback(`${rotuloModo()} completo.`, 'ok');

  areaMontagem.hidden = true;
  areaPalavras.hidden = true;
  btnReiniciar.hidden = false;
  btnAnterior.hidden = !podeVoltar();
  btnProximo.textContent = textoBotaoProximo();
  btnProximo.style.display = 'inline-block';
  salvarSessaoLocal();
}

function unidadeAnterior() {
  if (estado.workout && estado.workout.ativo) {
    if (estado.workout.pos <= 0) return;
    estado.workout.pos--;
    aplicarItemWorkoutAtual();
    carregarUnidade();
    return;
  }

  if (estado.unidadeAtualIndex <= 0) return;
  estado.unidadeAtualIndex--;
  carregarUnidade();
}

function proximaUnidade() {
  if (estado.workout && estado.workout.ativo) {
    estado.workout.pos++;
    if (estado.workout.pos >= estado.workout.fila.length) {
      finalizarWorkout();
      return;
    }
    aplicarItemWorkoutAtual();
    carregarUnidade();
    return;
  }

  const unidades = obterUnidadesDaFase();
  estado.unidadeAtualIndex++;

  if (estado.unidadeAtualIndex >= unidades.length) {
    const texto = obterTextoAtual();
    const proximaFaseExiste = texto && estado.faseAtualIndex + 1 < texto.fases.length;
    if (proximaFaseExiste) {
      estado.faseAtualIndex++;
      estado.unidadeAtualIndex = primeiroIndiceNaoReveladoDaFase(estado.faseAtualIndex);
      carregarUnidade();
      return;
    }
    finalizarTreino();
    return;
  }

  estado.unidadeConcluida = obterSetReveladasDaFase(estado.faseAtualIndex).has(estado.unidadeAtualIndex);
  carregarUnidade();
}


function iniciarWorkoutErros() {
  const texto = obterTextoAtual();
  if (!texto) {
    atualizarFeedback('Carregue um livro antes de iniciar o workout.', 'erro');
    return;
  }

  if (estado.modo !== 'frases') {
    estado.modo = 'frases';
    selectModo.value = 'frases';
  }

  const fila = criarFilaWorkoutErros();
  if (!fila.length) {
    atualizarFeedback('Ainda não há erros registrados para montar um workout.', 'erro');
    return;
  }

  estado.workout = {
    ativo: true,
    tipo: 'maiores-erros',
    criadoEm: new Date().toISOString(),
    pos: 0,
    fila,
  };

  aplicarItemWorkoutAtual();
  carregarUnidade();
  atualizarFeedback(`Workout iniciado com ${fila.length} trecho(s), agrupados pelas frases mais difíceis.`, 'ok');
}

function criarFilaWorkoutErros() {
  const texto = obterTextoAtual();
  if (!texto) return [];

  const statsTexto = lerStats()[chaveTexto(texto)];
  if (!statsTexto || !statsTexto.fases) return [];

  const grupos = new Map();

  texto.fases.forEach((fase, faseIndex) => {
    const faseStats = statsTexto.fases[String(faseIndex)];
    if (!faseStats || !faseStats.unidades) return;

    fase.unidadesPorTrecho.forEach((unidade, unidadeIndex) => {
      const unidadeStats = faseStats.unidades[String(unidadeIndex)];
      if (!unidadeStats || !unidadeStats.erros) return;

      const groupKey = `${faseIndex}::${unidade.sentenceGroup || unidadeIndex}`;
      if (!grupos.has(groupKey)) {
        const indicesDoGrupo = fase.unidadesPorTrecho
          .map((u, i) => ({ unidade: u, index: i }))
          .filter(item => (item.unidade.sentenceGroup || item.index) === (unidade.sentenceGroup || unidadeIndex))
          .map(item => item.index);

        grupos.set(groupKey, {
          groupKey,
          faseIndex,
          indices: indicesDoGrupo,
          erros: 0,
          tentativas: 0,
          fraseCompleta: unidade.fraseCompleta || unidade.texto,
        });
      }

      const grupo = grupos.get(groupKey);
      grupo.erros += unidadeStats.erros || 0;
      grupo.tentativas += unidadeStats.tentativas || 0;
    });
  });

  const gruposOrdenados = Array.from(grupos.values())
    .filter(grupo => grupo.erros > 0)
    .sort((a, b) => b.erros - a.erros || a.faseIndex - b.faseIndex || a.indices[0] - b.indices[0])
    .slice(0, MAX_GRUPOS_WORKOUT);

  const fila = [];
  gruposOrdenados.forEach(grupo => {
    grupo.indices.forEach(unidadeIndex => {
      fila.push({
        faseIndex: grupo.faseIndex,
        unidadeIndex,
        groupKey: grupo.groupKey,
        errosGrupo: grupo.erros,
        fraseCompleta: grupo.fraseCompleta,
      });
    });
  });

  return fila;
}

function aplicarItemWorkoutAtual() {
  if (!estado.workout || !estado.workout.ativo) return;
  const item = estado.workout.fila[estado.workout.pos];
  if (!item) return;
  estado.faseAtualIndex = item.faseIndex;
  estado.unidadeAtualIndex = item.unidadeIndex;
  estado.forcarPraticaUnidade = true;
  estado.modoRevisaoUnidade = false;
}

function finalizarWorkout() {
  estado.workout = null;
  estado.forcarPraticaUnidade = false;
  estado.modoRevisaoUnidade = false;
  renderizarPainelFases();
  carregarUnidade();
  atualizarFeedback('Workout concluído. Agora escolha uma fase ou baixe o progresso.', 'ok');
}

function finalizarTreino() {
  areaMontagem.hidden = true;
  areaPalavras.hidden = true;
  btnReiniciar.hidden = true;
  btnAnterior.hidden = false;
  btnProximo.style.display = 'none';
  feedback.className = 'feedback ok';
  feedback.textContent = 'Treino concluído. Use as fases com mais erros para reforço e baixe o progresso antes de fechar.';
  salvarSessaoLocal();
}

function atualizarTodosProgressos() {
  const texto = obterTextoAtual();
  const fase = obterFaseAtual();
  if (!texto || !fase) return;

  const totalTexto = contarUnidadesTexto();
  const reveladasTexto = contarUnidadesReveladasTexto();
  setBarra(barraProgressoTexto, totalTexto ? (reveladasTexto / totalTexto) * 100 : 0);

  const unidadesFase = obterUnidadesDaFase();
  const reveladasFase = obterSetReveladasDaFase(estado.faseAtualIndex).size;
  setBarra(barraProgressoFase, unidadesFase.length ? (reveladasFase / unidadesFase.length) * 100 : 0);

  const progressoPalavras = estado.modoRevisaoUnidade
    ? 1
    : (estado.palavrasOriginais.length ? estado.palavrasSelecionadas.length / estado.palavrasOriginais.length : 0);
  setBarra(barraProgressoFrase, progressoPalavras * 100);
}

function setBarra(elemento, percentual) {
  elemento.style.width = `${Math.max(0, Math.min(100, percentual))}%`;
}

function contarUnidadesTexto() {
  const texto = obterTextoAtual();
  if (!texto) return 0;
  return texto.fases.reduce((soma, fase) => soma + obterUnidadesDaFase(fase).length, 0);
}

function contarUnidadesReveladasTexto() {
  const texto = obterTextoAtual();
  if (!texto) return 0;
  return texto.fases.reduce((soma, fase, faseIndex) => {
    const unidades = obterUnidadesDaFase(fase);
    const reveladas = obterSetReveladasDaFase(faseIndex);
    return soma + Math.min(reveladas.size, unidades.length);
  }, 0);
}

function registrarConclusaoDaUnidade() {
  const texto = obterTextoAtual();
  if (!texto) return;

  const stats = lerStats();
  const chave = chaveTexto(texto);
  if (!stats[chave]) stats[chave] = { titulo: texto.titulo, fases: {} };

  const faseId = String(estado.faseAtualIndex);
  if (!stats[chave].fases[faseId]) {
    stats[chave].fases[faseId] = { erros: 0, tentativas: 0, conclusoes: 0, unidades: {} };
  }

  const faseStats = stats[chave].fases[faseId];
  faseStats.erros += estado.errosUnidade;
  faseStats.tentativas += 1;
  faseStats.ultimaPratica = new Date().toISOString();

  const unidadeId = String(estado.unidadeAtualIndex);
  if (!faseStats.unidades[unidadeId]) faseStats.unidades[unidadeId] = { erros: 0, tentativas: 0 };
  faseStats.unidades[unidadeId].erros += estado.errosUnidade;
  faseStats.unidades[unidadeId].tentativas += 1;

  const unidades = obterUnidadesDaFase();
  if (estado.unidadeAtualIndex >= unidades.length - 1) faseStats.conclusoes += 1;

  salvarStats(stats);
}

function chaveTexto(texto) {
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
  } catch (erro) {
    console.warn('Não foi possível salvar estatísticas.', erro);
  }
}

function obterStatsDaFase(texto, faseIndex) {
  const stats = lerStats();
  const registroTexto = stats[chaveTexto(texto)];
  if (!registroTexto || !registroTexto.fases) return { erros: 0, tentativas: 0, conclusoes: 0, unidades: {} };
  return registroTexto.fases[String(faseIndex)] || { erros: 0, tentativas: 0, conclusoes: 0, unidades: {} };
}

function renderizarPainelFases() {
  const texto = obterTextoAtual();
  if (!texto || painelFases.hidden) return;

  const fasesComStats = texto.fases.map((fase, index) => {
    const stats = obterStatsDaFase(texto, index);
    return {
      fase,
      index,
      erros: stats.erros || 0,
      tentativas: stats.tentativas || 0,
      conclusoes: stats.conclusoes || 0,
      media: stats.tentativas ? (stats.erros / stats.tentativas) : 0,
    };
  });

  const maxErros = Math.max(0, ...fasesComStats.map(item => item.erros));
  const faseAtualStats = obterStatsDaFase(texto, estado.faseAtualIndex);
  const faseAtualReveladas = obterSetReveladasDaFase(estado.faseAtualIndex).size;
  const faseAtualTotal = obterUnidadesDaFase().length;

  resumoFase.textContent = `Fase atual: ${estado.faseAtualIndex + 1}. ${faseAtualReveladas}/${faseAtualTotal} trecho(s) revelado(s). Erros acumulados: ${faseAtualStats.erros || 0}.`;
  listaFases.innerHTML = '';

  fasesComStats.forEach(item => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'fase-tile';
    botao.textContent = String(item.index + 1);
    botao.title = `Fase ${item.index + 1} | Erros: ${item.erros} | Tentativas: ${item.tentativas} | Média: ${item.media.toFixed(2)}`;
    if (item.index === estado.faseAtualIndex) botao.classList.add('ativa');
    if (item.erros > 0) botao.classList.add('com-erro');
    if (item.erros > 0 && item.erros === maxErros) botao.classList.add('dificil');
    botao.addEventListener('click', () => irParaFase(item.index));
    listaFases.appendChild(botao);
  });
}

function renderizarDadosFase() {
  const texto = obterTextoAtual();
  const fase = obterFaseAtual();
  if (!texto || !fase) return;

  const stats = obterStatsDaFase(texto, estado.faseAtualIndex);
  const dados = {
    texto: texto.titulo,
    modo: estado.modo,
    faseIndex: estado.faseAtualIndex,
    faseNumero: estado.faseAtualIndex + 1,
    faseTitulo: fase.titulo,
    totalUnidadesNaFase: obterUnidadesDaFase().length,
    unidadeAtualIndex: estado.unidadeAtualIndex,
    unidadeAtualNumero: estado.unidadeAtualIndex + 1,
    sentenceGroup: estado.unidadeAtual && estado.unidadeAtual.sentenceGroup,
    parteDaFrase: estado.unidadeAtual ? `${estado.unidadeAtual.parteIndex + 1}/${estado.unidadeAtual.totalPartes}` : null,
    fraseCompleta: estado.unidadeAtual && estado.unidadeAtual.fraseCompleta,
    workout: estado.workout,
    reveladasNaFase: Array.from(obterSetReveladasDaFase(estado.faseAtualIndex)).sort((a, b) => a - b),
    stats,
  };

  dadosFaseJson.textContent = JSON.stringify(dados, null, 2);
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
  const offsetHoras = pad(Math.floor(abs / 60));
  const offsetRestante = pad(abs % 60);

  return [
    data.getFullYear(),
    pad(data.getMonth() + 1),
    pad(data.getDate()),
    pad(data.getHours()),
    pad(data.getMinutes()),
    pad(data.getSeconds()),
    pad(data.getMilliseconds(), 3),
    `gmt-${sinal}-${offsetHoras}-${offsetRestante}`,
  ].join('-');
}

function timestampLegivelLocal() {
  const data = new Date();
  return data.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}
