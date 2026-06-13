/* index.js - Interactive Scripts for Buddycane Landing Page */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Certificate Dropdown Toggle
    const dropdownBtn = document.getElementById('dropdown-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', () => {
            const isActive = dropdownBtn.classList.toggle('active');
            
            if (isActive) {
                // Expand menu
                dropdownMenu.style.maxHeight = dropdownMenu.scrollHeight + 'px';
            } else {
                // Collapse menu
                dropdownMenu.style.maxHeight = null;
            }
        });
    }

    // 2. Performance Hack: Delay YouTube Background Players by 200ms
    // This allows the initial text and styles to render instantly without waiting for Google iframe resources.
    const lazyIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
    lazyIframes.forEach(iframe => {
        const src = iframe.getAttribute('src');
        // Temporarily clear src during page loading, then set it back
        iframe.setAttribute('src', '');
        setTimeout(() => {
            iframe.setAttribute('src', src);
        }, 300);
    });
});
