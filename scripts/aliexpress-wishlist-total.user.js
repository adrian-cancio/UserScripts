// ==UserScript==
// @name          AliExpress Wishlist Total
// @namespace     https://github.com/adrian-cancio
// @version       2025-10-26
// @description   Calculates and displays the total price of items in your AliExpress wishlist
// @license       MIT
// @author        Adrián Cancio
// @updateURL     https://raw.githubusercontent.com/adrian-cancio/Userscripts/master/scripts/aliexpress-wishlist-total.user.js
// @downloadURL   https://raw.githubusercontent.com/adrian-cancio/Userscripts/master/scripts/aliexpress-wishlist-total.user.js
// @match         https://*.aliexpress.com/p/wish-manage*
// @icon          https://www.google.com/s2/favicons?sz=64&domain=aliexpress.com
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    function extractPrice(node) {
        // Reconstruct the price from character spans
        let chars = node.querySelectorAll('.es--char--RqgnKC9');
        let text = '';
        chars.forEach(c => text += c.textContent);

        // Clean and convert to number
        text = text.replace(/[^\d,\.]/g, '').replace(',', '.');
        return parseFloat(text) || 0;
    }

    function calculateTotal() {
        let total = 0;
        let priceBlocks = document.querySelectorAll('.price--price--1bDoAeQ');
        priceBlocks.forEach(block => {
            total += extractPrice(block);
        });
        return total.toFixed(2);
    }

    function showTotal(total) {
        let div = document.getElementById('wishlist-total-div');
        if (!div) {
            div = document.createElement('div');
            div.id = 'wishlist-total-div';
            div.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff4400 0%, #ff6a3d 100%);
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 18px;
                font-weight: 600;
                box-shadow: 0 4px 20px rgba(255, 68, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);
                z-index: 9999;
                transition: all 0.3s ease;
                cursor: default;
                user-select: none;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;

            // Add hover effect
            div.addEventListener('mouseenter', () => {
                div.style.transform = 'translateY(-2px)';
                div.style.boxShadow = '0 6px 25px rgba(255, 68, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)';
            });
            div.addEventListener('mouseleave', () => {
                div.style.transform = 'translateY(0)';
                div.style.boxShadow = '0 4px 20px rgba(255, 68, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)';
            });

            document.body.appendChild(div);
        }
        div.innerHTML = `<span style="opacity: 0.9; margin-right: 8px;">💰</span>Wishlist Total: <span style="font-weight: 700; margin-left: 6px;">€${total}</span>`;
    }

    function update() {
        let total = calculateTotal();
        showTotal(total);
    }

    // Execute on load
    window.addEventListener('load', update);

    // Observe dynamic changes, ignoring our own div
    const observer = new MutationObserver(mutations => {
        for (let m of mutations) {
            if (m.target.closest && m.target.closest('#wishlist-total-div')) {
                return; // Ignore changes to our div
            }
        }
        update();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
