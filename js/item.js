import { supabase } from './config/supabaseClient.js';

const publishForm = document.getElementById('publish-form');
const fileInput = document.querySelector('input[type="file"][name="item-images"]');
const fileNameEl = document.getElementById('file-name');
const imagePreviewEl = document.getElementById('image-preview');

const wearStatusMap = {
	novo: 'novo',
	como_novo: 'como_novo',
	bom: 'bom',
	satisfatorio: 'usado'
};

async function loadCategories() {
	const select = document.getElementById('item-category');
	if (!select) return;

	try {
		const { data, error } = await supabase.from('categoria').select('id,name').order('name');
		if (error) throw error;

		if (!data || data.length === 0) {
			select.innerHTML = '<option value="" disabled selected>Sem categorias disponíveis</option>';
			return;
		}

		let html = '<option value="" disabled selected>Seleciona...</option>';
		data.forEach((c) => {
			html += `<option value="${c.id}">${c.name}</option>`;
		});
		select.innerHTML = html;
	} catch (err) {
		console.error('Erro a carregar categorias:', err);
		select.innerHTML = '<option value="" disabled selected>Erro ao carregar categorias</option>';
	}
}

function showNotification(form, type, message) {
	const notification = document.createElement('div');
	notification.className = `notification is-${type}`;
	notification.textContent = message;
	form.prepend(notification);
}

function setSubmitting(form, isSubmitting) {
	const submitBtn = form.querySelector('button[type="submit"]');

	if (!submitBtn) return;

	submitBtn.disabled = isSubmitting;
	submitBtn.textContent = isSubmitting ? 'A publicar...' : 'Publicar Anúncio';
}

async function getCurrentUser() {
	try {
		const { data, error } = await supabase.auth.getUser();

		if (error) throw error;
		if (!data?.user) {
			const returnUrl = encodeURIComponent(window.location.pathname.split('/').pop());
			window.location.href = `login.html?returnUrl=${returnUrl}`;
			throw new Error('Redirecionando para login...');
		}

		return data.user;
	} catch (err) {
		if (err && err.message && err.message.toLowerCase().includes('auth session missing')) {
			const returnUrl = encodeURIComponent(window.location.pathname.split('/').pop());
			window.location.href = `login.html?returnUrl=${returnUrl}`;
		}
		throw err;
	}
}

async function createItem({ sellerId, categoryId, title, description, price, wearStatus }) {
	const payload = {
		seller_id: sellerId,
		title,
		description,
		price,
		wear_status: wearStatus,
		sell_status: 'disponivel'
	};

	if (categoryId) payload.category_id = categoryId;

	const { data, error } = await supabase
		.from('item')
		.insert(payload)
		.select('id')
		.single();

	if (error) throw error;

	return data.id;
}

function buildStoragePath(userId, itemId, file, index) {
	const safeName = file.name
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	return `${userId}/${itemId}/${Date.now()}-${index + 1}-${safeName}`;
}

async function createItemImages(itemId, userId, files) {
	if (!files.length) return;

	const imageRows = [];

	for (const [index, file] of files.entries()) {
		const path = buildStoragePath(userId, itemId, file, index);

		const { error: uploadError } = await supabase.storage
			.from('item-images')
			.upload(path, file, {
				contentType: file.type,
				upsert: false
			});

		if (uploadError) throw uploadError;

		const { data: publicUrlData } = supabase.storage
			.from('item-images')
			.getPublicUrl(path);

		imageRows.push({
			item_id: itemId,
			image_url: publicUrlData.publicUrl,
			is_principal: index === 0
		});
	}

	const { error } = await supabase.from('item_image').insert(imageRows);
	if (error) throw error;
}

function renderImagePreview(files) {
	if (!imagePreviewEl) return;

	imagePreviewEl.innerHTML = '';

	files.forEach((file) => {
		const url = URL.createObjectURL(file);
		const column = document.createElement('div');
		column.className = 'column is-4-mobile is-3-tablet is-2-desktop';
		column.innerHTML = `
			<figure class="image is-square">
				<img src="${url}" alt="Preview" loading="lazy">
			</figure>
		`;
		const img = column.querySelector('img');
		if (img) {
			img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
		}
		imagePreviewEl.appendChild(column);
	});
}

if (fileInput && fileNameEl) {
	fileInput.addEventListener('change', () => {
		const selectedFiles = Array.from(fileInput.files || []).slice(0, 5);
		const names = selectedFiles.map((file) => file.name).join(', ');
		fileNameEl.textContent = names || 'Nenhuma fotografia seleccionada';
		renderImagePreview(selectedFiles);
	});
}

if (publishForm) {
	publishForm.addEventListener('submit', async (event) => {
		event.preventDefault();

		const title = document.getElementById('item-title')?.value.trim();
		const description = document.getElementById('item-description')?.value.trim();
		const category = document.getElementById('item-category')?.value; // now category ID
		const condition = document.getElementById('item-condition')?.value;
		const priceValue = document.getElementById('item-price')?.value;
		const files = Array.from(fileInput?.files || []).slice(0, 5);

		const existingError = publishForm.querySelector('.notification');
		if (existingError) existingError.remove();

		if (!title || !description || !category || !condition || !priceValue) {
			showNotification(publishForm, 'danger', 'Preenche todos os campos obrigatórios.');
			return;
		}

		if (files.length > 5) {
			showNotification(publishForm, 'danger', 'Podes enviar no máximo 5 fotografias.');
			return;
		}

		setSubmitting(publishForm, true);

		try {
			const user = await getCurrentUser();
			const categoryId = category || null; // use selected existing category id
			const itemId = await createItem({
				sellerId: user.id,
				categoryId,
				title,
				description,
				price: Number(priceValue),
				wearStatus: wearStatusMap[condition] || 'bom'
			});

			await createItemImages(itemId, user.id, files);

			showNotification(publishForm, 'success', 'Artigo publicado com sucesso.');
			publishForm.reset();

			if (fileNameEl) {
				fileNameEl.textContent = 'Nenhuma fotografia seleccionada';
			}

			if (imagePreviewEl) {
				imagePreviewEl.innerHTML = '';
			}

			setTimeout(() => {
				window.location.href = 'dashboard.html';
			}, 1200);
		} catch (error) {
			console.error('Erro ao publicar artigo:', error);
			showNotification(publishForm, 'danger', error.message || 'Não foi possível publicar o artigo.');
		} finally {
			setSubmitting(publishForm, false);
		}
	});
}

// Populate categories on load
loadCategories();
