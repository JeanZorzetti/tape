/*
 * Rolo de fita TapePro em 3D: o rolo laranja com tubete de papelão e a fita saindo
 * dele com a marca impressa. A cena inteira é função de UM número, o comprimento já
 * desenrolado: o mesmo valor dá o mesmo quadro no hero, no pôster e no vídeo.
 *
 * Referencial do rolo: eixo em Z, fita no plano XY. A fita deixa o rolo pelo ponto
 * mais à esquerda (-RAIO, 0) descendo; o material corre no sentido anti-horário,
 * então o rolo gira +comprimento/RAIO a cada pedaço puxado.
 */
import {
  NeutralToneMapping,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { COMPRIMENTO_REPOUSO } from "./medidas";

// Proporção de um rolo de 48 mm × 100 m: ~106 mm de diâmetro sobre tubete de 76 mm.
const RAIO = 1;
const RAIO_TUBETE = 0.74;
const RAIO_TUBETE_INTERNO = 0.68;
const LARGURA = 0.9;
const SOBRA_DO_TUBETE = 0.03;

// Uma volta do rolo é exatamente um ciclo da impressão: a arte fecha sem emenda.
const PERIODO_IMPRESSAO = 2 * Math.PI * RAIO;
const LARGURA_TEXTURA = 2048;
const ALTURA_TEXTURA = Math.round((LARGURA_TEXTURA * LARGURA) / PERIODO_IMPRESSAO);

// Forma da fita pendurada: desce, abre em diagonal para a esquerda e gira a face
// impressa para a câmera. Fixa: só o trecho [0, comprimento] muda.
const CURVA_TOTAL = 1.1;
const CURVA_ESCALA = 3;
const TORCAO_TOTAL = -0.75;
const TORCAO_ESCALA = 2.4;
const COMPRIMENTO_MINIMO = 0.1;
const PASSO_DO_CAMINHO = 0.02;
const SEGMENTOS_AO_LONGO = 320;
/** Fita que vira malha no hero: cobre o maior comprimento que o hero usa. */
const TRECHO_DO_HERO = 16;
const SEGMENTOS_NA_LARGURA = 10;
const DENTE_DA_SERRILHA = 0.05;


const COR = {
  laranja: "#f47c20",
  laranjaSombra: "#d9661a",
  navy: "#232c7a",
  branco: "#ffffff",
  kraft: "#c8a97a",
  kraftEscuro: "#9c7f55",
};

export interface Enquadramento {
  campoDeVisao: number;
  posicao: { x: number; y: number };
}

export interface OpcoesDaCena {
  densidadeDePixels?: number;
  /** Outro quadro que não o quadrado do hero (o vídeo vertical, por exemplo). */
  enquadramento?: Enquadramento;
  /** Mantém o último quadro no buffer: necessário para ler o canvas (pôster, vídeo). */
  preservarQuadro?: boolean;
}

export async function carregarFontesDaImpressao(): Promise<void> {
  await Promise.all([
    document.fonts.load(`800 100px Archivo`),
    document.fonts.load(`500 40px "IBM Plex Mono"`),
  ]);
}

function texturaDaImpressao(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA_TEXTURA;
  canvas.height = ALTURA_TEXTURA;
  const ctx = canvas.getContext("2d")!;
  const h = ALTURA_TEXTURA;

  ctx.fillStyle = COR.laranja;
  ctx.fillRect(0, 0, LARGURA_TEXTURA, h);

  // Pontilhado das bordas: o mesmo da faixa TapeStrip do site.
  ctx.strokeStyle = COR.navy;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  for (const y of [h * 0.1, h * 0.9]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LARGURA_TEXTURA, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  const fonteMarca = `800 ${Math.round(h * 0.46)}px Archivo`;
  const fonteApoio = `500 ${Math.round(h * 0.15)}px "IBM Plex Mono"`;
  const apoio = "FITAS PERSONALIZADAS";
  ctx.font = fonteMarca;
  const larguraTape = ctx.measureText("TAPE").width;
  const larguraPro = ctx.measureText("PRO").width;
  ctx.font = fonteApoio;
  ctx.letterSpacing = `${Math.round(h * 0.04)}px`;
  const larguraApoio = ctx.measureText(apoio).width;
  const folga = (LARGURA_TEXTURA - (larguraTape + larguraPro + larguraApoio)) / 2;

  ctx.textBaseline = "middle";
  let x = folga / 2;
  ctx.letterSpacing = "0px";
  ctx.font = fonteMarca;
  ctx.fillStyle = COR.navy;
  ctx.fillText("TAPE", x, h * 0.53);
  x += larguraTape;
  ctx.fillStyle = COR.branco;
  ctx.fillText("PRO", x, h * 0.53);
  x += larguraPro + folga;
  ctx.font = fonteApoio;
  ctx.letterSpacing = `${Math.round(h * 0.04)}px`;
  ctx.fillStyle = COR.navy;
  ctx.fillText(apoio, x, h * 0.52);

  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  textura.wrapS = RepeatWrapping;
  textura.anisotropy = 8;
  return textura;
}

// Face lateral: as voltas de fita empilhadas, cada uma com um brilho levemente diferente.
function texturaDasVoltas(): CanvasTexture {
  const tamanho = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tamanho;
  const ctx = canvas.getContext("2d")!;
  const centro = tamanho / 2;
  ctx.fillStyle = COR.laranja;
  ctx.fillRect(0, 0, tamanho, tamanho);
  const raioInterno = (RAIO_TUBETE / RAIO) * centro;
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let r = raioInterno; r < centro; r += 1.6) {
    ctx.strokeStyle = aleatorio() > 0.5 ? COR.laranjaSombra : "#f98d3a";
    ctx.globalAlpha = 0.25 + aleatorio() * 0.35;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(centro, centro, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  return textura;
}

interface PontoDoCaminho {
  x: number;
  y: number;
  angulo: number;
  torcao: number;
}

/**
 * Para onde a fita vai, além do hero. Tudo em unidades locais do conjunto (antes da escala).
 * `viagem` 0 é a fita pendurada do hero; 1 é a faixa reta que desce pela margem da página.
 * A dobra só existe na viagem: perto da ponta, a fita vira para a esquerda (até `giro`
 * radianos, num arco de `raio`) e corre `corrida` na horizontal até a etiqueta do CTA.
 */
export interface FormaDaFita {
  viagem: number;
  raio: number;
  giro: number;
  corrida: number;
}

const VIRADA_DA_ARTE = 0.5;
const FORMA_DO_HERO: FormaDaFita = { viagem: 0, raio: 1, giro: 0, corrida: 0 };

// Direção da fita a s do rolo. A forma do hero é contada a partir do rolo; a dobra, a
// partir da ponta: a curva do CTA acompanha a ponta, por mais fita que já tenha saído.
function anguloEm(s: number, comprimento: number, forma: FormaDaFita): number {
  const doHero = -Math.PI / 2 - CURVA_TOTAL * (1 - Math.exp(-s / CURVA_ESCALA));
  if (forma.viagem === 0) return doHero;
  const atePonta = comprimento - s;
  const arco = forma.raio * forma.giro;
  let varredura = 0;
  if (atePonta < forma.corrida) varredura = forma.giro;
  else if (atePonta < forma.corrida + arco) varredura = forma.giro * (1 - (atePonta - forma.corrida) / arco);
  const daViagem = -Math.PI / 2 - varredura;
  return doHero + (daViagem - doHero) * forma.viagem;
}

// Na viagem a fita deita de frente para a câmera (largura no plano da tela): a impressão aparece inteira.
const TORCAO_DE_FRENTE = -Math.PI / 2;

function torcaoEm(s: number, forma: FormaDaFita): number {
  const doHero = TORCAO_TOTAL * (1 - Math.exp(-s / TORCAO_ESCALA));
  return doHero + (TORCAO_DE_FRENTE - doHero) * forma.viagem;
}

// Integra a direção do rolo até s. O passo cresce com a fita: na viagem ela passa de
// cem unidades, e a parte reta não precisa da resolução da curva do hero.
function pontoEm(s: number, comprimento: number, forma: FormaDaFita): PontoDoCaminho {
  const passos = Math.max(1, Math.ceil(s / Math.max(PASSO_DO_CAMINHO, comprimento / 800)));
  const passo = s / passos;
  let x = -RAIO;
  let y = 0;
  for (let k = 0; k < passos; k++) {
    const angulo = anguloEm((k + 0.5) * passo, comprimento, forma);
    x += Math.cos(angulo) * passo;
    y += Math.sin(angulo) * passo;
  }
  return { x, y, angulo: anguloEm(s, comprimento, forma), torcao: torcaoEm(s, forma) };
}

function geometriaDaFita(): BufferGeometry {
  const colunas = SEGMENTOS_NA_LARGURA + 1;
  const linhas = SEGMENTOS_AO_LONGO + 1;
  const geometria = new BufferGeometry();
  geometria.setAttribute("position", new BufferAttribute(new Float32Array(linhas * colunas * 3), 3));
  geometria.setAttribute("uv", new BufferAttribute(new Float32Array(linhas * colunas * 2), 2));
  const indices: number[] = [];
  for (let i = 0; i < SEGMENTOS_AO_LONGO; i++) {
    for (let j = 0; j < SEGMENTOS_NA_LARGURA; j++) {
      const a = i * colunas + j;
      const b = a + colunas;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometria.setIndex(indices);
  return geometria;
}

// Reposiciona os vértices da fita para o comprimento dado. A ponta tem os dentes da
// lâmina do aplicador, e a impressão fica presa à ponta: puxar faz a arte sair do rolo.
// Só o trecho final (`trechoVisivel`) vira malha: o começo já saiu da tela junto com o rolo.
function moldarFita(
  geometria: BufferGeometry,
  comprimento: number,
  forma: FormaDaFita,
  trechoVisivel: number,
) {
  const posicoes = geometria.getAttribute("position") as BufferAttribute;
  const uvs = geometria.getAttribute("uv") as BufferAttribute;
  const colunas = SEGMENTOS_NA_LARGURA + 1;
  const inicio = Math.max(0, comprimento - trechoVisivel);
  const passo = (comprimento - inicio) / SEGMENTOS_AO_LONGO;
  let { x, y } = pontoEm(inicio, comprimento, forma);
  // A fita termina correndo para a esquerda: com a arte no sentido do hero, a marca ficaria
  // de cabeça para baixo na etiqueta. Na metade da saída do hero (fita em movimento rápido)
  // a arte gira 180° no plano e passa a ler direito no trecho final.
  const sentido = forma.viagem >= VIRADA_DA_ARTE ? -1 : 1;
  for (let i = 0; i <= SEGMENTOS_AO_LONGO; i++) {
    const sDaLinha = inicio + passo * i;
    if (i > 0) {
      const angulo = anguloEm(sDaLinha - passo / 2, comprimento, forma);
      x += Math.cos(angulo) * passo;
      y += Math.sin(angulo) * passo;
    }
    const angulo = anguloEm(sDaLinha, comprimento, forma);
    const torcao = torcaoEm(sDaLinha, forma);
    for (let j = 0; j < colunas; j++) {
      const naPonta = i === SEGMENTOS_AO_LONGO;
      const recuo = naPonta && j % 2 === 1 ? Math.min(DENTE_DA_SERRILHA, sDaLinha) : 0;
      const s = sDaLinha - recuo;
      const px = x - Math.cos(angulo) * recuo;
      const py = y - Math.sin(angulo) * recuo;
      const v = j / SEGMENTOS_NA_LARGURA;
      const z = (v - 0.5) * LARGURA;
      // Gira o eixo da largura (Z) em torno da tangente: a torção expõe a face impressa.
      const cosT = Math.cos(torcao);
      const sinT = Math.sin(torcao);
      const lateralX = Math.sin(angulo) * sinT;
      const lateralY = -Math.cos(angulo) * sinT;
      const indice = i * colunas + j;
      posicoes.setXYZ(indice, px + lateralX * z, py + lateralY * z, cosT * z);
      uvs.setXY(indice, (sentido * (s - comprimento)) / PERIODO_IMPRESSAO, sentido > 0 ? v : 1 - v);
    }
  }
  posicoes.needsUpdate = true;
  uvs.needsUpdate = true;
  geometria.computeVertexNormals();
  geometria.computeBoundingSphere();
}

function montarRolo(impressao: CanvasTexture, voltas: CanvasTexture): Group {
  const rolo = new Group();

  const materialImpresso = new MeshPhysicalMaterial({
    map: impressao,
    roughness: 0.45,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
  });
  // CylinderGeometry tem o eixo em Y; deitado em X ele passa a ter o eixo em Z.
  const superficie = new Mesh(new CylinderGeometry(RAIO, RAIO, LARGURA, 160, 1, true), materialImpresso);
  superficie.rotation.x = Math.PI / 2;
  rolo.add(superficie);

  const materialVoltas = new MeshPhysicalMaterial({ map: voltas, roughness: 0.5, clearcoat: 0.3 });
  for (const lado of [1, -1]) {
    const face = new Mesh(new RingGeometry(RAIO_TUBETE, RAIO, 160, 1), materialVoltas);
    face.position.z = (lado * LARGURA) / 2;
    if (lado < 0) face.rotation.y = Math.PI;
    rolo.add(face);
  }

  const larguraTubete = LARGURA + SOBRA_DO_TUBETE * 2;
  const kraft = new MeshStandardMaterial({ color: COR.kraft, roughness: 0.92 });
  const kraftInterno = new MeshStandardMaterial({ color: COR.kraftEscuro, roughness: 0.95, side: BackSide });
  const tubete = new Mesh(new CylinderGeometry(RAIO_TUBETE, RAIO_TUBETE, larguraTubete, 96, 1, true), kraft);
  tubete.rotation.x = Math.PI / 2;
  const tubeteInterno = new Mesh(
    new CylinderGeometry(RAIO_TUBETE_INTERNO, RAIO_TUBETE_INTERNO, larguraTubete, 96, 1, true),
    kraftInterno,
  );
  tubeteInterno.rotation.x = Math.PI / 2;
  rolo.add(tubete, tubeteInterno);
  for (const lado of [1, -1]) {
    const borda = new Mesh(new RingGeometry(RAIO_TUBETE_INTERNO, RAIO_TUBETE, 96, 1), kraft);
    borda.position.z = (lado * larguraTubete) / 2;
    if (lado < 0) borda.rotation.y = Math.PI;
    rolo.add(borda);
  }
  return rolo;
}

// Enquadramento do quadro quadrado do hero: rolo no alto à direita, fita saindo pela borda de baixo.
const DISTANCIA_DA_CAMERA = 10;
const ENQUADRAMENTO_DO_HERO: Enquadramento = { campoDeVisao: 28, posicao: { x: 0.9, y: 0.85 } };
const GIRO_DO_CONJUNTO = { x: -0.12, y: 0.85, z: -0.14 };
const ITERACOES_DA_BUSCA = 26;

/** Altura, em unidades da cena, do quadro quadrado do hero. A página converte pixels por ela. */
export const ALTURA_DO_QUADRO_DO_HERO =
  2 * DISTANCIA_DA_CAMERA * Math.tan(((ENQUADRAMENTO_DO_HERO.campoDeVisao / 2) * Math.PI) / 180);
export const DESLOCAMENTO_DO_ROLO_NO_QUADRO = ENQUADRAMENTO_DO_HERO.posicao;
export const RAIO_DO_ROLO = RAIO;
export const LARGURA_DA_FITA = LARGURA;

/**
 * Pose do rolo na página inteira, em unidades do mundo: origem no centro da tela, y para cima.
 * `eixo` é o centro do quadro do hero (por onde a câmera olha, para a perspectiva bater com o
 * pôster). Com `alvoDaPonta`, o comprimento é o que leva a ponta até essa altura.
 */
export interface PoseNaPagina {
  eixo: { x: number; y: number };
  rolo: { x: number; y: number };
  escala: number;
  comprimentoDoHero: number;
  forma: FormaDaFita;
  alvoDaPonta: number | null;
  trechoVisivel: number;
}

export interface CenaDoRolo {
  definirComprimento(comprimento: number): void;
  /** Muda o canvas para a página inteira: largura e altura da tela, em px, e px por unidade. */
  enquadrarPagina(largura: number, altura: number, pixelsPorUnidade: number): void;
  definirPose(pose: PoseNaPagina): void;
  redimensionar(largura: number, altura: number): void;
  renderizar(): void;
  destruir(): void;
}

export function criarCenaDoRolo(canvas: HTMLCanvasElement, opcoes: OpcoesDaCena = {}): CenaDoRolo {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: opcoes.preservarQuadro ?? false,
  });
  renderer.setPixelRatio(opcoes.densidadeDePixels ?? Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const cena = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04);
  cena.environment = ambiente.texture;
  cena.environmentIntensity = 0.4;
  pmrem.dispose();

  const luzPrincipal = new DirectionalLight(0xffffff, 1.5);
  luzPrincipal.position.set(-4, 5, 6);
  const luzDeRecorte = new DirectionalLight(0xffd9b8, 1.2);
  luzDeRecorte.position.set(5, 2, -4);
  cena.add(luzPrincipal, luzDeRecorte);

  const enquadramento = opcoes.enquadramento ?? ENQUADRAMENTO_DO_HERO;
  const camera = new PerspectiveCamera(enquadramento.campoDeVisao, 1, 0.1, 100);
  camera.position.set(0, 0, DISTANCIA_DA_CAMERA);

  const impressao = texturaDaImpressao();
  const voltas = texturaDasVoltas();
  const conjunto = new Group();
  conjunto.position.set(enquadramento.posicao.x, enquadramento.posicao.y, 0);
  conjunto.rotation.set(GIRO_DO_CONJUNTO.x, GIRO_DO_CONJUNTO.y, GIRO_DO_CONJUNTO.z);
  cena.add(conjunto);

  const rolo = montarRolo(impressao, voltas);
  conjunto.add(rolo);

  const geometria = geometriaDaFita();
  const fita = new Mesh(
    geometria,
    new MeshPhysicalMaterial({
      map: impressao,
      roughness: 0.5,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      side: DoubleSide,
    }),
  );
  fita.frustumCulled = false;
  conjunto.add(fita);

  const pagina = { largura: 1, altura: 1, pixelsPorUnidade: 1 };
  const pontaNoMundo = new Vector3();

  function aplicarComprimento(comprimento: number, forma: FormaDaFita, trechoVisivel: number) {
    const c = Math.max(comprimento, COMPRIMENTO_MINIMO);
    moldarFita(geometria, c, forma, trechoVisivel);
    // Ponto de saída com coordenada -c na arte: o rolo gira para casar a impressão.
    rolo.rotation.z = (3 * Math.PI) / 2 + c / RAIO;
  }

  function alturaDaPonta(comprimento: number, forma: FormaDaFita): number {
    const ponta = pontoEm(comprimento, comprimento, forma);
    return conjunto.localToWorld(pontaNoMundo.set(ponta.x, ponta.y, 0)).y;
  }

  // A ponta desce quanto mais fita sai: busca binária pelo comprimento que a leva ao alvo.
  function comprimentoAte(alvo: number, forma: FormaDaFita, maximo: number): number {
    let curto = COMPRIMENTO_MINIMO;
    let longo = maximo;
    if (alturaDaPonta(longo, forma) > alvo) return longo;
    for (let k = 0; k < ITERACOES_DA_BUSCA; k++) {
      const meio = (curto + longo) / 2;
      if (alturaDaPonta(meio, forma) > alvo) curto = meio;
      else longo = meio;
    }
    return (curto + longo) / 2;
  }

  const cenaDoRolo: CenaDoRolo = {
    definirComprimento(comprimento) {
      aplicarComprimento(comprimento, FORMA_DO_HERO, TRECHO_DO_HERO);
    },
    enquadrarPagina(largura, altura, pixelsPorUnidade) {
      Object.assign(pagina, { largura, altura, pixelsPorUnidade });
      renderer.setSize(largura, altura, false);
    },
    definirPose(pose) {
      const { largura, altura, pixelsPorUnidade } = pagina;
      // A câmera fica sobre o centro do quadro do hero e só a janela desliza até a tela:
      // assim a perspectiva do rolo é a mesma do pôster, em qualquer ponto da página.
      const eixoX = largura / 2 + pose.eixo.x * pixelsPorUnidade;
      const eixoY = altura / 2 - pose.eixo.y * pixelsPorUnidade;
      const larguraTotal = 2 * Math.max(eixoX, largura - eixoX, 1);
      const alturaTotal = 2 * Math.max(eixoY, altura - eixoY, 1);
      camera.position.set(pose.eixo.x, pose.eixo.y, DISTANCIA_DA_CAMERA);
      camera.aspect = larguraTotal / alturaTotal;
      camera.fov = (2 * Math.atan(alturaTotal / pixelsPorUnidade / 2 / DISTANCIA_DA_CAMERA) * 180) / Math.PI;
      camera.setViewOffset(larguraTotal, alturaTotal, larguraTotal / 2 - eixoX, alturaTotal / 2 - eixoY, largura, altura);

      const v = pose.forma.viagem;
      conjunto.position.set(pose.rolo.x, pose.rolo.y, 0);
      conjunto.scale.setScalar(pose.escala);
      conjunto.rotation.set(GIRO_DO_CONJUNTO.x * (1 - v), GIRO_DO_CONJUNTO.y * (1 - v), GIRO_DO_CONJUNTO.z * (1 - v));
      conjunto.updateMatrixWorld(true);

      let comprimento = pose.comprimentoDoHero;
      if (pose.alvoDaPonta !== null && v > 0) {
        // O rolo ficou lá no hero: a fita precisa vencer a distância dele até o alvo, com folga para a dobra.
        const distancia = Math.abs(pose.rolo.y - pose.alvoDaPonta) / pose.escala;
        const maximo = pose.comprimentoDoHero + 1.5 * distancia + (2 * altura) / (pixelsPorUnidade * pose.escala) + 40;
        const ateOAlvo = comprimentoAte(pose.alvoDaPonta, pose.forma, maximo);
        comprimento += (ateOAlvo - comprimento) * v;
      }
      aplicarComprimento(comprimento, pose.forma, Math.max(TRECHO_DO_HERO, pose.trechoVisivel));
    },
    redimensionar(largura, altura) {
      renderer.setSize(largura, altura, false);
      camera.clearViewOffset();
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
    },
    renderizar() {
      camera.updateProjectionMatrix();
      renderer.render(cena, camera);
    },
    destruir() {
      cena.traverse((objeto) => {
        if (objeto instanceof Mesh) {
          objeto.geometry.dispose();
          (Array.isArray(objeto.material) ? objeto.material : [objeto.material]).forEach((m) => m.dispose());
        }
      });
      impressao.dispose();
      voltas.dispose();
      ambiente.dispose();
      renderer.dispose();
    },
  };
  cenaDoRolo.definirComprimento(COMPRIMENTO_REPOUSO);
  return cenaDoRolo;
}
