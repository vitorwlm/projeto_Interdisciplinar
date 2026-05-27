// Importa o cliente que acabámos de configurar
import { supabase } from '../js/config/supabaseClient.js'

const publish = document.getElementById('submit');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const university = document.getElementById('university').value;
        const password = document.getElementById('password').value;

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'A criar conta...';

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });

            if (error) throw error;

            const { error: profileError } = await supabase
                .from('utilizador')
                .upsert({ id: data.user.id, name, email, university });

            if (profileError) throw profileError;

            const msg = document.createElement('div');
            msg.className = 'notification is-success';
            msg.textContent = 'Conta criada! Verifica o teu e-mail para confirmares o registo.';
            registerForm.prepend(msg);

            setTimeout(() => { window.location.href = 'login.html'; }, 2000);

        } catch (error) {
            console.error('Erro:', error.message);
            const errMsg = document.createElement('div');
            errMsg.className = 'notification is-danger';
            errMsg.textContent = 'Não foi possível criar a conta: ' + error.message;
            registerForm.prepend(errMsg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Criar Conta';
        }
    });
}

// // Função de teste para ver se os itens aparecem na consola do browser
// async function testarConexao() {
//   const { data, error } = await supabase
//     .from('item')
//     .select('*')

//   if (error) {
//     console.error('Erro ao ligar ao Supabase:', error.message)
//   } else {
//     console.log('Ligado com sucesso! Dados dos itens:', data)
//   }
// }
// async function name(params) {
  
}
// Executa a função de teste
testarConexao()