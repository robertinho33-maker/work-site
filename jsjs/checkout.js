'use strict';

import {
    processOrder,
    validateCoupon
} from './checkout-service.js';

import {
    buscarCEP
} from './services/cep-service.js';

let activeCoupon = null;


/* =========================================================
   UTILITÁRIOS
========================================================= */

function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
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
function formatPhone(value) {
    const digits = String(value || '')
        .replace(/\D/g, '')
        .slice(0, 11);

    if (digits.length <= 2) {
        return digits;
    }

    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
function getCartItems() {
    if (!window.cart) {
        return [];
    }

    return window.cart.getItems();
}

function getSubtotal() {
    return getCartItems().reduce(
        (total, item) =>
            total +
            Number(item.price || 0) *
            Number(item.quantity || 0),
        0
    );
}


/* =========================================================
   ELEMENTOS
========================================================= */

const elements = {
    items: document.getElementById('checkout-items'),

    subtotal: document.getElementById('cart-subtotal'),
    discount: document.getElementById('cart-discount'),
    total: document.getElementById('cart-total'),

    discountRow: document.getElementById('row-discount'),
    discountPercent: document.getElementById('discount-percent'),

    coupon: document.getElementById('input-coupon'),
    couponButton: document.getElementById('btn-apply-coupon'),
    couponFeedback: document.getElementById('coupon-feedback'),

    finishButton: document.getElementById('btn-finish-order'),

    name: document.getElementById('customer-name'),
    email: document.getElementById('customer-email'),
    phone: document.getElementById('customer-phone'),

    cep: document.getElementById('customer-cep'),
    street: document.getElementById('customer-street'),
    number: document.getElementById('customer-number'),
    complement: document.getElementById('customer-complement'),
    neighborhood: document.getElementById('customer-neighborhood'),
    city: document.getElementById('customer-city'),
    state: document.getElementById('customer-state')
};


/* =========================================================
   RENDER DO CHECKOUT
========================================================= */

function renderCheckout() {
    const items = getCartItems();
    const subtotal = getSubtotal();

    if (!elements.items) {
        updateTotals();
        return;
    }

    if (!items.length) {
        elements.items.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-cart-x me-2"></i>
                Seu carrinho está vazio.
            </div>
        `;

        updateTotals();
        return;
    }

    elements.items.innerHTML = items.map(item => `
        <div class="checkout-item
                    d-flex
                    justify-content-between
                    align-items-center">

            <div class="d-flex align-items-center gap-3">

                ${
                    item.image
                        ? `
                            <img
                                src="${escapeHTML(item.image)}"
                                alt="${escapeHTML(item.name)}"
                                class="checkout-item-image"
                            >
                        `
                        : `
                            <div
                                class="checkout-item-image
                                       d-flex
                                       align-items-center
                                       justify-content-center"
                            >
                                <i class="bi bi-image text-muted"></i>
                            </div>
                        `
                }

                <div>
                    <div class="fw-bold">
                        ${escapeHTML(item.name)}
                    </div>
                        
                    <small class="text-muted">
                        Quantidade: ${Number(item.quantity || 0)}
                    </small>
                </div>

            </div>

            <strong>
                ${money(
                    Number(item.price || 0) *
                    Number(item.quantity || 0)
                )}
            </strong>

        </div>
    `).join('');

    updateTotals();
}


/* =========================================================
   TOTAIS
========================================================= */

function updateTotals() {
    const subtotal = getSubtotal();

    const percentage = activeCoupon
        ? Number(
            activeCoupon.discountPercentage ??
            activeCoupon.value ??
            0
        )
        : 0;

    const safePercentage =
        Number.isFinite(percentage)
            ? Math.min(100, Math.max(0, percentage))
            : 0;

    const discount = Math.min(
        subtotal,
        Math.max(
            0,
            subtotal * safePercentage / 100
        )
    );

    const total = Math.max(
        0,
        subtotal - discount
    );

    if (elements.subtotal) {
        elements.subtotal.textContent = money(subtotal);
    }

    if (elements.discount) {
        elements.discount.textContent = `- ${money(discount)}`;
    }

    if (elements.total) {
        elements.total.textContent = money(total);
    }

    if (elements.discountRow) {
        elements.discountRow.classList.toggle(
            'd-none',
            discount <= 0
        );
    }

    if (elements.discountPercent) {
        elements.discountPercent.textContent =
            safePercentage;
    }
}


/* =========================================================
   CUPOM
========================================================= */

async function applyCoupon() {
    const code = elements.coupon?.value?.trim();

    if (!code) {
        activeCoupon = null;

        if (elements.couponFeedback) {
            elements.couponFeedback.textContent =
                'Digite um cupom.';

            elements.couponFeedback.className =
                'small mt-2 text-danger';
        }

        updateTotals();
        return;
    }

    if (elements.couponButton) {
        elements.couponButton.disabled = true;
    }

    try {
        const result = await validateCoupon(code);

        if (!result.success) {
            activeCoupon = null;

            if (elements.couponFeedback) {
                elements.couponFeedback.textContent =
                    result.message;

                elements.couponFeedback.className =
                    'small mt-2 text-danger';
            }

            updateTotals();
            return;
        }

        activeCoupon = result.coupon;

        if (elements.couponFeedback) {
            elements.couponFeedback.textContent =
                `Cupom ${result.coupon.code} aplicado com sucesso.`;

            elements.couponFeedback.className =
                'small mt-2 text-success';
        }

        updateTotals();

    } catch (error) {
        console.error(
            '[CHECKOUT] Erro ao aplicar cupom:',
            error
        );

        activeCoupon = null;

        if (elements.couponFeedback) {
            elements.couponFeedback.textContent =
                'Não foi possível validar o cupom.';

            elements.couponFeedback.className =
                'small mt-2 text-danger';
        }

        updateTotals();

    } finally {
        if (elements.couponButton) {
            elements.couponButton.disabled = false;
        }
    }
}


/* =========================================================
   CEP
========================================================= */

let cepRequestInProgress = false;

async function buscarEnderecoPorCEP() {
    if (!elements.cep) {
        return;
    }

    const cepNumerico =
        elements.cep.value.replace(/\D/g, '');

    if (cepNumerico.length !== 8) {
        return;
    }

    if (cepRequestInProgress) {
        return;
    }

    cepRequestInProgress = true;
    elements.cep.disabled = true;

    try {
        const resultado =
            await buscarCEP(cepNumerico);

        if (!resultado.success) {
            alert(
                resultado.message ||
                'CEP não encontrado.'
            );

            return;
        }

        const endereco = resultado.data;

        if (elements.street) {
            elements.street.value =
                endereco.logradouro || '';
        }

        if (elements.complement) {
            elements.complement.value =
                endereco.complemento || '';
        }

        if (elements.neighborhood) {
            elements.neighborhood.value =
                endereco.bairro || '';
        }

        if (elements.city) {
            elements.city.value =
                endereco.localidade || '';
        }

        if (elements.state) {
            elements.state.value =
                endereco.uf || '';
        }

        if (elements.number) {
            elements.number.focus();
        }

    } catch (error) {
        console.error(
            '[CHECKOUT] Erro ao buscar CEP:',
            error
        );

        alert(
            'Não foi possível consultar o CEP.'
        );

    } finally {
        cepRequestInProgress = false;
        elements.cep.disabled = false;
    }
}


/* =========================================================
   FINALIZAR PEDIDO
========================================================= */

async function finishOrder() {

    /* -----------------------------------------------------
       DADOS DO CLIENTE
    ----------------------------------------------------- */

    const customer = {
        name: elements.name?.value?.trim() || '',
        email: elements.email?.value?.trim() || '',
        phone: elements.phone?.value?.trim() || ''
    };


    /* -----------------------------------------------------
       VALIDAÇÃO DO CLIENTE
    ----------------------------------------------------- */

    if (!customer.name) {
        alert('Informe seu nome.');
        elements.name?.focus();
        return;
    }

    if (!customer.email) {
        alert('Informe seu e-mail.');
        elements.email?.focus();
        return;
    }

    const emailValid =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(customer.email);

    if (!emailValid) {
        alert('Informe um e-mail válido.');
        elements.email?.focus();
        return;
    }

    if (!customer.phone) {
        alert('Informe seu telefone.');
        elements.phone?.focus();
        return;
    }

    const phoneDigits =
        customer.phone.replace(/\D/g, '');

    if (
        phoneDigits.length !== 10 &&
        phoneDigits.length !== 11
    ) {
        alert('Informe um telefone válido.');
        elements.phone?.focus();
        return;
    }


    /* -----------------------------------------------------
       CEP
    ----------------------------------------------------- */

    const cep =
        elements.cep?.value?.trim() || '';

    const cepDigits =
        cep.replace(/\D/g, '');

    if (cepDigits.length !== 8) {
        alert('Informe um CEP válido.');
        elements.cep?.focus();
        return;
    }


    /* -----------------------------------------------------
       ENDEREÇO
    ----------------------------------------------------- */

    const street =
        elements.street?.value?.trim() || '';

    const number =
        elements.number?.value?.trim() || '';

    const complement =
        elements.complement?.value?.trim() || '';

    const neighborhood =
        elements.neighborhood?.value?.trim() || '';

    const city =
        elements.city?.value?.trim() || '';

    const state =
        elements.state?.value?.trim().toUpperCase() || '';

    if (!street) {
        alert('Informe a rua.');
        elements.street?.focus();
        return;
    }

    if (!number) {
        alert('Informe o número.');
        elements.number?.focus();
        return;
    }

    if (!neighborhood) {
        alert('Informe o bairro.');
        elements.neighborhood?.focus();
        return;
    }

    if (!city) {
        alert('Informe a cidade.');
        elements.city?.focus();
        return;
    }

    if (!state || state.length !== 2) {
        alert('Informe o estado (UF).');
        elements.state?.focus();
        return;
    }


    /* -----------------------------------------------------
       MONTA ENDEREÇO
    ----------------------------------------------------- */

    const address = [
        `${street}, ${number}`,
        complement,
        neighborhood,
        `${city} - ${state}`
    ]
        .filter(Boolean)
        .join(', ');


    /* -----------------------------------------------------
       CARRINHO
    ----------------------------------------------------- */
    
    const items = getCartItems();
    const subtotal = getSubtotal();

    if (!items.length) {
        alert('O carrinho está vazio.');
        return;
    }

    if (
        !Number.isFinite(subtotal) ||
        subtotal <= 0
    ) {
        alert('O valor do carrinho é inválido.');
        return;
    }


    /* -----------------------------------------------------
       BOTÃO
    ----------------------------------------------------- */

    if (elements.finishButton) {
        elements.finishButton.disabled = true;

        elements.finishButton.innerHTML = `
            <span
                class="spinner-border
                       spinner-border-sm
                       me-2"
                role="status"
                aria-hidden="true"
            ></span>
            Processando...
        `;
    }


    /* -----------------------------------------------------
       PROCESSAMENTO
    ----------------------------------------------------- */

    try {

        const result = await processOrder({

            customer,

            items,

            subtotal,

            activeCoupon,

            user: null,

            cep: cepDigits,

            address

        });


        if (!result.success) {
            throw new Error(
                result.message ||
                'Não foi possível finalizar o pedido.'
            );
        }


        /* -------------------------------------------------
           LIMPA CARRINHO
        ------------------------------------------------- */

        if (window.cart) {
            window.cart.clear();
        }


        /* -------------------------------------------------
           SUCESSO
        ------------------------------------------------- */

        alert(
            `Pedido #${result.orderId} criado com sucesso!`
        );

        window.location.href = 'index.html';

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao finalizar:',
            error
        );

        alert(
            error.message ||
            'Não foi possível finalizar o pedido.'
        );

        if (elements.finishButton) {
            elements.finishButton.disabled = false;

            elements.finishButton.innerHTML = `
                <i class="bi bi-check-circle me-1"></i>
                Finalizar Pedido
            `;
        }
    }
}


/* =========================================================
   EVENTOS
========================================================= */
/* TELEFONE */

elements.phone?.addEventListener(
    'input',
    event => {
        event.target.value =
            formatPhone(event.target.value);
    }
);

/* CUPOM */

elements.couponButton?.addEventListener(
    'click',
    applyCoupon
);

elements.coupon?.addEventListener(
    'keydown',
    event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyCoupon();
        }
    }
);


/* CEP */

elements.cep?.addEventListener(
    'blur',
    buscarEnderecoPorCEP
);

elements.cep?.addEventListener(
    'keydown',
    event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            buscarEnderecoPorCEP();
        }
    }
);


/* FINALIZAR */

elements.finishButton?.addEventListener(
    'click',
    finishOrder
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {
        renderCheckout();
    }
);
 