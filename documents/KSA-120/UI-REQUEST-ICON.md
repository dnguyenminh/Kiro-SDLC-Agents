# UI Design Request — Activity Bar Icon

## KSA-120: Kiro SDLC Extension Icon

---

| Field | Value |
|-------|-------|
| Requested By | BA Agent |
| For | KSA-120 — Extension Activity Bar Icon |
| Priority | High (blocks USER-GUIDE finalization) |
| Date | 2025-05-23 |

---

## Yêu cầu

Thiết kế **1 icon SVG** cho Activity Bar (sidebar trái VS Code) đại diện cho extension "Kiro SDLC Agents".

## Concept

Merge 2 ý tưởng:
- **Brain (🧠)** — đại diện Knowledge Base, AI intelligence
- **Kiro branding** — nhận diện extension thuộc hệ sinh thái Kiro

## Specifications

| Attribute | Value |
|-----------|-------|
| Format | SVG (monochrome, single path) |
| Size | 24x24px (VS Code Activity Bar standard) |
| Colors | Monochrome — VS Code tự apply theme color (active/inactive) |
| Style | Line art, clean, minimal — phù hợp VS Code icon language |
| States | Normal, Active (VS Code handles via CSS), Warning (overlay badge) |

## Design Direction

- Brain outline kết hợp với chữ "K" hoặc Kiro logo mark
- Hoặc: Brain silhouette với circuit/node pattern bên trong (gợi ý knowledge graph)
- Phải nhận diện được ở kích thước nhỏ (24x24)
- Không quá chi tiết — VS Code icons đều minimalist

## Warning State

Khi config lỗi, VS Code sẽ hiển thị badge overlay (⚠️) trên icon. Không cần thiết kế warning state riêng — chỉ cần icon base đủ rõ ràng khi có badge chồng lên.

## Deliverables

1. `sidebar-icon.svg` — Icon chính cho Activity Bar
2. `icon.png` — 128x128 PNG cho extension marketplace listing (có thể có màu)

## Reference

- VS Code built-in icons: Explorer (📁), Search (🔍), Source Control (branch icon)
- Style guide: https://code.visualstudio.com/api/references/icons-in-labels
- Current placeholder: emoji 🧠 (cần thay bằng custom SVG)

## Context

Icon này xuất hiện ở:
- Activity Bar (sidebar trái) — điểm truy cập chính vào extension
- Extension marketplace listing
- USER-GUIDE documentation (screenshots)
