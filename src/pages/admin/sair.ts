import type { APIRoute } from "astro";
import { encerrarSessao } from "../../lib/auth";

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  encerrarSessao(cookies);
  return redirect("/admin/login");
};
