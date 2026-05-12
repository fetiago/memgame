const estado = {
  textos: [],
  textoAtualIndex: 0,
  faseAtualIndex: 0,
  unidadeAtualIndex: 0,
  modo: 'frases',
  palavrasOriginais: [],
  palavrasSelecionadas: [],
  unidadesReveladas: [],
  unidadeAtual: null,
  errosUnidade: 0,
  unidadeConcluida: false,
  sessaoImportada: null,
  mudouDesdeExportacao: false,
};

const MAX_PALAVRAS_POR_TRECHO = 12;
const MIN_PALAVRAS_POR_TRECHO = 5;
const STATS_KEY = 'memorizadorTextosStatsV2';
const SESSION_KEY = 'memorizadorTextosSessionV2';
const PROGRESS_TYPE = 'memorizador_textos_progresso';
const PROGRESS_VERSION = 2;

const inputJson = document.getElementById('input-json');
const inputProgresso = document.getElementById('input-progresso');
const painelArquivo = document.getElementById('painel-arquivo');
const btnMostrarArquivo = document.getElementById('btn-mostrar-arquivo');
const btnBaixarProgresso = document.getElementById('btn-baixar-progresso');
const btnBaixarProgressoFases = document.getElementById('btn-baixar-progresso-fases');
const selectTexto = document.getElementById('select-texto');
const selectModo = document.getElementById('select-modo');
const nomeArquivo = document.getElementById('nome-arquivo');
const erroArquivo = document.getElementById('erro-arquivo');

const painelFases = document.getElementById('painel-fases');
const selectFase = document.getElementById('select-fase');
const listaFases = document.getElementById('lista-fases');
const resumoFase = document.getElementById('resumo-fase');
const btnRepetirFase = document.getElementById('btn-repetir-fase');

const painelTreino = document.getElementById('painel-treino');
const telaVazia = document.getElementById('tela-vazia');
const textoRevelado = document.getElementById('texto-revelado');
const textoCorrido = document.getElementById('texto-corrido');
const elTitulo = document.getElementById('titulo-texto');
const elFaseAtual = document.getElementById('fase-atual');
const elTotalFases = document.getElementById('total-fases');
const elRotuloUnidade = document.getElementById('rotulo-unidade');
const elUnidadeAtual = document.getElementById('unidade-atual');
const elTotalUnidades = document.getElementById('total-unidades');
const elContadorErros = document.getElementById('contador-erros');
const barraProgresso = document.getElementById('barra-progresso');
const areaMontagem = document.getElementById('area-montagem');
const areaPalavras = document.getElementById('area-palavras');
const feedback = document.getElementById('feedback');
const btnAnterior = document.getElementById('btn-anterior');
const btnProximo = document.getElementById('btn-proximo');
const btnReiniciar = document.getElementById('btn-reiniciar');

