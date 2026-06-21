/*
 * sw-register.js — Registo centralizado do Service Worker.
 *
 * O que é um Service Worker?
 *   É um script que corre num thread separado do browser, entre a aplicação
 *   e a rede. Permite que a app funcione offline e carregue mais depressa,
 *   porque os assets (HTML, CSS, JS) são servidos da cache local em vez
 *   de serem descarregados do servidor em cada visita.
 *
 * Porquê um ficheiro separado para o registo?
 *   O Service Worker tem de ser registado em todas as páginas da app.
 *   Centralizar aqui garante que basta importar este módulo em cada
 *   página — se a lógica mudar, só se altera num sítio.
 */

export function registerServiceWorker() {
  /*
   * Verificação de suporte: browsers antigos não têm serviceWorker.
   * O "return" imediato faz a app continuar a funcionar normalmente
   * sem SW — degradação elegante (graceful degradation).
   */
  if (!('serviceWorker' in navigator)) return;

  /*
   * O registo é feito no evento "load" (após o carregamento completo da página)
   * para não competir com recursos críticos e atrasar a renderização inicial.
   * O SW regista-se em segundo plano quando a página já está visível.
   */
  window.addEventListener('load', () => {
    /*
     * Calculamos o caminho do sw.js a partir da localização deste módulo
     * (js/sw-register.js → ../sw.js = raiz do projeto). Assim funciona tanto
     * na raiz do domínio (ex.: localhost) como numa subpasta
     * (ex.: github.io/projeto_Interdisciplinar/), ao contrário do antigo
     * '/sw.js' absoluto, que falhava em subpastas.
     */
    const swUrl = new URL('../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('Service Worker registado com escopo:', registration.scope);
      })
      .catch((error) => {
        console.error('Erro ao registar o Service Worker:', error);
      });
  });
}
