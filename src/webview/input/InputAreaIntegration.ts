/**
 * InputAreaIntegration — Wires context menu into the existing input field
 * KSA-252
 */

import { ContextMenuController } from '../context-menu/ContextMenuController';
import { BadgeRenderer } from '../badges/BadgeRenderer';
import { MessageBridge } from '../bridge/MessageBridge';
import type { ContextTagBadge } from '../../shared/protocol';
import type { VsCodeApi } from '../bridge/types';

export interface InputAreaIntegrationOptions {
  inputElement: HTMLElement;
  containerElement: HTMLElement;
  badgeContainer: HTMLElement;
  vscodeApi: VsCodeApi;
}

export class InputAreaIntegration {
  private controller: ContextMenuController;
  private badgeContainer: HTMLElement;
  private inputElement: HTMLElement;
  private hashDetectionEnabled = true;

  constructor(options: InputAreaIntegrationOptions) {
    this.inputElement = options.inputElement;
    this.badgeContainer = options.badgeContainer;

    const bridge = new MessageBridge(options.vscodeApi);

    this.controller = new ContextMenuController(
      {
        container: options.containerElement,
        inputElement: options.inputElement,
        onBadgeInsert: (badge) => this.renderBadge(badge),
        onClose: () => this.onMenuClose(),
      },
      bridge
    );

    this.setupListeners();
  }

  private setupListeners(): void {
    // Detect "#" typed in input
    this.inputElement.addEventListener('input', (e) => {
      if (!this.hashDetectionEnabled) return;
      const event = e as InputEvent;
      if (event.data === '#' && !this.controller.isOpen()) {
        this.controller.open();
      } else if (this.controller.isOpen()) {
        this.updateFilter();
      }
    });

    // Key events for menu navigation
    this.inputElement.addEventListener('keydown', (e) => {
      if (this.controller.isOpen()) {
        const handled = this.controller.handleKeyDown(e as KeyboardEvent);
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // Outside click detection
    document.addEventListener('mousedown', (e) => {
      if (!this.controller.isOpen()) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu') && !target.closest('.picker-panel')) {
        this.controller.close();
      }
    });

    // Badge backspace removal
    this.inputElement.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Backspace' && !this.controller.isOpen()) {
        this.handleBadgeBackspace();
      }
    });
  }

  private updateFilter(): void {
    // Extract text after the last "#"
    const text = this.inputElement.textContent || '';
    const lastHash = text.lastIndexOf('#');
    if (lastHash >= 0) {
      const filterText = text.substring(lastHash + 1);
      this.controller.filter(filterText);
    }
  }

  private renderBadge(badge: ContextTagBadge): void {
    const renderer = this.controller.getBadgeRenderer();
    const el = renderer.createBadgeElement(badge);
    this.badgeContainer.appendChild(el);

    // Remove "#..." text from input
    this.removeHashText();
  }

  private removeHashText(): void {
    const text = this.inputElement.textContent || '';
    const lastHash = text.lastIndexOf('#');
    if (lastHash >= 0) {
      this.inputElement.textContent = text.substring(0, lastHash);
    }
  }

  private handleBadgeBackspace(): void {
    // If cursor is at the beginning or adjacent to badge, remove last badge
    const badges = this.controller.getBadgeManager().getAll();
    if (badges.length > 0) {
      const selection = window.getSelection();
      if (selection && selection.anchorOffset === 0) {
        const lastBadge = badges[badges.length - 1];
        this.controller.getBadgeManager().remove(lastBadge.id);
        BadgeRenderer.removeBadgeElement(this.badgeContainer, lastBadge.id);
      }
    }
  }

  private onMenuClose(): void {
    this.inputElement.focus();
  }

  getController(): ContextMenuController {
    return this.controller;
  }

  /**
   * Get all current context badges for message submission
   */
  async getResolvedContexts() {
    return this.controller.getBadgeManager().resolveAll();
  }

  dispose(): void {
    this.controller.dispose();
  }
}
