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
const COMPRIMENTO_MAXIMO = 16;
const PASSO_DO_CAMINHO = 0.02;
const SEGMENTOS_AO_LONGO = 220;
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

export interface CenaDoRolo {
  definirComprimento(comprimento: number): void;
  redimensionar(largura: number, altura: number): void;
  renderizar(): void;
  destruir(): void;
}

export interface OpcoesDaCena {
  densidadeDePixels?: number;
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

// Caminho da fita pré-calculado uma vez; cada quadro só amostra até o comprimento.
function caminhoDaFita(): PontoDoCaminho[] {
  const pontos: PontoDoCaminho[] = [];
  let x = -RAIO;
  let y = 0;
  for (let s = 0; s <= COMPRIMENTO_MAXIMO + PASSO_DO_CAMINHO; s += PASSO_DO_CAMINHO) {
    const angulo = -Math.PI / 2 - CURVA_TOTAL * (1 - Math.exp(-s / CURVA_ESCALA));
    const torcao = TORCAO_TOTAL * (1 - Math.exp(-s / TORCAO_ESCALA));
    pontos.push({ x, y, angulo, torcao });
    x += Math.cos(angulo) * PASSO_DO_CAMINHO;
    y += Math.sin(angulo) * PASSO_DO_CAMINHO;
  }
  return pontos;
}

function amostrar(caminho: PontoDoCaminho[], s: number): PontoDoCaminho {
  const i = Math.min(s / PASSO_DO_CAMINHO, caminho.length - 2);
  const base = Math.floor(i);
  const t = i - base;
  const a = caminho[base];
  const b = caminho[base + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angulo: a.angulo + (b.angulo - a.angulo) * t,
    torcao: a.torcao + (b.torcao - a.torcao) * t,
  };
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
function moldarFita(geometria: BufferGeometry, caminho: PontoDoCaminho[], comprimento: number) {
  const posicoes = geometria.getAttribute("position") as BufferAttribute;
  const uvs = geometria.getAttribute("uv") as BufferAttribute;
  const colunas = SEGMENTOS_NA_LARGURA + 1;
  for (let i = 0; i <= SEGMENTOS_AO_LONGO; i++) {
    for (let j = 0; j < colunas; j++) {
      const naPonta = i === SEGMENTOS_AO_LONGO;
      const recuo = naPonta && j % 2 === 1 ? DENTE_DA_SERRILHA : 0;
      const s = Math.max(0, (comprimento * i) / SEGMENTOS_AO_LONGO - recuo);
      const p = amostrar(caminho, s);
      const v = j / SEGMENTOS_NA_LARGURA;
      const z = (v - 0.5) * LARGURA;
      // Gira o eixo da largura (Z) em torno da tangente: a torção expõe a face impressa.
      const cosT = Math.cos(p.torcao);
      const sinT = Math.sin(p.torcao);
      const lateralX = Math.sin(p.angulo) * sinT;
      const lateralY = -Math.cos(p.angulo) * sinT;
      const indice = i * colunas + j;
      posicoes.setXYZ(indice, p.x + lateralX * z, p.y + lateralY * z, cosT * z);
      uvs.setXY(indice, (s - comprimento) / PERIODO_IMPRESSAO, v);
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

// Enquadramento num quadro quadrado: rolo no alto à direita, fita saindo pela borda de baixo.
const CAMERA = { campoDeVisao: 28, distancia: 10 };
const POSICAO_DO_CONJUNTO = { x: 0.9, y: 0.85 };
const GIRO_DO_CONJUNTO = { x: -0.12, y: 0.85, z: -0.14 };

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

  const camera = new PerspectiveCamera(CAMERA.campoDeVisao, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA.distancia);

  const impressao = texturaDaImpressao();
  const voltas = texturaDasVoltas();
  const conjunto = new Group();
  conjunto.position.set(POSICAO_DO_CONJUNTO.x, POSICAO_DO_CONJUNTO.y, 0);
  conjunto.rotation.set(GIRO_DO_CONJUNTO.x, GIRO_DO_CONJUNTO.y, GIRO_DO_CONJUNTO.z);
  cena.add(conjunto);

  const rolo = montarRolo(impressao, voltas);
  conjunto.add(rolo);

  const caminho = caminhoDaFita();
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

  const cenaDoRolo: CenaDoRolo = {
    definirComprimento(comprimento) {
      const c = Math.min(Math.max(comprimento, 0.1), COMPRIMENTO_MAXIMO);
      moldarFita(geometria, caminho, c);
      // Ponto de saída com coordenada -c na arte: o rolo gira para casar a impressão.
      rolo.rotation.z = (3 * Math.PI) / 2 + c / RAIO;
    },
    redimensionar(largura, altura) {
      renderer.setSize(largura, altura, false);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
    },
    renderizar() {
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