inputJson.addEventListener('change', carregarArquivosJson);
inputProgresso.addEventListener('change', importarProgresso);
btnMostrarArquivo.addEventListener('click', mostrarPainelArquivo);
btnBaixarProgresso.addEventListener('click', baixarProgresso);
btnBaixarProgressoFases.addEventListener('click', baixarProgresso);
selectTexto.addEventListener('change', trocarTextoSelecionado);
selectModo.addEventListener('change', trocarModoTreino);
selectFase.addEventListener('change', () => irParaFase(Number(selectFase.value)));
btnRepetirFase.addEventListener('click', repetirFaseAtual);
btnAnterior.addEventListener('click', unidadeAnterior);
btnProximo.addEventListener('click', proximaUnidade);
btnReiniciar.addEventListener('click', carregarUnidade);

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
    reiniciarFluxoDaFase();
    popularSelectTextos();
    popularSelectFases();
    nomeArquivo.textContent = `Carregado: ${nomes.join(', ')}`;
    ocultarPainelArquivo();
    painelFases.hidden = false;

    const restaurou = tentarRestaurarSessaoImportada() || tentarRestaurarSessaoLocal();
    if (!restaurou) carregarUnidade();
  }

  if (erros.length) {
    mostrarErro(erros.join(' | '));
    mostrarPainelArquivo();
  }

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

    const statsAtuais = lerStats();
    const statsMesclados = { ...statsAtuais, ...statsImportados };
    salvarStats(statsMesclados);

    estado.sessaoImportada = pacote.current || null;
    estado.mudouDesdeExportacao = false;

    atualizarFeedback('Progresso importado.', 'ok');
    renderizarPainelFases();

    if (estado.textos.length) {
      const restaurou = tentarRestaurarSessaoImportada();
      if (!restaurou) carregarUnidade();
    }
  } catch (erro) {
    mostrarErro(`${arquivo.name}: ${erro.message}`);
    mostrarPainelArquivo();
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
    unidadesReveladasNaFase: estado.unidadesReveladas.length,
    unidadeConcluida: estado.unidadeConcluida,
    faseTitulo: fase.titulo,
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

  const faseIndex = limitarNumero(sessao.faseAtualIndex, 0, textoAtual.fases.length - 1);
  estado.faseAtualIndex = faseIndex;
  selectFase.value = String(faseIndex);

  const unidades = obterUnidadesDaFase();
  if (!unidades.length) return false;

  let unidadeIndex = limitarNumero(sessao.unidadeAtualIndex || 0, 0, unidades.length - 1);
  let reveladas = limitarNumero(sessao.unidadesReveladasNaFase || 0, 0, unidades.length);

  if (sessao.unidadeConcluida && unidadeIndex < unidades.length - 1) {
    unidadeIndex += 1;
    reveladas = Math.max(reveladas, unidadeIndex);
  }

  if (sessao.unidadeConcluida && unidadeIndex >= unidades.length - 1 && reveladas >= unidades.length) {
    reveladas = unidades.length - 1;
  }

  estado.unidadeAtualIndex = unidadeIndex;
  reconstruirReveladasAte(Math.min(reveladas, unidadeIndex));
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
          adicionarTrechos(texto, paragraphIndex, fase.unidadesPorTrecho);
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
          frasesLimpas.forEach(frase => adicionarTrechos(frase, paragraphIndex, fase.unidadesPorTrecho));
        } else if (fase.texto) {
          adicionarTrechos(fase.texto, paragraphIndex, fase.unidadesPorTrecho);
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
        if (textoFrase) adicionarTrechos(textoFrase, 0, fase.unidadesPorTrecho);
      });

      fase.texto = fase.unidadesPorTrecho.map(unidade => unidade.texto).join(' ');
      if (fase.texto) fase.unidadesPorParagrafo.push({ texto: fase.texto, paragraphIndex: 0 });
      if (fase.texto) fases.push(fase);
    }

    if (!fases.length) throw new Error('não encontrei textos válidos em paragrafos ou frases.');
    return { titulo, fases, origem: nomeOrigem };
  });
}

