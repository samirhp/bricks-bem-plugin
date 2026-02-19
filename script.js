document.addEventListener('DOMContentLoaded', () => {
    const SETTINGS_KEY = 'bbem_settings';
    let userSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
        syncLabels: true,
        showModifiers: false,
        showLabels: true,
        classAction: 'rename' 
    };

    // Lista negra de propiedades de Bricks que son ESTRUCTURA o CONTENIDO, no estilos CSS.
    // Todo lo que NO esté en esta lista, se considerará un estilo y se migrará a la clase.
    const contentBlacklist = [
        '_cssGlobalClasses', '_cssClasses', '_cssId', '_name', '_attributes', '_interactions',
        'text', 'title', 'subtitle', 'image', 'icon', 'video', 'url', 'link', 'query', 'tag', 'type',
        'content', 'items', 'formFields', 'code', 'html', 'shortcode', 'svgCode', 'svgContent',
        'autoplay', 'loop', 'controls', 'placeholder', 'size', 'variant', 'colorScheme',
        'isCustom', 'postType', 'taxonomy', 'terms', 'author', 'useDynamicData', 'dynamicData',
        'popup', 'conditions', 'loopQuery', 'accordion', 'tabs', 'slider', 'gallery', 'iconLibrary',
        'divider', 'label', 'description', 'heading'
    ];

    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }

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
        
        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => injectBemButtons(structurePanel), 50);
        });
        
        observer.observe(structurePanel, { childList: true, subtree: true });
        injectBemButtons(structurePanel);
    }

    function injectBemButtons(panel) {
        const items = panel.querySelectorAll('li[data-id]:not(.has-bbem-btn)');
        items.forEach(item => {
            if (item.querySelector('.bbem-trigger-btn')) return;
            
            let target = item.querySelector('.actions') || item.querySelector('.structure-item-actions');
            
            const btn = document.createElement('div');
            btn.className = 'bbem-trigger-btn';
            btn.textContent = "BEM";
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const existing = document.querySelector('.bbem-draggable-panel');
                if (existing) existing.remove();
                openBemPanel(item.getAttribute('data-id'));
            });

            if (target) {
                if (target.firstChild) target.insertBefore(btn, target.firstChild);
                else target.appendChild(btn);
            } else {
                btn.classList.add('bbem-no-actions');
                let titleNode = item.firstElementChild;
                if (titleNode) {
                    titleNode.style.position = 'relative';
                    titleNode.appendChild(btn);
                } else {
                    item.appendChild(btn);
                }
            }
            
            item.classList.add('has-bbem-btn');
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

    function openBemPanel(rootId) {
        const rootEl = findElement(rootId);
        if (!rootEl) return;
        const baseLabel = rootEl.label || rootEl.name || 'block';
        const blockClass = slugify(baseLabel);
        
        let showActionSelect = false;
        const elementsToProcess = [rootEl, ...getDescendants(rootId)];
        const state = getBricksState(); 
        
        // VALIDACIÓN DE INTELIGENCIA UI: 
        // Mostrar el selector si hay clases viejas válidas O si hay estilos en el ID para migrar.
        elementsToProcess.forEach(el => {
            if (el && el.settings) {
                // 1. ¿Hay clases reales?
                if (el.settings._cssGlobalClasses) {
                    try {
                        const classIds = Object.values(el.settings._cssGlobalClasses);
                        for (let i = 0; i < classIds.length; i++) {
                            const cid = classIds[i];
                            if (typeof cid === 'string' && cid.trim() !== '') {
                                const realClass = state.globalClasses.find(gc => gc.id === cid);
                                if (realClass && realClass.name && realClass.name.trim() !== '') {
                                    showActionSelect = true;
                                }
                            }
                        }
                    } catch(e) {}
                }
                
                // 2. ¿Hay estilos en el ID para migrar?
                Object.keys(el.settings).forEach(key => {
                    if (!contentBlacklist.includes(key)) {
                        showActionSelect = true;
                    }
                });
            }
        });
        
        const panel = document.createElement('div');
        panel.className = 'bbem-draggable-panel';
        
        let rowsHtml = '';
        elementsToProcess.forEach(el => {
            const rawLabel = el.label || el.name || 'element';
            const safeLabel = escapeHtml(rawLabel); 
            const safeBlockClass = escapeHtml(blockClass);
            const type = el.id === rootId ? 'BLOCK' : 'ELEMENT';
            const depth = el.depth || 0;
            const isBlock = el.id === rootId;
            const elementSlug = slugify(safeLabel);
            const hideModsClass = userSettings.showModifiers ? '' : 'hide-mods';

            let classWrapperHtml = '';
            if (isBlock) {
                classWrapperHtml = `<div class="bbem-class-wrapper"><input type="text" class="bbem-class-name inner-input" value="${safeBlockClass}" data-is-block="true"></div>`;
            } else {
                classWrapperHtml = `<div class="bbem-class-wrapper"><span class="bbem-block-prefix">${safeBlockClass}__</span><input type="text" class="bbem-class-name inner-input" value="${elementSlug}" data-is-block="false"></div>`;
            }

            rowsHtml += `
                <div class="bbem-row" data-id="${el.id}">
                    <div class="bbem-indent-wrapper bbem-indent-${Math.min(depth, 3)}">
                        <div class="bbem-label-group"><span class="bbem-original-name">${safeLabel}</span><span class="bbem-tag">${type}</span></div>
                        <div class="bbem-input-group ${hideModsClass}">
                            ${classWrapperHtml}
                            <input type="text" class="bbem-input bbem-modifier" placeholder="mod">
                        </div>
                    </div>
                    <div class="bbem-checkbox-col"><input type="checkbox" class="bbem-include-checkbox" checked title="Include"></div>
                </div>`;
        });

        let actionSelectHtml = '';
        if (showActionSelect) {
            actionSelectHtml = `
                <select id="bbem-class-action" class="bbem-select">
                    <option value="rename" ${userSettings.classAction === 'rename' ? 'selected' : ''}>Rename classes</option>
                    <option value="remove" ${userSettings.classAction === 'remove' ? 'selected' : ''}>Create new & remove old</option>
                    <option value="delete" ${userSettings.classAction === 'delete' ? 'selected' : ''}>Create new & delete old</option>
                    <option value="keep" ${userSettings.classAction === 'keep' ? 'selected' : ''}>Create new & keep old</option>
                    <option value="copy-id" ${userSettings.classAction === 'copy-id' ? 'selected' : ''}>Copy ID styles to Class</option>
                </select>
            `;
        }

        const bodyClass = userSettings.showLabels ? '' : 'hide-labels';
        const toolbarClass = userSettings.showModifiers ? 'mods-active' : '';
        const modBtnClass = userSettings.showModifiers ? 'active' : '';
        const baseLabelSafe = escapeHtml(baseLabel); 

        panel.innerHTML = `
            <div class="bbem-header" id="bbem-drag-handle">
                <h2>BEM: ${baseLabelSafe}</h2>
                <button class="bbem-close">&times;</button>
            </div>
            <div class="bbem-toolbar ${toolbarClass}">
                <div class="bbem-general-group">
                    ${actionSelectHtml}
                    <label class="bbem-toggle-group"><div class="bbem-switch"><input type="checkbox" id="bbem-toggle-sync" ${userSettings.syncLabels ? 'checked' : ''}><span class="bbem-slider"></span></div><span class="bbem-toggle-label">Sync</span></label>
                </div>
                <div class="bbem-separator"></div>
                <button class="bbem-text-toggle ${modBtnClass}" id="bbem-toggle-mods-vis">MODIFIER</button>
                <span class="bbem-toggle-label" id="bbem-select-all-btn" style="margin-left:auto; cursor:pointer; color:var(--bbem-accent);">None</span>
            </div>
            <div class="bbem-body ${bodyClass}">${rowsHtml}</div>
            <div class="bbem-footer">
                <div class="bbem-footer-left">
                    <label class="bbem-toggle-group"><div class="bbem-switch"><input type="checkbox" id="bbem-toggle-labels" ${userSettings.showLabels ? 'checked' : ''}><span class="bbem-slider"></span></div><span class="bbem-toggle-label">Labels</span></label>
                </div>
                <div class="bbem-footer-right">
                    <button class="bbem-btn bbem-btn-secondary bbem-close-btn">Cancel</button>
                    <button class="bbem-btn bbem-btn-primary" id="bbem-apply">Apply</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        
        const structurePanel = document.getElementById('bricks-structure');
        let left = 350, top = 100;
        if (structurePanel) {
            const rect = structurePanel.getBoundingClientRect();
            left = rect.right + 10;
            top = rect.top + 40;
        }
        if (left + 440 > window.innerWidth) left = window.innerWidth - 440 - 20;
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        requestAnimationFrame(() => { panel.style.opacity = '1'; });
        
        setupDraggable(panel);
        setupInteractions(panel);
    }

    function setupDraggable(element) {
        const header = element.querySelector('#bbem-drag-handle');
        if (!header) return;
        let isDragging = false, startX, startY, initialLeft, initialTop;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.bbem-close')) return;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            const rect = element.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            element.style.transform = 'none';
            header.style.cursor = 'grabbing'; document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return; e.preventDefault();
            element.style.left = `${initialLeft + (e.clientX - startX)}px`;
            element.style.top = `${initialTop + (e.clientY - startY)}px`;
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; header.style.cursor = 'grab'; document.body.style.userSelect = ''; }
        });
    }

    function setupInteractions(panel) {
        const toolbar = panel.querySelector('.bbem-toolbar');
        
        const actionSelect = panel.querySelector('#bbem-class-action');
        if (actionSelect) {
            actionSelect.addEventListener('change', (e) => {
                userSettings.classAction = e.target.value;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
            });
        }

        const saveSetting = (id, key) => {
            const el = panel.querySelector(id);
            if(el) { el.addEventListener('change', (e) => { userSettings[key] = e.target.checked; localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings)); }); }
        };
        saveSetting('#bbem-toggle-sync', 'syncLabels');

        const labelsToggle = panel.querySelector('#bbem-toggle-labels');
        const bodyEl = panel.querySelector('.bbem-body');
        if(labelsToggle) {
            labelsToggle.addEventListener('change', (e) => {
                userSettings.showLabels = e.target.checked;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                e.target.checked ? bodyEl.classList.remove('hide-labels') : bodyEl.classList.add('hide-labels');
            });
        }

        const modVisBtn = panel.querySelector('#bbem-toggle-mods-vis');
        if(modVisBtn) {
            modVisBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const isActive = modVisBtn.classList.toggle('active');
                userSettings.showModifiers = isActive;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                panel.querySelectorAll('.bbem-input-group').forEach(g => isActive ? g.classList.remove('hide-mods') : g.classList.add('hide-mods'));
                isActive ? toolbar.classList.add('mods-active') : toolbar.classList.remove('mods-active');
            });
        }

        const blockInput = panel.querySelector('input[data-is-block="true"]');
        if (blockInput) {
            blockInput.addEventListener('input', (e) => {
                const newBlockName = slugify(e.target.value);
                panel.querySelectorAll('.bbem-block-prefix').forEach(prefix => {
                    prefix.textContent = newBlockName ? `${newBlockName}__` : '';
                });
            });
        }

        panel.querySelectorAll('.bbem-class-name').forEach(input => {
            input.addEventListener('input', (e) => {
                const wrapper = e.target.closest('.bbem-class-wrapper');
                if (wrapper) {
                    if (!e.target.value.trim()) {
                        wrapper.classList.add('bbem-input-error');
                    } else {
                        wrapper.classList.remove('bbem-input-error');
                        wrapper.classList.remove('bbem-shake');
                    }
                }
            });
        });

        panel.querySelectorAll('.bbem-class-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', () => {
                const input = wrapper.querySelector('input');
                if (input) input.focus();
            });
        });

        const selectAllBtn = panel.querySelector('#bbem-select-all-btn');
        if(selectAllBtn) {
            let allSelected = true;
            selectAllBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                allSelected = !allSelected;
                panel.querySelectorAll('.bbem-include-checkbox').forEach(cb => {
                    cb.checked = allSelected;
                    const row = cb.closest('.bbem-row');
                    const wrapper = row.querySelector('.bbem-class-wrapper');
                    const input = row.querySelector('.bbem-class-name');
                    
                    if (allSelected) {
                        row.classList.remove('disabled');
                        if (input && !input.value.trim() && wrapper) wrapper.classList.add('bbem-input-error');
                    } else {
                        row.classList.add('disabled');
                        if (wrapper) { wrapper.classList.remove('bbem-input-error'); wrapper.classList.remove('bbem-shake'); }
                    }
                });
                selectAllBtn.textContent = allSelected ? "None" : "All";
            });
        }
        
        panel.querySelectorAll('.bbem-include-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const row = e.target.closest('.bbem-row');
                const wrapper = row.querySelector('.bbem-class-wrapper');
                const input = row.querySelector('.bbem-class-name');

                if (e.target.checked) {
                    row.classList.remove('disabled');
                    if (input && !input.value.trim() && wrapper) wrapper.classList.add('bbem-input-error');
                } else {
                    row.classList.add('disabled');
                    if (wrapper) { wrapper.classList.remove('bbem-input-error'); wrapper.classList.remove('bbem-shake'); }
                }
            });
        });

        const closePanel = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            panel.remove();
        };

        panel.querySelectorAll('.bbem-close, .bbem-close-btn').forEach(btn => {
            btn.addEventListener('click', closePanel);
        });
        
        const applyBtn = panel.querySelector('#bbem-apply');
        if(applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                let isValid = true;
                
                panel.querySelectorAll('.bbem-row').forEach(row => {
                    if (!row.querySelector('.bbem-include-checkbox').checked) return;
                    const inputEl = row.querySelector('.bbem-class-name');
                    const wrapper = row.querySelector('.bbem-class-wrapper');
                    
                    if (!inputEl.value.trim()) {
                        isValid = false;
                        wrapper.classList.add('bbem-input-error');
                        wrapper.classList.remove('bbem-shake');
                        void wrapper.offsetWidth; 
                        wrapper.classList.add('bbem-shake');
                    } else {
                        wrapper.classList.remove('bbem-input-error');
                        wrapper.classList.remove('bbem-shake');
                    }
                });

                if (isValid) {
                    applyClasses(panel);
                    closePanel();
                }
            });
        }
    }

    function applyClasses(panel) {
        let count = 0;
        const state = getBricksState();
        const shouldSyncLabel = panel.querySelector('#bbem-toggle-sync').checked;
        const actionSelect = panel.querySelector('#bbem-class-action');
        const userAction = actionSelect ? actionSelect.value : 'rename';

        panel.querySelectorAll('.bbem-row').forEach(row => {
            if (!row.querySelector('.bbem-include-checkbox').checked) return;
            
            const id = row.dataset.id;
            const inputEl = row.querySelector('.bbem-class-name');
            const isBlockInput = inputEl.dataset.isBlock === 'true';
            const rawValue = slugify(inputEl.value);
            
            let clsInput = rawValue;
            if (!isBlockInput) {
                const prefixEl = row.querySelector('.bbem-block-prefix');
                const prefix = prefixEl ? prefixEl.textContent : '';
                clsInput = prefix + rawValue;
            }

            const modInput = row.querySelector('.bbem-modifier').value.trim();
            if (!clsInput) return;

            let cleanMod = modInput;
            if (cleanMod && !cleanMod.startsWith('--')) cleanMod = '--' + cleanMod;
            const isModifierOperation = !!cleanMod;

            const finalClassName = isModifierOperation ? `${clsInput}${cleanMod}` : clsInput;
            const element = findElement(id);
            
            if (element) {
                if (!element.settings) element.settings = {};
                if (!Array.isArray(element.settings._cssGlobalClasses)) element.settings._cssGlobalClasses = [];
                
                const oldClassIds = element.settings._cssGlobalClasses.filter(cid => cid && cid.trim() !== '');
                let actionToApply = isModifierOperation ? 'keep' : userAction;

                let newGlobalClass = state.globalClasses.find(gc => gc.name === finalClassName);
                let isNewClassCreated = false;
                
                if (!newGlobalClass) {
                    newGlobalClass = { id: Math.random().toString(36).slice(2, 8), name: finalClassName, settings: {} };
                    state.globalClasses.push(newGlobalClass);
                    isNewClassCreated = true;
                }

                // LÓGICA MIGRACIÓN DE ESTILOS DEL ID A LA CLASE BEM
                if (actionToApply === 'copy-id') {
                    Object.keys(element.settings).forEach(key => {
                        // Si la propiedad NO está en la lista negra, es un estilo CSS.
                        if (!contentBlacklist.includes(key)) {
                            // Clonamos el estilo a la nueva clase BEM
                            newGlobalClass.settings[key] = JSON.parse(JSON.stringify(element.settings[key]));
                            // Eliminamos el estilo del ID del elemento para dejarlo limpio
                            delete element.settings[key];
                        }
                    });
                }

                // Lógica de clonado para RENAME
                if (actionToApply === 'rename' && oldClassIds.length > 0 && isNewClassCreated) {
                    const firstOldClassId = oldClassIds[0];
                    const firstOldClassObj = state.globalClasses.find(gc => gc.id === firstOldClassId);
                    if (firstOldClassObj && firstOldClassObj.settings) {
                        newGlobalClass.settings = JSON.parse(JSON.stringify(firstOldClassObj.settings));
                    }
                }

                // Borrar clases viejas globalmente si toca
                if (actionToApply === 'delete' || actionToApply === 'rename') {
                    oldClassIds.forEach(idToRemove => {
                        const idx = state.globalClasses.findIndex(gc => gc.id === idToRemove);
                        if (idx !== -1) {
                            state.globalClasses.splice(idx, 1);
                        }
                    });
                }

                // Asignar clases al elemento
                element.settings._cssGlobalClasses.splice(0, element.settings._cssGlobalClasses.length);

                if (actionToApply === 'keep') {
                    oldClassIds.forEach(oldId => element.settings._cssGlobalClasses.push(oldId));
                    if (!element.settings._cssGlobalClasses.includes(newGlobalClass.id)) {
                        element.settings._cssGlobalClasses.push(newGlobalClass.id);
                    }
                } else {
                    // Para RENAME, REMOVE, DELETE y COPY-ID: El elemento queda solo con la nueva clase
                    element.settings._cssGlobalClasses.push(newGlobalClass.id);
                }

                count++;

                if (shouldSyncLabel && !isModifierOperation) {
                    const blockName = panel.querySelector('input[data-is-block="true"]').value.trim();
                    let newLabel = formatLabel(finalClassName, blockName);
                    if (!newLabel || newLabel.trim() === '') newLabel = finalClassName.replace(/-/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase());
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

        // Refrescar entorno de Bricks
        if (count > 0 || shouldSyncLabel || userAction !== 'keep') {
            state.globalClasses.push({});
            setTimeout(() => state.globalClasses.pop(), 50);
        }
    }
});