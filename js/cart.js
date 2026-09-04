'use strict';

const CART_STORAGE_KEY = 'fiosperfeitos_cart';

let cart = loadCart();

/* =========================================================
   UTILITÁRIOS
========================================================= */

function money(value) {
    const number = Number(value || 0);

    return number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* =========================================================
   PERSISTÊNCIA
========================================================= */

function loadCart() {
    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY);

        if (!stored) return [];

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(item =>
            item &&
            typeof item.sku === 'string' &&
            Number(item.price) > 0 &&
            Number(item.quantity) > 0
        );
    } catch (error) {
        console.error('[CARRINHO] Erro ao carregar:', error);
        return [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error('[CARRINHO] Erro ao salvar:', error);
    }
}

/* =========================================================
   CÁLCULOS
========================================================= */

function getCartCount() {
    return cart.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );
}

function getCartSubtotal() {
    return cart.reduce(
        (total, item) =>
            total +
            Number(item.price || 0) *
            Number(item.quantity || 0),
        0
    );
}

/* =========================================================
   ADICIONAR
========================================================= */

function addToCart(product) {
    if (!product || !product.sku) {
        console.error('[CARRINHO] Produto inválido:', product);
        return;
    }

    const existing = cart.find(
        item => item.sku === product.sku
    );

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            sku: product.sku,
            name: product.name,
            price: Number(product.price || 0),
            weight: product.weight || '',
            category: product.category || '',
            image: product.image || '',
            quantity: 1
        });
    }

    saveCart();
    renderCart();

    console.log('[CARRINHO] Produto adicionado:', product.name);
}

/* =========================================================
   QUANTIDADE
========================================================= */

function changeQuantity(sku, delta) {
    const item = cart.find(
        product => product.sku === sku
    );

    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
        cart = cart.filter(
            product => product.sku !== sku
        );
    }

    saveCart();
    renderCart();
}

function removeFromCart(sku) {
    cart = cart.filter(
        product => product.sku !== sku
    );

    saveCart();
    renderCart();
}

function clearCart() {
    cart = [];

    saveCart();
    renderCart();
}

/* =========================================================
   RENDERIZAÇÃO
========================================================= */

function renderCart() {
    const container = document.getElementById('cart-items');
    const badge = document.getElementById('cart-badge-count');
    const subtotalElement = document.getElementById('cart-subtotal');
    const discountElement = document.getElementById('cart-discount');
    const totalElement = document.getElementById('cart-total');

    const count = getCartCount();
    const subtotal = getCartSubtotal();

    if (badge) {
        badge.textContent = count;
    }

    if (subtotalElement) {
        subtotalElement.textContent = money(subtotal);
    }

    if (discountElement) {
        discountElement.textContent = '- R$ 0,00';
    }

    if (totalElement) {
        totalElement.textContent = money(subtotal);
    }

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fa-solid fa-bag-shopping fa-2x mb-3"></i>
                <p class="mb-0">
                    Seu carrinho está vazio.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="border-bottom pb-3 mb-3">

            <div class="d-flex gap-3">

                ${
                    item.image
                        ? `
                            <img
                                src="${escapeHTML(item.image)}"
                                alt="${escapeHTML(item.name)}"
                                width="70"
                                height="70"
                                class="rounded"
                                style="object-fit: contain;"
                            >
                        `
                        : `
                            <div
                                class="rounded bg-light d-flex align-items-center justify-content-center"
                                style="width:70px;height:70px;"
                            >
                                <i class="fa-solid fa-image text-muted"></i>
                            </div>
                        `
                }

                <div class="flex-grow-1">

                    <div class="fw-semibold">
                        ${escapeHTML(item.name)}
                    </div>

                    <small class="text-muted">
                        ${money(item.price)}
                    </small>

                    <div class="d-flex align-items-center gap-2 mt-2">

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            data-cart-minus="${escapeHTML(item.sku)}"
                            aria-label="Diminuir quantidade"
                        >
                            -
                        </button>

                        <span class="fw-bold">
                            ${item.quantity}
                        </span>

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            data-cart-plus="${escapeHTML(item.sku)}"
                            aria-label="Aumentar quantidade"
                        >
                            +
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger ms-auto"
                            data-cart-remove="${escapeHTML(item.sku)}"
                            aria-label="Remover produto"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>

                </div>

            </div>

        </div>
    `).join('');
}

/* =========================================================
   EVENTOS
========================================================= */

document.addEventListener(
    'catalog:add-to-cart',
    event => {
        addToCart(event.detail);
    }
);

document.addEventListener(
    'click',
    event => {

        const plus = event.target.closest(
            '[data-cart-plus]'
        );

        if (plus) {
            changeQuantity(
                plus.dataset.cartPlus,
                1
            );
            return;
        }

        const minus = event.target.closest(
            '[data-cart-minus]'
        );

        if (minus) {
            changeQuantity(
                minus.dataset.cartMinus,
                -1
            );
            return;
        }

        const remove = event.target.closest(
            '[data-cart-remove]'
        );

        if (remove) {
            removeFromCart(
                remove.dataset.cartRemove
            );
        }
    }
);

/* =========================================================
   API
========================================================= */

window.cart = {
    getItems() {
        return cart.map(item => ({ ...item }));
    },

    getCount() {
        return getCartCount();
    },

    getSubtotal() {
        return getCartSubtotal();
    },

    clear() {
        clearCart();
    },

    refresh() {
        cart = loadCart();
        renderCart();
    }
};

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    renderCart
);