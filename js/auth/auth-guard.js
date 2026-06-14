/*
 * auth-guard.js — Guarda de rotas baseada na sessão do utilizador.
 *
 * Problema que resolve:
 *   Numa SPA ou app com páginas separadas, qualquer pessoa pode escrever
 *   diretamente "dashboard.html" na barra de endereços. Este módulo
 *   interceta esse acesso e redireciona conforme o estado da sessão.
 *
 * Dois cenários protegidos:
 *   1. Utilizador SEM sessão acede a página protegida → vai para login.
 *   2. Utilizador COM sessão acede a login/registo → vai para dashboard
 *      (não faz sentido ver o login se já estamos autenticados).
 */

import { supabase } from '../config/supabaseClient.js';

/*
 * Obtém apenas o nome do ficheiro atual (ex.: "dashboard.html") em vez
 * do URL completo. Isto torna as comparações simples e independentes do
 * domínio ou caminho onde a app está alojada.
 */
const currentPage = window.location.pathname.split('/').pop().toLowerCase();

/*
 * Set (em vez de Array) para as verificações de pertença (.has) serem O(1)
 * em vez de O(n) — mais eficiente quando o número de páginas cresce.
 *
 * protectedPages: exigem sessão ativa — sem ela, o utilizador é redirecionado.
 * publicAuthPages: não fazem sentido com sessão — o utilizador já está dentro.
 */
const protectedPages = new Set(['dashboard.html', 'publish.html', 'item.html', 'admin.html', 'edit.html', 'favorites.html', 'profile.html', 'messages.html']);
const publicAuthPages = new Set(['index.html', 'login.html', 'register.html']);

/*
 * Os caminhos de redirecionamento são diferentes consoante a página atual
 * ser index.html (raiz do projeto) ou estar dentro da pasta /pages/.
 * Sem este ajuste, um redirecionamento de index.html para "login.html"
 * tentaria aceder à raiz e não a pages/login.html.
 */
const loginPath = currentPage === 'index.html' ? './pages/login.html' : 'login.html';
const dashboardPath = currentPage === 'index.html' ? './pages/dashboard.html' : 'dashboard.html';

/*
 * runAuthGuard — verifica a sessão e redireciona se necessário.
 *
 * É async porque getSession() é uma chamada assíncrona (consulta o token
 * guardado localmente e valida-o). Deve ser chamada com "await" no início
 * de cada página para bloquear o resto da inicialização até à verificação.
 */
export async function runAuthGuard() {
  const { data } = await supabase.auth.getSession();
  const session = data ? data.session : null;

  if (protectedPages.has(currentPage) && !session) {
    window.location.replace(loginPath);
    return;
  }

  if (publicAuthPages.has(currentPage) && session) {
    window.location.replace(dashboardPath);
  }
}
