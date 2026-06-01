import { supabase } from './config/supabaseClient.js';

const registerForm = document.getElementById('register-form');

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

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'A Entrar...';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) throw error;

            // If a returnUrl was provided (e.g., user started from publish), go there
            const params = new URLSearchParams(window.location.search);
            const returnUrl = params.get('returnUrl');

            if (returnUrl) {
                // sanitize: allow only same-folder html filename
                const safeFile = returnUrl.split('/').pop().split('?')[0];
                const isSafe = /^[a-z0-9_-]+\.html$/i.test(safeFile);
                window.location.replace(isSafe ? safeFile : 'dashboard.html');
            } else {
                window.location.replace('dashboard.html');
            }

        } catch (error) {
            console.error('Erro:', error.message);
            const errMsg = document.createElement('div');
            errMsg.className = 'notification is-danger';
            errMsg.textContent = 'E-mail ou password incorretos.';
            loginForm.prepend(errMsg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar';
        }
    });
}

const logoutButtons = document.querySelectorAll('[data-logout-btn], #logout-btn');

logoutButtons.forEach((logoutBtn) => {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        try {
            const { error } = await supabase.auth.signOut({ scope: 'local' });

            if (error) throw error;

            window.location.href = '../index.html';

        } catch (error) {
            console.error('Não foi possível terminar a sessão:', error.message);
        }
    });
});