/*
 * app.js — Ponto de entrada da página inicial (index.html).
 *
 * Esta página é apenas a "capa" da app — não tem conteúdo próprio além
 * da navegação para login/registo. O initPage() trata de:
 *   1. Registar o Service Worker (para a app funcionar offline).
 *   2. Verificar se há sessão: se sim, redireciona para o dashboard
 *      automaticamente (utilizador já autenticado não precisa de ver a capa).
 *   3. Ligar os botões de logout (caso existam na página).
 */

import { initPage } from '../utils/utils.js';

await initPage();
