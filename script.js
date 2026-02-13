document.addEventListener('DOMContentLoaded', () => {
    // Config
    const SETTINGS_KEY = 'bbem_settings';
    let userSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
        replaceMode: false,
        syncLabels: true,
        showModifiers: false,
        showLabels: true 
    };

    // Wait for Bricks
    const waitForBricks = setInterval(() => {
        const appElement = document.querySelector("[data-v-app]");
        if (appElement && appElement.__vue_app__) {
            clearInterval(waitForBricks);
            initBemPlugin();
        }
    }, 500);

    function getBricksState() {
        const app = document.querySelector("[data-v-app]");
        return app?.__vue_app__?.config?.globalProperties?.$_state || null;
    }

    function initBemPlugin() {
        const structurePanel = document.getElementById('bricks-structure');
        if (!structurePanel) return;
        const observer = new MutationObserver(() => injectBemButtons(structurePanel));
        observer.observe(structurePanel, { childList: true, subtree: true });
        injectBemButtons(structurePanel);
    }

    function injectBemButtons(panel) {
        const items = panel.querySelectorAll('li[data-id]');
        items.forEach(item => {
            if (item.querySelector('.bbem-trigger-btn')) return;
            let target = item.querySelector('.actions') || item.querySelector('.structure-item-actions') || item;
            
            const btn = document.createElement('div');
            btn.className = 'bbem-trigger-btn';
            btn.textContent = "BEM";
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const existing = document.querySelector('.bbem-draggable-panel');
                if (existing) existing.remove();
                openBemPanel(item.getAttribute('data-id'));
            });

            if (target.firstChild) target.insertBefore(btn, target.firstChild);
            else target.appendChild(btn);
        });
    }

    function findElement(id) {
        const state = getBricksState();
        if (!state) return null;
        return [...(state.header||[]), ...(state.content||[]), ...(state.footer||[])].find(el => el.id === id);
    }

    function getDescendants(parentId, list = [], depth = 0) {
        const parent = findElement(parentId);
        if (!parent || !parent.children) return list;
        parent.children.forEach(childId => {
            const child = findElement(childId);
            if (child) {
                list.push({ ...child, depth: depth + 1 });
                getDescendants(childId, list, depth + 1);
            }
        });
        return list;
    }

    function slugify(text) {
        return (text || 'element').toString().toLowerCase().trim()
            .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
            .replace(/^-+/, '').replace(/-+$/, '');
    }

    function formatLabel(className, blockName) {
        let cleanName = className.replace(blockName + '__', '');
        return cleanName.replace(/-/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
    }

    function calculateInitialPosition(panelWidth = 440) {
        const structurePanel = document.getElementById('bricks-structure');
        let left = 350, top = 100;
        if (structurePanel) {
            const rect = structurePanel.getBoundingClientRect();
            left = rect.right + 10;
            top = rect.top + 40;
        }
        if (left + panelWidth > window.innerWidth) left = window.innerWidth - panelWidth - 20;
        return { left, top };
    }

    // --- RENDER ---
    function openBemPanel(rootId) {
        const rootEl = findElement(rootId);
        if (!rootEl) return;
        const baseLabel = rootEl.label || rootEl.name || 'block';
        const blockClass = slugify(baseLabel);
        
        const panel = document.createElement('div');
        panel.className = 'bbem-draggable-panel';
        
        let rowsHtml = '';
        [rootEl, ...getDescendants(rootId)].forEach(el => {
            const label = el.label || el.name || 'element';
            const cls = el.id === rootId ? blockClass : `${blockClass}__${slugify(label)}`;
            const type = el.id === rootId ? 'BLOCK' : 'ELEMENT';
            const depth = el.depth || 0;
            const isBlock = el.id === rootId;
            const elementSlug = slugify(label);
            
            const hideModsClass = userSettings.showModifiers ? '' : 'hide-mods';

            rowsHtml += `
                <div class="bbem-row" data-id="${el.id}">
                    <div class="bbem-indent-wrapper bbem-indent-${Math.min(depth, 3)}">
                        <div class="bbem-label-group">
                            <span class="bbem-original-name">${label}</span>
                            <span class="bbem-tag">${type}</span>
                        </div>
                        <div class="bbem-input-group ${hideModsClass}">
                            <input type="text" 
                                   class="bbem-input bbem-class-name" 
                                   value="${cls}" 
                                   data-is-block="${isBlock}" 
                                   data-original-slug="${elementSlug}">
                            <input type="text" class="bbem-input bbem-modifier" placeholder="mod">
                        </div>
                    </div>
                    <div class="bbem-checkbox-col">
                        <input type="checkbox" class="bbem-include-checkbox" checked title="Include">
                    </div>
                </div>`;
        });

        const bodyClass = userSettings.showLabels ? '' : 'hide-labels';
        const toolbarClass = userSettings.showModifiers ? 'mods-active' : '';
        const modBtnClass = userSettings.showModifiers ? 'active' : '';

        // Texto inicial del botón corregido a "None"
        panel.innerHTML = `
            <div class="bbem-header" id="bbem-drag-handle">
                <h2>BEM: ${baseLabel}</h2>
                <button class="bbem-close">&times;</button>
            </div>
            
            <div class="bbem-toolbar ${toolbarClass}">
                <div class="bbem-general-group">
                    <label class="bbem-toggle-group">
                        <div class="bbem-switch">
                            <input type="checkbox" id="bbem-toggle-replace" ${userSettings.replaceMode ? 'checked' : ''}>
                            <span class="bbem-slider"></span>
                        </div>
                        <span class="bbem-toggle-label">Replace</span>
                    </label>
                    <label class="bbem-toggle-group">
                        <div class="bbem-switch">
                            <input type="checkbox" id="bbem-toggle-sync" ${userSettings.syncLabels ? 'checked' : ''}>
                            <span class="bbem-slider"></span>
                        </div>
                        <span class="bbem-toggle-label">Sync</span>
                    </label>
                </div>

                <div class="bbem-separator"></div>

                <button class="bbem-text-toggle ${modBtnClass}" id="bbem-toggle-mods-vis">MODIFIER</button>
                
                <span class="bbem-toggle-label" id="bbem-select-all-btn" style="margin-left:auto; cursor:pointer; color:var(--bbem-accent);">None</span>
            </div>

            <div class="bbem-body ${bodyClass}">${rowsHtml}</div>
            
            <div class="bbem-footer">
                <div class="bbem-footer-left">
                    <label class="bbem-toggle-group">
                        <div class="bbem-switch">
                            <input type="checkbox" id="bbem-toggle-labels" ${userSettings.showLabels ? 'checked' : ''}>
                            <span class="bbem-slider"></span>
                        </div>
                        <span class="bbem-toggle-label">Labels</span>
                    </label>
                </div>
                <div class="bbem-footer-right">
                    <button class="bbem-btn bbem-btn-secondary bbem-close-btn">Cancel</button>
                    <button class="bbem-btn bbem-btn-primary" id="bbem-apply">Apply</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        
        const pos = calculateInitialPosition(440);
        panel.style.left = pos.left + 'px';
        panel.style.top = pos.top + 'px';
        requestAnimationFrame(() => { panel.style.opacity = '1'; });
        
        setupDraggable(panel);
        setupInteractions(panel);
    }

    function setupDraggable(element) {
        const header = element.querySelector('#bbem-drag-handle');
        if (!header) return;

        let isDragging = false, startX, startY, initialLeft, initialTop;
        
        header.onmousedown = (e) => {
            isDragging = true; 
            startX = e.clientX; 
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            initialLeft = rect.left; 
            initialTop = rect.top;
            element.style.transform = 'none';
            header.style.cursor = 'grabbing'; 
            document.body.style.userSelect = 'none';
        };

        document.onmousemove = (e) => {
            if (!isDragging) return; 
            e.preventDefault();
            element.style.left = `${initialLeft + (e.clientX - startX)}px`;
            element.style.top = `${initialTop + (e.clientY - startY)}px`;
        };

        document.onmouseup = () => {
            isDragging = false; 
            header.style.cursor = 'grab'; 
            document.body.style.userSelect = '';
        };
    }

    function setupInteractions(panel) {
        const toolbar = panel.querySelector('.bbem-toolbar');

        // Save Settings
        const saveSetting = (id, key) => {
            const el = panel.querySelector(id);
            if(el) {
                el.addEventListener('change', (e) => {
                    userSettings[key] = e.target.checked;
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                });
            }
        };
        saveSetting('#bbem-toggle-replace', 'replaceMode');
        saveSetting('#bbem-toggle-sync', 'syncLabels');

        // Toggle Labels
        const labelsToggle = panel.querySelector('#bbem-toggle-labels');
        const bodyEl = panel.querySelector('.bbem-body');
        if(labelsToggle) {
            labelsToggle.addEventListener('change', (e) => {
                userSettings.showLabels = e.target.checked;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                e.target.checked ? bodyEl.classList.remove('hide-labels') : bodyEl.classList.add('hide-labels');
            });
        }

        // Toggle Mods
        const modVisBtn = panel.querySelector('#bbem-toggle-mods-vis');
        if(modVisBtn) {
            modVisBtn.addEventListener('click', () => {
                const isActive = modVisBtn.classList.toggle('active');
                userSettings.showModifiers = isActive;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                
                const inputGroups = panel.querySelectorAll('.bbem-input-group');
                inputGroups.forEach(g => isActive ? g.classList.remove('hide-mods') : g.classList.add('hide-mods'));
                
                if (isActive) toolbar.classList.add('mods-active');
                else toolbar.classList.remove('mods-active');
            });
        }

        // Reactivity
        const blockInput = panel.querySelector('input[data-is-block="true"]');
        if (blockInput) {
            blockInput.addEventListener('input', (e) => {
                const newBlockName = e.target.value.trim();
                const childInputs = panel.querySelectorAll('input:not([data-is-block="true"]).bbem-class-name');
                childInputs.forEach(input => {
                    const row = input.closest('.bbem-row');
                    if (!row.querySelector('.bbem-include-checkbox').checked) return;
                    const currentVal = input.value;
                    let suffix = '';
                    if (currentVal.includes('__')) suffix = currentVal.split('__')[1]; 
                    else suffix = input.dataset.originalSlug;
                    input.value = `${newBlockName}__${suffix}`;
                });
            });
        }

        // Select All/None
        const selectAllBtn = panel.querySelector('#bbem-select-all-btn');
        if(selectAllBtn) {
            let allSelected = true;
            selectAllBtn.addEventListener('click', () => {
                allSelected = !allSelected;
                panel.querySelectorAll('.bbem-include-checkbox').forEach(cb => {
                    cb.checked = allSelected;
                    const row = cb.closest('.bbem-row');
                    allSelected ? row.classList.remove('disabled') : row.classList.add('disabled');
                });
                selectAllBtn.textContent = allSelected ? "None" : "All";
            });
        }
        
        // Checkboxes
        panel.querySelectorAll('.bbem-include-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const row = e.target.closest('.bbem-row');
                e.target.checked ? row.classList.remove('disabled') : row.classList.add('disabled');
            });
        });

        // Close/Apply
        const close = () => panel.remove();
        panel.querySelectorAll('.bbem-close, .bbem-close-btn').forEach(b => b.onclick = close);
        
        const applyBtn = document.getElementById('bbem-apply');
        if(applyBtn) {
            applyBtn.onclick = () => {
                applyClasses(panel);
                close();
            };
        }
    }

    function applyClasses(panel) {
        let count = 0;
        const state = getBricksState();
        
        const shouldReplace = panel.querySelector('#bbem-toggle-replace').checked;
        const shouldSyncLabel = panel.querySelector('#bbem-toggle-sync').checked;

        panel.querySelectorAll('.bbem-row').forEach(row => {
            if (!row.querySelector('.bbem-include-checkbox').checked) return;

            const id = row.dataset.id;
            const clsInput = row.querySelector('.bbem-class-name').value.trim();
            const modInput = row.querySelector('.bbem-modifier').value.trim();
            
            if (!clsInput) return;

            let classesToCreate = [];
            let cleanMod = modInput;
            
            if (cleanMod && !cleanMod.startsWith('--')) {
                cleanMod = '--' + cleanMod;
            }

            const isModifierOperation = !!cleanMod;

            if (isModifierOperation) {
                // MODIFICADOR: Solo clase modificada, no borrar clases existentes, no renombrar
                const modClass = `${clsInput}${cleanMod}`; 
                classesToCreate = [modClass];
            } else {
                // NORMAL: Clase base
                classesToCreate = [clsInput];
            }

            const element = findElement(id);
            if (element) {
                if (!element.settings) element.settings = {};
                
                // Si es modo normal y Reemplazar está activo, limpiar
                if (shouldReplace && !isModifierOperation) {
                    element.settings._cssGlobalClasses = [];
                }

                if (!element.settings._cssGlobalClasses) element.settings._cssGlobalClasses = [];

                classesToCreate.forEach(className => {
                    let globalClass = state.globalClasses.find(gc => gc.name === className);
                    if (!globalClass) {
                        globalClass = { id: Math.random().toString(36).slice(2, 8), name: className, settings: {} };
                        state.globalClasses.push(globalClass);
                    }
                    if (!element.settings._cssGlobalClasses.includes(globalClass.id)) {
                        element.settings._cssGlobalClasses.push(globalClass.id);
                        count++;
                    }
                });

                // Solo sincronizar etiqueta si es modo Normal
                if (shouldSyncLabel && !isModifierOperation) {
                    const baseClass = classesToCreate[0]; 
                    const blockName = panel.querySelector('input[data-is-block="true"]').value.trim();
                    let newLabel = formatLabel(baseClass, blockName);
                    if (!newLabel || newLabel.trim() === '') newLabel = baseClass.replace(/-/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase());
                    
                    element.label = newLabel;
                    
                    setTimeout(() => {
                        const selectors = [
                            `li[data-id="${id}"] .structure-item-title span.text`,
                            `li[data-id="${id}"] .structure-item-title span`,
                            `li[data-id="${id}"] .name`
                        ];
                        for (const sel of selectors) {
                            const domEl = document.querySelector(sel);
                            if (domEl) { domEl.innerText = newLabel; break; }
                        }
                    }, 50);
                }
            }
        });

        if (count > 0 || shouldSyncLabel) {
            state.globalClasses.push({});
            setTimeout(() => state.globalClasses.pop(), 50);
        }
    }
});