function adicionarTrechos(texto, paragraphIndex, destino) {
  quebrarTextoEmTrechos(texto, MAX_PALAVRAS_POR_TRECHO).forEach(trecho => {
    destino.push({ texto: trecho, paragraphIndex });
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

function obterUnidadesDaFase() {
  const fase = obterFaseAtual();
  if (!fase) return [];
  return estado.modo === 'paragrafos' ? fase.unidadesPorParagrafo : fase.unidadesPorTrecho;
}

function rotuloModo() {
  return estado.modo === 'paragrafos' ? 'Parágrafo' : 'Trecho';
}

function ocultarPainelArquivo() {
  painelArquivo.hidden = true;
  btnMostrarArquivo.hidden = false;
}

function mostrarPainelArquivo() {
  painelArquivo.hidden = false;
  btnMostrarArquivo.hidden = true;
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
  reiniciarFluxoDaFase();
  popularSelectFases();
  carregarUnidade();
}

function trocarModoTreino() {
  estado.modo = selectModo.value;
  reiniciarFluxoDaFase();
  carregarUnidade();
  renderizarPainelFases();
}

function irParaFase(index) {
  const texto = obterTextoAtual();
  if (!texto || index < 0 || index >= texto.fases.length) return;
  estado.faseAtualIndex = index;
  reiniciarFluxoDaFase();
  selectFase.value = String(index);
  carregarUnidade();
  renderizarPainelFases();
}

function repetirFaseAtual() {
  reiniciarFluxoDaFase();
  carregarUnidade();
}

function reiniciarFluxoDaFase() {
  estado.unidadeAtualIndex = 0;
  estado.unidadesReveladas = [];
  estado.unidadeAtual = null;
  estado.errosUnidade = 0;
  estado.unidadeConcluida = false;
  renderizarTextoRevelado();
}

function carregarUnidade() {
  const texto = obterTextoAtual();
  const fase = obterFaseAtual();
  const unidades = obterUnidadesDaFase();
  if (!texto || !fase || !unidades.length) return;

  const unidadeAtual = unidades[estado.unidadeAtualIndex];
  estado.unidadeAtual = unidadeAtual;
  estado.palavrasOriginais = separarPalavras(unidadeAtual.texto);
  estado.palavrasSelecionadas = [];
  estado.errosUnidade = 0;
  estado.unidadeConcluida = false;

  elTitulo.textContent = `${texto.titulo} — ${fase.titulo}`;
  elFaseAtual.textContent = estado.faseAtualIndex + 1;
  elTotalFases.textContent = texto.fases.length;
  elRotuloUnidade.textContent = rotuloModo();
  elUnidadeAtual.textContent = estado.unidadeAtualIndex + 1;
  elTotalUnidades.textContent = unidades.length;
  elContadorErros.textContent = estado.errosUnidade;
  btnProximo.textContent = estado.modo === 'paragrafos' ? 'Próximo parágrafo' : 'Próximo trecho';
  feedback.textContent = '';
  feedback.className = 'feedback';

  painelTreino.hidden = false;
  telaVazia.hidden = true;
  textoRevelado.hidden = false;
  areaMontagem.hidden = false;
  areaPalavras.hidden = false;
  btnReiniciar.hidden = false;
  btnAnterior.hidden = estado.unidadeAtualIndex === 0;
  btnProximo.style.display = 'none';

  atualizarProgressoFase(false);
  renderizarTextoRevelado();
  renderizarMontagem();
  renderizarBancoDePalavras();
  renderizarPainelFases();
  salvarSessaoLocal();
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
  textoCorrido.innerHTML = '';

  if (!estado.unidadesReveladas.length) {
    textoCorrido.classList.add('vazio');
    textoCorrido.textContent = 'Complete o primeiro trecho para começar a revelar o parágrafo.';
    return;
  }

  textoCorrido.classList.remove('vazio');
  let paragrafoAtual = null;
  let elementoParagrafo = null;

  estado.unidadesReveladas.forEach(item => {
    if (item.paragraphIndex !== paragrafoAtual) {
      paragrafoAtual = item.paragraphIndex;
      elementoParagrafo = document.createElement('p');
      elementoParagrafo.className = 'paragrafo-revelado';
      textoCorrido.appendChild(elementoParagrafo);
    }

    const span = document.createElement('span');
    span.className = 'trecho-revelado';
    span.textContent = item.texto;
    elementoParagrafo.appendChild(span);
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
    atualizarFeedback('Boa.', 'ok');

    if (estado.palavrasSelecionadas.length === estado.palavrasOriginais.length) {
      concluirUnidade();
    }
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
}

function concluirUnidade() {
  estado.unidadesReveladas.push({
    texto: estado.unidadeAtual.texto,
    paragraphIndex: estado.unidadeAtual.paragraphIndex,
  });

  estado.unidadeConcluida = true;
  estado.mudouDesdeExportacao = true;
  registrarConclusaoDaUnidade();
  renderizarTextoRevelado();
  atualizarProgressoFase(true);
  renderizarPainelFases();
  atualizarFeedback(`${rotuloModo()} completo.`, 'ok');

  areaMontagem.hidden = true;
  areaPalavras.hidden = true;
  btnReiniciar.hidden = true;
  btnAnterior.hidden = estado.unidadeAtualIndex === 0;

  const unidades = obterUnidadesDaFase();
  const ultimaUnidadeDaFase = estado.unidadeAtualIndex >= unidades.length - 1;
  if (ultimaUnidadeDaFase) {
    const texto = obterTextoAtual();
    const existeProximaFase = texto && estado.faseAtualIndex < texto.fases.length - 1;
    btnProximo.textContent = existeProximaFase ? 'Próxima fase' : 'Concluir treino';
  }

  btnProximo.style.display = 'inline-block';
  salvarSessaoLocal();
}

function unidadeAnterior() {
  if (estado.unidadeAtualIndex <= 0) return;
  estado.unidadeAtualIndex--;
  reconstruirReveladasAte(estado.unidadeAtualIndex);
  carregarUnidade();
}

function proximaUnidade() {
  const unidades = obterUnidadesDaFase();
  estado.unidadeAtualIndex++;

  if (estado.unidadeAtualIndex >= unidades.length) {
    const texto = obterTextoAtual();
    const proximaFaseExiste = texto && estado.faseAtualIndex + 1 < texto.fases.length;
    if (proximaFaseExiste) {
      estado.faseAtualIndex++;
      selectFase.value = String(estado.faseAtualIndex);
      reiniciarFluxoDaFase();
      carregarUnidade();
      return;
    }
    finalizarTreino();
    return;
  }

  estado.unidadeConcluida = false;
  carregarUnidade();
}

function reconstruirReveladasAte(indiceExclusivo) {
  const unidades = obterUnidadesDaFase();
  estado.unidadesReveladas = unidades.slice(0, indiceExclusivo).map(unidade => ({
    texto: unidade.texto,
    paragraphIndex: unidade.paragraphIndex,
  }));
}

function finalizarTreino() {
  painelTreino.hidden = true;
  areaMontagem.hidden = true;
  areaPalavras.hidden = true;
  btnReiniciar.hidden = true;
  btnAnterior.hidden = false;
  btnProximo.style.display = 'none';
  feedback.className = 'feedback ok';
  feedback.textContent = 'Treino concluído.';
  telaVazia.hidden = false;
  telaVazia.innerHTML = '<strong>Parabéns. Você concluiu o treino.</strong><p>Use as fases com mais erros para repetir os trechos difíceis. Baixe o progresso antes de fechar, se quiser guardar um backup.</p>';
  salvarSessaoLocal();
}

function atualizarProgressoFase(contarAtualComoConcluido) {
  const total = obterUnidadesDaFase().length;
  const concluidas = estado.unidadeAtualIndex + (contarAtualComoConcluido ? 1 : 0);
  const progresso = total <= 0 ? 0 : (concluidas / total) * 100;
  barraProgresso.style.width = `${Math.max(0, Math.min(100, progresso))}%`;
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
  if (!registroTexto || !registroTexto.fases) return { erros: 0, tentativas: 0, conclusoes: 0 };
  return registroTexto.fases[String(faseIndex)] || { erros: 0, tentativas: 0, conclusoes: 0 };
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
  const existeErro = fasesComStats.some(item => item.erros > 0);
  const ordenadas = existeErro
    ? [...fasesComStats].sort((a, b) => b.erros - a.erros || a.index - b.index)
    : fasesComStats;

  const faseAtualStats = obterStatsDaFase(texto, estado.faseAtualIndex);
  resumoFase.textContent = `Fase atual: ${estado.faseAtualIndex + 1}. Erros acumulados: ${faseAtualStats.erros || 0}. Tentativas: ${faseAtualStats.tentativas || 0}.`;
  listaFases.innerHTML = '';

  ordenadas.forEach(item => {
    const card = document.createElement('div');
    card.className = 'fase-card';
    if (item.index === estado.faseAtualIndex) card.classList.add('ativa');
    if (item.erros > 0 && item.erros === maxErros) card.classList.add('dificil');

    const titulo = document.createElement('strong');
    titulo.textContent = `Fase ${item.index + 1}`;

    const erros = document.createElement('span');
    erros.textContent = `Erros: ${item.erros}`;

    const tentativas = document.createElement('span');
    tentativas.textContent = `Tentativas: ${item.tentativas}`;

    const media = document.createElement('span');
    media.textContent = `Média: ${item.media.toFixed(2)} erro(s)/tentativa`;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = item.erros > 0 ? 'btn perigo-suave' : 'btn secundario';
    botao.textContent = item.index === estado.faseAtualIndex ? 'Fase atual' : 'Treinar';
    botao.addEventListener('click', () => irParaFase(item.index));

    card.appendChild(titulo);
    card.appendChild(erros);
    card.appendChild(tentativas);
    card.appendChild(media);
    card.appendChild(botao);
    listaFases.appendChild(card);
  });
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
