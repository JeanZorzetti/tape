import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { buscarUsuario, contarUsuarios, criarUsuario } from "./crm";

/**
 * Autenticação do /admin: senha com scrypt e sessão em cookie assinado (HMAC).
 * Tudo com `node:crypto` — nenhuma dependência de auth.
 *
 * ponytail: sem token CSRF por formulário — o Astro já recusa POST cross-site
 * (`security.checkOrigin`, ligado por padrão) e o cookie é `SameSite=Strict`.
 * Isso depende de `security.allowedDomains` no astro.config: sem ele o Astro
 * ignora o header Host, vira `http://localhost` e recusa todo POST atrás do proxy.
 */

const COOKIE = "tp_sessao";
const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TENTATIVAS = 8;
const JANELA_BLOQUEIO_MS = 15 * 60 * 1000;

const env = (nome: string) => process.env[nome] ?? (import.meta.env as Record<string, string>)[nome];

function segredo() {
  const s = env("SESSION_SECRET");
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou curta (mínimo 32 caracteres).");
  return s;
}

export function hashSenha(senha: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;
}

export function senhaConfere(senha: string, hash: string) {
  const [salt, esperado] = hash.split(":");
  if (!salt || !esperado) return false;
  const calculado = scryptSync(senha, salt, 64);
  const alvo = Buffer.from(esperado, "hex");
  return calculado.length === alvo.length && timingSafeEqual(calculado, alvo);
}

// ponytail: throttle em memória, some no restart e não é compartilhado entre réplicas.
// Suficiente para um painel com um usuário; virar Redis/tabela se escalar.
const tentativas = new Map<string, { n: number; ate: number }>();

export function bloqueado(ip: string) {
  const t = tentativas.get(ip);
  return !!t && t.n >= MAX_TENTATIVAS && Date.now() < t.ate;
}

function registrarFalha(ip: string) {
  const t = tentativas.get(ip) ?? { n: 0, ate: 0 };
  tentativas.set(ip, { n: t.n + 1, ate: Date.now() + JANELA_BLOQUEIO_MS });
}

function assinar(valor: string) {
  return createHmac("sha256", segredo()).update(valor).digest("hex");
}

export function criarSessao(cookies: AstroCookies, usuarioId: number) {
  const corpo = `${usuarioId}.${Date.now() + DURACAO_SESSAO_MS}`;
  cookies.set(COOKIE, `${corpo}.${assinar(corpo)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
}

export function encerrarSessao(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: "/" });
}

/** Id do usuário logado, ou null se o cookie faltar, estiver vencido ou adulterado. */
export function sessaoAtual(cookies: AstroCookies): number | null {
  const bruto = cookies.get(COOKIE)?.value;
  if (!bruto) return null;
  const [id, expira, assinatura] = bruto.split(".");
  if (!id || !expira || !assinatura) return null;

  const esperada = Buffer.from(assinar(`${id}.${expira}`));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  if (Number(expira) < Date.now()) return null;
  return Number(id);
}

/**
 * Valida as credenciais. Se ainda não existe nenhum usuário, o primeiro login com
 * ADMIN_EMAIL/ADMIN_SENHA cria a conta — bootstrap sem script e sem shell na VPS.
 */
export async function autenticar(email: string, senha: string, ip: string) {
  if (bloqueado(ip)) return null;

  const usuario = await buscarUsuario(email);
  if (!usuario) {
    const admEmail = env("ADMIN_EMAIL")?.toLowerCase();
    const admSenha = env("ADMIN_SENHA");
    const primeiroAcesso = admEmail && admSenha && email.toLowerCase() === admEmail && senha === admSenha;
    if (primeiroAcesso && (await contarUsuarios()) === 0) {
      return criarUsuario(admEmail, hashSenha(admSenha));
    }
    registrarFalha(ip);
    return null;
  }

  if (!senhaConfere(senha, usuario.senha_hash)) {
    registrarFalha(ip);
    return null;
  }
  tentativas.delete(ip);
  return usuario;
}
