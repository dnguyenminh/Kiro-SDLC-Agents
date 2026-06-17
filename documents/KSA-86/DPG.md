# Deployment Guide (DPG)

## KSA-86: Frontend HTML Update (Dashboard, Tags, Quality, Analytics Pages)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-86 |
| Title | Frontend HTML Update — Dashboard, Tags, Quality, Analytics Pages |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-15 |
| Status | Final |

---

## 1. Overview

### 1.1 Feature Summary

Updated KB Web Viewer frontend pages: added auto-suggestions/typeahead on Tags page, due reviews/reminders on Dashboard, and most-cited entries on Quality page. Python-only viewer implementation.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| viewer_tags_html.py | Modified | Typeahead search on Tags |
| viewer_dashboard_html.py | Modified | Reminders section |
| viewer_quality_html.py | Modified | Most cited entries section |
| kb_viewer_routes.py | Modified | New /api/kb/citations/most route |

### 1.3 Target Environments

| Environment | Deploy Order |
|-------------|-------------|
| DEV (local Python server) | 1st |
| Production | 2nd |

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Python 3.11+ | Runtime |
| KB entries exist | Data for citations/reminders |

---

## 3. Pre-Deployment Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Typeahead works on Tags page | Done |
| 2 | Reminders display on Dashboard | Done |
| 3 | Citations section on Quality page | Done |
| 4 | New API route returns data | Done |

---

## 4. Database Migration

Not applicable — reads from existing KB data.

---

## 5. Application Deployment

### 5.1 Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Deploy updated Python files | Files in place |
| 2 | Restart Python server | Server starts |
| 3 | Access Dashboard | Reminders section visible |
| 4 | Access Tags page | Typeahead working |
| 5 | Access Quality page | Citations section visible |
| 6 | Call /api/kb/citations/most | Returns data |

---

## 6. Configuration Changes

No configuration changes.

---

## 7. Post-Deployment Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Dashboard page | Shows due reviews/reminders |
| 2 | Tags page search | Auto-suggestions appear |
| 3 | Quality page | Most cited entries listed |
| 4 | API endpoint | /api/kb/citations/most returns JSON |

---

## 8. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert the 4 modified Python files |
| 2 | Restart server |

Rollback Time: ~2 minutes.
