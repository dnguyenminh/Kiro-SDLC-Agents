/**
 * SlashMenuView — DOM rendering for the slash command popup
 * KSA-254
 *
 * Two-section layout: Agents (top) + Steering Rules (bottom)
 * Section headers are non-selectable (BR-08, BR-20)
 * Max height 400px, scrollable (TDD §7)
 */
export class SlashMenuView {
    container;
    menuEl = null;
    highlightedIndex = -1;
    selectableItems = [];
    constructor(container) {
        this.container = container;
    }
    /**
     * Render the two-section popup (BR-06: Agents first, Steering second)
     */
    render(agents, steering, anchorRect) {
        this.destroy();
        this.selectableItems = [...agents, ...steering];
        this.menuEl = document.createElement('div');
        this.menuEl.id = 'slash-command-popup';
        this.menuEl.className = 'context-menu slash-menu';
        this.menuEl.setAttribute('role', 'listbox');
        this.menuEl.setAttribute('aria-label', 'Slash commands');
        // Agents section
        if (agents.length > 0) {
            this.menuEl.appendChild(this.createSectionHeader('AGENTS'));
            agents.forEach((item, index) => {
                const el = this.createItemElement(item, index);
                this.menuEl.appendChild(el);
            });
        }
        // Steering section
        if (steering.length > 0) {
            this.menuEl.appendChild(this.createSectionHeader('STEERING RULES'));
            steering.forEach((item, index) => {
                const globalIndex = agents.length + index;
                const el = this.createItemElement(item, globalIndex);
                this.menuEl.appendChild(el);
            });
        }
        // No items at all
        if (agents.length === 0 && steering.length === 0) {
            this.showEmptyState();
        }
        // Position above input
        this.menuEl.style.position = 'absolute';
        this.menuEl.style.bottom = `${this.container.clientHeight - anchorRect.top + 4}px`;
        this.menuEl.style.left = `${anchorRect.left}px`;
        this.menuEl.style.maxHeight = '400px';
        this.menuEl.style.overflowY = 'auto';
        this.container.appendChild(this.menuEl);
        // Highlight first item (BR-11)
        if (this.selectableItems.length > 0) {
            this.setHighlight(0);
        }
    }
    /**
     * Update items after filter change (BR-14: hide empty section headers)
     */
    updateItems(agents, steering) {
        if (!this.menuEl)
            return;
        this.selectableItems = [...agents, ...steering];
        this.menuEl.innerHTML = '';
        if (agents.length > 0) {
            this.menuEl.appendChild(this.createSectionHeader('AGENTS'));
            agents.forEach((item, index) => {
                this.menuEl.appendChild(this.createItemElement(item, index));
            });
        }
        if (steering.length > 0) {
            this.menuEl.appendChild(this.createSectionHeader('STEERING RULES'));
            steering.forEach((item, index) => {
                const globalIndex = agents.length + index;
                this.menuEl.appendChild(this.createItemElement(item, globalIndex));
            });
        }
        if (agents.length === 0 && steering.length === 0) {
            this.showEmptyState();
            this.highlightedIndex = -1;
        }
        else {
            this.setHighlight(0);
        }
    }
    createSectionHeader(text) {
        const header = document.createElement('div');
        header.className = 'slash-menu__section-header';
        header.setAttribute('role', 'presentation');
        header.textContent = text;
        return header;
    }
    createItemElement(item, index) {
        const el = document.createElement('div');
        el.className = 'context-menu-item slash-menu__item';
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', 'false');
        el.dataset.index = String(index);
        el.dataset.itemId = item.id;
        const descHtml = item.description
            ? `<span class="context-menu-item__sublabel">${this.escapeHtml(item.description)}</span>`
            : '';
        el.innerHTML = `
      <span class="context-menu-item__icon">${item.icon}</span>
      <span class="context-menu-item__label">${this.escapeHtml(item.label)}</span>
      ${descHtml}
    `;
        return el;
    }
    showEmptyState() {
        if (!this.menuEl)
            return;
        const empty = document.createElement('div');
        empty.className = 'context-menu-empty';
        empty.textContent = 'No matching commands';
        this.menuEl.appendChild(empty);
    }
    setHighlight(index) {
        if (!this.menuEl)
            return;
        // Clear previous
        const prev = this.menuEl.querySelector('.context-menu-item--highlighted');
        if (prev) {
            prev.classList.remove('context-menu-item--highlighted');
            prev.setAttribute('aria-selected', 'false');
        }
        this.highlightedIndex = index;
        const itemEls = this.menuEl.querySelectorAll('.context-menu-item');
        if (index >= 0 && index < itemEls.length) {
            const el = itemEls[index];
            el.classList.add('context-menu-item--highlighted');
            el.setAttribute('aria-selected', 'true');
            el.scrollIntoView({ block: 'nearest' });
        }
    }
    /**
     * Move highlight up/down, wrapping at boundaries (BR-18, BR-19)
     * Section headers are automatically skipped (they have no .context-menu-item class)
     */
    moveHighlight(direction) {
        const count = this.selectableItems.length;
        if (count === 0)
            return -1;
        let next;
        if (direction === 'down') {
            next = this.highlightedIndex < count - 1 ? this.highlightedIndex + 1 : 0;
        }
        else {
            next = this.highlightedIndex > 0 ? this.highlightedIndex - 1 : count - 1;
        }
        this.setHighlight(next);
        return next;
    }
    getHighlightedItem() {
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.selectableItems.length) {
            return this.selectableItems[this.highlightedIndex];
        }
        return null;
    }
    getItemAtIndex(index) {
        return this.selectableItems[index] ?? null;
    }
    getSelectableCount() {
        return this.selectableItems.length;
    }
    isVisible() {
        return this.menuEl !== null && this.menuEl.parentElement !== null;
    }
    destroy() {
        if (this.menuEl && this.menuEl.parentElement) {
            this.menuEl.parentElement.removeChild(this.menuEl);
        }
        this.menuEl = null;
        this.highlightedIndex = -1;
        this.selectableItems = [];
    }
    getElement() {
        return this.menuEl;
    }
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
//# sourceMappingURL=SlashMenuView.js.map