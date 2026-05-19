// Importa o cliente que acabámos de configurar
import { supabase } from '../js/config/supabaseClient.js'

// Função de teste para ver se os itens aparecem na consola do browser
async function testarConexao() {
  const { data, error } = await supabase
    .from('item')
    .select('*')

  if (error) {
    console.error('Erro ao ligar ao Supabase:', error.message)
  } else {
    console.log('Ligado com sucesso! Dados dos itens:', data)
  }
}

// Executa a função de teste
testarConexao()